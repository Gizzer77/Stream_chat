import { useState, useEffect } from 'react'

// The video player is driven by the SAME sources as the combined chat, plus an
// ad-hoc URL box. Twitch/Kick embed; X broadcasts open on X (no embed allowed).
const META = {
  twitch: { emoji: '🟣', color: '#9147ff' },
  kick:   { emoji: '🟢', color: '#53fc18' },
  x:      { emoji: '✖',  color: '#1d9bf0' },
}

function toActive(s) {
  if (s.platform === 'x') return { platform: 'x', url: s.url, channel: s.label || 'X Broadcast' }
  return { platform: s.platform, channel: s.channel }
}

export default function StreamPlayer({ sources }) {
  const watchable = (sources || []).filter(s => s.platform === 'twitch' || s.platform === 'kick' || (s.platform === 'x' && s.kind === 'broadcast'))
  const [active, setActive] = useState(null)
  const [input,  setInput]  = useState('')

  useEffect(() => {
    if (!active && watchable[0]) setActive(toActive(watchable[0]))
  }, [JSON.stringify(watchable.map(s => s.platform + s.channel))])

  function loadFromInput() {
    const v = input.trim()
    if (!v) return
    const tm = v.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
    if (tm) { setActive({ platform: 'twitch', channel: tm[1] }); return }
    const km = v.match(/kick\.com\/([a-zA-Z0-9_]+)/)
    if (km) { setActive({ platform: 'kick', channel: km[1] }); return }
    const xb = v.match(/(?:x|twitter)\.com\/(?:i\/)?broadcasts\/([A-Za-z0-9]+)/i)
    if (xb) { setActive({ platform: 'x', url: v.startsWith('http') ? v : `https://${v}`, channel: 'X Broadcast' }); return }
    if (/^[a-zA-Z0-9_]{3,25}$/.test(v)) { setActive({ platform: 'twitch', channel: v }); return }
    setActive({ platform: 'other', url: v.startsWith('http') ? v : `https://${v}` })
  }

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const isActive = s => active && ((s.platform === 'x' && active.platform === 'x') || (active.channel && s.channel && active.channel.toLowerCase() === s.channel.toLowerCase()))

  const QuickBar = () => watchable.length > 0 && (
    <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: '92%' }}>
      {watchable.map((s, i) => {
        const m = META[s.platform]; const on = isActive(s)
        return (
          <button key={i} onClick={() => setActive(toActive(s))} style={{
            background: on ? `${m.color}33` : 'rgba(0,0,0,0.7)',
            border: `1px solid ${on ? m.color + '66' : 'rgba(255,255,255,0.15)'}`,
            color: on ? m.color : '#ddd', borderRadius: 7, padding: '3px 9px', fontSize: 10, cursor: 'pointer', fontWeight: 700,
          }}>{m.emoji} {s.label || s.channel}</button>
        )
      })}
    </div>
  )

  // X broadcast — can't be embedded
  if (active && active.platform === 'x') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: 'radial-gradient(ellipse at 50% 30%, rgba(29,155,240,0.08), transparent 70%)' }}>
        <div style={{ fontSize: 40 }}>✖</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#e8e8f5' }}>X Broadcast</div>
        <div style={{ fontSize: 12, color: '#8a8aa5', maxWidth: 320, lineHeight: 1.6 }}>X blocks embedding its player, so broadcasts open on X in a new tab.</div>
        <a href={active.url} target="_blank" rel="noreferrer" style={{ background: 'linear-gradient(135deg,#1d9bf0,#0f6fb8)', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700 }}>Watch on X ↗</a>
        <button onClick={() => setActive(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 9, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>⬅ Change</button>
        <QuickBar />
      </div>
    )
  }

  if (active) {
    const src = active.platform === 'twitch'
      ? `https://player.twitch.tv/?channel=${active.channel}&parent=${domain}&autoplay=true`
      : active.platform === 'kick'
        ? `https://player.kick.com/${active.channel}`
        : active.url
    const pc = active.platform === 'twitch' ? '#9147ff' : active.platform === 'kick' ? '#53fc18' : '#888'
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="autoplay" title="stream" />
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.75)', borderRadius: 8, padding: '4px 10px', pointerEvents: 'auto' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: pc }}>{active.channel}</span>
          </div>
          <button onClick={() => setActive(null)} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.75)', border: `1px solid ${pc}44`, color: pc, borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700, pointerEvents: 'auto' }}>⬅ Change</button>
        </div>
        <QuickBar />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 20 }}>
      <div style={{ fontSize: 44 }}>📺</div>
      {watchable.length > 0 ? (
        <>
          <div style={{ fontSize: 12, color: '#8a8aa5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Sources</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {watchable.map((s, i) => {
              const m = META[s.platform]
              return (
                <button key={i} onClick={() => setActive(toActive(s))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 16px', borderRadius: 12, cursor: 'pointer', background: `${m.color}15`, border: `1px solid ${m.color}44`, color: m.color }}>
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{s.label || s.channel}</span>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: '#55556a', fontWeight: 600 }}>— or enter URL —</div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#8a8aa5', textAlign: 'center', lineHeight: 1.7 }}>Add chat/video sources in Settings ⚙<br/>or paste a URL below</div>
      )}
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadFromInput()}
          placeholder="twitch.tv/… · kick.com/… · x.com/i/broadcasts/…"
          style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: '#eeeef5', outline: 'none' }} />
        <button onClick={loadFromInput} style={{ background: 'linear-gradient(135deg,#9147ff,#6441a5)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Go</button>
      </div>
    </div>
  )
}
