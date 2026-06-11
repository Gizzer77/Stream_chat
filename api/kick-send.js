// Kick chat send.
// To post into a channel, Kick's public API needs that channel's broadcaster_user_id.
// The client passes the channel SLUG; we resolve the id server-side via the
// authenticated api.kick.com endpoint (NOT kick.com, which Cloudflare blocks).
// If we can't resolve a target channel, we fall back to the token owner's own channel.

async function getJson(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  const text = await r.text()
  let d = {}; try { d = JSON.parse(text) } catch (_) { d = { raw: text.slice(0, 200) } }
  return { ok: r.ok, status: r.status, d }
}

async function resolveBroadcasterId(token, slug) {
  if (!slug) return null
  const { ok, d } = await getJson(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`, token)
  if (!ok) return null
  return d?.data?.[0]?.broadcaster_user_id ?? d?.data?.[0]?.user_id ?? null
}

async function getOwnUserId(token) {
  const { ok, d } = await getJson('https://api.kick.com/public/v1/users', token)
  if (!ok) return null
  return d?.data?.[0]?.user_id ?? d?.data?.user_id ?? d?.user_id ?? null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const { content, accessToken, channel } = req.body || {}
  let { broadcasterUserId } = req.body || {}
  if (!content || !accessToken) { res.status(400).json({ error: 'Missing content or accessToken' }); return }

  try {
    let target = 'channel ' + (channel || '?')
    // 1) explicit id from client  2) resolve from slug  3) fall back to own channel
    if (!broadcasterUserId && channel) broadcasterUserId = await resolveBroadcasterId(accessToken, channel)
    if (!broadcasterUserId) { broadcasterUserId = await getOwnUserId(accessToken); target = 'your own channel (could not resolve ' + (channel || 'target') + ')' }

    const body = { content, type: 'user' }
    if (broadcasterUserId) body.broadcaster_user_id = broadcasterUserId

    const r = await fetch('https://api.kick.com/public/v1/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    let d = {}; try { d = JSON.parse(text) } catch (_) { d = { raw: text.slice(0, 200) } }
    if (!r.ok) {
      let msg = d.message || d.error || `Kick ${r.status}: ${d.raw || ''}`
      if (r.status === 403 || r.status === 401) msg += ' — reconnect Kick (login may lack chat:write, or token expired).'
      if (r.status === 400 && !broadcasterUserId) msg += ' — could not find the channel to post to.'
      res.status(400).json({ error: msg, status: r.status }); return
    }
    res.status(200).json({ ok: true, sentTo: target, broadcasterUserId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
