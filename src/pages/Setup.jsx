import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Helpers ───────────────────────────────────────────────────────────────────

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function parseChannel(input, platform) {
  if (!input?.trim()) return ''
  input = input.trim()
  const prefixes = {
    twitch: ['https://www.twitch.tv/', 'https://twitch.tv/', 'twitch.tv/'],
    kick:   ['https://www.kick.com/',  'https://kick.com/',  'kick.com/' ],
  }
  for (const p of (prefixes[platform] || [])) {
    if (input.toLowerCase().startsWith(p.toLowerCase()))
      return input.slice(p.length).split('/')[0].split('?')[0]
  }
  return input.split('/').pop().split('?')[0]
}

function buildConfig(streamers, roomCode, locked) {
  return {
    roomCode,
    locked,
    streamers: streamers.map(s => ({
      name:   s.name.trim(),
      twitch: parseChannel(s.twitch, 'twitch'),
      kick:   parseChannel(s.kick,   'kick'),
    })),
  }
}

function buildUrl(streamers, roomCode, locked) {
  const hash = btoa(JSON.stringify(buildConfig(streamers, roomCode, locked)))
  return `${window.location.origin}/room#${hash}`
}

// ── Platform field ────────────────────────────────────────────────────────────

function PlatformField({ platform, value, onChange }) {
  const meta = {
    twitch: { label: 'Twitch', color: '#9147ff', placeholder: 'twitch.tv/username  or  username' },
    kick:   { label: 'Kick',   color: '#1f9e47', placeholder: 'kick.com/username  or  username'  },
  }[platform]

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
      <div style={{
        flexShrink:0, width:56, textAlign:'center',
        background: `${meta.color}22`, color: meta.color,
        border: `1px solid ${meta.color}44`,
        borderRadius:'var(--r-sm)', padding:'4px 6px',
        fontSize:11, fontWeight:700, letterSpacing:'0.05em',
      }}>{meta.label}</div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={meta.placeholder}
        style={{
          flex:1, background:'var(--bg)', border:'1px solid var(--border2)',
          borderRadius:'var(--r-sm)', padding:'8px 10px', fontSize:13, outline:'none',
          transition:'border-color .15s',
        }}
        onFocus={e  => e.target.style.borderColor = meta.color + '88'}
        onBlur={e   => e.target.style.borderColor = 'var(--border2)'}
      />
    </div>
  )
}

// ── Streamer card ─────────────────────────────────────────────────────────────

const STREAMER_COLORS = ['#9147ff', '#54c0ff']

