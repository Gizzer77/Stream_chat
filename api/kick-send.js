// Kick chat send. Kick's public API needs the broadcaster_user_id; if the
// client didn't pass one, we look up the token owner's id and send to their
// own channel.
async function getOwnUserId(token) {
  try {
    const r = await fetch('https://api.kick.com/public/v1/users', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!r.ok) return null
    const d = await r.json()
    return d?.data?.[0]?.user_id ?? d?.data?.user_id ?? d?.user_id ?? null
  } catch (_) { return null }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const { content, accessToken } = req.body || {}
  let { broadcasterUserId } = req.body || {}
  if (!content || !accessToken) { res.status(400).json({ error: 'Missing content or accessToken' }); return }

  try {
    if (!broadcasterUserId) broadcasterUserId = await getOwnUserId(accessToken)

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
      if (r.status === 403 || r.status === 401) msg += ' — your Kick login may be missing the chat:write scope; reconnect Kick.'
      res.status(400).json({ error: msg }); return
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
