import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTwitchChat } from '../hooks/useTwitchChat.js'
import { useKickChat   } from '../hooks/useKickChat.js'

const MAX_MESSAGES = 500
const HEARTBEAT_MS = 12000

const PLATFORM = {
  twitch: { label:'Twitch', color:'#9147ff', bg:'#6441a530' },
  kick:   { label:'Kick',   color:'#53fc18', bg:'#1f9e4730' },
}
const STREAMER_COLORS = ['#9147ff','#54c0ff','#ff7b54','#54ffb4','#ffda54']

function parseConfig() {
  try { return JSON.parse(atob(window.location.hash.slice(1))) }
  catch { return null }
}
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function genUserId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlatformPill({ platform }) {
  const p = PLATFORM[platform] || { label:platform, color:'#888', bg:'#88888830' }
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20,
      background:p.bg, color:p.color, border:`1px solid ${p.color}44`,
      fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
      flexShrink:0, whiteSpace:'nowrap',
    }}>{p.label}</span>
  )
}

function StreamerPill({ name, idx }) {
  const c = STREAMER_COLORS[idx % STREAMER_COLORS.length]
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20,
      background:`${c}18`, color:c, border:`1px solid ${c}33`,
      fontSize:10, fontWeight:600, flexShrink:0, whiteSpace:'nowrap',
    }}>{name}</span>
  )
}

function ChatMessage({ msg, sIdx, fresh }) {
  const color = msg.userColor || STREAMER_COLORS[sIdx % STREAMER_COLORS.length]
  return (
    <div className={fresh ? 'fade-up' : ''}
      style={{ display:'flex', alignItems:'flex-start', gap:6, padding:'5px 16px', transition:'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <PlatformPill platform={msg.platform} />
      <StreamerPill name={msg.streamer} idx={sIdx} />
      <div style={{ flex:1, lineHeight:1.5, wordBreak:'break-word', fontSize:14 }}>
        <span style={{ fontWeight:700, color, marginRight:4 }}>{escHtml(msg.username)}</span>
        <span style={{ color:'var(--text)' }}>{escHtml(msg.message)}</span>
      </div>
    </div>
  )
}

function Avatar({ name, color, size=30 }) {
  return (
    <div title={name} style={{
      width:size, height:size, borderRadius:'50%',
      background:`${color}28`, border:`2px solid ${color}66`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size * 0.36, fontWeight:700, color, flexShrink:0,
      userSelect:'none',
    }}>
      {initials(name)}
    </div>
  )
}

// ── Tutorial Modal ────────────────────────────────────────────────────────────

function RoomTutorialModal({ onClose }) {
  const steps = [
    { icon:'🎙', title:'Set up your room', body:'On the setup page, enter each streamer\'s name and their Twitch/Kick username. A room code is generated automatically. Share the link with your co-streamer so you both see the same combined chat.' },
    { icon:'🔗', title:'Share the room', body:'Click the Share button to copy your room link. Anyone with the link can join and see all the chats combined. You\'ll see who\'s connected in the top row.' },
    { icon:'🔒', title:'Lock the room', body:'Once both streamers are in, hit the Lock button to stop anyone else from joining. Locked rooms show a gate page to late arrivals.' },
    { icon:'🤖', title:'C3PO AI assistant', body:'Click the C3PO button to open the AI assistant in a popup. It listens to your mic for the wake word "Hey C3PO" followed by a question — like "Hey C3PO, who won the game last night?" It searches the web and answers in seconds.' },
    { icon:'⚙️', title:'Room settings', body:'The ⚙ gear button lets you change your display name, view streamer channels, and toggle the room lock — all without leaving the chat view.' },
  ]
  return (
    <div className="fade-in" style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(5px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pop-in" style={{
        background:'var(--surface)', border:'1px solid rgba(145,71,255,0.25)',
        borderRadius:20, padding:28, width:480, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.7)',
        maxHeight:'90vh', display:'flex', flexDirection:'column',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>📖</span>
            <div>
              <div style={{ fontWeight:900, fontSize:17, color:'var(--text)' }}>How to use Market Bubble</div>
              <div style={{ fontSize:11, color:'var(--dim)' }}>Chat aggregator + AI assistant</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8,
            color:'var(--muted)', fontSize:18, cursor:'pointer', padding:'2px 8px',
          }}>✕</button>
        </div>

        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:10, paddingRight:4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display:'flex', gap:14, padding:'13px 15px', borderRadius:12,
              background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)',
            }}>
              <div style={{
                width:38, height:38, borderRadius:10, flexShrink:0,
                background:'rgba(145,71,255,0.1)', border:'1px solid rgba(145,71,255,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          marginTop:18, width:'100%', background:'linear-gradient(135deg,#9147ff,#6441a5)',
          color:'#fff', border:'none', borderRadius:10, padding:'11px',
          fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0,
        }}>Got it!</button>
      </div>
    </div>
  )
}

