import { useState, useEffect } from 'react'

// Uses the /api/polymarket proxy (valid params + no CORS). Search is filtered
// server-side. Defaults come from settings.
export default function Polymarket({ defaultQuery = '', limit = 12 }) {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)
  const [search,  setSearch]  = useState(defaultQuery)
  const [searchQ, setSearchQ] = useState(defaultQuery)

  useEffect(() => {
    let alive = true
    async function load() {
      setErr(null)
      try {
        const params = new URLSearchParams({ limit: String(limit) })
        if (searchQ.trim()) params.set('q', searchQ.trim())
        const r = await fetch(`/api/polymarket?${params}`)
        if (!r.ok) throw new Error(`${r.status}`)
        const data = await r.json()
        if (!alive) return
        if (Array.isArray(data)) setMarkets(data)
        else { setMarkets([]); if (data?.error) setErr(data.error) }
      } catch (e) { if (alive) setErr(e.message) }
      if (alive) setLoading(false)
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [searchQ, limit])

  function handleSearch() { setSearchQ(search.trim()); setLoading(true) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search prediction markets…"
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#eeeef5', outline: 'none' }} />
          <button onClick={handleSearch} style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔍</button>
          {searchQ && <button onClick={() => { setSearch(''); setSearchQ(''); setLoading(true) }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#ccc', padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>✕</button>}
        </div>
      </div>
      {loading && <div style={{ padding: 20, textAlign: 'center', color: '#8a8aa5', fontSize: 12 }}>Loading markets…</div>}
      {err && <div style={{ padding: 12, color: '#f87171', fontSize: 12 }}>⚠ {err}</div>}
      {!loading && !err && markets.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#55556a', fontSize: 12 }}>No markets found.</div>}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {markets.map((m, i) => {
          let prices = [], outcomes = []
          try { prices = JSON.parse(m.outcomePrices || '[]') } catch (_) {}
          try { outcomes = JSON.parse(m.outcomes || '[]') } catch (_) {}
          const yesP = prices[0] != null ? parseFloat(prices[0]) : null
          const noP  = prices[1] != null ? parseFloat(prices[1]) : null
          return (
            <div key={m.id || i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <a href={`https://polymarket.com/event/${m.slug || ''}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 600, color: '#eeeef5', lineHeight: 1.45, display: 'block', marginBottom: 6, textDecoration: 'none' }}
                onMouseOver={e => e.currentTarget.style.color = '#a0a0ff'}
                onMouseOut={e => e.currentTarget.style.color = '#eeeef5'}>{m.question || m.title}</a>
              {(yesP !== null || noP !== null) && (
                <div style={{ display: 'flex', gap: 5, marginBottom: 4 }}>
                  {yesP !== null && <div style={{ flex: 1, padding: '4px 7px', borderRadius: 7, textAlign: 'center', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{Math.round(yesP * 100)}¢</div>
                    <div style={{ fontSize: 9, color: '#22c55e88', textTransform: 'uppercase' }}>{outcomes[0] || 'Yes'}</div>
                  </div>}
                  {noP !== null && <div style={{ flex: 1, padding: '4px 7px', borderRadius: 7, textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444' }}>{Math.round(noP * 100)}¢</div>
                    <div style={{ fontSize: 9, color: '#ef444488', textTransform: 'uppercase' }}>{outcomes[1] || 'No'}</div>
                  </div>}
                </div>
              )}
              {m.volume && <div style={{ fontSize: 10, color: '#55556a' }}>Vol: ${parseFloat(m.volume).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
