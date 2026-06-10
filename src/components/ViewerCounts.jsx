import { useState, useEffect } from 'react'

// Live viewer counts for Twitch + Kick. (X has no public live-viewer API, so
// per the spec we just show Twitch/Kick.)
export default function ViewerCounts({ sources }) {
  const channels = (sources || []).filter(s => s.platform === 'twitch' || s.platform === 'kick')
  const [counts, setCounts] = useState({})

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
            if (r.ok) {
              const d = await r.json()
              out[`kk_${s.channel}`] = { platform: 'kick', name: s.channel, viewers: d.livestream?.viewer_count ?? 0, live: !!d.livestream, title: d.livestream?.session_title || '' }
            }
          } catch (_) {}
        }
      }
      if (alive) setCounts(out)
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [JSON.stringify(channels)])

  const entries = Object.values(counts)
  const total   = entries.reduce((s, e) => s + (e.viewers || 0), 0)
  const liveCount = entries.filter(e => e.live).length

  return (
    <div style={{ padding: 14, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ textAlign: 'center', padding: '6px 0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: '#eeeef5', lineHeight: 1 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: '#8a8aa5', marginTop: 3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Total Viewers · {liveCount} live</div>
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: '#55556a', textAlign: 'center', lineHeight: 1.7 }}>Connect channels to see live counts</div>
      ) : entries.map(e => {
        const pc = e.platform === 'twitch' ? '#9147ff' : '#53fc18'
        return (
          <div key={e.platform + e.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: e.live ? '#22c55e' : '#444', boxShadow: e.live ? '0 0 6px #22c55e' : 'none', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: pc }}>{e.platform === 'twitch' ? '🟣' : '🟢'} {e.name}</div>
              {e.title && <div style={{ fontSize: 10, color: '#55556a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>}
              {!e.live && <div style={{ fontSize: 10, color: '#44445a' }}>offline</div>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#eeeef5' }}>{(e.viewers || 0).toLocaleString()}</div>
          </div>
        )
      })}
    </div>
  )
}
