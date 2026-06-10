import { useState, useEffect } from 'react'

// Full-width seamless ticker. We repeat the items enough to always fill the
// width, then render the sequence twice and animate -50% for a gapless loop.
export default function MarketTicker() {
  const [items, setItems] = useState([])
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const r = await fetch('/api/market-ticker')
        if (r.ok && alive) { const data = await r.json(); if (Array.isArray(data)) setItems(data) }
      } catch (_) {}
    }
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const shown = items.length ? items : [
    { label: 'BTC', value: '…', change: null }, { label: 'ETH', value: '…', change: null },
    { label: 'SOL', value: '…', change: null }, { label: 'S&P 500', value: '…', change: null },
  ]
  // Repeat until we have a wide base, then duplicate that base once for the loop.
  const base = []
  while (base.length < 24) base.push(...shown)
  const seq = [...base, ...base]

  const Item = ({ it, i }) => {
    const has = typeof it.change === 'number'
    const pos = has && it.change >= 0
    const col = !has ? '#8888aa' : pos ? '#22c55e' : '#ef4444'
    return (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 22px', borderRight: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: '#a0a0c0' }}>{it.label}</span>
        <span style={{ color: '#e8e8f5', fontWeight: 700 }}>{it.value}</span>
        {has && <span style={{ color: col, fontSize: 10, fontWeight: 700 }}>{pos ? '▲' : '▼'}{Math.abs(it.change).toFixed(2)}%</span>}
      </span>
    )
  }

  return (
    <div style={{ width: '100%', overflow: 'hidden', background: '#060610', borderBottom: '1px solid rgba(255,255,255,0.05)', height: 30, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', willChange: 'transform', animation: 'mbTicker 90s linear infinite' }}>
        {seq.map((it, i) => <Item it={it} i={i} key={i} />)}
      </div>
      <style>{`@keyframes mbTicker { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  )
}
