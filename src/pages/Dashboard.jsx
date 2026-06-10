import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { useKickChat }   from '../hooks/useKickChat'

// ── Config parse ──────────────────────────────────────────────────────────────

function parseConfig() {
  try {
    const h = window.location.hash.slice(1)
    return h ? JSON.parse(atob(h)) : null
  } catch { return null }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function genCodeVerifier() {
  const arr = new Uint8Array(32)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, d => ('0'+d.toString(16)).slice(-2)).join('')
}
async function genCodeChallenge(verifier) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}

// ── Market ticker ─────────────────────────────────────────────────────────────

function MarketTicker() {
  const [items, setItems] = useState([])
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/market-ticker')
        if (r.ok) setItems(await r.json())
      } catch (_) {}
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])
  if (!items.length) return null
  const triple = [...items, ...items, ...items]
  return (
    <div style={{ overflow:'hidden', background:'#060610', borderBottom:'1px solid rgba(255,255,255,0.05)', height:28, flexShrink:0, display:'flex', alignItems:'center' }}>
      <div style={{ animation:'tickerScroll 40s linear infinite', display:'flex', gap:0, whiteSpace:'nowrap', willChange:'transform' }}>
        {triple.map((it,i) => {
          const pos = it.change >= 0
          const col = pos ? '#22c55e' : '#ef4444'
          return (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'0 20px', borderRight:'1px solid rgba(255,255,255,0.04)', fontSize:11 }}>
              <span style={{ fontWeight:700, color:'#8888aa' }}>{it.symbol}</span>
              <span style={{ color:col, fontWeight:700 }}>${parseFloat(it.price).toFixed(2)}</span>
              <span style={{ color:col, fontSize:10 }}>{pos?'+':''}{parseFloat(it.change).toFixed(2)}%</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Widget container ──────────────────────────────────────────────────────────

function Widget({ id, title, icon, accent, x, y, w, h, minW=240, minH=150, zIndex, onDrag, onResize, onFocus, onClose, children }) {
  const dragRef   = useRef(null)
  const resizeRef = useRef(null)

  const startDrag = useCallback(e => {
    if (e.button !== 0) return
    e.preventDefault()
    const ox = e.clientX - x, oy = e.clientY - y
    onFocus(id)
    function mv(e) { onDrag(id, e.clientX - ox, e.clientY - oy) }
    function up() { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up) }
    window.addEventListener('mousemove',mv)
    window.addEventListener('mouseup',up)
  }, [id,x,y,onDrag,onFocus])

  const startResize = useCallback(e => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const sx = e.clientX, sy = e.clientY, sw = w, sh = h
    function mv(e) { onResize(id, Math.max(minW,sw+(e.clientX-sx)), Math.max(minH,sh+(e.clientY-sy))) }
    function up() { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up) }
    window.addEventListener('mousemove',mv)
    window.addEventListener('mouseup',up)
  }, [id,w,h,minW,minH,onResize])

  return (
    <div
      onMouseDown={() => onFocus(id)}
      style={{
        position:'absolute', left:x, top:y, width:w, height:h, zIndex,
        display:'flex', flexDirection:'column',
        background:'rgba(10,10,22,0.97)',
        border:`1px solid rgba(255,255,255,0.08)`,
        borderRadius:16,
        boxShadow:`0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${accent}22`,
        backdropFilter:'blur(20px)',
        overflow:'hidden',
      }}
    >
      {/* Accent top line */}
      <div style={{ height:2, background:`linear-gradient(90deg,${accent},${accent}66,transparent)`, flexShrink:0 }} />

      {/* Title bar */}
      <div
        ref={dragRef}
        onMouseDown={startDrag}
        style={{
          display:'flex', alignItems:'center', gap:7, padding:'8px 12px',
          background:`linear-gradient(135deg,${accent}12 0%,transparent 70%)`,
          borderBottom:'1px solid rgba(255,255,255,0.05)',
          flexShrink:0, cursor:'grab', userSelect:'none',
        }}
      >
        <span style={{ fontSize:13 }}>{icon}</span>
        <span style={{ fontSize:12, fontWeight:700, color:accent, flex:1, letterSpacing:'0.03em' }}>{title}</span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onClose(id)}
          style={{ background:'none', border:'none', color:'#33334a', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px', transition:'color .15s' }}
          onMouseOver={e=>e.currentTarget.style.color='#f87171'}
          onMouseOut={e=>e.currentTarget.style.color='#33334a'}
        >✕</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', minHeight:0 }}>
        {children}
      </div>

      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={startResize}
        style={{
          position:'absolute', right:0, bottom:0, width:18, height:18,
          cursor:'nwse-resize', zIndex:10,
          background:`linear-gradient(135deg,transparent 50%,${accent}55 50%)`,
          borderRadius:'0 0 16px 0',
        }}
      />
    </div>
  )
}

// ── Stream Player ─────────────────────────────────────────────────────────────

function StreamPlayer({ streamers }) {
  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  // Build quick-access channel list: own first, then co-streamers
  const quickChannels = [
    ...(myTwitch ? [{ label:myTwitch, sublabel:'You', platform:'twitch', emoji:'🟣', color:'#9147ff' }] : []),
    ...(myKick   ? [{ label:myKick,   sublabel:'You', platform:'kick',   emoji:'🟢', color:'#53fc18' }] : []),
    ...streamers.flatMap(s => [
      ...(s.twitch && s.twitch.toLowerCase()!==myTwitch.toLowerCase() ? [{ label:s.twitch, sublabel:s.name, platform:'twitch', emoji:'🟣', color:'#9147ff' }] : []),
      ...(s.kick   && s.kick.toLowerCase()!==myKick.toLowerCase()     ? [{ label:s.kick,   sublabel:s.name, platform:'kick',   emoji:'🟢', color:'#53fc18' }] : []),
    ]),
  ]

  const [active, setActive] = useState(null)
  const [input,  setInput]  = useState('')

  // Auto-load own stream on first mount
  useEffect(() => {
    if (myTwitch) { setActive({ platform:'twitch', channel:myTwitch }); return }
    if (myKick)   { setActive({ platform:'kick',   channel:myKick   }); return }
    if (streamers[0]?.twitch) setActive({ platform:'twitch', channel:streamers[0].twitch })
    else if (streamers[0]?.kick) setActive({ platform:'kick', channel:streamers[0].kick })
  }, [])

  function loadFromInput() {
    const v = input.trim()
    if (!v) return
    const tm = v.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/)
    if (tm) { setActive({ platform:'twitch', channel:tm[1] }); return }
    const km = v.match(/(?:kick\.com\/)([a-zA-Z0-9_]+)/)
    if (km) { setActive({ platform:'kick', channel:km[1] }); return }
    if (/^[a-zA-Z0-9_]{3,25}$/.test(v)) { setActive({ platform:'twitch', channel:v }); return }
    setActive({ platform:'other', url:v })
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
      <div style={{ position:'relative', width:'100%', height:'100%' }}>
        <iframe src={src} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen allow="autoplay" title="stream" />
        <div style={{ position:'absolute', top:8, left:8, right:8, display:'flex', alignItems:'center', gap:6, pointerEvents:'none' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.75)', borderRadius:8, padding:'4px 10px', pointerEvents:'auto' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e' }} />
            <span style={{ fontSize:11, fontWeight:700, color:pc }}>{active.channel}</span>
          </div>
          <button onClick={() => setActive(null)} style={{
            marginLeft:'auto', background:'rgba(0,0,0,0.75)', border:`1px solid ${pc}44`,
            color:pc, borderRadius:8, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:700, pointerEvents:'auto',
          }}>⬅ Change</button>
        </div>
        {/* Quick switch buttons */}
        {quickChannels.length > 1 && (
          <div style={{ position:'absolute', bottom:8, left:8, display:'flex', gap:5 }}>
            {quickChannels.map((ch,i) => (
              <button key={i} onClick={() => setActive({ platform:ch.platform, channel:ch.label })}
                style={{
                  background: active.channel===ch.label ? `${ch.color}33` : 'rgba(0,0,0,0.7)',
                  border:`1px solid ${active.channel===ch.label ? ch.color+'66' : 'rgba(255,255,255,0.15)'}`,
                  color: active.channel===ch.label ? ch.color : '#aaa',
                  borderRadius:7, padding:'3px 9px', fontSize:10, cursor:'pointer', fontWeight:700,
                }}>{ch.emoji} {ch.label}</button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, padding:20 }}>
      <div style={{ fontSize:44 }}>📺</div>
      {quickChannels.length > 0 ? (
        <>
          <div style={{ fontSize:12, color:'#55556a', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Channels</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {quickChannels.map((ch,i) => (
              <button key={i} onClick={() => setActive({ platform:ch.platform, channel:ch.label })} style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'10px 16px', borderRadius:12, cursor:'pointer',
                background:`${ch.color}15`, border:`1px solid ${ch.color}44`,
                color:ch.color, transition:'all .15s',
              }}
                onMouseOver={e => { e.currentTarget.style.background=`${ch.color}25`; e.currentTarget.style.boxShadow=`0 0 14px ${ch.color}33` }}
                onMouseOut={e  => { e.currentTarget.style.background=`${ch.color}15`; e.currentTarget.style.boxShadow='none' }}
              >
                <span style={{ fontSize:18 }}>{ch.emoji}</span>
                <span style={{ fontSize:12, fontWeight:700 }}>{ch.label}</span>
                {ch.sublabel && <span style={{ fontSize:9, color:'#55556a', fontWeight:600 }}>{ch.sublabel}</span>}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#22223a', fontWeight:600 }}>— or enter URL —</div>
        </>
      ) : (
        <div style={{ fontSize:12, color:'#55556a', textAlign:'center', lineHeight:1.7 }}>Connect Twitch or Kick on Setup<br/>to auto-load your stream</div>
      )}
      <div style={{ display:'flex', gap:8, width:'100%', maxWidth:360 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadFromInput()}
          placeholder="twitch.tv/channel  or  kick.com/channel"
          style={{ flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'9px 13px', fontSize:12, color:'#eeeef5', outline:'none' }}
        />
        <button onClick={loadFromInput} style={{
          background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff',
          border:'none', borderRadius:10, padding:'9px 16px', fontSize:12, fontWeight:700, cursor:'pointer',
        }}>Go</button>
      </div>
    </div>
  )
}

// ── Combined Chat ─────────────────────────────────────────────────────────────

const PLAT = { twitch:{ color:'#9147ff', bg:'rgba(145,71,255,0.12)' }, kick:{ color:'#53fc18', bg:'rgba(83,252,24,0.1)' } }

function CombinedChat({ streamers }) {
  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  // Build default sources: own channels + co-streamers
  function buildDefaultSources() {
    const src = []
    if (myTwitch) src.push({ platform:'twitch', channel:myTwitch, label:'Your Twitch' })
    if (myKick)   src.push({ platform:'kick',   channel:myKick,   label:'Your Kick'   })
    streamers.forEach(s => {
      if (s.twitch && s.twitch.toLowerCase()!==myTwitch.toLowerCase()) src.push({ platform:'twitch', channel:s.twitch, label:s.name+' (Twitch)' })
      if (s.kick   && s.kick.toLowerCase()!==myKick.toLowerCase())     src.push({ platform:'kick',   channel:s.kick,   label:s.name+' (Kick)'   })
    })
    return src
  }

  const [sources,   setSources]   = useState(buildDefaultSources)
  const [msgs,      setMsgs]      = useState([])
  const [filter,    setFilter]    = useState('all')
  const [showCfg,   setShowCfg]   = useState(false)
  const [addInput,  setAddInput]  = useState('')
  const chatRef = useRef(null)

  // Build streamers array for hooks
  const hookStreamers = sources.map(s => ({
    name: s.label,
    twitch: s.platform==='twitch' ? s.channel : '',
    kick:   s.platform==='kick'   ? s.channel : '',
  }))

  const add = useCallback(msg => setMsgs(p => [...p.slice(-399), msg]), [])
  useTwitchChat(hookStreamers, add)
  useKickChat(hookStreamers, add)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs])

  function addSource() {
    const v = addInput.trim().toLowerCase()
    if (!v) return
    const tm = v.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/) || (v.match(/^[a-zA-Z0-9_]+$/) ? [null, v] : null)
    const km = v.match(/(?:kick\.com\/)([a-zA-Z0-9_]+)/)
    if (km) {
      setSources(p => [...p, { platform:'kick', channel:km[1], label:km[1] }])
    } else if (tm) {
      const ch = tm[1]
      setSources(p => [...p, { platform:'twitch', channel:ch, label:ch }])
    }
    setAddInput('')
  }

  const visible = msgs.filter(m => filter === 'all' || m.platform === filter)

  const twCount = msgs.filter(m=>m.platform==='twitch').length
  const kkCount = msgs.filter(m=>m.platform==='kick').length

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Filter tabs */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        {[
          { key:'all',    label:`All (${msgs.length})`,      color:'#8888aa' },
          { key:'twitch', label:`🟣 ${twCount}`,             color:'#9147ff' },
          { key:'kick',   label:`🟢 ${kkCount}`,             color:'#53fc18' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
            background: filter===tab.key ? tab.color+'22' : 'transparent',
            color: filter===tab.key ? tab.color : '#33334a',
            border:`1px solid ${filter===tab.key ? tab.color+'55' : 'transparent'}`,
            transition:'all .15s',
          }}>{tab.label}</button>
        ))}
        <button onClick={() => setShowCfg(v=>!v)} style={{
          marginLeft:'auto', background: showCfg?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.04)',
          border:'none', borderRadius:6, color: showCfg?'#8888aa':'#33334a',
          fontSize:10, cursor:'pointer', padding:'3px 8px', fontWeight:700,
        }}>⚙ Sources</button>
      </div>

      {/* Source config */}
      {showCfg && (
        <div style={{ padding:'10px 12px', background:'rgba(0,0,0,0.45)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, maxHeight:180, overflowY:'auto' }}>
          <div style={{ fontSize:10, color:'#44445a', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>Chat Sources</div>
          {sources.map((s,i) => {
            const pc = PLAT[s.platform]?.color || '#888'
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:pc, flexShrink:0 }} />
                <span style={{ fontSize:11, color:pc, fontWeight:700, flex:1 }}>{s.label}</span>
                <button onClick={() => setSources(p=>p.filter((_,j)=>j!==i))} style={{
                  background:'rgba(239,68,68,0.12)', border:'none', color:'#f87171', borderRadius:5, padding:'1px 7px', fontSize:10, cursor:'pointer',
                }}>✕</button>
              </div>
            )
          })}
          {sources.length === 0 && <div style={{ fontSize:11, color:'#22223a' }}>No sources — add one below</div>}
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={addInput} onChange={e=>setAddInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSource()}
              placeholder="twitch.tv/channel  or  kick.com/channel"
              style={{ flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'5px 9px', fontSize:11, color:'#eeeef5', outline:'none' }}
            />
            <button onClick={addSource} style={{
              background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff', border:'none', borderRadius:7, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer',
            }}>+ Add</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
        {visible.length === 0 && (
          <div style={{ padding:24, textAlign:'center', color:'#22223a', fontSize:12 }}>
            {sources.length === 0 ? 'Add a chat source above ↑' : 'Waiting for messages…'}
          </div>
        )}
        {visible.map(msg => {
          const pc = PLAT[msg.platform]?.color || '#8888aa'
          const uc = msg.userColor || pc
          return (
            <div key={msg.id} style={{ padding:'4px 12px', fontSize:12.5, lineHeight:1.5, transition:'background .1s' }}
              onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
              onMouseOut={e=>e.currentTarget.style.background='transparent'}
            >
              <span style={{ fontSize:8, color:pc, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', marginRight:5, background:pc+'22', borderRadius:3, padding:'1px 4px' }}>{msg.platform[0]}</span>
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
  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  const allStreamers = [
    ...(myTwitch ? [{ name:'You', twitch:myTwitch, kick:'' }] : []),
    ...(myKick   ? [{ name:'You', twitch:'', kick:myKick }]   : []),
    ...streamers.filter(s => s.twitch!==myTwitch && s.kick!==myKick),
  ]

  const [counts, setCounts] = useState({})
  useEffect(() => {
    async function load() {
      const out = {}
      for (const s of allStreamers) {
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
              out[`kk_${s.kick}`] = { platform:'kick', name:s.kick, viewers:d.livestream?.viewer_count??0, live:!!d.livestream, title:d.livestream?.session_title||'' }
            }
          } catch (_) {}
        }
      }
      setCounts(out)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [JSON.stringify(allStreamers)])

  const entries = Object.values(counts)
  const total   = entries.reduce((s,e) => s+(e.viewers||0), 0)

  return (
    <div style={{ padding:14, overflowY:'auto', height:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ textAlign:'center', padding:'8px 0 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize:38, fontWeight:900, color:'#eeeef5', lineHeight:1 }}>{total.toLocaleString()}</div>
        <div style={{ fontSize:10, color:'#44445a', marginTop:3, letterSpacing:'0.07em', textTransform:'uppercase' }}>Total Viewers</div>
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize:11, color:'#22223a', textAlign:'center', lineHeight:1.7 }}>Connect channels to see live counts</div>
      ) : entries.map(e => {
        const pc = e.platform === 'twitch' ? '#9147ff' : '#53fc18'
        return (
          <div key={e.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: e.live?'#22c55e':'#333', boxShadow: e.live?'0 0 6px #22c55e':'none', flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:pc }}>{e.name}</div>
              {e.title && <div style={{ fontSize:10, color:'#33334a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</div>}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:'#eeeef5' }}>{(e.viewers||0).toLocaleString()}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Polymarket ────────────────────────────────────────────────────────────────

function Polymarket() {
  const [markets,  setMarkets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState(null)
  const [search,   setSearch]   = useState('')
  const [searchQ,  setSearchQ]  = useState('')

  useEffect(() => {
    async function load() {
      setErr(null)
      try {
        const q = searchQ.trim()
        const url = q
          ? `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20&sortBy=volumeNum&order=DESC&q=${encodeURIComponent(q)}`
          : 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=12&sortBy=volumeNum&order=DESC'
        const r = await fetch(url)
        if (!r.ok) throw new Error(`${r.status}`)
        setMarkets(await r.json())
      } catch (e) { setErr(e.message) }
      setLoading(false)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [searchQ])

  function handleSearch() { setSearchQ(search.trim()); setLoading(true) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'8px 10px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}
            placeholder="Search prediction markets…"
            style={{ flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#eeeef5', outline:'none' }}
          />
          <button onClick={handleSearch} style={{ background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>🔍</button>
          {searchQ && <button onClick={() => { setSearch(''); setSearchQ(''); setLoading(true) }} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, color:'#888', padding:'6px 10px', fontSize:11, cursor:'pointer' }}>✕</button>}
        </div>
      </div>
      {loading && <div style={{ padding:20, textAlign:'center', color:'#44445a', fontSize:12 }}>Loading markets…</div>}
      {err     && <div style={{ padding:12, color:'#f87171', fontSize:12 }}>⚠ {err}</div>}
      <div style={{ overflowY:'auto', flex:1 }}>
        {markets.map((m,i) => {
          let prices=[],outcomes=[]
          try { prices   = JSON.parse(m.outcomePrices||'[]') } catch(_){}
          try { outcomes = JSON.parse(m.outcomes||'[]')      } catch(_){}
          const yesP = prices[0]!=null ? parseFloat(prices[0]) : null
          const noP  = prices[1]!=null ? parseFloat(prices[1]) : null
          return (
            <div key={m.id||i} style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <a href={`https://polymarket.com/event/${m.slug||''}`} target="_blank" rel="noreferrer"
                style={{ fontSize:12, fontWeight:600, color:'#eeeef5', lineHeight:1.45, display:'block', marginBottom:6, textDecoration:'none' }}
                onMouseOver={e=>e.currentTarget.style.color='#a0a0ff'}
                onMouseOut={e=>e.currentTarget.style.color='#eeeef5'}
              >{m.question||m.title}</a>
              {(yesP!==null||noP!==null) && (
                <div style={{ display:'flex', gap:5, marginBottom:4 }}>
                  {yesP!==null && <div style={{ flex:1, padding:'4px 7px', borderRadius:7, textAlign:'center', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize:14, fontWeight:900, color:'#22c55e' }}>{Math.round(yesP*100)}¢</div>
                    <div style={{ fontSize:9, color:'#22c55e88', textTransform:'uppercase' }}>{outcomes[0]||'Yes'}</div>
                  </div>}
                  {noP!==null && <div style={{ flex:1, padding:'4px 7px', borderRadius:7, textAlign:'center', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize:14, fontWeight:900, color:'#ef4444' }}>{Math.round(noP*100)}¢</div>
                    <div style={{ fontSize:9, color:'#ef444488', textTransform:'uppercase' }}>{outcomes[1]||'No'}</div>
                  </div>}
                </div>
              )}
              {m.volume && <div style={{ fontSize:10, color:'#33334a' }}>Vol: ${parseFloat(m.volume).toLocaleString('en-US',{maximumFractionDigits:0})}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── C3PO Widget ───────────────────────────────────────────────────────────────

function C3POWidget() {
  const [msgs,  setMsgs]  = useState([{ role:'assistant', text:'Hey! I\'m C-3PO, your AI co-pilot. Ask me anything — stream strategy, market analysis, or just chat.' }])
  const [input, setInput] = useState('')
  const [busy,  setBusy]  = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const history = [...msgs, { role:'user', text }]
    setMsgs(history)
    setBusy(true)
    try {
      const r = await fetch('/api/c3po', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: text, history: msgs.map(m => ({ role:m.role, content:m.text })) }),
      })
      const d = await r.json()
      setMsgs(p => [...p, { role:'assistant', text: d.reply || d.error || 'No response.' }])
    } catch(e) {
      setMsgs(p => [...p, { role:'assistant', text:`Error: ${e.message}` }])
    }
    setBusy(false)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
        {msgs.map((m,i) => {
          const isBot = m.role === 'assistant'
          return (
            <div key={i} style={{ display:'flex', justifyContent: isBot?'flex-start':'flex-end' }}>
              <div style={{
                maxWidth:'85%', padding:'9px 13px', borderRadius: isBot?'4px 14px 14px 14px':'14px 4px 14px 14px',
                background: isBot?'rgba(255,215,0,0.08)':'rgba(145,71,255,0.15)',
                border: `1px solid ${isBot?'rgba(255,215,0,0.2)':'rgba(145,71,255,0.3)'}`,
                fontSize:12.5, color:'#ddddf5', lineHeight:1.55,
              }}>{m.text}</div>
            </div>
          )
        })}
        {busy && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ padding:'9px 16px', borderRadius:'4px 14px 14px 14px', background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.15)', fontSize:12, color:'#888' }}>
              Thinking…
            </div>
          </div>
        )}
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask C-3PO anything…"
          disabled={busy}
          style={{ flex:1, background:'#0a0a0f', border:'1px solid rgba(255,215,0,0.2)', borderRadius:10, padding:'9px 13px', fontSize:12, color:'#eeeef5', outline:'none', opacity:busy?0.6:1 }}
        />
        <button onClick={send} disabled={busy||!input.trim()} style={{
          background: busy||!input.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
          color: busy||!input.trim() ? '#33334a' : '#fff',
          border:'none', borderRadius:10, padding:'9px 14px', fontSize:13, cursor:busy||!input.trim()?'not-allowed':'pointer', fontWeight:700,
        }}>➤</button>
      </div>
    </div>
  )
}

// ── Twitch IRC send hook ──────────────────────────────────────────────────────

function useTwitchSend(token, username) {
  const wsRef  = useRef(null)
  const [ready, setReady] = useState(false)
  const joined = useRef(new Set())
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

// ── Broadcast ─────────────────────────────────────────────────────────────────

function Broadcast({ streamers, twitchAuth, xAuth, onConnectTwitch, onConnectX }) {
  const [msg,    setMsg]    = useState('')
  const [status, setStatus] = useState(null)
  const [sendTw, setSendTw] = useState(true)
  const [sendX,  setSendX]  = useState(true)
  const [sendKick, setSendKick] = useState(false)
  const [, forceUpdate] = useState(0)

  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  const { ready: twReady, send: twSend } = useTwitchSend(twitchAuth?.token, twitchAuth?.username)
  const twitchChannels = [
    ...(myTwitch ? [myTwitch] : []),
    ...streamers.map(s=>s.twitch).filter(Boolean).filter(c=>c!==myTwitch),
  ]

  const xReady  = !!xAuth?.token

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
        results.push(r.ok ? 'X' : `X err: ${d.error}`)
      } catch(e) { results.push(`X err: ${e.message}`) }
    }
    const sent = results.filter(Boolean)
    setStatus(sent.length ? { ok:true, text:`✓ Sent to ${sent.join(', ')}` } : { ok:false, text:'Nothing sent — connect a platform first' })
    setTimeout(() => setStatus(null), 4000)
  }

  function PlatToggle({ active, disabled, color, label, onClick }) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        flex:1, padding:'6px', borderRadius:8, fontSize:11, fontWeight:700,
        cursor: disabled?'not-allowed':'pointer',
        background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
        color: active ? color : '#33334a',
        border:`1px solid ${active ? color+'44':'rgba(255,255,255,0.06)'}`,
        transition:'all .15s', opacity:disabled?0.4:1,
      }}>{active?'✓':'○'} {label}</button>
    )
  }

  function PlatStatus({ color, label, connected, username, onConnect }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
        <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background:connected?'#22c55e':'#2a2a3a', boxShadow:connected?'0 0 6px #22c55e':'none' }} />
        <span style={{ fontSize:11, fontWeight:700, color, flex:1 }}>{label}{username?` @${username}`:''}</span>
        {!connected && <button onClick={onConnect} style={{ fontSize:10, background:`${color}22`, border:`1px solid ${color}44`, color, borderRadius:5, padding:'2px 9px', cursor:'pointer', fontWeight:700 }}>Connect →</button>}
      </div>
    )
  }

  const canSend = msg.trim() && ((sendTw && twReady) || (sendX && xReady))

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Connection status */}
      <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <PlatStatus color="#9147ff" label="Twitch" connected={twReady} username={twitchAuth?.username}
          onConnect={onConnectTwitch} />
        <PlatStatus color="#e2e8f0" label="X (Twitter)" connected={xReady} username={xAuth?.username}
          onConnect={onConnectX} />
        <PlatStatus color="#53fc18" label="Kick" connected={false} username={myKick||undefined}
          onConnect={() => {}} />
      </div>

      {/* Target toggles */}
      <div style={{ padding:'7px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', flexShrink:0, display:'flex', gap:5 }}>
        <PlatToggle active={sendTw}   disabled={!twReady} color="#9147ff" label="Twitch" onClick={()=>setSendTw(v=>!v)} />
        <PlatToggle active={sendX}    disabled={!xReady}  color="#e2e8f0" label="X"      onClick={()=>setSendX(v=>!v)} />
        <PlatToggle active={sendKick} disabled={true}     color="#53fc18" label="Kick"   onClick={()=>setSendKick(v=>!v)} />
      </div>

      {/* Message area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:8, minHeight:0 }}>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),doSend())}
          placeholder={canSend||msg ? 'Type… (Enter to send, Shift+Enter for newline)' : 'Connect a platform to start broadcasting…'}
          style={{
            flex:1, resize:'none', background:'#0a0a0f',
            border:`1px solid ${msg.trim()&&canSend?'rgba(145,71,255,0.4)':'rgba(255,255,255,0.08)'}`,
            borderRadius:10, padding:'10px 12px', fontSize:13, color:'#eeeef5', outline:'none', fontFamily:'inherit', transition:'border-color .15s',
          }}
        />
        <button onClick={doSend} disabled={!canSend} style={{
          padding:'11px', borderRadius:10, fontSize:13, fontWeight:800,
          cursor: canSend?'pointer':'not-allowed',
          background: canSend?'linear-gradient(135deg,#9147ff,#6441a5)':'rgba(255,255,255,0.04)',
          color: canSend?'#fff':'#33334a', border:'none', transition:'all .15s',
          boxShadow: canSend?'0 4px 20px rgba(145,71,255,0.3)':'none',
        }}>📢 Send to All</button>
        {status && (
          <div style={{ padding:'7px 12px', borderRadius:8, fontSize:12, textAlign:'center',
            background: status.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
            color: status.ok?'#22c55e':'#f87171',
            border:`1px solid ${status.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,
          }}>{status.text}</div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard Settings ────────────────────────────────────────────────────────

function DashboardSettings({ onClose }) {
  const [twClientId, setTwClientId] = useState(() => localStorage.getItem('twitch_client_id') || '')
  const [xClientId,  setXClientId]  = useState(() => localStorage.getItem('x_client_id')     || '')
  function save() {
    localStorage.setItem('twitch_client_id', twClientId.trim())
    localStorage.setItem('x_client_id',      xClientId.trim())
    onClose()
  }
  const iStyle = { width:'100%', background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, padding:'9px 12px', fontSize:13, color:'#eeeef5', outline:'none', boxSizing:'border-box' }
  const origin = window.location.origin
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#0e0e1c', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:28, width:460, maxWidth:'92vw', boxShadow:'0 24px 60px rgba(0,0,0,0.7)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ fontSize:15, fontWeight:800 }}>⚙ Dashboard Settings</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#44445a', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9147ff', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>🟣 Twitch — Redirect URI</div>
          <code style={{ display:'block', fontSize:11, color:'#a78bfa', background:'rgba(145,71,255,0.08)', borderRadius:6, padding:'6px 10px', marginBottom:8, wordBreak:'break-all' }}>{origin}/oauth/twitch</code>
          <input value={twClientId} onChange={e=>setTwClientId(e.target.value)} placeholder="Twitch Client ID" style={iStyle} />
        </div>
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>✖ X — Redirect URI</div>
          <code style={{ display:'block', fontSize:11, color:'#94a3b8', background:'rgba(255,255,255,0.05)', borderRadius:6, padding:'6px 10px', marginBottom:8, wordBreak:'break-all' }}>{origin}/oauth/x</code>
          <input value={xClientId} onChange={e=>setXClientId(e.target.value)} placeholder="X Client ID" style={iStyle} />
        </div>
        <button onClick={save} style={{ width:'100%', background:'linear-gradient(135deg,#9147ff,#6441a5)', color:'#fff', border:'none', borderRadius:10, padding:'11px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Save Settings</button>
      </div>
    </div>
  )
}

// ── Default layout ────────────────────────────────────────────────────────────

function defaultWidgets() {
  return [
    { id:'stream',     title:'Live Stream',        icon:'📺', accent:'#9147ff', x:0,   y:0,   w:700, h:450, minW:320, minH:200, zIndex:1, visible:true },
    { id:'chat',       title:'Combined Chat',      icon:'💬', accent:'#54c0ff', x:710, y:0,   w:320, h:700, minW:260, minH:240, zIndex:1, visible:true },
    { id:'broadcast',  title:'Send to Chat',       icon:'📢', accent:'#f59e0b', x:710, y:710, w:320, h:340, minW:260, minH:260, zIndex:1, visible:true },
    { id:'viewers',    title:'Viewer Counts',      icon:'👥', accent:'#22c55e', x:0,   y:460, w:340, h:280, minW:220, minH:180, zIndex:1, visible:true },
    { id:'polymarket', title:'Polymarket',         icon:'📊', accent:'#3b82f6', x:350, y:460, w:350, h:280, minW:260, minH:200, zIndex:1, visible:true },
    { id:'c3po',       title:'C-3PO AI Assistant', icon:'🤖', accent:'#ffd700', x:0,   y:750, w:700, h:300, minW:300, minH:240, zIndex:1, visible:true },
  ]
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate  = useNavigate()
  const config    = parseConfig()
  const streamers = config?.streamers || []

  const [widgets, setWidgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mb_dash_layout_v2') || 'null') || defaultWidgets() }
    catch { return defaultWidgets() }
  })

  const [twitchAuth, setTwitchAuth] = useState(() => {
    const t = localStorage.getItem('twitch_token')
    const u = localStorage.getItem('twitch_username')
    return t && u ? { token:t, username:u } : null
  })
  const [connectingTw, setConnectingTw] = useState(false)

  const [xAuth,       setXAuth]       = useState(() => {
    const t = localStorage.getItem('x_token')
    const u = localStorage.getItem('x_username')
    return t ? { token:t, username:u||'' } : null
  })
  const [connectingX,  setConnectingX]  = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Handle pending tokens from redirect flow
  useEffect(() => {
    const pendingTwitch = localStorage.getItem('twitch_pending_token')
    if (pendingTwitch) { localStorage.removeItem('twitch_pending_token'); fetchTwitchUser(pendingTwitch) }
    const pendingX = localStorage.getItem('x_pending_code')
    if (pendingX) { localStorage.removeItem('x_pending_code'); exchangeXCode(pendingX) }
  }, [])

  async function fetchTwitchUser(token) {
    const clientId = localStorage.getItem('twitch_client_id') || import.meta.env.VITE_TWITCH_CLIENT_ID || ''
    if (!clientId) return
    try {
      const r = await fetch('https://api.twitch.tv/helix/users', { headers:{ Authorization:`Bearer ${token}`, 'Client-Id':clientId } })
      const d = await r.json()
      const username = d.data?.[0]?.login
      if (username) { localStorage.setItem('twitch_token',token); localStorage.setItem('twitch_username',username); setTwitchAuth({token,username}) }
    } catch(_) {}
  }

  function connectTwitch() {
    const clientId = localStorage.getItem('twitch_client_id') || import.meta.env.VITE_TWITCH_CLIENT_ID || ''
    if (!clientId) { setShowSettings(true); return }
    const redirectUri = `${window.location.origin}/oauth/twitch`
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat%3Aread+chat%3Aedit`
    const popup = window.open(url,'twitch_oauth','width=520,height=720,left=200,top=80')
    setConnectingTw(true)
    const handler = async e => {
      if (e.origin!==window.location.origin||e.data?.type!=='twitch_oauth') return
      window.removeEventListener('message',handler); setConnectingTw(false)
      if (e.data.token) await fetchTwitchUser(e.data.token)
      else alert('Twitch auth failed: '+(e.data.error||'unknown'))
    }
    window.addEventListener('message',handler)
    setTimeout(() => { window.removeEventListener('message',handler); setConnectingTw(false); if(popup&&!popup.closed)popup.close() }, 120000)
  }

  async function exchangeXCode(code) {
    const codeVerifier = sessionStorage.getItem('x_code_verifier') || localStorage.getItem('x_code_verifier_tmp') || ''
    localStorage.removeItem('x_code_verifier_tmp')
    const redirectUri = `${window.location.origin}/oauth/x`
    try {
      const r = await fetch('/api/x-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, codeVerifier, redirectUri }) })
      const d = await r.json()
      if (d.access_token) {
        localStorage.setItem('x_token',    d.access_token)
        localStorage.setItem('x_username', d.username||'')
        if (d.refresh_token) localStorage.setItem('x_refresh_token', d.refresh_token)
        setXAuth({ token:d.access_token, username:d.username||'' })
      } else alert('X auth failed: '+(d.error||'unknown'))
    } catch(e) { alert('X auth error: '+e.message) }
    setConnectingX(false)
  }

  async function connectX() {
    const clientId = localStorage.getItem('x_client_id') || import.meta.env.VITE_X_CLIENT_ID || ''
    if (!clientId) { setShowSettings(true); return }
    const verifier  = genCodeVerifier()
    const challenge = await genCodeChallenge(verifier)
    sessionStorage.setItem('x_code_verifier', verifier)
    localStorage.setItem('x_code_verifier_tmp', verifier)
    const redirectUri = `${window.location.origin}/oauth/x`
    const url = 'https://twitter.com/i/oauth2/authorize?' + new URLSearchParams({
      response_type:'code', client_id:clientId, redirect_uri:redirectUri,
      scope:'tweet.write users.read offline.access',
      state:Math.random().toString(36).slice(2),
      code_challenge:challenge, code_challenge_method:'S256',
    })
    const popup = window.open(url,'x_oauth','width=700,height=850,left=100,top=50')
    setConnectingX(true)
    const handler = async e => {
      if (e.origin!==window.location.origin||e.data?.type!=='x_oauth') return
      window.removeEventListener('message',handler); setConnectingX(false)
      if (e.data.code) await exchangeXCode(e.data.code)
      else alert('X auth failed: '+(e.data.error||'unknown'))
    }
    window.addEventListener('message',handler)
    setTimeout(() => { window.removeEventListener('message',handler); setConnectingX(false); if(popup&&!popup.closed)popup.close() }, 120000)
  }

  useEffect(() => {
    localStorage.setItem('mb_dash_layout_v2', JSON.stringify(widgets))
  }, [widgets])

  const drag   = useCallback((id,x,y)   => setWidgets(p=>p.map(w=>w.id===id?{...w,x,y}:w)), [])
  const resize = useCallback((id,nw,nh) => setWidgets(p=>p.map(w=>w.id===id?{...w,w:nw,h:nh}:w)), [])
  const focus  = useCallback((id)       => setWidgets(p=>{ const mx=Math.max(...p.map(w=>w.zIndex)); return p.map(w=>w.id===id?{...w,zIndex:mx+1}:w) }), [])
  const close  = useCallback((id)       => setWidgets(p=>p.map(w=>w.id===id?{...w,visible:false}:w)), [])
  const show   = useCallback((id)       => setWidgets(p=>p.map(w=>w.id===id?{...w,visible:true}:w)), [])

  function renderContent(id) {
    switch (id) {
      case 'stream':     return <StreamPlayer streamers={streamers} />
      case 'chat':       return <CombinedChat streamers={streamers} />
      case 'viewers':    return <ViewerCounts streamers={streamers} />
      case 'polymarket': return <Polymarket />
      case 'c3po':       return <C3POWidget />
      case 'broadcast':  return (
        <Broadcast
          streamers={streamers}
          twitchAuth={twitchAuth}
          xAuth={xAuth}
          onConnectTwitch={connectTwitch}
          onConnectX={connectX}
        />
      )
      default: return null
    }
  }

  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''

  const hidden  = widgets.filter(w=>!w.visible)
  const visible = widgets.filter(w=>w.visible)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#07070e', color:'#eeeef5', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif" }}>
      {showSettings && <DashboardSettings onClose={()=>setShowSettings(false)} />}

      <MarketTicker />

      {/* Top bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:8, padding:'5px 14px',
        background:'rgba(10,10,22,0.95)', borderBottom:'1px solid rgba(255,255,255,0.06)',
        flexShrink:0, flexWrap:'wrap', backdropFilter:'blur(12px)',
      }}>
        <span style={{ fontSize:14, fontWeight:900, background:'linear-gradient(135deg,#9147ff,#54c0ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', flexShrink:0 }}>
          🎛 Market Bubble
        </span>

        {/* Connected accounts */}
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {myTwitch && <span style={{ fontSize:11, fontWeight:700, color:'#9147ff', background:'rgba(145,71,255,0.12)', border:'1px solid rgba(145,71,255,0.25)', borderRadius:6, padding:'2px 8px' }}>🟣 @{myTwitch}</span>}
          {myKick   && <span style={{ fontSize:11, fontWeight:700, color:'#53fc18', background:'rgba(83,252,24,0.08)',   border:'1px solid rgba(83,252,24,0.2)',   borderRadius:6, padding:'2px 8px' }}>🟢 @{myKick}</span>}
          {twitchAuth && !myTwitch && <span style={{ fontSize:11, fontWeight:700, color:'#9147ff', background:'rgba(145,71,255,0.12)', border:'1px solid rgba(145,71,255,0.25)', borderRadius:6, padding:'2px 8px' }}>🟣 @{twitchAuth.username}</span>}
          {xAuth      && <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', background:'rgba(226,232,240,0.06)', border:'1px solid rgba(226,232,240,0.15)', borderRadius:6, padding:'2px 8px' }}>✖ @{xAuth.username||'X'}</span>}
        </div>

        {/* Add hidden widgets */}
        {hidden.map(w => (
          <button key={w.id} onClick={()=>show(w.id)} style={{
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:7, padding:'3px 10px', fontSize:11, color:'#8888aa', cursor:'pointer',
            transition:'all .15s',
          }}
            onMouseOver={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#ccc' }}
            onMouseOut={e  => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='#8888aa' }}
          >+ {w.title}</button>
        ))}

        <div style={{ flex:1 }} />

        {/* Auth buttons */}
        {!twitchAuth ? (
          <button onClick={connectTwitch} disabled={connectingTw} style={{
            background:'rgba(145,71,255,0.12)', border:'1px solid rgba(145,71,255,0.3)',
            borderRadius:7, padding:'4px 12px', fontSize:11, color:connectingTw?'#55556a':'#c084fc',
            cursor:connectingTw?'wait':'pointer', fontWeight:700, transition:'all .15s',
          }}>{connectingTw?'Connecting…':'🟣 Connect Twitch'}</button>
        ) : (
          <button onClick={() => { ['twitch_token','twitch_username'].forEach(k=>localStorage.removeItem(k)); setTwitchAuth(null) }} style={{
            background:'rgba(145,71,255,0.12)', border:'1px solid rgba(145,71,255,0.25)',
            borderRadius:7, padding:'4px 12px', fontSize:11, color:'#9147ff', cursor:'pointer', fontWeight:700,
          }}>🟣 @{twitchAuth.username} ✕</button>
        )}

        {!xAuth ? (
          <button onClick={connectX} disabled={connectingX} style={{
            background:'rgba(226,232,240,0.06)', border:'1px solid rgba(226,232,240,0.2)',
            borderRadius:7, padding:'4px 12px', fontSize:11, color:connectingX?'#55556a':'#94a3b8',
            cursor:connectingX?'wait':'pointer', fontWeight:700, transition:'all .15s',
          }}>{connectingX?'Connecting…':'✖ Connect X'}</button>
        ) : (
          <button onClick={() => { ['x_token','x_username','x_refresh_token'].forEach(k=>localStorage.removeItem(k)); setXAuth(null) }} style={{
            background:'rgba(226,232,240,0.06)', border:'1px solid rgba(226,232,240,0.15)',
            borderRadius:7, padding:'4px 12px', fontSize:11, color:'#94a3b8', cursor:'pointer', fontWeight:700,
          }}>✖ @{xAuth.username||'X'} ✕</button>
        )}

        <button onClick={()=>setShowSettings(true)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, padding:'4px 10px', fontSize:13, color:'#44445a', cursor:'pointer' }}>⚙</button>
        <button onClick={()=>{ localStorage.removeItem('mb_dash_layout_v2'); setWidgets(defaultWidgets()) }} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, padding:'4px 10px', fontSize:11, color:'#44445a', cursor:'pointer' }}>Reset</button>
        <button onClick={()=>navigate(-1)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, padding:'4px 10px', fontSize:11, color:'#44445a', cursor:'pointer' }}>← Back</button>
      </div>

      {/* Widget canvas */}
      <div style={{ flex:1, position:'relative', overflow:'auto', minHeight:600 }}>
        {visible.map(w => (
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
        ::-webkit-scrollbar { width:5px; height:5px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px }
        ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.2) }
      `}</style>
    </div>
  )
}