// ── Name prompt modal ─────────────────────────────────────────────────────────

function NameModal({ streamers, onConfirm }) {
  const [name, setName] = useState('')
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20,
    }}>
      <div className="pop-in" style={{
        background:'#16161f', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:18, padding:28, width:380, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize:26, marginBottom:10, textAlign:'center' }}>👤</div>
        <h2 style={{ fontSize:18, fontWeight:800, textAlign:'center', marginBottom:6 }}>Who are you?</h2>
        <p style={{ fontSize:13, color:'#8888aa', textAlign:'center', marginBottom:20 }}>
          Pick your name so others in the room can see you.
        </p>

        {/* Quick picks */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {streamers.filter(s => s.name).map((s, i) => (
            <button key={i} onClick={() => onConfirm(s.name)} style={{
              flex:1, padding:'9px 12px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13,
              background:`${STREAMER_COLORS[i]}18`, color:STREAMER_COLORS[i],
              border:`1px solid ${STREAMER_COLORS[i]}44`,
            }}>{s.name}</button>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize:11, color:'#44445a' }}>or type a name</span>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
        </div>

        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
            placeholder="Your name…"
            style={{
              flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:9, padding:'9px 12px', fontSize:14, color:'#eeeef5', outline:'none',
            }}
          />
          <button onClick={() => name.trim() && onConfirm(name.trim())} style={{
            background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
            border:'none', borderRadius:9, padding:'9px 16px', fontWeight:700, fontSize:13, cursor:'pointer',
          }}>Join →</button>
        </div>

        <button onClick={() => onConfirm('Viewer')} style={{
          marginTop:10, width:'100%', background:'transparent',
          color:'#44445a', border:'none', fontSize:12, cursor:'pointer', padding:'4px',
        }}>Continue as Viewer</button>
      </div>
    </div>
  )
}

// ── Room settings modal ───────────────────────────────────────────────────────

