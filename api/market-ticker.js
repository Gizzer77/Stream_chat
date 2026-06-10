// Market ticker — fetches crypto + stock prices for the dashboard ticker strip

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const results = []

  // ── Crypto via CoinGecko (free, no key) ──────────────────────────────────
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
      { headers: { 'Accept': 'application/json' } }
    )
    if (cgRes.ok) {
      const cg = await cgRes.json()
      const fmt = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n.toFixed(2)}`
      if (cg.bitcoin)  results.push({ label:'BTC',  value: fmt(cg.bitcoin.usd),  change: cg.bitcoin.usd_24h_change })
      if (cg.ethereum) results.push({ label:'ETH',  value: fmt(cg.ethereum.usd), change: cg.ethereum.usd_24h_change })
      if (cg.solana)   results.push({ label:'SOL',  value: fmt(cg.solana.usd),   change: cg.solana.usd_24h_change })
    }
  } catch (_) {}

  // ── S&P 500 via Yahoo Finance ────────────────────────────────────────────
  try {
    const yfRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d',
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    )
    if (yfRes.ok) {
      const yf = await yfRes.json()
      const meta = yf?.chart?.result?.[0]?.meta
      if (meta) {
        const price  = meta.regularMarketPrice
        const prev   = meta.chartPreviousClose || meta.previousClose
        const change = prev ? ((price - prev) / prev) * 100 : null
        results.push({ label: 'S&P 500', value: price ? price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—', change })
      }
    }
  } catch (_) {}

  // Fallback stubs if everything failed
  if (results.length === 0) {
    results.push(
      { label: 'BTC',     value: '—', change: null },
      { label: 'ETH',     value: '—', change: null },
      { label: 'SOL',     value: '—', change: null },
      { label: 'S&P 500', value: '—', change: null },
    )
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  res.status(200).json(results)
}
