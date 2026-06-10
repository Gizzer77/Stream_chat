import { useState, useEffect } from 'react'

export default function StreamPlayer({ streamers }) {
  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  const quickChannels = [
    ...(myTwitch ? [{ label: myTwitch, sublabel: 'You', platform: 'twitch', emoji: '🟣', color: '#9147ff' }] : []),
    ...(myKick   ? [{ label: myKick,   sublabel: 'You', platform: 'kick',   emoji: '🟢', color: '#53fc18' }] : []),
    ...streamers.flatMap(s => [
      ...(s.twitch && s.twitch.toLowerCase() !== myTwitch.toLowerCase() ? [{ label: s.twitch, sublabel: s.name, platform: 'twitch', emoji: '🟣', color: '#9147ff' }] : []),
      ...(s.kick   && s.kick.toLowerCase()   !== myKick.toLowerCase()   ? [{ label: s.kick,   sublabel: s.name, platform: 'kick',   emoji: '🟢', color: '#53fc18' }] : []),
    ]),
  ]

  const [active, setActive] = useState(null)
  const [input,  setInput]  = useState('')

  useEffect(() => {
    if (myTwitch) { setActive({ platform: 'twitch', channel: myTwitch }); return }
    if (myKick)   { setActive({ platform: 'kick',   channel: myKick }); return }
    if (streamers[0]?.twitch) setActive({ platform: 'twitch', channel: streamers[0].twitch })
    else if (streamers[0]?.kick) setActive({ platform: 'kick', channel: streamers[0].kick })
  }, [])

  function loadFromInput() {
    const v = input.trim()
    if (!v) return
    const tm = v.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
    if (tm) { setActive({ platform: 'twitch', channel: tm[1] }); return }
    const km = v.match(/kick\.com\/([a-zA-Z0-9_]+)/)
    if (km) { setActive({ platform: 'kick', channel: km[1] }); return }
    if (/^[a-zA-Z0-9_]{3,25}$/.test(v)) { setActive({ platform: 'twitch', channel: v }); return }
    setActive({ platform: 'other', url: v })
  }

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

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
        {quickChannels.length > 1 && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {quickChannels.map((ch, i) => (
              <button key={i} onClick={() => setActive({ platform: ch.platform, channel: ch.label })} style={{
                background: active.channel === ch.label ? `${ch.color}33` : 'rgba(0,0,0,0.7)',
                border: `1px solid ${active.channel === ch.label ? ch.color + '66' : 'rgba(255,255,255,0.15)'}`,
                color: active.channel === ch.label ? ch.color : '#ddd',
                borderRadius: 7, padding: '3px 9px', fontSize: 10, cursor: 'pointer', fontWeight: 700,
              }}>{ch.emoji} {ch.label}</button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 20 }}>
      <div style={{ fontSize: 44 }}>📺</div>
      {quickChannels.length > 0 ? (
        <>
          <div style={{ fontSize: 12, color: '#8a8aa5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Channels</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {quickChannels.map((ch, i) => (
              <button key={i} onClick={() => setActive({ platform: ch.platform, channel: ch.label })} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                background: `${ch.color}15`, border: `1px solid ${ch.color}44`, color: ch.color,
              }}>
                <span style={{ fontSize: 18 }}>{ch.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{ch.label}</span>
                {ch.sublabel && <span style={{ fontSize: 9, color: '#8a8aa5', fontWeight: 600 }}>{ch.sublabel}</span>}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#55556a', fontWeight: 600 }}>— or enter URL —</div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#8a8aa5', textAlign: 'center', lineHeight: 1.7 }}>Connect Twitch or Kick to auto-load your stream</div>
      )}
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadFromInput()}
          placeholder="twitch.tv/channel  or  kick.com/channel"
          style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: '#eeeef5', outline: 'none' }} />
        <button onClick={loadFromInput} style={{ background: 'linear-gradient(135deg,#9147ff,#6441a5)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Go</button>
      </div>
    </div>
  )
}