function RoomSettingsModal({ config, roomCode, myName, roomLocked, onNameChange, onToggleLock, lockLoading, onClose }) {
  const navigate = useNavigate()
  const [draftName, setDraftName] = useState(myName || '')
  const [copied,    setCopied]    = useState(false)

  const streamers = config?.streamers || []

  function saveName() {
    const n = draftName.trim()
    if (!n) return
    localStorage.setItem('sc_my_name', n)
    onNameChange(n)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fade-in" style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(5px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pop-in" style={{
        background:'#16161f', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:20, padding:28, width:480, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', gap:20,
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⚙️</span>
            <span style={{ fontWeight:800, fontSize:17, color:'#f0f0f5' }}>Room Settings</span>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8,
            color:'#8888aa', fontSize:18, cursor:'pointer', padding:'2px 8px',
          }}>✕</button>
        </div>

        {/* Your name */}
        <div>
          <label style={mLabel}>Your Display Name</label>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Your name…"
              style={mInput}
            />
            <button onClick={saveName} style={{
              background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
              border:'none', borderRadius:9, padding:'9px 16px', fontWeight:700, fontSize:13, cursor:'pointer',
            }}>Save</button>
          </div>
        </div>

        {/* Room code + share */}
        {roomCode && (
          <div>
            <label style={mLabel}>Room Code</label>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <code style={{
                flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:9, padding:'10px 14px', fontSize:16, fontFamily:'monospace',
                letterSpacing:'0.18em', color:'var(--gold)', fontWeight:700,
              }}>{roomCode}</code>
              <button onClick={copyLink} style={{
                background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                color:      copied ? '#22c55e' : '#8888aa',
                border:`1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius:9, padding:'10px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
                transition:'all .2s', whiteSpace:'nowrap',
              }}>{copied ? '✓ Copied!' : '🔗 Copy Link'}</button>
            </div>
          </div>
        )}

        {/* Lock toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#f0f0f5', marginBottom:3 }}>
              {roomLocked ? '🔒 Room is Locked' : '🔓 Room is Unlocked'}
            </div>
            <div style={{ fontSize:11, color:'#44445a' }}>
              {roomLocked ? 'No new people can join right now' : 'Anyone with the link can join'}
            </div>
          </div>
          <button onClick={() => { onToggleLock(); }} disabled={lockLoading} style={{
            background: roomLocked ? 'rgba(255,215,0,0.1)' : 'rgba(145,71,255,0.1)',
            color:      roomLocked ? 'var(--gold)' : '#9147ff',
            border:`1px solid ${roomLocked ? 'rgba(255,215,0,0.3)' : 'rgba(145,71,255,0.3)'}`,
            borderRadius:9, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>{lockLoading ? '…' : roomLocked ? 'Unlock' : 'Lock'}</button>
        </div>

        {/* Streamers */}
        <div>
          <label style={mLabel}>Streamers in this Room</label>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {streamers.length === 0 && <div style={{ fontSize:13, color:'#44445a' }}>No streamers configured.</div>}
            {streamers.map((s, i) => (
              <div key={i} style={{
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:10, padding:'10px 14px', display:'flex', flexDirection:'column', gap:4,
              }}>
                <div style={{ fontWeight:700, fontSize:14, color: STREAMER_COLORS[i % STREAMER_COLORS.length] }}>{s.name}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {s.twitch && <span style={{ fontSize:12, color:'#9147ff' }}>🟣 Twitch: {s.twitch}</span>}
                  {s.kick   && <span style={{ fontSize:12, color:'#53fc18' }}>🟢 Kick: {s.kick}</span>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { onClose(); navigate('/') }} style={{
            marginTop:10, width:'100%', background:'rgba(255,255,255,0.04)',
            color:'#8888aa', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:9, padding:'9px', fontSize:12, cursor:'pointer',
          }}>✏ Edit Streamers — Back to Setup</button>
        </div>
      </div>
    </div>
  )
}

const mLabel = {
  display:'block', fontSize:12, fontWeight:700, color:'#8888aa',
  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7,
}
const mInput = {
  flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:9, padding:'10px 12px', fontSize:14, color:'#eeeef5', outline:'none',
}

// ── Locked gate ───────────────────────────────────────────────────────────────

function LockedGate() {
  const navigate = useNavigate()
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', gap:16, background:'var(--bg)', padding:20, textAlign:'center',
    }}>
      <div style={{ fontSize:56 }}>🔒</div>
      <h2 style={{ fontSize:22, fontWeight:800 }}>Room Locked</h2>
      <p style={{ color:'#8888aa', fontSize:14, maxWidth:300, lineHeight:1.6 }}>
        The streamer has locked this room. No new viewers can join right now.
      </p>
      <button onClick={() => navigate('/')} style={{
        background:'var(--surface2)', color:'var(--muted)', border:'1px solid var(--border2)',
        borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer',
      }}>← Back to Setup</button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Room() {
  const navigate  = useNavigate()
  const config    = parseConfig()
  const streamers = config?.streamers || []
  const roomCode  = config?.roomCode  || null

  const [messages,    setMessages]    = useState([])
  const [filter,      setFilter]      = useState('all')
  const [autoscroll,  setAutoscroll]  = useState(true)
  const [paused,      setPaused]      = useState(false)
  const [freshIds,    setFreshIds]    = useState(new Set())
  const [copied,      setCopied]      = useState(false)

  // Presence
  const [myName,      setMyName]      = useState(() => localStorage.getItem('sc_my_name') || '')
  const [userId]      = useState(() => {
    let id = sessionStorage.getItem('sc_user_id')
    if (!id) { id = genUserId(); sessionStorage.setItem('sc_user_id', id) }
    return id
  })
  const [roomUsers,   setRoomUsers]   = useState([])
  const [roomLocked,  setRoomLocked]  = useState(false)
  const [isNewcomer,  setIsNewcomer]  = useState(false) // blocked by lock
  const [showName,    setShowName]    = useState(!localStorage.getItem('sc_my_name'))
  const [lockLoading,      setLockLoading]      = useState(false)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [showTutorial,     setShowTutorial]     = useState(false)

  const chatRef  = useRef(null)
  const hbRef    = useRef(null)

  const sIdxMap = {}
  streamers.forEach((s, i) => { sIdxMap[s.name] = i })

  // ── Presence: heartbeat ───────────────────────────────────────────────────

  const sendHeartbeat = useCallback(async (name) => {
    if (!roomCode || !name) return
    try {
      const res  = await fetch('/api/presence', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomCode, userId, name }),
      })
      const data = await res.json()
      if (res.status === 403 && data.locked && !roomUsers.find(u => u.userId === userId)) {
        setIsNewcomer(true)
        return
      }
      if (data.users)   setRoomUsers(data.users)
      if (data.locked !== undefined) setRoomLocked(data.locked)
    } catch (_) {}
  }, [roomCode, userId])

  const fetchUsers = useCallback(async () => {
    if (!roomCode) return
    try {
      const res  = await fetch(`/api/presence?room=${encodeURIComponent(roomCode)}`)
      const data = await res.json()
      if (data.users)  setRoomUsers(data.users)
      if (data.locked !== undefined) setRoomLocked(data.locked)
    } catch (_) {}
  }, [roomCode])

  useEffect(() => {
    if (!myName || !roomCode) return
    sendHeartbeat(myName)
    hbRef.current = setInterval(() => sendHeartbeat(myName), HEARTBEAT_MS)
    fetchUsers()
    const pollInterval = setInterval(fetchUsers, HEARTBEAT_MS)
    return () => {
      clearInterval(hbRef.current)
      clearInterval(pollInterval)
      fetch('/api/presence', {
        method:'DELETE', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomCode, userId }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [myName, roomCode, sendHeartbeat, fetchUsers])

  function handleNameConfirm(name) {
    setMyName(name)
    localStorage.setItem('sc_my_name', name)
    setShowName(false)
  }

  // ── Lock / unlock ─────────────────────────────────────────────────────────

  async function toggleLock() {
    if (!roomCode || lockLoading) return
    setLockLoading(true)
    try {
      const action = roomLocked ? 'unlock' : 'lock'
      await fetch('/api/presence', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomCode, userId, name: myName, action }),
      })
      setRoomLocked(v => !v)
    } catch (_) {}
    setLockLoading(false)
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const next = [...prev, msg]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
    setFreshIds(prev => {
      const n = new Set(prev)
      n.add(msg.id)
      setTimeout(() => setFreshIds(p => { const x = new Set(p); x.delete(msg.id); return x }), 600)
      return n
    })
  }, [])

  useTwitchChat(streamers, addMessage)
  useKickChat(streamers, addMessage)

  useEffect(() => {
    if (autoscroll && chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, autoscroll])

  function handleScroll() {
    const el = chatRef.current; if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setAutoscroll(near); setPaused(!near)
  }

  function jumpBottom() {
    setAutoscroll(true); setPaused(false)
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (!config) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
        <div style={{ fontSize:48 }}>🤷</div>
        <p style={{ color:'var(--muted)', fontSize:15 }}>No room config found.</p>
        <button onClick={() => navigate('/')} style={btnPrimary}>← Back to Setup</button>
      </div>
    )
  }

  if (isNewcomer) return <LockedGate />

  const visible = filter === 'all' ? messages : messages.filter(m => m.platform === filter)
  const counts  = messages.reduce((a,m) => ({...a, [m.platform]:(a[m.platform]||0)+1}), {})

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--bg)' }}>

      {/* Name modal */}
      {showName && <NameModal streamers={streamers} onConfirm={handleNameConfirm} />}

      {/* Tutorial modal */}
      {showTutorial && <RoomTutorialModal onClose={() => setShowTutorial(false)} />}

      {/* Room settings modal */}
      {showRoomSettings && (
        <RoomSettingsModal
          config={config}
          roomCode={roomCode}
          myName={myName}
          roomLocked={roomLocked}
          lockLoading={lockLoading}
          onNameChange={name => { setMyName(name); setShowRoomSettings(false) }}
          onToggleLock={toggleLock}
          onClose={() => setShowRoomSettings(false)}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
        flexShrink:0, padding:'0 16px',
      }}>

        {/* Row 1: branding + action buttons */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 0 10px', borderBottom:'1px solid var(--border)', gap:10,
        }}>
          {/* Left: logo + room info */}
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>🎙</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:17, letterSpacing:'-0.3px' }}>StreamChat</div>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--muted)', marginTop:1 }}>
                {roomCode && (
                  <code style={{ fontFamily:'monospace', letterSpacing:'0.12em', color:'var(--text)', fontWeight:700, fontSize:12 }}>
                    {roomCode}
                  </code>
                )}
                {roomLocked && <span title="Room locked">🔒</span>}
                <span style={{ color:'var(--dim)' }}>·</span>
                <span style={{ color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {streamers.map(s => s.name).join(' + ')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>

            {/* C3PO — big prominent button */}
            <button
              onClick={() => window.open(`/c3po${roomCode ? '?room=' + encodeURIComponent(roomCode) : ''}`, '_blank', 'width=520,height=840,menubar=no,toolbar=no')}
              style={{
                display:'flex', alignItems:'center', gap:7,
                background:'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.08))',
                color:'var(--gold)', border:'1px solid rgba(255,215,0,0.35)',
                borderRadius:10, padding:'9px 16px', fontSize:14, fontWeight:700, cursor:'pointer',
                boxShadow:'0 2px 12px rgba(255,215,0,0.1)',
                transition:'all .15s',
              }}
              onMouseOver={e => e.currentTarget.style.background='linear-gradient(135deg,rgba(255,215,0,0.22),rgba(255,215,0,0.12))'}
              onMouseOut={e  => e.currentTarget.style.background='linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.08))'}
              title="Open C3PO AI assistant"
            >
              <span style={{ fontSize:18 }}>🤖</span> C3PO
            </button>

            {/* Lock / Unlock */}
            <button onClick={toggleLock} disabled={lockLoading} style={{
              display:'flex', alignItems:'center', gap:6,
              background: roomLocked ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
              color:      roomLocked ? 'var(--gold)' : 'var(--muted)',
              border:`1px solid ${roomLocked ? 'rgba(255,215,0,0.3)' : 'var(--border2)'}`,
              borderRadius:10, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer',
              transition:'all .2s',
            }} title={roomLocked ? 'Unlock room — allow new joiners' : 'Lock room — no new joiners'}>
              {lockLoading ? '…' : roomLocked ? '🔒 Locked' : '🔓 Lock'}
            </button>

            {/* Copy link */}
            <button onClick={copyLink} style={{
              display:'flex', alignItems:'center', gap:6,
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
              color:      copied ? 'var(--success)' : 'var(--muted)',
              border:`1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border2)'}`,
              borderRadius:10, padding:'9px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
              transition:'all .2s',
            }} title="Copy invite link">
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>

            {/* Tutorial */}
            <button onClick={() => setShowTutorial(true)} style={{
              background:'rgba(145,71,255,0.08)', color:'#9147ff',
              border:'1px solid rgba(145,71,255,0.25)', borderRadius:10,
              padding:'9px 13px', fontSize:14, fontWeight:800, cursor:'pointer',
            }} title="How to use Market Bubble">?</button>

            {/* Settings gear */}
            <button onClick={() => setShowRoomSettings(true)} style={{
              background:'rgba(255,255,255,0.04)', color:'var(--muted)',
              border:'1px solid var(--border2)', borderRadius:10,
              padding:'9px 13px', fontSize:16, cursor:'pointer',
            }} title="Room settings">⚙</button>
          </div>
        </div>

        {/* Row 2: who's in the room */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 0',
          minHeight:42,
        }}>
          <span style={{ fontSize:12, color:'var(--dim)', fontWeight:600, flexShrink:0 }}>
            👥 {roomUsers.length} in room
          </span>

          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', flex:1 }}>
            {roomUsers.length === 0 ? (
              <span style={{ fontSize:12, color:'var(--dim)', fontStyle:'italic' }}>
                {roomCode ? 'No one connected yet…' : 'Presence requires a room code'}
              </span>
            ) : (
              roomUsers.map((u, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <Avatar name={u.name} color={u.color} size={26} />
                  <span style={{ fontSize:12, color: u.name === myName ? 'var(--text)' : 'var(--muted)', fontWeight: u.name === myName ? 700 : 400 }}>
                    {u.name}{u.name === myName ? ' (you)' : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Change name */}
          <button onClick={() => setShowName(true)} style={{
            background:'transparent', border:'none', color:'var(--dim)',
            fontSize:11, cursor:'pointer', flexShrink:0, padding:'2px 6px',
            textDecoration:'underline',
          }}>
            {myName ? `as ${myName}` : 'Set name'}
          </button>

          {/* Clear + message count */}
          <button onClick={() => setMessages([])} style={{
            background:'rgba(255,255,255,0.04)', color:'var(--dim)',
            border:'1px solid var(--border)', borderRadius:6,
            padding:'3px 10px', fontSize:11, cursor:'pointer', flexShrink:0,
          }}>Clear</button>
          <span style={{ fontSize:11, color:'var(--dim)', flexShrink:0 }}>
            {messages.length} msgs
          </span>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:6, padding:'7px 16px',
        background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0,
      }}>
        {[['all', 'All', messages.length, 'var(--muted)'],
          ...Object.entries(PLATFORM).map(([p, m]) => [p, m.label, counts[p]||0, m.color])
        ].map(([id, label, count, color]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
            border:  filter===id ? `1px solid ${color}` : '1px solid transparent',
            background: filter===id ? `${color}18` : 'transparent',
            color:   filter===id ? color : 'var(--muted)',
            transition:'all .15s',
          }}>
            {label} <span style={{ opacity:.6 }}>({count})</span>
          </button>
        ))}
      </div>

      {/* ── Chat ── */}
      <div ref={chatRef} onScroll={handleScroll}
        style={{ flex:1, overflowY:'auto', padding:'8px 0' }}
      >
        {visible.length === 0 && (
          <div style={{ padding:'60px 20px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
            <div style={{ color:'var(--muted)', fontSize:14, marginBottom:6 }}>Waiting for messages…</div>
            <div style={{ color:'var(--dim)', fontSize:12 }}>Make sure your streams are live and channels are correct.</div>
          </div>
        )}
        {visible.map(msg => (
          <ChatMessage key={msg.id} msg={msg} sIdx={sIdxMap[msg.streamer]??0} fresh={freshIds.has(msg.id)} />
        ))}
      </div>

      {/* ── Paused banner ── */}
      {paused && (
        <div onClick={jumpBottom} style={{
          background:'rgba(145,71,255,0.12)', borderTop:'1px solid rgba(145,71,255,0.25)',
          padding:'9px', textAlign:'center', fontSize:13, color:'var(--twitch)',
          cursor:'pointer', flexShrink:0,
        }}>↓ New messages — click to jump</div>
      )}
    </div>
  )
}

const btnPrimary = {
  background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
  border:'none', borderRadius:'var(--r)', padding:'10px 22px',
  fontSize:14, fontWeight:700, cursor:'pointer',
}
