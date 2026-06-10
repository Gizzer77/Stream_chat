import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Env vars (VITE_ prefix = accessible in browser) ───────────────────────────
const ENV = {
  twitchClientId: import.meta.env.VITE_TWITCH_CLIENT_ID || '',
  kickClientId:   import.meta.env.VITE_KICK_CLIENT_ID   || '',
  xClientId:      import.meta.env.VITE_X_CLIENT_ID      || '',
}

// ── Debug logger (writes a timestamped trail to localStorage; shown in the
//    on-screen Debug panel so we can see exactly what the OAuth flow does) ─────
function dbg(msg, obj) {
  try {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}` + (obj !== undefined ? ' ' + JSON.stringify(obj) : '')
    const prev = localStorage.getItem('oauth_debug_log') || ''
    localStorage.setItem('oauth_debug_log', (prev + '\n' + line).slice(-8000))
    console.log('[OAuth]', msg, obj !== undefined ? obj : '')
  } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function buildRoomUrl(profiles, roomCode, locked) {
  const config = {
    roomCode, locked,
    streamers: profiles.map(p => ({
      name:   p.name.trim(),
      twitch: p.twitchUsername || '',
      kick:   p.kickUsername   || '',
    })),
  }
  return `${window.location.origin}/room#${btoa(JSON.stringify(config))}`
}

function buildInviteUrl(myProfile, roomCode, locked) {
  const data = { name: myProfile.name, twitchUsername: myProfile.twitchUsername||'', kickUsername: myProfile.kickUsername||'', xUsername: myProfile.xUsername||'', roomCode, locked }
  return `${window.location.origin}/?invite=${btoa(JSON.stringify(data))}`
}

// ── PKCE ──────────────────────────────────────────────────────────────────────

function genCodeVerifier() {
  const arr = new Uint8Array(32)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, d => ('0'+d.toString(16)).slice(-2)).join('')
}
async function genCodeChallenge(verifier) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}

async function fetchTwitchUser(token, clientId) {
  try {
    const r = await fetch('https://api.twitch.tv/helix/users', { headers: { 'Authorization':`Bearer ${token}`, 'Client-Id':clientId } })
    return (await r.json()).data?.[0]?.login || ''
  } catch { return '' }
}

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORMS = {
  twitch: { label:'Twitch',      color:'#9147ff', glow:'rgba(145,71,255,0.25)', bg:'rgba(145,71,255,0.1)',  border:'rgba(145,71,255,0.3)',  icon:'🟣' },
  kick:   { label:'Kick',        color:'#53fc18', glow:'rgba(83,252,24,0.2)',   bg:'rgba(83,252,24,0.07)', border:'rgba(83,252,24,0.25)', icon:'🟢' },
  x:      { label:'X (Twitter)', color:'#e2e8f0', glow:'rgba(255,255,255,0.1)',  bg:'rgba(255,255,255,0.06)', border:'rgba(255,255,255,0.2)', icon:'✖' },
}

// ── Connected platform tile ───────────────────────────────────────────────────

function PlatformTile({ platform, username, onDisconnect }) {
  const p = PLATFORMS[platform]
  const [hov, setHov] = useState(false)
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      background: p.bg, border:`1px solid ${hov ? p.border : p.border+'88'}`,
      borderRadius:10, padding:'10px 13px',
      boxShadow: `0 0 12px ${p.glow}`,
      transition:'all .15s',
    }}>
      <div style={{
        width:28, height:28, borderRadius:8, flexShrink:0,
        background:`${p.color}22`, border:`1px solid ${p.color}44`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
      }}>{p.icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, fontWeight:800, color:p.color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{p.label}</div>
        <div style={{ fontSize:13, fontWeight:700, color:'#eeeef5' }}>@{username}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e' }} />
        <button onClick={onDisconnect}
          onMouseOver={e=>{ e.currentTarget.style.color='#ef4444'; setHov(true) }}
          onMouseOut={e=>{ e.currentTarget.style.color='#33334a'; setHov(false) }}
          style={{ background:'none', border:'none', color:'#33334a', cursor:'pointer', fontSize:11, fontWeight:700, padding:'2px 6px', transition:'color .15s' }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Connect button ────────────────────────────────────────────────────────────

function ConnectPlatformBtn({ platform, onClick, loading }) {
  const p = PLATFORMS[platform]
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={loading}
      onMouseOver={()=>setHov(true)} onMouseOut={()=>setHov(false)}
      style={{
        width:'100%', padding:'10px 14px', borderRadius:10, cursor: loading?'wait':'pointer',
        background: hov ? `${p.color}18` : `${p.color}0a`,
        border:`1px solid ${hov ? p.border : p.border+'55'}`,
        color: p.color, fontSize:13, fontWeight:700, transition:'all .15s',
        display:'flex', alignItems:'center', gap:10,
        boxShadow: hov ? `0 0 16px ${p.glow}` : 'none',
      }}>
      <span style={{ fontSize:16 }}>{p.icon}</span>
      <span style={{ flex:1, textAlign:'left' }}>
        {loading ? `Connecting to ${p.label}…` : `Connect ${p.label}`}
      </span>
      {loading && <span style={{ fontSize:12, opacity:0.6 }}>⏳</span>}
      {!loading && <span style={{ fontSize:12, opacity:0.4 }}>→</span>}
    </button>
  )
}

// ── Small UI ──────────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:800, color:'#33334a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{children}</div>
}

