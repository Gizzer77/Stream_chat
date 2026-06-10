// Polymarket proxy — avoids browser CORS and uses only valid Gamma params.
// The old client code sent ?q= and ?sortBy= which Gamma rejects with 400,
// which is why Polymarket "wasn't working". We fetch a valid list here and
// filter by search term server-side.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const q     = (req.query.q || '').toString().trim().toLowerCase()
  const limit = Math.min(parseInt(req.query.limit || '12', 10) || 12, 40)

  try {
    // Pull a generous active set, then sort/filter ourselves.
    const r = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100', {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) throw new Error(`Gamma ${r.status}`)
    let data = await r.json()
    if (!Array.isArray(data)) data = []

    // Sort by volume desc (volumeNum or volume)
    data.sort((a, b) => (parseFloat(b.volumeNum || b.volume || 0)) - (parseFloat(a.volumeNum || a.volume || 0)))

    if (q) data = data.filter(m => ((m.question || m.title || '') + ' ' + (m.description || '')).toLowerCase().includes(q))

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.status(200).json(data.slice(0, limit))
  } catch (e) {
    res.status(200).json({ error: e.message })
  }
}
