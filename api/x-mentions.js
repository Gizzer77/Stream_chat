// Pull recent X mentions for the logged-in user so they show in combined chat.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).end(); return }

  const token = req.body?.accessToken
  if (!token) { res.status(400).json({ error: 'Missing accessToken' }); return }

  try {
    const meRes = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${token}` } })
    const me = await meRes.json()
    if (!meRes.ok) { res.status(400).json({ error: me.detail || me.title || `users/me ${meRes.status}` }); return }
    const id = me.data?.id
    if (!id) { res.status(400).json({ error: 'No user id' }); return }

    const url = `https://api.twitter.com/2/users/${id}/mentions?max_results=20&tweet.fields=created_at&expansions=author_id&user.fields=username,name`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (!r.ok) {
      let msg = d.detail || d.title || `mentions ${r.status}`
      if (r.status === 403 || r.status === 453 || r.status === 429) msg += ' — reading X mentions needs an elevated (paid) X API plan; the free tier only allows posting.'
      res.status(400).json({ error: msg }); return
    }

    const users = {}
    ;(d.includes?.users || []).forEach(u => { users[u.id] = u })
    const messages = (d.data || []).map(t => ({ id: t.id, username: users[t.author_id]?.username || 'user', text: t.text, created_at: t.created_at }))
    res.setHeader('Cache-Control', 's-maxage=30')
    res.status(200).json({ messages })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