function ActionBtn({ onClick, primary, icon, label, sublabel, disabled, wide, style:s={} }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseOver={()=>setHov(true)} onMouseOut={()=>setHov(false)}
      style={{
        flex: wide?'1 1 100%':1, minWidth:130,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:2, padding:'13px 18px', borderRadius:12, cursor:disabled?'not-allowed':'pointer',
        border: primary?'none':'1px solid rgba(255,255,255,0.1)',
        background: primary
          ? (hov?'linear-gradient(135deg,#a855f7,#7c3aed)':'linear-gradient(135deg,#9147ff,#6d28d9)')
          : (hov?'rgba(255,255,255,0.07)':'rgba(255,255,255,0.04)'),
        boxShadow: primary?(hov?'0 6px 28px rgba(145,71,255,0.45)':'0 4px 20px rgba(145,71,255,0.3)'):'none',
        transition:'all .15s', opacity:disabled?0.4:1, ...s,
      }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:700, color:primary?'#fff':'#cccce0' }}>{label}</span>
      {sublabel && <span style={{ fontSize:10, color:primary?'rgba(255,255,255,0.55)':'#44445a' }}>{sublabel}</span>}
    </button>
  )
}

function Badge({ color, bg, border, children }) {
  return <span style={{ fontSize:10, fontWeight:700, color, background:bg, border:`1px solid ${border}`, borderRadius:6, padding:'2px 7px' }}>{children}</span>
}

function ErrorBar({ msg }) {
  return <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.22)', borderRadius:10, padding:'10px 16px', fontSize:13, color:'#f87171', marginBottom:14 }}>⚠ {msg}</div>
}

// ── ProfileCard ───────────────────────────────────────────────────────────────

