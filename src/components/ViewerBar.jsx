import { useState, useEffect } from 'react'

// Compact inline viewer counts for the top bar (replaces the big panel).
export default function ViewerBar({ sources }) {
  const channels = (sources || []).filter(s =>
    ((s.platform === 'twitch' || s.platform === 'kick') && s.channel && s.channel.toLowerCase() !== 'connected') ||
    (s.platform === 'x' && s.kind === 'broadcast' && s.broadcastId))
  const [counts, setCounts] = useState({})

  useEffect(() => {
    let alive = true
    async function load() {
      const out = {}
      for (const s of channels) {
        try {
          if (s.platform === 'twitch') {
            const r = await fetch(`/api/viewer-counts?platform=twitch&channel=${encodeURIComponent(s.channel)}`)
            if (r.ok) out[`tw_${s.channel}`] = { platform: 'twitch', name: s.channel, ...(await r.json()) }
          } else if (s.platform === 'kick') {
            const r = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(s.channel)}`, { headers: { Accept: 'application/json' } })
            if (r.ok) { const d = await r.json(); out[`kk_${s.channel}`] = { platform: 'kick', name: s.channel, viewers: d.livestream?.viewer_count ?? 0, live: !!d.livestream } }
          } else if (s.platform === 'x' && s.broadcastId) {
            const r = await fetch(`/api/x-broadcast?id=${encodeURIComponent(s.broadcastId)}`)
            if (r.ok) { const d = await r.json(); out[`x_${s.broadcastId}`] = { platform: 'x', name: 'X', viewers: d.viewers ?? null, live: !!d.live, error: d.error } }
          }
        } catch (_) {}
      }
      if (alive) setCounts(out)
    }
    load(); const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [JSON.stringify(channels)])

  if (!channels.length) return null
  const entries = Object.values(counts).sort((a, b) => (b.viewers || 0) - (a.viewers || 0))
  const total = entries.reduce((s, e) => s + (e.viewers || 0), 0)

  const pill = (bg, border, color, children, key) => (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>{children}</span>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflowX: 'auto', minWidth: 0 }}>
      {pill('rgba(34,197,94,0.1)', 'rgba(34,197,94,0.25)', '#22c55e', <>👥 {total.toLocaleString()}</>, 'total')}
      {entries.map(e => {
        const c = e.platform === 'twitch' ? '#9147ff' : e.platform === 'kick' ? '#53fc18' : '#1d9bf0'
        const em = e.platform === 'twitch' ? '🟣' : e.platform === 'kick' ? '🟢' : '✖'
        const val = e.platform === 'x' && (e.error || e.viewers == null) ? '—' : (e.viewers || 0).toLocaleString()
        return pill(c + '14', c + '33', c, <>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.live ? '#22c55e' : '#555', boxShadow: e.live ? '0 0 5px #22c55e' : 'none' }} />
          {em} {e.name} <span style={{ color: '#eeeef5' }}>{val}</span>
        </>, e.platform + e.name)
      })}
    </div>
  )
}
