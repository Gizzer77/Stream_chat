// Twitch live viewer counts.
// Primary method: Twitch's public GraphQL endpoint with the well-known public
// web Client-ID — needs NO login and NO server secret (this is what most
// viewer-count tools use). Falls back to the Helix API if GQL ever fails AND
// server credentials happen to be set.

const PUBLIC_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

async function gqlViewers(channel) {
  const body = JSON.stringify({
    query: 'query($login:String!){ user(login:$login){ stream { viewersCount type } broadcastSettings { title } } }',
    variables: { login: channel },
  })
  const r = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: { 'Client-ID': PUBLIC_GQL_CLIENT_ID, 'Content-Type': 'application/json' },
    body,
  })
  if (!r.ok) throw new Error(`gql ${r.status}`)
  const d = await r.json()
  const user = d?.data?.user
  if (!user) throw new Error('no user')
  const stream = user.stream
  return { viewers: stream?.viewersCount || 0, live: !!stream, title: user.broadcastSettings?.title || '' }
}

// ── Helix fallback (only if server creds exist) ────────────────────────────────
let cachedToken = null, tokenExpiry = 0
async function getTwitchToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const clientId = process.env.TWITCH_CLIENT_ID, clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  })
  if (!res.ok) return null
  const data = await res.json()
  cachedToken = data.access_token; tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { platform, channel } = req.query
  if (!channel) { res.status(400).json({ error: 'Missing channel' }); return }
  if (platform !== 'twitch') { res.status(400).json({ error: 'Unsupported platform' }); return }

  // 1) Public GraphQL — no creds needed.
  try {
    const out = await gqlViewers(channel)
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40')
    res.status(200).json(out)
    return
  } catch (gqlErr) {
    // 2) Helix fallback if creds are configured.
    const token = await getTwitchToken(), clientId = process.env.TWITCH_CLIENT_ID
    if (token && clientId) {
      try {
        const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } })
        const d = await r.json(); const s = d.data?.[0]
        res.status(200).json({ viewers: s?.viewer_count || 0, live: !!s, title: s?.title || '' })
        return
      } catch (_) {}
    }
    res.status(200).json({ viewers: 0, live: false, title: '', error: `Could not fetch viewers (${gqlErr.message})` })
  }
}
