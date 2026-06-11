import { useState, useEffect } from 'react'
import { parseConfig, genCodeVerifier, genCodeChallenge, loadCfg, saveCfg, effectiveSources, DEFAULT_LAYOUT, dbg } from '../lib/dash'
import Panel        from '../components/Panel'
import GridLayout   from '../components/GridLayout'
import StreamPlayer from '../components/StreamPlayer'
import CombinedChat from '../components/CombinedChat'
import ViewerBar    from '../components/ViewerBar'
import ViewerPanel  from '../components/ViewerPanel'
import Polymarket   from '../components/Polymarket'
import C3POWidget   from '../components/C3POWidget'
import SettingsModal from '../components/SettingsModal'

const PANEL_META = {
  stream:     { title: 'Live Stream',        icon: '📺', accent: '#8b7fb5', flexBasis: '2 1 480px', height: 440 },
  chat:       { title: 'Combined Chat',      icon: '💬', accent: '#7fa8c4', flexBasis: '1 1 340px', height: 440 },
  viewers:    { title: 'Viewer Counts',      icon: '👥', accent: '#6fae8a', flexBasis: '1 1 300px', height: 320 },
  polymarket: { title: 'Polymarket',         icon: '📊', accent: '#7691c0', flexBasis: '1 1 320px', height: 320 },
  c3po:       { title: 'Jarvis Assistant',    icon: '🤖', accent: '#c9b878', flexBasis: '2 1 480px', height: 340 },
}
const PANEL_ORDER = ['stream', 'chat', 'polymarket', 'c3po', 'viewers']

