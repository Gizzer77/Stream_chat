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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
      {/* Total — clean, no box */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#cdd3df', whiteSpace: 'nowrap' }}>
        <span>👥</span>{total.toLocaleString()}
      </span>
      <span style={{ width: 1, height: 13, background: 'rgba(255,255,255,0.09)', flexShrink: 0 }} />
      {entries.map(e => {
        const c = e.platform === 'twitch' ? '#9b8cc7' : e.platform === 'kick' ? '#6fae8a' : '#7fa8c4'
        const em = e.platform === 'twitch' ? '🟣' : e.platform === 'kick' ? '🟢' : '✖'
        const label = e.platform === 'twitch' ? 'Twitch' : e.platform === 'kick' ? 'Kick' : 'X'
        const val = e.platform === 'x' && (e.error || e.viewers == null) ? '—' : (e.viewers || 0).toLocaleString()
        return (
          <span key={e.platform + e.name} title={`${e.name} · ${label}${e.live ? ' · live' : ' · offline'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, whiteSpace: 'nowrap', padding: '2px 4px', borderRadius: 8, cursor: 'default', transition: 'background .15s' }}
            onMouseOver={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: e.live ? '#5fbf85' : '#4a4a5a', boxShadow: e.live ? '0 0 5px #5fbf85' : 'none' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 6, background: c + '1c', border: `1px solid ${c}33`, color: c, fontWeight: 700 }}>{em} {e.name}</span>
            <span style={{ color: '#f0f0f5', fontWeight: 800 }}>{val}</span>
          </span>
        )
      })}
    </div>
  )
}
