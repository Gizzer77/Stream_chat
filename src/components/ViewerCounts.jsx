import { useState, useEffect, useMemo } from 'react'

// Live viewer counts for Twitch + Kick with filtering, search and sorting.
export default function ViewerCounts({ sources }) {
  const channels = (sources || []).filter(s => (s.platform === 'twitch' || s.platform === 'kick') && s.channel && s.channel.toLowerCase() !== 'connected')
  const [counts, setCounts] = useState({})
  const [filter, setFilter] = useState('all')   // all | twitch | kick | live
  const [q,      setQ]      = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      const out = {}
      for (const s of channels) {
        if (s.platform === 'twitch') {
          try {
            const r = await fetch(`/api/viewer-counts?platform=twitch&channel=${encodeURIComponent(s.channel)}`)
            if (r.ok) out[`tw_${s.channel}`] = { platform: 'twitch', name: s.channel, ...(await r.json()) }
          } catch (_) {}
        } else if (s.platform === 'kick') {
          try {
            const r = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(s.channel)}`, { headers: { Accept: 'application/json' } })
            if (r.ok) { const d = await r.json(); out[`kk_${s.channel}`] = { platform: 'kick', name: s.channel, viewers: d.livestream?.viewer_count ?? 0, live: !!d.livestream, title: d.livestream?.session_title || '' } }
          } catch (_) {}
        }
      }
      if (alive) setCounts(out)
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [JSON.stringify(channels)])

  const all = Object.values(counts)
  const total = all.reduce((s, e) => s + (e.viewers || 0), 0)
  const liveCount = all.filter(e => e.live).length
  const peak = Math.max(1, ...all.map(e => e.viewers || 0))
  const twNote = all.find(e => e.platform === 'twitch' && e.note)?.note

  const entries = useMemo(() => {
    let list = all.slice()
    if (filter === 'live') list = list.filter(e => e.live)
    else if (filter !== 'all') list = list.filter(e => e.platform === filter)
    if (q.trim()) { const ql = q.toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(ql)) }
    return list.sort((a, b) => (b.viewers || 0) - (a.viewers || 0))
  }, [counts, filter, q])

  const tabs = [
    { key: 'all',    label: `All ${all.length}`,      color: '#c8c8e0' },
    { key: 'twitch', label: '🟣',                     color: '#9147ff' },
    { key: 'kick',   label: '🟢',                     color: '#53fc18' },
    { key: 'live',   label: `🔴 ${liveCount}`,         color: '#ef4444' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hero total */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'linear-gradient(135deg,rgba(34,197,94,0.08),transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#eeeef5', lineHeight: 1 }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#8a8aa5', letterSpacing: '0.07em', textTransform: 'uppercase' }}>total viewers</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: liveCount ? '#22c55e' : '#55556a' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: liveCount ? '#22c55e' : '#444', boxShadow: liveCount ? '0 0 6px #22c55e' : 'none' }} />{liveCount} live
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: filter === t.key ? t.color + '22' : 'transparent',
            color: filter === t.key ? t.color : '#8a8aa5',
            border: `1px solid ${filter === t.key ? t.color + '55' : 'transparent'}`,
          }}>{t.label}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter…"
          style={{ marginLeft: 'auto', width: 90, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '4px 8px', fontSize: 11, color: '#eeeef5', outline: 'none' }} />
      </div>

      {twNote && (
        <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.18)' }}>🟣 {twNote}</div>
      )}
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {entries.length === 0 ? (
          <div style={{ fontSize: 11, color: '#55556a', textAlign: 'center', padding: 20, lineHeight: 1.7 }}>{all.length ? 'No channels match.' : 'Connect channels to see live counts'}</div>
        ) : entries.map(e => {
          const pc = e.platform === 'twitch' ? '#9147ff' : '#53fc18'
          const pct = Math.round(((e.viewers || 0) / peak) * 100)
          return (
            <div key={e.platform + e.name} style={{ position: 'relative', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: `linear-gradient(90deg,${pc}22,transparent)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: pc, background: pc + '22', borderRadius: 5, padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0 }}>{e.platform}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#eeeef5', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {e.name}
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.live ? '#22c55e' : '#444', boxShadow: e.live ? '0 0 5px #22c55e' : 'none' }} />
                  </div>
                  {e.title ? <div style={{ fontSize: 10, color: '#8a8aa5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    : <div style={{ fontSize: 10, color: '#55556a' }}>{e.live ? 'live' : 'offline'}</div>}
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#eeeef5', flexShrink: 0 }}>{(e.viewers || 0).toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
