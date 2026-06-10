import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTwitchChat } from '../hooks/useTwitchChat.js'
import { useKickChat   } from '../hooks/useKickChat.js'

const SNAP = 8
function snap(v) { return Math.round(v / SNAP) * SNAP }

function parseConfig() {
  try { return JSON.parse(atob(window.location.hash.slice(1))) }
  catch { return null }
}

// ── Market Ticker ─────────────────────────────────────────────────────────────

function MarketTicker() {
  const [items, setItems] = useState([
    { label:'BTC', value:'…', change:null },
    { label:'ETH', value:'…', change:null },
    { label:'SOL', value:'…', change:null },
    { label:'S&P 500', value:'…', change:null },
  ])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/market-ticker')
        if (res.ok) setItems(await res.json())
      } catch (_) {}
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  // Triple for seamless loop
  const all = [...items, ...items, ...items]

  return (
    <div style={{
      height:32, background:'#06060c', borderBottom:'1px solid rgba(255,255,255,0.07)',
      overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center',
    }}>
      <div style={{ display:'flex', gap:40, animation:'tickerScroll 40s linear infinite', whiteSpace:'nowrap', paddingLeft:'100%' }}>
        {all.map((p, i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:12 }}>
            <span style={{ color:'#555570', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{p.label}</span>
            <span style={{ color:'#eeeef5', fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{p.value}</span>
            {p.change != null && (
              <span style={{ color: p.change >= 0 ? '#22c55e' : '#ef4444', fontWeight:700 }}>
                {p.change >= 0 ? '▲' : '▼'} {Math.abs(p.change).toFixed(2)}%
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Widget Shell ──────────────────────────────────────────────────────────────

function Widget({ id, title, icon, accent, x, y, w, h, minW=240, minH=180, zIndex, onDrag, onResize, onFocus, onClose, children }) {
  const headerRef = useRef(null)
  const col = accent || '#9147ff'

  function startDrag(e) {
    if (!headerRef.current.contains(e.target)) return
    e.preventDefault()
    onFocus(id)
    const ox = e.clientX - x, oy = e.clientY - y
    const move = me => onDrag(id, snap(Math.max(0, me.clientX - ox)), snap(Math.max(0, me.clientY - oy)))
    const up   = () => document.removeEventListener('mousemove', move)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up, { once:true })
  }

  function startResize(e) {
    e.preventDefault(); e.stopPropagation()
    const sw = w, sh = h, sx = e.clientX, sy = e.clientY
    const move = me => onResize(id, snap(Math.max(minW, sw + me.clientX - sx)), snap(Math.max(minH, sh + me.clientY - sy)))
    const up   = () => document.removeEventListener('mousemove', move)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up, { once:true })
  }

  return (
    <div
      onMouseDown={() => onFocus(id)}
      style={{
        position:'absolute', left:x, top:y, width:w, height:h, zIndex,
        background:'#12121c', border:`1px solid ${col}22`,
        borderTop:`2px solid ${col}88`,
        borderRadius:12, display:'flex', flexDirection:'column',
        boxShadow:`0 8px 40px rgba(0,0,0,0.5), 0 0 0 0px ${col}`,
        overflow:'hidden', transition:'box-shadow .15s',
      }}
    >
      {/* Drag header */}
      <div
        ref={headerRef}
        onMouseDown={startDrag}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'7px 12px', background:'#1a1a2a', cursor:'grab',
          borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, userSelect:'none',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:700, color:'#eeeef5' }}>
          <span style={{ fontSize:15 }}>{icon}</span>
          <span>{title}</span>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onClose(id)}
          style={{ background:'none', border:'none', color:'#33334a', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px', transition:'color .1s' }}
          onMouseOver={e => e.currentTarget.style.color = '#888'}
          onMouseOut={e  => e.currentTarget.style.color = '#33334a'}
        >✕</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {children}
      </div>

      {/* Resize corner */}
      <div
        onMouseDown={startResize}
        style={{
          position:'absolute', right:0, bottom:0, width:16, height:16,
          cursor:'nwse-resize', zIndex:10,
          background:`linear-gradient(135deg, transparent 50%, ${col}44 50%)`,
          borderRadius:'0 0 12px 0',
        }}
      />
    </div>
  )
}

// ── Stream Player ─────────────────────────────────────────────────────────────

function StreamPlayer() {
  const [input,  setInput]  = useState('')
  const [active, setActive] = useState(null)

  function load(val) {
    const v = (val || input).trim()
    if (!v) return
    const tm = v.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/)
    if (tm || /^[a-zA-Z0-9_]{3,25}$/.test(v)) {
      setActive({ platform:'twitch', channel: tm ? tm[1] : v }); return
    }
    const km = v.match(/(?:kick\.com\/)([a-zA-Z0-9_]+)/)
    if (km) { setActive({ platform:'kick', channel: km[1] }); return }
    setActive({ platform:'other', url: v })
  }

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

  if (active) {
    const src = active.platform === 'twitch'
      ? `https://player.twitch.tv/?channel=${active.channel}&parent=${domain}&autoplay=true`
      : active.platform === 'kick'
        ? `https://player.kick.com/${active.channel}`
        : active.url
    return (
      <div style={{ position:'relative', width:'100%', height:'100%' }}>
        <iframe src={src} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen allow="autoplay" title="stream" />
        <button onClick={() => setActive(null)} style={{
          position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.75)',
          border:'none', color:'#fff', borderRadius:6, padding:'4px 10px',
          fontSize:11, cursor:'pointer', fontWeight:600,
        }}>⬅ Change</button>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:14, padding:20 }}>
      <div style={{ fontSize:40 }}>📺</div>
      <div style={{ fontSize:13, color:'#8888aa', textAlign:'center', lineHeight:1.6 }}>
        Paste a Twitch or Kick URL,<br />or type a username
      </div>
      <div style={{ display:'flex', gap:8, width:'100%', maxWidth:340 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="twitch.tv/username  or  kick.com/username"
          style={{
            flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:8, padding:'8px 12px', fontSize:12, color:'#eeeef5', outline:'none',
          }}
        />
        <button onClick={() => load()} style={{
          background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
          border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>Load</button>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {['twitch.tv/', 'kick.com/'].map(hint => (
          <span key={hint} style={{ fontSize:10, color:'#33334a', background:'rgba(255,255,255,0.03)', borderRadius:4, padding:'3px 8px' }}>{hint}…</span>
        ))}
      </div>
    </div>
  )
}

// ── Combined Chat ─────────────────────────────────────────────────────────────

const PLAT = { twitch:{ color:'#9147ff', bg:'#9147ff22' }, kick:{ color:'#53fc18', bg:'#53fc1822' } }

function CombinedChat({ streamers }) {
  const [msgs,    setMsgs]    = useState([])
  const [filter,  setFilter]  = useState('all')
  const [muted,   setMuted]   = useState(new Set())
  const [banned,  setBanned]  = useState('')
  const [vipOnly, setVipOnly] = useState(false)
  const [showCfg, setShowCfg] = useState(false)
  const chatRef = useRef(null)

  const add = useCallback(msg => setMsgs(p => [...p.slice(-299), msg]), [])
  useTwitchChat(streamers, add)
  useKickChat(streamers, add)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs])

  const bwords = banned.split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
  const visible = msgs.filter(m => {
    if (muted.has(m.platform)) return false
    if (filter !== 'all' && m.platform !== filter) return false
    if (bwords.some(w => m.message.toLowerCase().includes(w))) return false
    if (vipOnly && !m.username.startsWith('#')) return false // placeholder VIP logic
    return true
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        {['all','twitch','kick'].map(p => {
          const c = PLAT[p]?.color || '#9147ff'
          return (
            <button key={p} onClick={() => setFilter(p)} style={{
              padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, cursor:'pointer',
              background: filter===p ? c+'22' : 'transparent',
              color: filter===p ? c : '#44445a',
              border: `1px solid ${filter===p ? c+'55' : 'transparent'}`,
            }}>{p === 'all' ? 'All' : p[0].toUpperCase()+p.slice(1)} {p !== 'all' ? `(${msgs.filter(m=>m.platform===p).length})` : `(${msgs.length})`}</button>
          )
        })}
        <button onClick={() => setShowCfg(v=>!v)} style={{ marginLeft:'auto', background:'rgba(255,255,255,0.04)', border:'none', borderRadius:5, color:'#44445a', fontSize:10, cursor:'pointer', padding:'3px 7px' }}>⚙ Filter</button>
      </div>

      {/* Filter config */}
      {showCfg && (
        <div style={{ padding:'8px 10px', background:'rgba(0,0,0,0.4)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
          <div style={{ fontSize:10, color:'#55556a', marginBottom:5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Mute platforms</div>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            {['twitch','kick'].map(p => (
              <button key={p} onClick={() => setMuted(prev => { const n=new Set(prev); n.has(p)?n.delete(p):n.add(p); return n })} style={{
                padding:'3px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                background: muted.has(p) ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                color: muted.has(p) ? '#f87171' : '#8888aa',
                border:`1px solid ${muted.has(p) ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}>{muted.has(p) ? '🔇' : '🔊'} {p}</button>
            ))}
          </div>
          <input value={banned} onChange={e=>setBanned(e.target.value)} placeholder="Banned words (comma-separated)…"
            style={{ width:'100%', background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'5px 8px', fontSize:11, color:'#eeeef5', outline:'none', boxSizing:'border-box' }} />
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
        {visible.length === 0 && <div style={{ padding:24, textAlign:'center', color:'#22223a', fontSize:12 }}>Waiting for messages…</div>}
        {visible.map(msg => {
          const pc = PLAT[msg.platform]?.color || '#8888aa'
          const uc = msg.userColor || pc
          return (
            <div key={msg.id} style={{ padding:'3px 10px', fontSize:12.5, lineHeight:1.5 }}>
              <span style={{ fontSize:8, color:pc, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', marginRight:5 }}>{msg.platform[0]}</span>
              <span style={{ fontWeight:700, color:uc, marginRight:4 }}>{msg.username}</span>
              <span style={{ color:'#b0b0c8' }}>{msg.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Viewer Counts ─────────────────────────────────────────────────────────────

function ViewerCounts({ streamers }) {
  const [counts, setCounts] = useState({})

  useEffect(() => {
    async function load() {
      const out = {}
      for (const s of streamers) {
        if (s.twitch) {
          try {
            const r = await fetch(`/api/viewer-counts?platform=twitch&channel=${encodeURIComponent(s.twitch)}`)
            if (r.ok) out[`tw_${s.twitch}`] = { platform:'twitch', name:s.twitch, ...(await r.json()) }
          } catch (_) {}
        }
        if (s.kick) {
          try {
            const r = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(s.kick)}`, { headers:{ Accept:'application/json' } })
            if (r.ok) {
              const d = await r.json()
              out[`kk_${s.kick}`] = { platform:'kick', name:s.kick, viewers: d.livestream?.viewer_count??0, live:!!d.livestream, title:d.livestream?.session_title||'' }
            }
          } catch (_) {}
        }
      }
      setCounts(out)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [JSON.stringify(streamers)])

  const entries = Object.values(counts)
  const total   = entries.reduce((s,e) => s+(e.viewers||0), 0)

  return (
    <div style={{ padding:14, overflowY:'auto', height:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Big total */}
      <div style={{ textAlign:'center', padding:'10px 0 14px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize:42, fontWeight:900, color:'#eeeef5', lineHeight:1 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize:11, color:'#44445a', marginTop:4, letterSpacing:'0.06em', textTransform:'uppercase' }}>Total Viewers</div>
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize:11, color:'#33334a', textAlign:'center', lineHeight:1.7 }}>
          Kick pulls automatically.<br/>
          For Twitch counts, add<br/>
          <code style={{ color:'#9147ff' }}>TWITCH_CLIENT_ID</code> +<br/>
          <code style={{ color:'#9147ff' }}>TWITCH_CLIENT_SECRET</code><br/>
          to your Vercel environment.
        </div>
      ) : entries.map(e => {
        const pc = e.platform === 'twitch' ? '#9147ff' : '#53fc18'
        return (
          <div key={e.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: e.live?'#22c55e':'#ef4444', boxShadow: e.live?'0 0 6px #22c55e':'none', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:pc }}>{e.name}</div>
              {e.title && <div style={{ fontSize:10, color:'#33334a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</div>}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'#eeeef5', flexShrink:0 }}>{(e.viewers||0).toLocaleString()}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Polymarket ────────────────────────────────────────────────────────────────

function Polymarket() {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)

  useEffect(() => {
    async function load() {
      setErr(null)
      try {
        const r = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&sortBy=volumeNum&order=DESC')
        if (!r.ok) throw new Error(`${r.status}`)
        setMarkets(await r.json())
      } catch (e) { setErr(e.message) }
      setLoading(false)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div style={{ padding:24, textAlign:'center', color:'#44445a', fontSize:12 }}>Loading markets…</div>
  if (err)     return <div style={{ padding:16, color:'#f87171', fontSize:12 }}>⚠ Could not load Polymarket: {err}</div>

  return (
    <div style={{ overflowY:'auto', height:'100%' }}>
      {markets.map((m, i) => {
        let prices = [], outcomes = []
        try { prices   = JSON.parse(m.outcomePrices || '[]') } catch (_) {}
        try { outcomes = JSON.parse(m.outcomes       || '[]') } catch (_) {}
        const yesP = prices[0] != null ? parseFloat(prices[0]) : null
        const noP  = prices[1] != null ? parseFloat(prices[1]) : null

        return (
          <div key={m.id||i} style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <a href={`https://polymarket.com/event/${m.slug||''}`} target="_blank" rel="noreferrer"
              style={{ fontSize:12, fontWeight:600, color:'#eeeef5', lineHeight:1.45, display:'block', marginBottom:8, textDecoration:'none' }}
              onMouseOver={e=>e.currentTarget.style.color='#a0a0ff'}
              onMouseOut={e =>e.currentTarget.style.color='#eeeef5'}
            >
              {m.question||m.title}
            </a>
            {(yesP!==null||noP!==null) && (
              <div style={{ display:'flex', gap:6 }}>
                {yesP!==null && (
                  <div style={{ flex:1, padding:'5px 8px', borderRadius:6, textAlign:'center', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize:15, fontWeight:900, color:'#22c55e' }}>{Math.round(yesP*100)}¢</div>
                    <div style={{ fontSize:9, color:'#22c55e88', textTransform:'uppercase', letterSpacing:'0.06em' }}>{outcomes[0]||'Yes'}</div>
                  </div>
                )}
                {noP!==null && (
                  <div style={{ flex:1, padding:'5px 8px', borderRadius:6, textAlign:'center', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:15, fontWeight:900, color:'#ef4444' }}>{Math.round(noP*100)}¢</div>
                    <div style={{ fontSize:9, color:'#ef444488', textTransform:'uppercase', letterSpacing:'0.06em' }}>{outcomes[1]||'No'}</div>
                  </div>
                )}
              </div>
            )}
            {m.volume && <div style={{ fontSize:10, color:'#33334a', marginTop:5 }}>Vol: ${parseFloat(m.volume).toLocaleString('en-US',{maximumFractionDigits:0})}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Twitch IRC send hook ──────────────────────────────────────────────────────

function useTwitchSend(token, username) {
  const wsRef    = useRef(null)
  const [ready,  setReady]  = useState(false)
  const joined   = useRef(new Set())

  useEffect(() => {
    if (!token || !username) { setReady(false); return }
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(`PASS oauth:${token}`)
      ws.send(`NICK ${username.toLowerCase()}`)
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      setReady(true)
    }
    ws.onmessage = e => { if (e.data.startsWith('PING')) ws.send('PONG :tmi.twitch.tv') }
    ws.onclose = ws.onerror = () => setReady(false)
    return () => { ws.close(); joined.current = new Set() }
  }, [token, username])

  function send(channels, message) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return false
    channels.forEach(ch => {
      const c = ch.toLowerCase()
      if (!joined.current.has(c)) { wsRef.current.send(`JOIN #${c}`); joined.current.add(c) }
      wsRef.current.send(`PRIVMSG #${c} :${message}`)
    })
    return true
  }

  return { ready, send }
}

// ── PKCE helpers for X OAuth ──────────────────────────────────────────────────

function genCodeVerifier() {
  const arr = new Uint8Array(32)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, d => ('0'+d.toString(16)).slice(-2)).join('')
}

async function genCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}

// ── Dashboard Settings Modal ──────────────────────────────────────────────────

function DashboardSettings({ onClose }) {
  const [twClientId, setTwClientId] = useState(() => localStorage.getItem('twitch_client_id') || '')
  const [xClientId,  setXClientId]  = useState(() => localStorage.getItem('x_client_id')     || '')

  function save() {
    localStorage.setItem('twitch_client_id', twClientId.trim())
    localStorage.setItem('x_client_id',      xClientId.trim())
    onClose()
  }

  const iStyle = {
    width:'100%', background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:8, padding:'9px 12px', fontSize:13, color:'#eeeef5', outline:'none',
    boxSizing:'border-box',
  }
  const origin = window.location.origin

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'#14141f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16,
        padding:28, width:460, maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
        maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>⚙ Dashboard Settings</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#44445a', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>

        {/* Twitch */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9147ff', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>🟣 Twitch — Chat Send</div>
          <p style={{ fontSize:12, color:'#55556a', lineHeight:1.6, margin:'0 0 8px' }}>
            Register a free app at <a href="https://dev.twitch.tv/console/apps/create" target="_blank" rel="noreferrer" style={{color:'#9147ff'}}>dev.twitch.tv</a> with redirect URI:<br/>
            <code style={{color:'#a78bfa',fontSize:11,wordBreak:'break-all'}}>{origin}/oauth/twitch</code>
          </p>
          <input value={twClientId} onChange={e=>setTwClientId(e.target.value)} placeholder="Twitch Client ID" style={iStyle} />
        </div>

        {/* X */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✖ X (Twitter) — Post Tweets</div>
          <p style={{ fontSize:12, color:'#55556a', lineHeight:1.6, margin:'0 0 8px' }}>
            Create an app at <a href="https://developer.twitter.com/en/portal/apps/new" target="_blank" rel="noreferrer" style={{color:'#94a3b8'}}>developer.twitter.com</a> with redirect URI:<br/>
            <code style={{color:'#94a3b8',fontSize:11,wordBreak:'break-all'}}>{origin}/oauth/x</code><br/>
            Also add <code style={{color:'#94a3b8',fontSize:11}}>X_CLIENT_ID</code> + <code style={{color:'#94a3b8',fontSize:11}}>X_CLIENT_SECRET</code> to Vercel env vars.
          </p>
          <input value={xClientId} onChange={e=>setXClientId(e.target.value)} placeholder="X (Twitter) Client ID" style={iStyle} />
        </div>

        {/* Kick */}
        <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(83,252,24,0.04)', border:'1px solid rgba(83,252,24,0.08)', marginBottom:22 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#53fc18', marginBottom:3 }}>🟢 Kick — Chat Send</div>
          <div style={{ fontSize:12, color:'#33463a' }}>Kick's public send API is in early access — will be added once available.</div>
        </div>

        <button onClick={save} style={{
          width:'100%', background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
          border:'none', borderRadius:9, padding:'11px', fontSize:14, fontWeight:700, cursor:'pointer',
        }}>Save Settings</button>
      </div>
    </div>
  )
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

function Broadcast({ streamers, twitchAuth, xAuth, onConnectTwitch, onConnectX }) {
  const [msg,    setMsg]    = useState('')
  const [status, setStatus] = useState(null)
  const [sendTw, setSendTw] = useState(true)
  const [sendX,  setSendX]  = useState(true)

  const { ready: twReady, send: twSend } = useTwitchSend(twitchAuth?.token, twitchAuth?.username)
  const twitchChannels = streamers.map(s=>s.twitch).filter(Boolean)
  const xReady  = !!xAuth?.token
  const canSend = msg.trim() && ((sendTw && twReady) || (sendX && xReady))

  async function doSend() {
    const text = msg.trim()
    if (!text) return
    setMsg('')
    const results = []

    if (sendTw && twReady && twitchChannels.length) {
      const ok = twSend(twitchChannels, text)
      results.push(ok ? `Twitch (${twitchChannels.length}ch)` : null)
    }
    if (sendX && xReady) {
      try {
        const r = await fetch('/api/x-tweet', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ text, accessToken: xAuth.token }),
        })
        const d = await r.json()
        results.push(r.ok ? 'X' : `X error: ${d.error}`)
      } catch (e) { results.push(`X error: ${e.message}`) }
    }

    const sent = results.filter(Boolean)
    if (sent.length) {
      setStatus({ ok:true,  text:`Sent to ${sent.join(', ')}` })
    } else {
      setStatus({ ok:false, text:'Nothing sent — connect a platform first' })
    }
    setTimeout(() => setStatus(null), 3500)
  }

  function PlatRow({ color, label, connected, username, onConnect, onDisconnect, disconnectKeys }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
          background: connected ? '#22c55e':'#333',
          boxShadow: connected ? '0 0 6px #22c55e':'none',
        }} />
        <span style={{ fontSize:12, fontWeight:700, color, flex:1 }}>
          {label}{username ? ` — @${username}` : ''}
        </span>
        {connected
          ? <button onClick={()=>{ disconnectKeys.forEach(k=>localStorage.removeItem(k)); onDisconnect() }}
              style={{ fontSize:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', borderRadius:5, padding:'2px 8px', cursor:'pointer' }}>
              Disconnect
            </button>
          : <button onClick={onConnect}
              style={{ fontSize:11, background:`${color}22`, border:`1px solid ${color}44`, color, borderRadius:5, padding:'3px 10px', cursor:'pointer', fontWeight:700 }}>
              Connect →
            </button>
        }
      </div>
    )
  }

  function ToggleBtn({ active, disabled, color, label, onClick }) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        flex:1, padding:'5px', borderRadius:7, fontSize:11, fontWeight:700,
        cursor: disabled ? 'not-allowed':'pointer',
        background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
        color: active ? color : '#33334a',
        border:`1px solid ${active ? color+'44':'rgba(255,255,255,0.06)'}`,
        transition:'all .15s', opacity: disabled ? 0.4 : 1,
      }}>{active ? '✓' : '○'} {label}</button>
    )
  }

  const [, forceUpdate] = useState(0)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Connection status */}
      <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <PlatRow color="#9147ff" label="Twitch" connected={twReady} username={twitchAuth?.username}
          onConnect={onConnectTwitch}
          onDisconnect={() => forceUpdate(n=>n+1)}
          disconnectKeys={['twitch_token','twitch_username']} />
        <PlatRow color="#e2e8f0" label="X (Twitter)" connected={xReady} username={xAuth?.username}
          onConnect={onConnectX}
          onDisconnect={() => forceUpdate(n=>n+1)}
          disconnectKeys={['x_token','x_refresh_token','x_username']} />
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#1a1a2a', flexShrink:0 }} />
          <span style={{ fontSize:12, color:'#2a2a3a' }}>Kick — coming soon</span>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ padding:'7px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', flexShrink:0, display:'flex', gap:5 }}>
        <ToggleBtn active={sendTw} disabled={!twReady} color="#9147ff" label="Twitch" onClick={()=>setSendTw(v=>!v)} />
        <ToggleBtn active={sendX}  disabled={!xReady}  color="#e2e8f0" label="X"      onClick={()=>setSendX(v=>!v)} />
        <ToggleBtn active={false}  disabled={true}     color="#53fc18" label="Kick"   onClick={()=>{}} />
      </div>

      {/* Send area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:8, minHeight:0 }}>
        <textarea
          value={msg}
          onChange={e=>setMsg(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),doSend())}
          placeholder={canSend||msg ? 'Type a message… (Enter to send to all platforms)' : 'Connect a platform above to start sending…'}
          style={{
            flex:1, resize:'none', background:'#0a0a0f',
            border:`1px solid ${msg.trim()&&canSend ? 'rgba(145,71,255,0.35)':'rgba(255,255,255,0.08)'}`,
            borderRadius:9, padding:'10px 12px', fontSize:14, color:'#eeeef5', outline:'none',
            fontFamily:'inherit', transition:'border-color .15s',
          }}
        />
        <button onClick={doSend} disabled={!canSend} style={{
          padding:'11px', borderRadius:9, fontSize:14, fontWeight:800,
          cursor: canSend ? 'pointer':'not-allowed',
          background: canSend ? 'linear-gradient(135deg,#9147ff,#6441a5)':'rgba(255,255,255,0.04)',
          color: canSend ? '#fff':'#33334a',
          border:'none', transition:'all .15s',
          boxShadow: canSend ? '0 4px 18px rgba(145,71,255,0.3)':'none',
        }}>
          📢 Send to All Platforms
        </button>
        {status && (
          <div style={{
            padding:'7px 10px', borderRadius:7, fontSize:12, textAlign:'center',
            background: status.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
            color: status.ok?'#22c55e':'#f87171',
            border:`1px solid ${status.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,
          }}>{status.ok?'✓':'⚠'} {status.text}</div>
        )}
      </div>
    </div>
  )
}

// ── Default layout ────────────────────────────────────────────────────────────

function defaultWidgets() {
  return [
    { id:'stream',     title:'Live Stream',     icon:'📺', accent:'#9147ff', x:20,  y:20,  w:640, h:420, minW:300, minH:200, zIndex:1, visible:true },
    { id:'chat',       title:'Combined Chat',   icon:'💬', accent:'#54c0ff', x:680, y:20,  w:320, h:560, minW:240, minH:200, zIndex:1, visible:true },
    { id:'viewers',    title:'Viewer Counts',   icon:'👥', accent:'#22c55e', x:20,  y:460, w:300, h:300, minW:220, minH:180, zIndex:1, visible:true },
    { id:'polymarket', title:'Polymarket',      icon:'📊', accent:'#3b82f6', x:340, y:460, w:320, h:300, minW:240, minH:200, zIndex:1, visible:true },
    { id:'broadcast',  title:'Send to Chat',    icon:'📢', accent:'#f59e0b', x:680, y:600, w:320, h:380, minW:260, minH:280, zIndex:1, visible:true },
  ]
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate  = useNavigate()
  const config    = parseConfig()
  const streamers = config?.streamers || []

  const [widgets, setWidgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mb_dash_layout') || 'null') || defaultWidgets() }
    catch { return defaultWidgets() }
  })

  // ── Twitch auth ──────────────────────────────────────────────────────────────
  const [twitchAuth,   setTwitchAuth]   = useState(() => {
    const t = localStorage.getItem('twitch_token')
    const u = localStorage.getItem('twitch_username')
    return t && u ? { token:t, username:u } : null
  })
  const [connectingTw, setConnectingTw] = useState(false)

  useEffect(() => {
    const pending = localStorage.getItem('twitch_pending_token')
    if (pending) { localStorage.removeItem('twitch_pending_token'); fetchAndStoreTwitchUser(pending) }
  }, [])

  async function fetchAndStoreTwitchUser(token) {
    const clientId = localStorage.getItem('twitch_client_id') || ''
    if (!clientId) return
    try {
      const r = await fetch('https://api.twitch.tv/helix/users', { headers:{ 'Authorization':`Bearer ${token}`, 'Client-Id':clientId } })
      const d = await r.json()
      const username = d.data?.[0]?.login
      if (username) { localStorage.setItem('twitch_token',token); localStorage.setItem('twitch_username',username); setTwitchAuth({token,username}) }
    } catch (_) {}
  }

  async function connectTwitch() {
    const clientId = localStorage.getItem('twitch_client_id') || ''
    if (!clientId) { setShowSettings(true); return }
    const redirectUri = `${window.location.origin}/oauth/twitch`
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat%3Aread+chat%3Aedit`
    const popup = window.open(url,'twitch_oauth','width=500,height=700,left=200,top=100')
    setConnectingTw(true)
    const handler = async e => {
      if (e.origin!==window.location.origin||e.data?.type!=='twitch_oauth') return
      window.removeEventListener('message',handler); setConnectingTw(false)
      if (e.data.token) await fetchAndStoreTwitchUser(e.data.token)
      else alert('Twitch auth failed: '+(e.data.error||'unknown'))
    }
    window.addEventListener('message',handler)
    setTimeout(()=>{ window.removeEventListener('message',handler); setConnectingTw(false); if(popup&&!popup.closed)popup.close() },120000)
  }

  // ── X auth ────────────────────────────────────────────────────────────────────
  const [xAuth,        setXAuth]        = useState(() => {
    const t = localStorage.getItem('x_token')
    const u = localStorage.getItem('x_username')
    return t ? { token:t, username:u||'' } : null
  })
  const [connectingX, setConnectingX]  = useState(false)

  useEffect(() => {
    const pending = localStorage.getItem('x_pending_code')
    if (pending) { localStorage.removeItem('x_pending_code'); exchangeXCode(pending) }
  }, [])

  async function exchangeXCode(code) {
    const codeVerifier = sessionStorage.getItem('x_code_verifier') || ''
    const redirectUri  = `${window.location.origin}/oauth/x`
    try {
      const r = await fetch('/api/x-auth', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ code, codeVerifier, redirectUri }),
      })
      const d = await r.json()
      if (d.access_token) {
        localStorage.setItem('x_token',    d.access_token)
        localStorage.setItem('x_username', d.username || '')
        if (d.refresh_token) localStorage.setItem('x_refresh_token', d.refresh_token)
        setXAuth({ token: d.access_token, username: d.username || '' })
      } else { alert('X auth failed: '+(d.error||'unknown')) }
    } catch (e) { alert('X auth error: '+e.message) }
  }

  async function connectX() {
    const clientId = localStorage.getItem('x_client_id') || ''
    if (!clientId) { setShowSettings(true); return }
    const verifier   = genCodeVerifier()
    const challenge  = await genCodeChallenge(verifier)
    sessionStorage.setItem('x_code_verifier', verifier)
    const redirectUri = `${window.location.origin}/oauth/x`
    const url = 'https://twitter.com/i/oauth2/authorize?' + new URLSearchParams({
      response_type:'code', client_id:clientId, redirect_uri:redirectUri,
      scope:'tweet.write users.read offline.access',
      state: Math.random().toString(36).slice(2),
      code_challenge: challenge, code_challenge_method:'S256',
    })
    const popup = window.open(url,'x_oauth','width=500,height=700,left=200,top=100')
    setConnectingX(true)
    const handler = async e => {
      if (e.origin!==window.location.origin||e.data?.type!=='x_oauth') return
      window.removeEventListener('message',handler); setConnectingX(false)
      if (e.data.code) await exchangeXCode(e.data.code)
      else alert('X auth failed: '+(e.data.error||'unknown'))
    }
    window.addEventListener('message',handler)
    setTimeout(()=>{ window.removeEventListener('message',handler); setConnectingX(false); if(popup&&!popup.closed)popup.close() },120000)
  }

  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    localStorage.setItem('mb_dash_layout', JSON.stringify(widgets))
  }, [widgets])

  const drag   = useCallback((id,x,y)   => setWidgets(p=>p.map(w=>w.id===id?{...w,x,y}:w)), [])
  const resize = useCallback((id,nw,nh) => setWidgets(p=>p.map(w=>w.id===id?{...w,w:nw,h:nh}:w)), [])
  const focus  = useCallback((id)       => setWidgets(p=>{ const mx=Math.max(...p.map(w=>w.zIndex)); return p.map(w=>w.id===id?{...w,zIndex:mx+1}:w) }), [])
  const close  = useCallback((id)       => setWidgets(p=>p.map(w=>w.id===id?{...w,visible:false}:w)), [])
  const show   = useCallback((id)       => setWidgets(p=>p.map(w=>w.id===id?{...w,visible:true}:w)), [])

  function renderContent(id) {
    switch (id) {
      case 'stream':     return <StreamPlayer />
      case 'chat':       return <CombinedChat streamers={streamers} />
      case 'viewers':    return <ViewerCounts streamers={streamers} />
      case 'polymarket': return <Polymarket />
      case 'broadcast':  return (
        <Broadcast
          streamers={streamers}
          twitchAuth={twitchAuth}
          xAuth={xAuth}
          onConnectTwitch={() => { const id=localStorage.getItem('twitch_client_id'); id?connectTwitch():setShowSettings(true) }}
          onConnectX={() => { const id=localStorage.getItem('x_client_id'); id?connectX():setShowSettings(true) }}
        />
      )
      default: return null
    }
  }

  const hidden  = widgets.filter(w=>!w.visible)
  const visible = widgets.filter(w=>w.visible)

  return (
    <div style={{
      display:'flex', flexDirection:'column', height:'100%', overflow:'hidden',
      background:'#08080f', color:'#eeeef5', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {showSettings && <DashboardSettings onClose={()=>setShowSettings(false)} />}

      <MarketTicker />

      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'5px 12px',
        background:'#0d0d18', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0, flexWrap:'wrap',
      }}>
        <span style={{ fontSize:13, fontWeight:800, color:'#9147ff', flexShrink:0, marginRight:4 }}>🎛 Dashboard</span>

        {hidden.map(w => (
          <button key={w.id} onClick={()=>show(w.id)} style={{
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:6, padding:'3px 10px', fontSize:11, color:'#8888aa', cursor:'pointer',
          }}>+ {w.title}</button>
        ))}

        <div style={{ flex:1 }} />

        {!twitchAuth ? (
          <button onClick={connectTwitch} disabled={connectingTw} style={{
            background:'rgba(145,71,255,0.12)', border:'1px solid rgba(145,71,255,0.3)',
            borderRadius:6, padding:'4px 12px', fontSize:11,
            color: connectingTw?'#55556a':'#c084fc', cursor:connectingTw?'wait':'pointer', fontWeight:700,
          }}>{connectingTw?'Connecting…':'🟣 Connect Twitch'}</button>
        ) : (
          <div style={{ fontSize:11, color:'#9147ff', fontWeight:700, padding:'4px 10px', background:'rgba(145,71,255,0.08)', borderRadius:6, border:'1px solid rgba(145,71,255,0.2)' }}>
            🟣 @{twitchAuth.username}
          </div>
        )}

        {!xAuth ? (
          <button onClick={connectX} disabled={connectingX} style={{
            background:'rgba(226,232,240,0.06)', border:'1px solid rgba(226,232,240,0.2)',
            borderRadius:6, padding:'4px 12px', fontSize:11,
            color: connectingX?'#55556a':'#94a3b8', cursor:connectingX?'wait':'pointer', fontWeight:700,
          }}>{connectingX?'Connecting…':'✖ Connect X'}</button>
        ) : (
          <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, padding:'4px 10px', background:'rgba(226,232,240,0.06)', borderRadius:6, border:'1px solid rgba(226,232,240,0.15)' }}>
            ✖ @{xAuth.username||'connected'}
          </div>
        )}

        <button onClick={()=>setShowSettings(true)} style={{
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:6, padding:'4px 10px', fontSize:13, color:'#44445a', cursor:'pointer',
        }}>⚙</button>

        <button onClick={()=>setWidgets(defaultWidgets())} style={{
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:6, padding:'4px 10px', fontSize:11, color:'#44445a', cursor:'pointer',
        }}>Reset</button>

        <button onClick={()=>navigate(-1)} style={{
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:6, padding:'4px 10px', fontSize:11, color:'#44445a', cursor:'pointer',
        }}>← Back</button>
      </div>

      <div style={{ flex:1, position:'relative', overflow:'auto', minHeight:600 }}>
        {visible.map(w=>(
          <Widget key={w.id} {...w} onDrag={drag} onResize={resize} onFocus={focus} onClose={close}>
            {renderContent(w.id)}
          </Widget>
        ))}
      </div>

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0) }
          to   { transform: translateX(-33.333%) }
        }
      `}</style>
    </div>
  )
}