function ProfileCard({ label, accent, icon, profile, onChange, readOnly,
  onConnectTwitch, onDisconnectTwitch, connectingTw,
  onConnectKick,   onDisconnectKick,   connectingKick,
  onConnectX,      onDisconnectX,      connectingX,
}) {
  const hasTwitch = !!profile.twitchUsername
  const hasKick   = !!profile.kickUsername
  const hasX      = !!profile.xUsername
  const initials  = profile.name.trim() ? profile.name.trim().slice(0,2).toUpperCase() : '?'
  const connectedCount = [hasTwitch, hasKick, hasX].filter(Boolean).length

  return (
    <div style={{
      flex:1, minWidth:280,
      background:'linear-gradient(160deg,#0f0f1c 0%,#0a0a14 100%)',
      border:`1px solid ${readOnly?'rgba(255,255,255,0.05)':accent+'33'}`,
      borderRadius:18, overflow:'hidden',
      boxShadow: readOnly?'none':`0 4px 32px ${accent}18`,
      opacity: readOnly?0.78:1,
    }}>
      {/* Header */}
      <div style={{ padding:'14px 18px 12px', background:`linear-gradient(135deg,${accent}18 0%,transparent 80%)`, borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:12, flexShrink:0, background:`linear-gradient(135deg,${accent}55,${accent}22)`, border:`2px solid ${accent}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:accent }}>
          {initials}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontWeight:800, color:accent, textTransform:'uppercase', letterSpacing:'0.1em' }}>{icon} {label}</div>
          <div style={{ display:'flex', gap:5, marginTop:5, flexWrap:'wrap' }}>
            {hasTwitch && <Badge color="#9147ff" bg="rgba(145,71,255,0.12)" border="rgba(145,71,255,0.25)">🟣 @{profile.twitchUsername}</Badge>}
            {hasKick   && <Badge color="#53fc18" bg="rgba(83,252,24,0.08)"  border="rgba(83,252,24,0.2)"  >🟢 @{profile.kickUsername}</Badge>}
            {hasX      && <Badge color="#e2e8f0" bg="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.15)">✖ @{profile.xUsername}</Badge>}
            {!hasTwitch&&!hasKick&&!hasX && <span style={{ fontSize:10, color:'#22223a' }}>No accounts connected yet</span>}
          </div>
        </div>
        {readOnly && <span style={{ fontSize:10, color:'#33334a', fontWeight:700, border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:'3px 8px' }}>CO-STREAMER</span>}
        {!readOnly && connectedCount > 0 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:900, color:accent }}>{connectedCount}</div>
            <div style={{ fontSize:9, color:'#33334a', textTransform:'uppercase', fontWeight:700 }}>linked</div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:'16px 18px' }}>
        {/* Name */}
        <div style={{ marginBottom:14 }}>
          <FieldLabel>Display Name</FieldLabel>
          {readOnly
            ? <div style={{ padding:'10px 13px', borderRadius:9, fontSize:14, fontWeight:600, background:'#07070e', border:'1px solid rgba(255,255,255,0.05)', color:'#55556a' }}>{profile.name||'—'}</div>
            : <input value={profile.name} onChange={e=>onChange({...profile,name:e.target.value})}
                placeholder="Your stream name..."
                style={{ width:'100%', boxSizing:'border-box', background:'#08080f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:9, padding:'10px 13px', fontSize:14, fontWeight:600, color:'#eeeef5', outline:'none', transition:'border-color .15s' }}
                onFocus={e=>e.target.style.borderColor=accent+'55'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.07)'}
              />
          }
        </div>

        {/* Platform rows */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {/* Twitch */}
          {readOnly
            ? <div style={{ padding:'10px 13px', borderRadius:9, fontSize:13, background:'#07070e', border:'1px solid rgba(255,255,255,0.05)', color: hasTwitch?'#9147ff':'#22223a' }}>{hasTwitch?`🟣 @${profile.twitchUsername}`:'🟣 Twitch — not connected'}</div>
            : hasTwitch
              ? <PlatformTile platform="twitch" username={profile.twitchUsername} onDisconnect={onDisconnectTwitch} />
              : <ConnectPlatformBtn platform="twitch" onClick={onConnectTwitch} loading={connectingTw} />
          }
          {/* Kick */}
          {readOnly
            ? <div style={{ padding:'10px 13px', borderRadius:9, fontSize:13, background:'#07070e', border:'1px solid rgba(255,255,255,0.05)', color: hasKick?'#53fc18':'#22223a' }}>{hasKick?`🟢 @${profile.kickUsername}`:'🟢 Kick — not connected'}</div>
            : hasKick
              ? <PlatformTile platform="kick" username={profile.kickUsername} onDisconnect={onDisconnectKick} />
              : <ConnectPlatformBtn platform="kick" onClick={onConnectKick} loading={connectingKick} />
          }
          {/* X */}
          {readOnly
            ? <div style={{ padding:'10px 13px', borderRadius:9, fontSize:13, background:'#07070e', border:'1px solid rgba(255,255,255,0.05)', color: hasX?'#e2e8f0':'#22223a' }}>{hasX?`✖ @${profile.xUsername}`:'✖ X — not connected'}</div>
            : hasX
              ? <PlatformTile platform="x" username={profile.xUsername} onDisconnect={onDisconnectX} />
              : <ConnectPlatformBtn platform="x" onClick={onConnectX} loading={connectingX} />
          }
        </div>
      </div>
    </div>
  )
}

// ── Debug panel (on-screen OAuth log) ────────────────────────────────────────
const dbgBtnStyle = { background:'#1a1a2e', color:'#cfcfe6', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'3px 9px', fontSize:11, cursor:'pointer' }
function DebugPanel() {
  const [open, setOpen] = useState(true)
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id) }, [])
  const log = localStorage.getItem('oauth_debug_log') || '(no log yet — click a Connect button to start)'
  const keys = ['twitch_token','twitch_username','twitch_pending_token','x_token','x_username','x_pending_code','x_pending_error','x_oauth_return','kick_token','kick_username']
  const snap = keys.map(k => { const v = localStorage.getItem(k); return `${k} = ${v ? (k.includes('token') ? v.slice(0,8)+'…('+v.length+')' : v) : '∅'}` }).join('\n')
  const copy = () => navigator.clipboard.writeText('ENV(build):\n  VITE_TWITCH_CLIENT_ID '+(ENV.twitchClientId?'set':'MISSING')+'\n  VITE_X_CLIENT_ID '+(ENV.xClientId?'set':'MISSING')+'\n  VITE_KICK_CLIENT_ID '+(ENV.kickClientId?'set':'MISSING')+'\n\nSTATE:\n'+snap+'\n\nLOG:'+log).catch(()=>{})
  const clear = () => { localStorage.removeItem('oauth_debug_log'); setTick(t => t + 1) }
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position:'fixed', bottom:12, right:12, zIndex:9999, background:'#1a1a2e', color:'#9147ff', border:'1px solid #9147ff55', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer' }}>🐞 Debug</button>
  )
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9999, maxHeight:'45vh', display:'flex', flexDirection:'column', background:'#0a0a14', borderTop:'2px solid #9147ff', fontFamily:'monospace', fontSize:11, color:'#cfcfe6', boxShadow:'0 -8px 30px rgba(0,0,0,0.6)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <strong style={{ color:'#9147ff' }}>🐞 OAuth Debug</strong>
        <button onClick={() => setTick(t => t + 1)} style={dbgBtnStyle}>Refresh</button>
        <button onClick={copy} style={dbgBtnStyle}>Copy all</button>
        <button onClick={clear} style={dbgBtnStyle}>Clear log</button>
        <span style={{ flex:1 }} />
        <span style={{ color:'#44445a' }}>build env: TW {ENV.twitchClientId?'✓':'✗'} · X {ENV.xClientId?'✓':'✗'} · KICK {ENV.kickClientId?'✓':'✗'}</span>
        <button onClick={() => setOpen(false)} style={dbgBtnStyle}>Hide ▾</button>
      </div>
      <div style={{ display:'flex', gap:12, overflow:'auto', padding:'8px 12px' }}>
        <pre style={{ margin:0, whiteSpace:'pre-wrap', flex:'0 0 300px', color:'#7dd3fc' }}>{snap}</pre>
        <pre style={{ margin:0, whiteSpace:'pre-wrap', flex:1, color:'#cfcfe6' }}>{log}</pre>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Setup() {
  const navigate = useNavigate()

  const [isGuest,     setIsGuest]     = useState(false)
  const [hostProfile, setHostProfile] = useState(null)
  const [myProfile,   setMyProfile]   = useState({ name:'', twitchUsername:'', kickUsername:'', xUsername:'' })

  const [connectingTw,   setConnectingTw]   = useState(false)
  const [connectingKick, setConnectingKick] = useState(false)
  const [connectingX,    setConnectingX]    = useState(false)

  const [roomCode]     = useState(genRoomCode)
  const [locked,        setLocked]       = useState(false)
  const [inviteCopied,  setInviteCopied] = useState(false)
  const [roomCopied,    setRoomCopied]   = useState(false)
  const [finalUrl,      setFinalUrl]     = useState('')
  const [error,         setError]        = useState('')
  const [joinUrl,       setJoinUrl]      = useState('')
  const [joinErr,       setJoinErr]      = useState('')

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tu = localStorage.getItem('twitch_username') || ''
    const ku = localStorage.getItem('kick_username')   || ''
    const xu = localStorage.getItem('x_username')      || ''
    if (tu||ku||xu) setMyProfile(p => ({...p, twitchUsername:tu, kickUsername:ku, xUsername:xu}))

    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) { try { setHostProfile(JSON.parse(atob(invite))); setIsGuest(true) } catch(_){} }

    const pendingTwitchErr = localStorage.getItem('twitch_pending_error')
    if (pendingTwitchErr) { localStorage.removeItem('twitch_pending_error'); alert('Twitch auth failed: ' + pendingTwitchErr) }
    dbg('SETUP mount', { hasPendingTwitch: !!localStorage.getItem('twitch_pending_token'), hasPendingX: !!localStorage.getItem('x_pending_code'), twitchUser: localStorage.getItem('twitch_username')||'', xUser: localStorage.getItem('x_username')||'' })
    const pendingTwitch = localStorage.getItem('twitch_pending_token')
    if (pendingTwitch) {
      dbg('SETUP processing twitch pending token')
      localStorage.removeItem('twitch_pending_token')
      localStorage.setItem('twitch_token', pendingTwitch)
      // Show "connected" in the UI immediately so it never looks stuck,
      // then refine with the real Twitch login name in the background.
      const immediate = localStorage.getItem('twitch_username') || 'connected'
      localStorage.setItem('twitch_username', immediate)
      setMyProfile(p => ({ ...p, twitchUsername: immediate }))
      const cid = ENV.twitchClientId || localStorage.getItem('twitch_client_id') || ''
      fetchTwitchUser(pendingTwitch, cid).then(username => {
        if (username) {
          localStorage.setItem('twitch_username', username)
          setMyProfile(p => ({ ...p, twitchUsername: username }))
        }
      })
    }

    const pendingXErr = localStorage.getItem('x_pending_error')
    if (pendingXErr) { localStorage.removeItem('x_pending_error'); alert('X auth failed: ' + pendingXErr) }
    const pendingX    = localStorage.getItem('x_pending_code')
    const pendingKick = localStorage.getItem('kick_pending_code')
    if (pendingX)    { dbg('SETUP found x pending code -> exchanging'); localStorage.removeItem('x_pending_code');    setConnectingX(true); exchangeXCode(pendingX) }
    if (pendingKick) { localStorage.removeItem('kick_pending_code'); exchangeKickCode(pendingKick) }
  }, [])

  // ── Twitch ─────────────────────────────────────────────────────────────────
  function connectTwitch() {
    const cid = ENV.twitchClientId || localStorage.getItem('twitch_client_id') || ''
    if (!cid) { alert('Add VITE_TWITCH_CLIENT_ID to your .env.local file'); return }
    const redirectUri = `${window.location.origin}/oauth/twitch`
    localStorage.setItem('twitch_oauth_return', window.location.href.split('#')[0])
    dbg('TWITCH connect -> redirecting to Twitch', { cid: (cid||'').slice(0,6)+'...', redirectUri, returnTo: window.location.href.split('#')[0] })
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${cid}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat%3Aread+chat%3Aedit`
    // Full redirect — avoids postMessage/popup-blocker/COOP issues
    window.location.href = url
  }
  function disconnectTwitch() {
    ['twitch_token','twitch_username'].forEach(k=>localStorage.removeItem(k))
    setMyProfile(p=>({...p,twitchUsername:''}))
  }

  // ── Kick ───────────────────────────────────────────────────────────────────
  async function exchangeKickCode(code) {
    const codeVerifier = sessionStorage.getItem('kick_code_verifier') || ''
    const redirectUri  = `${window.location.origin}/oauth/kick`
    try {
      const r = await fetch('/api/kick-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code,codeVerifier,redirectUri}) })
      const d = await r.json()
      if (d.access_token) {
        localStorage.setItem('kick_token',    d.access_token)
        localStorage.setItem('kick_username', d.username||'')
        if (d.refresh_token) localStorage.setItem('kick_refresh_token', d.refresh_token)
        setMyProfile(p=>({...p,kickUsername:d.username||''}))
      } else alert('Kick auth failed: '+(d.error||'unknown'))
    } catch(e) { alert('Kick auth error: '+e.message) }
    setConnectingKick(false)
  }
  async function connectKick() {
    const cid = ENV.kickClientId || localStorage.getItem('kick_client_id') || ''
    if (!cid) { alert('Add VITE_KICK_CLIENT_ID to your .env.local file'); return }
    const verifier  = genCodeVerifier()
    const challenge = await genCodeChallenge(verifier)
    sessionStorage.setItem('kick_code_verifier', verifier)
    const redirectUri = `${window.location.origin}/oauth/kick`
    const url = 'https://id.kick.com/oauth/authorize?'+new URLSearchParams({ response_type:'code', client_id:cid, redirect_uri:redirectUri, scope:'user:read channel:read chat:write', state:Math.random().toString(36).slice(2), code_challenge:challenge, code_challenge_method:'S256' })
    const popup = window.open(url,'kick_oauth','width=500,height=700,left=200,top=100')
    setConnectingKick(true)
    const handler = async e => {
      if (e.origin!==window.location.origin||e.data?.type!=='kick_oauth') return
      window.removeEventListener('message',handler)
      if (e.data.code) await exchangeKickCode(e.data.code)
      else { setConnectingKick(false); alert('Kick auth failed: '+(e.data.error||'unknown')) }
    }
    window.addEventListener('message',handler)
    setTimeout(()=>{ window.removeEventListener('message',handler); setConnectingKick(false); if(popup&&!popup.closed)popup.close() },120000)
  }
  function disconnectKick() {
    ['kick_token','kick_username','kick_refresh_token'].forEach(k=>localStorage.removeItem(k))
    setMyProfile(p=>({...p,kickUsername:''}))
  }

  // ── X ──────────────────────────────────────────────────────────────────────
  async function exchangeXCode(code) {
    const codeVerifier = sessionStorage.getItem('x_code_verifier') || localStorage.getItem('x_code_verifier_tmp') || ''
    localStorage.removeItem('x_code_verifier_tmp')
    const redirectUri  = `${window.location.origin}/oauth/x`
    dbg('X exchange start', { codeLen: code?code.length:0, hasVerifier: !!codeVerifier, redirectUri })
    try {
      const r = await fetch('/api/x-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code,codeVerifier,redirectUri}) })
      const raw = await r.text()
      let d = {}
      try { d = JSON.parse(raw) } catch (_) { d = { error: 'Non-JSON response from /api/x-auth (are you on the deployed site / vercel dev? plain `vite` does not run /api): ' + raw.slice(0,120) } }
      dbg('X exchange response', { status: r.status, ok: r.ok, hasToken: !!d.access_token, username: d.username||'', error: d.error||'', userDebug: d.user_debug||'' })
      if (d.access_token) {
        localStorage.setItem('x_token',    d.access_token)
        localStorage.setItem('x_username', d.username||'connected')
        if (d.refresh_token) localStorage.setItem('x_refresh_token', d.refresh_token)
        setMyProfile(p=>({...p,xUsername:d.username||'connected'}))
        dbg('X CONNECTED', { username: d.username||'connected' })
      } else { alert('X auth failed: '+(d.error||'unknown')); dbg('X FAILED', { error: d.error||'unknown' }) }
    } catch(e) { alert('X auth error: '+e.message); dbg('X exchange threw', { error: e.message }) }
    setConnectingX(false)
  }
  async function connectX() {
    const cid = ENV.xClientId || localStorage.getItem('x_client_id') || ''
    if (!cid) { alert('Add VITE_X_CLIENT_ID to your .env.local file'); return }
    const verifier  = genCodeVerifier()
    const challenge = await genCodeChallenge(verifier)
    sessionStorage.setItem('x_code_verifier', verifier)
    localStorage.setItem('x_code_verifier_tmp', verifier)
    localStorage.setItem('x_oauth_return', window.location.href.split('#')[0])
    const redirectUri = `${window.location.origin}/oauth/x`
    const url = 'https://x.com/i/oauth2/authorize?'+new URLSearchParams({ response_type:'code', client_id:cid, redirect_uri:redirectUri, scope:'tweet.read tweet.write users.read offline.access', state:Math.random().toString(36).slice(2), code_challenge:challenge, code_challenge_method:'S256' })
    setConnectingX(true)
    dbg('X connect -> redirecting to X', { cid: (cid||'').slice(0,6)+'...', redirectUri, returnTo: window.location.href.split('#')[0] })
    // Full redirect — avoids popup-blocker/COOP/opener issues that caused the X login loop
    window.location.href = url
  }
  function disconnectX() {
    ['x_token','x_username','x_refresh_token'].forEach(k=>localStorage.removeItem(k))
    setMyProfile(p=>({...p,xUsername:''}))
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function validate() {
    if (!myProfile.name.trim()) return 'Add your display name.'
    if (!myProfile.twitchUsername&&!myProfile.kickUsername&&!myProfile.xUsername)
      return 'Connect at least one platform.'
    return null
  }
  async function handleCopyInvite() {
    const err=validate(); if(err){setError(err);return}
    setError('')
    await navigator.clipboard.writeText(buildInviteUrl(myProfile,roomCode,locked)).catch(()=>{})
    setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500)
  }
  function handleOpen() {
    const err=validate(); if(err){setError(err);return}
    setError('')
    const url=buildRoomUrl([myProfile],roomCode,locked)
    navigate('/dashboard#'+url.split('#')[1])
  }
  async function handleGuestJoin() {
    const err=validate(); if(err){setError(err);return}
    setError('')
    const url=buildRoomUrl([hostProfile,myProfile],hostProfile.roomCode,hostProfile.locked)
    setFinalUrl(url)
    await navigator.clipboard.writeText(url).catch(()=>{})
    setRoomCopied(true); setTimeout(()=>setRoomCopied(false),3000)
  }
  function handleGuestNavigate() {
    if(!finalUrl)return
    navigate('/dashboard#'+finalUrl.split('#')[1])
  }
  function handleJoin() {
    setJoinErr('')
    const url=joinUrl.trim()
    if(!url){setJoinErr('Paste a room link first.');return}
    try {
      const parsed=new URL(url)
      if(parsed.searchParams.get('invite')){window.location.href=url;return}
      const hash=parsed.hash.slice(1)
      if(!hash)throw new Error()
      JSON.parse(atob(hash))
      window.location.href=url
    } catch {setJoinErr("That doesn't look like a valid room or invite link.")}
  }

  const myCardProps = {
    label:'Your Profile', accent:'#9147ff', icon:'🎙',
    profile:myProfile, onChange:setMyProfile,
    onConnectTwitch:connectTwitch, onDisconnectTwitch:disconnectTwitch, connectingTw,
    onConnectKick:connectKick,     onDisconnectKick:disconnectKick,     connectingKick,
    onConnectX:connectX,           onDisconnectX:disconnectX,           connectingX,
  }

  return (
    <div style={{ minHeight:'100vh', background:'#06060c', color:'#eeeef5', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", overflowY:'auto' }}>
      <DebugPanel />
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background: isGuest
          ? 'radial-gradient(ellipse 80% 50% at 50% -10%,rgba(84,192,255,0.1) 0%,transparent 70%)'
          : 'radial-gradient(ellipse 80% 50% at 50% -10%,rgba(145,71,255,0.12) 0%,transparent 70%)' }} />

      <div style={{ position:'relative', zIndex:1, maxWidth:880, margin:'0 auto', padding:'40px 20px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, background:'rgba(145,71,255,0.08)', border:'1px solid rgba(145,71,255,0.2)', borderRadius:50, padding:'6px 18px', marginBottom:18 }}>
            <span>🟣</span><span style={{ fontSize:11, fontWeight:700, color:'#9147ff', letterSpacing:'0.1em', textTransform:'uppercase' }}>Multi-Platform Stream Chat</span><span>🟢</span>
          </div>
          <h1 style={{ fontSize:44, fontWeight:900, margin:'0 0 10px', letterSpacing:'-1.5px', background:'linear-gradient(135deg,#c084fc 0%,#ffffff 50%,#e879f9 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Market Bubble</h1>
          <p style={{ fontSize:14, color:'#33334a', margin:0 }}>
            {isGuest ? `🎙 ${hostProfile?.name||'Your co-streamer'} invited you — connect your accounts and join` : 'Log in to Twitch, Kick & X · invite your co-streamer · go live together'}
          </p>
        </div>

        {/* Guest mode */}
        {isGuest && hostProfile && (
          <>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:18 }}>
              <ProfileCard label={hostProfile.name||'Co-Streamer'} accent="#54c0ff" icon="🎙" profile={hostProfile} readOnly />
              <ProfileCard {...myCardProps} />
            </div>
            {error && <ErrorBar msg={error} />}
            {finalUrl ? (
              <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:14, padding:'18px 20px', marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:10 }}>✅ Room link ready — send this to {hostProfile.name||'your co-streamer'}!</div>
                <div style={{ background:'#08080f', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#8888aa', wordBreak:'break-all', fontFamily:'monospace', marginBottom:12 }}>{finalUrl}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <ActionBtn primary icon="🎛" label="Open Dashboard" onClick={()=>handleGuestNavigate()} />
                  <ActionBtn icon={roomCopied?'✓':'📋'} label={roomCopied?'Copied!':'Copy Room Link'} onClick={async()=>{ await navigator.clipboard.writeText(finalUrl).catch(()=>{}); setRoomCopied(true); setTimeout(()=>setRoomCopied(false),2500) }} style={roomCopied?{borderColor:'rgba(34,197,94,0.3)'}:{}} />
                </div>
              </div>
            ) : (
              <ActionBtn primary wide icon="🚀" label="Join Room" sublabel={`Create combined room with ${hostProfile.name||'host'}`} onClick={handleGuestJoin} />
            )}
          </>
        )}

        {/* Host mode */}
        {!isGuest && (
          <>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:18 }}>
              <ProfileCard {...myCardProps} />
              <div style={{ flex:1, minWidth:280, background:'linear-gradient(160deg,#0a0a12,#08080e)', border:'1px dashed rgba(255,255,255,0.06)', borderRadius:18, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:32, minHeight:300 }}>
                <div style={{ fontSize:36 }}>🤝</div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#33334a', marginBottom:6 }}>Add a Co-Streamer</div>
                  <div style={{ fontSize:12, color:'#1a1a2e', lineHeight:1.7, maxWidth:220 }}>Send them the invite link. They'll log into their own accounts and join your room.</div>
                </div>
                <button onClick={handleCopyInvite}
                  style={{ background:'rgba(145,71,255,0.08)', border:'1px solid rgba(145,71,255,0.2)', color:'#9147ff', borderRadius:10, padding:'9px 20px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .15s' }}
                  onMouseOver={e=>{ e.currentTarget.style.background='rgba(145,71,255,0.15)'; e.currentTarget.style.borderColor='rgba(145,71,255,0.4)' }}
                  onMouseOut={e=>{ e.currentTarget.style.background='rgba(145,71,255,0.08)'; e.currentTarget.style.borderColor='rgba(145,71,255,0.2)' }}>
                  {inviteCopied?'✅ Invite Copied!':'🔗 Copy Invite Link'}
                </button>
              </div>
            </div>

            {/* Room settings */}
            <div style={{ background:'linear-gradient(135deg,#0f0f1c,#0a0a14)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'16px 22px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#22223a', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:5 }}>Room Code</div>
                  <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:900, letterSpacing:'0.2em', color:'#eeeef5', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, padding:'7px 16px' }}>{roomCode}</div>
                </div>
                <div style={{ fontSize:12, color:'#1a1a2e', maxWidth:180, lineHeight:1.5 }}>Announce in your stream title so viewers can join</div>
              </div>
              <button onClick={()=>setLocked(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, background:locked?'rgba(234,179,8,0.08)':'rgba(255,255,255,0.04)', border:`1px solid ${locked?'rgba(234,179,8,0.3)':'rgba(255,255,255,0.08)'}`, color:locked?'#fbbf24':'#44445a', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .2s' }}>
                {locked?'🔒 Locked':'🔓 Lock Room'}
              </button>
            </div>

            {error && <ErrorBar msg={error} />}

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
              <ActionBtn primary icon="🎛" label="Open Dashboard" sublabel="Stream · chat · markets · AI" onClick={()=>handleOpen()} />
              <ActionBtn icon={inviteCopied?'✅':'🔗'} label={inviteCopied?'Copied!':'Copy Invite Link'} sublabel="Send to co-streamer" onClick={handleCopyInvite} style={inviteCopied?{borderColor:'rgba(34,197,94,0.3)'}:{}} />
            </div>
          </>
        )}

        {/* Join */}
        <div style={{ display:'flex', alignItems:'center', gap:16, margin:'28px 0 22px' }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }} />
          <span style={{ fontSize:11, color:'#1a1a2e', fontWeight:700 }}>OR JOIN AN EXISTING ROOM</span>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.04)' }} />
        </div>
        <div style={{ background:'linear-gradient(135deg,#0f0f1c,#0a0a14)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 22px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#33334a', marginBottom:12 }}>Paste a room link or invite link</div>
          <div style={{ display:'flex', gap:10 }}>
            <input value={joinUrl} onChange={e=>{setJoinUrl(e.target.value);setJoinErr('')}} onKeyDown={e=>e.key==='Enter'&&handleJoin()}
              placeholder="https://..."
              style={{ flex:1, background:'#08080f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'#eeeef5', outline:'none' }}
              onFocus={e=>e.target.style.borderColor='rgba(145,71,255,0.4)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.07)'}
            />
            <button onClick={handleJoin} style={{ background:'rgba(145,71,255,0.1)', border:'1px solid rgba(145,71,255,0.25)', color:'#c084fc', borderRadius:10, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Join →</button>
          </div>
          {joinErr && <div style={{ marginTop:8, fontSize:12, color:'#f87171' }}>⚠ {joinErr}</div>}
        </div>

        {/* Footer */}
        <div style={{ marginTop:36, display:'flex', alignItems:'center', justifyContent:'center', gap:22, flexWrap:'wrap' }}>
          {[['🟣','Twitch'],['🟢','Kick'],['✖','X (Twitter)'],['🤖','C3PO AI'],['📊','Polymarket'],['📈','Markets']].map(([ic,lb])=>(
            <div key={lb} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#1a1a2e' }}><span>{ic}</span><span style={{ fontWeight:600 }}>{lb}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}
