// Best-effort live viewer count for an X broadcast.
// X serves this via authenticated GraphQL (no open API), so we try the legacy
// guest-token broadcasts endpoint that some tools still use. If X has locked it
// down, we return { error } and the UI shows "unavailable" rather than a wrong
// number.
const WEB_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  const id = (req.query.id || '').toString()
  if (!id) { res.status(400).json({ error: 'Missing broadcast id' }); return }

  try {
    const gt = await fetch('https://api.twitter.com/1.1/guest/activate.json', { method: 'POST', headers: { Authorization: WEB_BEARER } })
    const gtd = await gt.json().catch(() => ({}))
    const guest = gtd.guest_token
    if (!guest) throw new Error('could not get guest token')

    const r = await fetch(`https://api.twitter.com/1.1/broadcasts/show.json?ids=${encodeURIComponent(id)}&include_events=false`, {
      headers: { Authorization: WEB_BEARER, 'x-guest-token': guest },
    })
    const text = await r.text()
    let d = {}; try { d = JSON.parse(text) } catch (_) {}
    if (!r.ok) throw new Error(`broadcasts/show ${r.status}`)

    const b = (d.broadcasts && (d.broadcasts[id] || d.broadcasts[Object.keys(d.broadcasts)[0]])) || null
    if (!b) throw new Error('broadcast not found')
    const live = b.state === 'RUNNING' || b.live === true
    const viewers = b.total_watching ?? b.numWatchingLive ?? b.watching_now ?? b.total_watched ?? null
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40')
    res.status(200).json({ live: !!live, viewers: viewers != null ? Number(viewers) : null, title: b.status || '' })
  } catch (e) {
    res.status(200).json({ error: e.message })
  }
}
