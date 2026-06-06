// Vercel serverless function — proxies Kick's channel API to avoid CORS in the browser

export default async function handler(req, res) {
  const { channel } = req.query

  // CORS headers so the React app can call this
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  if (!channel || typeof channel !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(channel)) {
    return res.status(400).json({ error: 'Invalid channel name' })
  }

  try {
    const response = await fetch(`https://kick.com/api/v1/channels/${channel}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'application/json',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `Kick returned ${response.status}` })
    }

    const data = await response.json()
    const chatroomId = data.chatroom?.id

    if (!chatroomId) {
      return res.status(404).json({ error: 'Channel not found or has no chatroom' })
    }

    return res.status(200).json({ chatroomId })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
