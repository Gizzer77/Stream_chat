// Kick chat send (best-effort) via Kick's public API.
// Requires a Kick OAuth token with chat:write scope. Kick's send endpoint is
// finicky; we surface the exact error so the UI can show what went wrong.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const { content, accessToken, broadcasterUserId } = req.body || {}
  if (!content || !accessToken) { res.status(400).json({ error: 'Missing content or accessToken' }); return }

  try {
    const body = { content, type: 'user' }
    if (broadcasterUserId) body.broadcaster_user_id = broadcasterUserId
    const r = await fetch('https://api.kick.com/public/v1/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    let d = {}; try { d = JSON.parse(text) } catch (_) { d = { raw: text.slice(0, 200) } }
    if (!r.ok) { res.status(400).json({ error: d.message || d.error || `Kick ${r.status}: ${d.raw || ''}` }); return }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
