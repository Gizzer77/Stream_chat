// Post a tweet via X API v2 (proxied to avoid CORS)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const { text, accessToken } = req.body || {}
  if (!text || !accessToken) {
    res.status(400).json({ error: 'Missing text or accessToken' }); return
  }
  if (text.length > 280) {
    res.status(400).json({ error: 'Tweet exceeds 280 characters' }); return
  }

  try {
    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    const data = await r.json()
    if (!r.ok) {
      res.status(400).json({ error: data.detail || data.title || JSON.stringify(data) }); return
    }
    res.status(200).json({ ok: true, id: data.data?.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
