// Kick OAuth 2.1 PKCE token exchange
// Requires KICK_CLIENT_ID + KICK_CLIENT_SECRET in Vercel env vars

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const { code, codeVerifier, redirectUri } = req.body || {}
  if (!code || !codeVerifier || !redirectUri) {
    res.status(400).json({ error: 'Missing code, codeVerifier, or redirectUri' }); return
  }

  const clientId     = process.env.KICK_CLIENT_ID
  const clientSecret = process.env.KICK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    res.status(400).json({ error: 'Add KICK_CLIENT_ID and KICK_CLIENT_SECRET to your Vercel environment variables.' }); return
  }

  try {
    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    })

    const rawText = await tokenRes.text()
    let tokenData
    try { tokenData = JSON.parse(rawText) }
    catch (_) {
      res.status(500).json({ error: `Kick returned non-JSON: ${rawText.slice(0, 200)}` }); return
    }

    if (!tokenRes.ok) {
      res.status(400).json({ error: tokenData.message || tokenData.error || `HTTP ${tokenRes.status}` }); return
    }

    // Fetch username
    let username = ''
    try {
      const userRes = await fetch('https://api.kick.com/public/v1/users', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      })
      const userData = await userRes.json()
      username = userData.data?.[0]?.username || userData.data?.[0]?.name || ''
    } catch (_) {}

    res.status(200).json({
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      username,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
