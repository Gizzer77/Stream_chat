// X OAuth 2.0 PKCE token exchange
// Requires X_CLIENT_ID + X_CLIENT_SECRET in Vercel env vars

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

  const clientId     = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    res.status(400).json({ error: 'Add X_CLIENT_ID and X_CLIENT_SECRET to your Vercel environment variables.' }); return
  }

  try {
    // Exchange code → tokens
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code_verifier: codeVerifier }).toString(),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      res.status(400).json({ error: tokenData.error_description || tokenData.error || 'Token exchange failed' }); return
    }

    // Fetch username
    let username = ''
    try {
      const userRes = await fetch('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      })
      const userData = await userRes.json()
      username = userData.data?.username || ''
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