export default function Dashboard() {
  const config    = parseConfig()
  const streamers = config?.streamers || []

  const [cfg, setCfg] = useState(loadCfg)
  const [settingsTab, setSettingsTab] = useState(null)   // null = closed, else tab key

  const [twitchAuth, setTwitchAuth] = useState(() => {
    const t = localStorage.getItem('twitch_token'), u = localStorage.getItem('twitch_username')
    return t ? { token: t, username: u || '' } : null
  })
  const [xAuth, setXAuth] = useState(() => {
    const t = localStorage.getItem('x_token'), u = localStorage.getItem('x_username')
    return t ? { token: t, username: u || '' } : null
  })
  const [kickAuth, setKickAuth] = useState(() => {
    const t = localStorage.getItem('kick_token'), u = localStorage.getItem('kick_username')
    return t ? { token: t, username: u || '' } : null
  })
  const [connectingX, setConnectingX] = useState(false)

  // ── Handle pending OAuth returns ────────────────────────────────────────────
  useEffect(() => {
    const tErr = localStorage.getItem('twitch_pending_error')
    if (tErr) { localStorage.removeItem('twitch_pending_error'); alert('Twitch auth failed: ' + tErr) }
    const pendingTwitch = localStorage.getItem('twitch_pending_token')
    if (pendingTwitch) { localStorage.removeItem('twitch_pending_token'); fetchTwitchUser(pendingTwitch) }

    const xErr = localStorage.getItem('x_pending_error')
    if (xErr) { localStorage.removeItem('x_pending_error'); alert('X auth failed: ' + xErr) }
    const pendingX = localStorage.getItem('x_pending_code')
    if (pendingX) { localStorage.removeItem('x_pending_code'); setConnectingX(true); exchangeXCode(pendingX) }
  }, [])

  async function fetchTwitchUser(token) {
    localStorage.setItem('twitch_token', token)
    const existing = localStorage.getItem('twitch_username') || 'connected'
    localStorage.setItem('twitch_username', existing)
    setTwitchAuth({ token, username: existing })
    const clientId = cfg.twClientId || import.meta.env.VITE_TWITCH_CLIENT_ID || ''
    if (!clientId) return
    try {
      const r = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId } })
      const d = await r.json()
      const username = d.data?.[0]?.login
      if (username) { localStorage.setItem('twitch_username', username); setTwitchAuth({ token, username }) }
    } catch (_) {}
  }

  function connectTwitch() {
    const clientId = cfg.twClientId || import.meta.env.VITE_TWITCH_CLIENT_ID || ''
    if (!clientId) { alert('Client ID is not configured (check your VITE_ env vars).'); return }
    localStorage.setItem('twitch_oauth_return', window.location.href)
    const redirectUri = `${window.location.origin}/oauth/twitch`
    dbg('TWITCH connect (dashboard)', { redirectUri })
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat%3Aread+chat%3Aedit`
  }

  async function exchangeXCode(code) {
    const codeVerifier = sessionStorage.getItem('x_code_verifier') || localStorage.getItem('x_code_verifier_tmp') || ''
    localStorage.removeItem('x_code_verifier_tmp')
    const redirectUri = `${window.location.origin}/oauth/x`
    dbg('X exchange (dashboard) start', { hasVerifier: !!codeVerifier })
    try {
      const r = await fetch('/api/x-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, codeVerifier, redirectUri }) })
      const raw = await r.text()
      let d = {}; try { d = JSON.parse(raw) } catch (_) { d = { error: 'Non-JSON from /api/x-auth: ' + raw.slice(0, 100) } }
      dbg('X exchange (dashboard) response', { status: r.status, hasToken: !!d.access_token, error: d.error || '' })
      if (d.access_token) {
        localStorage.setItem('x_token', d.access_token)
        localStorage.setItem('x_username', d.username || 'connected')
        if (d.refresh_token) localStorage.setItem('x_refresh_token', d.refresh_token)
        setXAuth({ token: d.access_token, username: d.username || 'connected' })
      } else alert('X auth failed: ' + (d.error || 'unknown'))
    } catch (e) { alert('X auth error: ' + e.message) }
    setConnectingX(false)
  }

  async function connectX() {
    const clientId = cfg.xClientId || import.meta.env.VITE_X_CLIENT_ID || ''
    if (!clientId) { alert('Client ID is not configured (check your VITE_ env vars).'); return }
    const verifier = genCodeVerifier(), challenge = await genCodeChallenge(verifier)
    sessionStorage.setItem('x_code_verifier', verifier)
    localStorage.setItem('x_code_verifier_tmp', verifier)
    localStorage.setItem('x_oauth_return', window.location.href)
    const redirectUri = `${window.location.origin}/oauth/x`
    const url = 'https://x.com/i/oauth2/authorize?' + new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state: Math.random().toString(36).slice(2), code_challenge: challenge, code_challenge_method: 'S256',
    })
    setConnectingX(true)
    dbg('X connect (dashboard) -> redirect', { redirectUri })
    window.location.href = url
  }

  function persistCfg(next) { setCfg(next); saveCfg(next) }
  function setPanel(id, visible) { persistCfg({ ...cfg, panels: { ...cfg.panels, [id]: visible } }) }

  // ── Room sharing ────────────────────────────────────────────────────────────
  const [, setRoomTick] = useState(0)
  // Use the public web URL for shareable links (in the desktop app the real
  // origin is localhost, which others can't open).
  const publicBase = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '')
  const origin = publicBase
  const roomCode = config?.roomCode || ''
  const roomLocked = !!config?.locked
  const roomLink = `${publicBase}/dashboard${window.location.hash || ''}`
  const inviteLink = (() => {
    try {
      return `${origin}/?invite=` + btoa(JSON.stringify({
        name: localStorage.getItem('twitch_username') || localStorage.getItem('kick_username') || 'Host',
        twitchUsername: localStorage.getItem('twitch_username') || '',
        kickUsername: localStorage.getItem('kick_username') || '',
        xUsername: localStorage.getItem('x_username') || '',
        roomCode, locked: roomLocked,
      }))
    } catch (_) { return origin }
  })()
  function toggleLock() {
    try {
      const cur = config || { roomCode, streamers: [] }
      window.location.hash = btoa(JSON.stringify({ ...cur, locked: !cur.locked }))
      setRoomTick(t => t + 1)
    } catch (_) {}
  }
  const room = { code: roomCode, link: roomLink, invite: inviteLink, locked: roomLocked, onToggleLock: toggleLock }

  const sources = effectiveSources(cfg, streamers)
  const visiblePanels = PANEL_ORDER.filter(id => cfg.panels[id] !== false)
  const hiddenPanels  = PANEL_ORDER.filter(id => cfg.panels[id] === false)
  const show = id => cfg.panels[id] !== false
  const P = id => { const m = PANEL_META[id]; return <Panel title={m.title} icon={m.icon} accent={m.accent} onHide={() => setPanel(id, false)}>{renderPanel(id)}</Panel> }

  function renderPanel(id) {
    switch (id) {
      case 'stream':     return <StreamPlayer sources={sources} />
      case 'chat':       return <CombinedChat sources={sources} twitchAuth={twitchAuth} xAuth={xAuth} kickAuth={kickAuth} roomCode={roomCode} onOpenSettings={() => setSettingsTab('sources')} />
      case 'polymarket': return <Polymarket defaultQuery={cfg.polyQ} limit={cfg.polyLimit} />
      case 'viewers':    return <ViewerPanel sources={sources} />
      case 'c3po':       return <C3POWidget provider={cfg.c3poProvider} apiKey={cfg.c3poApiKey} wakeWord={cfg.c3poWakeWord} autoSpeak={cfg.c3poAutoSpeak} onOpenSettings={() => setSettingsTab('c3po')} />
      default: return null
    }
  }

  const chip = (color, bg, border, text) => (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '2px 8px' }}>{text}</span>
  )
  const lightBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '5px 12px', fontSize: 11, color: '#dcdce8', cursor: 'pointer', fontWeight: 700, transition: 'all .15s' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(130,118,180,0.045), transparent 60%), #09090f', color: '#eeeef5', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      {settingsTab && <SettingsModal cfg={cfg} room={room} initialTab={settingsTab} onSave={persistCfg} onClose={() => setSettingsTab(null)} />}


      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'linear-gradient(180deg,rgba(16,16,30,0.98),rgba(9,9,18,0.96))', borderBottom: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 2px 14px rgba(0,0,0,0.35)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.01em', background: 'linear-gradient(135deg,#9d92c4,#84aac2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0, marginRight: 4 }}>🎛 Market Bubble</span>

        {/* Connected accounts (persistent) */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {twitchAuth && chip('#c084fc', 'rgba(145,71,255,0.14)', 'rgba(145,71,255,0.3)', `🟣 @${twitchAuth.username || 'connected'}`)}
          {kickAuth   && chip('#7bff4d', 'rgba(83,252,24,0.1)',   'rgba(83,252,24,0.25)', `🟢 @${kickAuth.username || 'connected'}`)}
          {xAuth      && chip('#cbd5e1', 'rgba(226,232,240,0.08)', 'rgba(226,232,240,0.2)', `✖ @${xAuth.username || 'connected'}`)}
        </div>

        {/* Live viewer counts (moved into the top bar) */}
        <div style={{ flex: '1 1 220px', minWidth: 0, overflowX: 'auto' }}><ViewerBar sources={sources} /></div>

        <div style={{ flex: 1 }} />

        {/* Connect buttons only for not-connected */}
        {!twitchAuth && <button onClick={connectTwitch} style={{ ...lightBtn, color: '#c084fc', background: 'rgba(145,71,255,0.14)', border: '1px solid rgba(145,71,255,0.35)' }}>🟣 Connect Twitch</button>}
        {!xAuth && <button onClick={connectX} disabled={connectingX} style={{ ...lightBtn, color: '#cbd5e1', background: 'rgba(226,232,240,0.08)', border: '1px solid rgba(226,232,240,0.25)' }}>{connectingX ? 'Connecting…' : '✖ Connect X'}</button>}

        {/* Restore hidden panels — sit up here next to Room */}
        {hiddenPanels.map(id => (
          <button key={id} onClick={() => setPanel(id, true)} style={{ ...lightBtn, color: PANEL_META[id].accent }}>+ {PANEL_META[id].title}</button>
        ))}
        <button onClick={() => setSettingsTab('room')} style={lightBtn}>🔗 Room {roomCode ? `· ${roomCode}` : ''}</button>
        <button onClick={() => setSettingsTab('accounts')} style={lightBtn}>👤 Accounts</button>
        <button onClick={() => setSettingsTab('sources')} style={lightBtn}>⚙ Settings</button>
        <button onClick={() => persistCfg({ ...cfg, panels: { stream: true, chat: true, viewers: true, polymarket: true, c3po: true }, layout: { ...DEFAULT_LAYOUT } })} style={lightBtn}>Reset layout</button>
        <button onClick={() => { window.location.href = '/' }} style={{ ...lightBtn, color: '#c084fc', borderColor: 'rgba(145,71,255,0.4)' }}>⬅ Back to Setup</button>
      </div>

      {/* Layout: Polymarket = thin glanceable strip on the left · center = stream
          on top with C-3PO filling all the way down · combined chat (bigger) on
          the right. Hide any panel with its ✕ and restore it from the top bar. */}
      {visiblePanels.length === 0 ? (
        <div style={{ flex: 1, textAlign: 'center', color: '#55556a', fontSize: 13, padding: 40 }}>All panels hidden — add them back from the top bar.</div>
      ) : (
        <GridLayout
          items={visiblePanels.map(id => ({ id }))}
          layout={cfg.layout}
          onLayout={next => persistCfg({ ...cfg, layout: next })}
          renderItem={(id, dragHandle) => (
            <Panel title={PANEL_META[id].title} icon={PANEL_META[id].icon} accent={PANEL_META[id].accent} dragHandle={dragHandle} onHide={() => setPanel(id, false)}>
              {renderPanel(id)}
            </Panel>
          )}
        />
      )}

      <style>{`
        @keyframes tickerScroll { from { transform: translateX(0) } to { transform: translateX(-33.333%) } }
        ::-webkit-scrollbar { width:7px; height:7px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.14); border-radius:4px }
        ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.25) }
      `}</style>
    </div>
  )
}
