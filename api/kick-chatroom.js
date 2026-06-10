// Resolve a Kick channel's chatroom id (needed to read chat over Pusher).
// Kick sits behind Cloudflare and blocks plain server fetches (403), so we try
// the official authenticated API first (if a token is passed), then the v2/v1
// endpoints with full browser-like headers.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { channel, token } = req.query
  if (!channel || !/^[a-zA-Z0-9_-]+$/.test(channel)) return res.status(400).json({ error: 'Invalid channel name' })

  const browser = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `https://kick.com/${channel}`,
  }
  const attempts = []
  if (token) attempts.push({ url: `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(channel)}`, headers: { ...browser, Authorization: `Bearer ${token}` } })
  attempts.push({ url: `https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, headers: browser })
  attempts.push({ url: `https://kick.com/api/v1/channels/${encodeURIComponent(channel)}`, headers: browser })

  let lastStatus = 0, lastBody = ''
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, { headers: a.headers })
      lastStatus = r.status
      if (!r.ok) { lastBody = (await r.text()).slice(0, 120); continue }
      const d = await r.json()
      const id = d.chatroom?.id ?? d.chatroom_id ?? d.data?.[0]?.chatroom?.id ?? d.data?.chatroom?.id ?? d.data?.[0]?.chatroom_id
      const broadcaster = d.broadcaster_user_id ?? d.data?.[0]?.broadcaster_user_id ?? d.user_id ?? null
      if (id) return res.status(200).json({ chatroomId: id, broadcasterUserId: broadcaster })
      lastBody = 'no chatroom id in response'
    } catch (e) { lastBody = e.message }
  }
  return res.status(lastStatus === 403 ? 403 : 502).json({ error: `Kick lookup failed (status ${lastStatus}). Kick's bot protection blocks server lookups.`, detail: lastBody })
}
