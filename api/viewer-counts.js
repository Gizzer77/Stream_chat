// Viewer counts — Twitch Helix API (requires TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET env vars)

let cachedToken = null
let tokenExpiry  = 0

async function getTwitchToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const clientId     = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  })
  if (!res.ok) return null
  const data    = await res.json()
  cachedToken   = data.access_token
  tokenExpiry   = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { platform, channel } = req.query
  if (!channel) { res.status(400).json({ error: 'Missing channel' }); return }

  if (platform === 'twitch') {
    const token    = await getTwitchToken()
    const clientId = process.env.TWITCH_CLIENT_ID
    if (!token || !clientId) {
      res.status(200).json({ viewers: 0, live: false, title: '', note: 'Set TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET in Vercel env vars' })
      return
    }

    try {
      const streamRes = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId } }
      )
      const streamData = await streamRes.json()
      const stream     = streamData.data?.[0]
      res.status(200).json({
        viewers: stream?.viewer_count || 0,
        live:    !!stream,
        title:   stream?.title || '',
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(400).json({ error: 'Unsupported platform' })
}
