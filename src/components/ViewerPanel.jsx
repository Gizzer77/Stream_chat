import { useState, useEffect, useMemo } from 'react'

// Polished viewer-count widget. Pick a streamer, then a platform, and see its
// live viewer count big and clean. Refreshes every 30s.
const PLAT_META = {
  twitch: { label: 'Twitch', emoji: '🟣', color: '#9147ff' },
  kick:   { label: 'Kick',   emoji: '🟢', color: '#53fc18' },
  x:      { label: 'X',      emoji: '✖',  color: '#1d9bf0' },
}

export default function ViewerPanel({ sources }) {
  const channels = useMemo(() => (sources || []).filter(s =>
    ((s.platform === 'twitch' || s.platform === 'kick') && s.channel && s.channel.toLowerCase() !== 'connected') ||
    (s.platform === 'x' && s.kind === 'broadcast' && s.broadcastId)), [sources])

  // Group by streamer name → { twitch:src, kick:src, x:src }
  const streamers = useMemo(() => {
    const m = {}
    channels.forEach(s => { const name = s.label || s.name || s.channel || 'Stream'; (m[name] ||= {})[s.platform] = s })
    return m
  }, [channels])
  const names = Object.keys(streamers)

  const [counts, setCounts] = useState({})   // `${platform}:${id}` → { viewers, live, error }
  const [sel, setSel]   = useState('')
  const [plat, setPlat] = useState('')

  const keyOf = s => `${s.platform}:${s.channel || s.broadcastId}`

  useEffect(() => {
    let alive = true
    async function load() {
      const out = {}
      for (const s of channels) {
        try {
          if (s.platform === 'twitch') {
            const r = await fetch(`/api/viewer-counts?platform=twitch&channel=${encodeURIComponent(s.channel)}`)
            if (r.ok) { const d = await r.json(); out[keyOf(s)] = { viewers: d.viewers ?? 0, live: !!d.live } }
          } else if (s.platform === 'kick') {
            const r = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(s.channel)}`, { headers: { Accept: 'application/json' } })
            if (r.ok) { const d = await r.json(); out[keyOf(s)] = { viewers: d.livestream?.viewer_count ?? 0, live: !!d.livestream } }
          } else if (s.platform === 'x' && s.broadcastId) {
            const r = await fetch(`/api/x-broadcast?id=${encodeURIComponent(s.broadcastId)}`)
            if (r.ok) { const d = await r.json(); out[keyOf(s)] = { viewers: d.viewers ?? null, live: !!d.live, error: d.error } }
          }
        } catch (_) {}
      }
      if (alive) setCounts(out)
    }
    load(); const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [JSON.stringify(channels)])

  useEffect(() => { if ((!sel || !streamers[sel]) && names.length) setSel(names[0]) }, [names.join('|')])
  useEffect(() => {
    const p = streamers[sel]; if (!p) return
    const avail = ['twitch', 'kick', 'x'].filter(k => p[k])
    if (!avail.includes(plat)) setPlat(avail[0] || '')
  }, [sel, streamers])

  if (!names.length) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#55556a', fontSize: 11.5, padding: 16 }}>
      Add a Twitch / Kick channel or an X broadcast to see viewer counts.
    </div>
  )

  const src = streamers[sel]?.[plat]
  const data = src ? counts[keyOf(src)] : null
  const pm = PLAT_META[plat] || {}
  const val = !data ? '…' : (plat === 'x' && (data.error || data.viewers == null)) ? '—' : (data.viewers || 0).toLocaleString()
  const total = Object.values(counts).reduce((a, c) => a + (c.viewers || 0), 0)

  const chip = (active, color, children, onClick, key) => (
    <button key={key} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
      color: active ? '#fff' : color, background: active ? color + 'cc' : color + '14',
      border: `1px solid ${active ? color : color + '33'}`, borderRadius: 7, padding: '3px 8px', whiteSpace: 'nowrap',
    }}>{children}</button>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8, minHeight: 0 }}>
      {/* Big live count */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${(pm.color || '#22c55e')}14, transparent 70%)`, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#8a8aa5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: data?.live ? '#22c55e' : '#555', boxShadow: data?.live ? '0 0 6px #22c55e' : 'none' }} />
          {data?.live ? 'Live now' : 'Offline'}
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{val}</div>
        <div style={{ fontSize: 11, color: pm.color || '#8a8aa5', fontWeight: 700 }}>{pm.emoji} {pm.label} viewers</div>
      </div>

      {/* Streamer picker */}
      {names.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {names.map(n => chip(n === sel, '#8b7fb5', n, () => setSel(n), n))}
        </div>
      )}

      {/* Platform picker for the selected streamer */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['twitch', 'kick', 'x'].filter(k => streamers[sel]?.[k]).map(k => {
          const c = counts[keyOf(streamers[sel][k])]
          const v = !c ? '' : (k === 'x' && (c.error || c.viewers == null)) ? '' : ` ${(c.viewers || 0).toLocaleString()}`
          return chip(k === plat, PLAT_META[k].color, <>{PLAT_META[k].emoji} {PLAT_META[k].label}{v}</>, () => setPlat(k), k)
        })}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 10, color: '#55556a', fontWeight: 700 }}>Σ {total.toLocaleString()}</span>
      </div>
    </div>
  )
}