function StreamerCard({ index, streamer, onChange }) {
  const accent = STREAMER_COLORS[index] || '#9147ff'
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderTop: `3px solid ${accent}`,
      borderRadius:'var(--r-lg)', padding:20, flex:1, minWidth:220,
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>
        Streamer {index + 1}
      </div>
      <input
        value={streamer.name}
        onChange={e => onChange({ ...streamer, name: e.target.value })}
        placeholder={index === 0 ? 'Your name (e.g. Sam)' : "Co-streamer's name"}
        style={{
          width:'100%', background:'var(--bg)', border:'1px solid var(--border2)',
          borderRadius:'var(--r-sm)', padding:'9px 11px', fontSize:14, fontWeight:600,
          outline:'none', marginBottom:14, color:'var(--text)',
        }}
        onFocus={e => e.target.style.borderColor = `${accent}88`}
        onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
      />
      <PlatformField platform="twitch" value={streamer.twitch} onChange={v => onChange({ ...streamer, twitch: v })} />
      <PlatformField platform="kick"   value={streamer.kick}   onChange={v => onChange({ ...streamer, kick:   v })} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Setup() {
  const navigate = useNavigate()
  const [streamers, setStreamers] = useState([
    { name:'', twitch:'', kick:'' },
    { name:'', twitch:'', kick:'' },
  ])
  const [roomCode] = useState(genRoomCode)
  const [locked,   setLocked]  = useState(false)
  const [copied,   setCopied]  = useState(false)
  const [error,    setError]   = useState('')
  const [joinUrl,  setJoinUrl] = useState('')
  const [joinErr,  setJoinErr] = useState('')

  function updateStreamer(i, val) {
    setStreamers(prev => prev.map((s, idx) => idx === i ? val : s))
    setError('')
  }

  function validate() {
    for (const s of streamers) {
      if (!s.name.trim()) return 'Give each streamer a display name.'
      if (!s.twitch.trim() && !s.kick.trim()) return `${s.name || 'Each streamer'} needs at least one channel.`
    }
    return null
  }

  function handleGo() {
    const err = validate()
    if (err) { setError(err); return }
    const hash = btoa(JSON.stringify(buildConfig(streamers, roomCode, locked)))
    navigate(`/room#${hash}`)
  }

  async function handleCopy() {
    const err = validate()
    if (err) { setError(err); return }
    await navigator.clipboard.writeText(buildUrl(streamers, roomCode, locked)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  function handleJoin() {
    setJoinErr('')
    const url = joinUrl.trim()
    if (!url) { setJoinErr('Paste a room link first.'); return }
    try {
      const parsed = new URL(url)
      const hash = parsed.hash.slice(1)
      if (!hash) throw new Error('no hash')
      JSON.parse(atob(hash)) // validate
      window.location.href = url
    } catch {
      setJoinErr('That doesn\'t look like a valid room link.')
    }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'var(--bg)', overflowY:'auto', overflowX:'hidden',
      display:'flex', flexDirection:'column', alignItems:'center',
    }}>

      {/* ── Hero header ── */}
      <div style={{
        width:'100%', padding:'40px 24px 32px',
        background:'linear-gradient(160deg, #12122099 0%, #0a0a0f 100%)',
        borderBottom:'1px solid var(--border)',
        textAlign:'center',
      }}>
        <div style={{ fontSize:36, marginBottom:10 }}>🎙</div>
        <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.5px', color:'var(--text)', marginBottom:6 }}>
          StreamChat
        </h1>
        <p style={{ fontSize:15, color:'var(--muted)', maxWidth:380, margin:'0 auto' }}>
          Aggregate live chat from Twitch & Kick into one unified view
        </p>
      </div>

      <div style={{ width:'100%', maxWidth:760, padding:'28px 20px 60px' }}>

        {/* ── Streamers ── */}
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:20 }}>
          {streamers.map((s, i) => (
            <StreamerCard key={i} index={i} streamer={s} onChange={v => updateStreamer(i, v)} />
          ))}
        </div>

        {/* ── Room settings ── */}
        <div style={{
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--r-lg)', padding:'18px 20px', marginBottom:20,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Room Code</div>
                <div style={{
                  fontFamily:'monospace', fontSize:22, fontWeight:800, letterSpacing:'0.18em', color:'var(--text)',
                  background:'var(--bg)', border:'1px solid var(--border2)',
                  borderRadius:'var(--r-sm)', padding:'6px 14px',
                }}>
                  {roomCode}
                </div>
              </div>
              <div style={{ color:'var(--dim)', fontSize:12, maxWidth:160, lineHeight:1.5 }}>
                Include this in your title so people know which room to join
              </div>
            </div>

            {/* Lock toggle */}
            <button
              onClick={() => setLocked(v => !v)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                background: locked ? 'rgba(255,215,0,0.1)' : 'var(--surface2)',
                border: `1px solid ${locked ? 'rgba(255,215,0,0.35)' : 'var(--border2)'}`,
                color: locked ? 'var(--gold)' : 'var(--muted)',
                borderRadius:'var(--r)', padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:600,
                transition:'all .2s',
              }}
            >
              {locked ? '🔒' : '🔓'}
              {locked ? 'Room Locked' : 'Lock Room'}
            </button>
          </div>
          {locked && (
            <div style={{ marginTop:10, fontSize:12, color:'var(--muted)', borderTop:'1px solid var(--border)', paddingTop:10 }}>
              🔒 Locked rooms hide the Edit button — perfect for sharing a finalized link.
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="fade-in" style={{
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:'var(--r)', padding:'10px 14px', fontSize:13, color:'#f87171', marginBottom:16,
          }}>⚠ {error}</div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display:'flex', gap:12, marginBottom:32 }}>
          <button onClick={handleGo} style={{
            flex:1, background:'linear-gradient(135deg, #9147ff, #6441a5)',
            color:'#fff', border:'none', borderRadius:'var(--r)', padding:'13px 20px',
            fontSize:15, fontWeight:700, cursor:'pointer',
            boxShadow:'0 4px 20px rgba(145,71,255,0.35)',
            transition:'opacity .15s, transform .15s',
          }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={e  => e.currentTarget.style.opacity = '1'}
          >
            Open Chat Room →
          </button>
          <button onClick={handleCopy} style={{
            flex:1, background: copied ? 'rgba(34,197,94,0.12)' : 'var(--surface)',
            color: copied ? 'var(--success)' : 'var(--text)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border2)'}`,
            borderRadius:'var(--r)', padding:'13px 20px', fontSize:15, fontWeight:600, cursor:'pointer',
            transition:'all .2s',
          }}>
            {copied ? '✓ Copied!' : '🔗 Copy Share Link'}
          </button>
        </div>

        {/* ── Join existing room ── */}
        <div style={{
          borderTop:'1px solid var(--border)', paddingTop:28,
        }}>
          <div style={{ textAlign:'center', marginBottom:16 }}>
            <span style={{ fontSize:13, color:'var(--dim)', background:'var(--bg)', padding:'0 12px' }}>
              or join an existing room
            </span>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <input
              value={joinUrl}
              onChange={e => { setJoinUrl(e.target.value); setJoinErr('') }}
              placeholder="Paste a room link here…"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              style={{
                flex:1, background:'var(--surface)', border:'1px solid var(--border2)',
                borderRadius:'var(--r)', padding:'10px 14px', fontSize:13, outline:'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--border2)'}
            />
            <button onClick={handleJoin} style={{
              background:'var(--surface2)', border:'1px solid var(--border2)',
              color:'var(--text)', borderRadius:'var(--r)', padding:'10px 18px',
              fontSize:13, fontWeight:600, cursor:'pointer',
            }}>Join →</button>
          </div>
          {joinErr && (
            <div style={{ marginTop:8, fontSize:12, color:'#f87171' }}>⚠ {joinErr}</div>
          )}
          <p style={{ marginTop:12, fontSize:12, color:'var(--dim)', textAlign:'center', lineHeight:1.6 }}>
            Anyone with the share link can open the room — no account needed.
          </p>
        </div>
      </div>
    </div>
  )
}
