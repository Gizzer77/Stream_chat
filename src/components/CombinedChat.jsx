import { useState, useEffect, useRef, useCallback } from 'react'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { useKickChat }   from '../hooks/useKickChat'
import { useTwitchSend } from '../hooks/useTwitchSend'
import { PLAT, dbg } from '../lib/dash'

// Combined chat. Reads Twitch IRC + Kick (Pusher). For X, the "X" filter tab
// shows the pop-out live-chat iframe directly; the browser extension scrapes
// that same iframe and feeds its messages into the "All" feed.
export default function CombinedChat({ sources, twitchAuth, xAuth, kickAuth, roomCode = '', onOpenSettings }) {
  const [msgs,   setMsgs]   = useState([])
  const [filter, setFilter] = useState('all')
  const chatRef = useRef(null)

  const [sendMsg,    setSendMsg]    = useState('')
  const [sendStatus, setSendStatus] = useState(null)
  const [kickStatus, setKickStatus] = useState(null)
  const [listenerUp, setListenerUp] = useState(false)
  // Room-wide chat relay: everyone in the room sees both streamers' merged chats
  const [roomUserId] = useState(() => { let id = sessionStorage.getItem('sc_user_id'); if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('sc_user_id', id) } return id })
  const relayPushed = useRef(new Set())
  const relayRemote = useRef(new Set())
  const msgsRef = useRef([])

  const myTwitchCh = localStorage.getItem('twitch_username') || ''
  const { ready: twSendReady, send: twSend } = useTwitchSend(twitchAuth?.token, twitchAuth?.username)
  const xReady    = !!xAuth?.token
  const kickReady = !!kickAuth?.token
  const kickBidRef = useRef(null)

  const hookStreamers = (sources || []).map(s => ({
    name: s.label || s.channel,
    twitch: s.platform === 'twitch' ? s.channel : '',
    kick:   s.platform === 'kick'   ? s.channel : '',
  }))
  const add = useCallback(msg => setMsgs(p => [...p.slice(-399), msg]), [])
  useTwitchChat(hookStreamers, add)
  useKickChat(hookStreamers, add, setKickStatus)

  // Resolve the watched Kick channel's broadcaster id so sends go into THAT chat
  const myKick = (localStorage.getItem('kick_username') || '').toLowerCase()
  const kickSources = (sources || []).filter(s => s.platform === 'kick')
  // Prefer a Kick channel that ISN'T your own auto-added one, so sends go to the channel you're watching
  const kickChannel = (kickSources.find(s => (s.channel || '').toLowerCase() !== myKick) || kickSources[0])?.channel || ''
  useEffect(() => {
    kickBidRef.current = null
    if (!kickChannel || !kickAuth?.token) return
    fetch(`/api/kick-chatroom?channel=${encodeURIComponent(kickChannel)}&token=${encodeURIComponent(kickAuth.token)}`)
      .then(r => r.json()).then(d => { if (d && d.broadcasterUserId) kickBidRef.current = d.broadcasterUserId }).catch(() => {})
  }, [kickChannel, kickAuth?.token])

  // Our own handles across platforms — used to highlight messages we send
  const ownNames = new Set([
    twitchAuth?.username, xAuth?.username, kickAuth?.username,
    localStorage.getItem('twitch_username'), localStorage.getItem('x_username'), localStorage.getItem('kick_username'),
  ].filter(Boolean).map(n => String(n).toLowerCase().replace(/^@/, '')))

  // X chat from the browser extension (scrapes the iframe below)
  useEffect(() => {
    function onMsg(e) {
      const d = e.data
      if (!d || d.type !== 'mb_x_chat' || !d.message) return
      const id = 'xc_' + (d.id || (d.username || '') + ':' + d.message)
      setMsgs(prev => prev.some(m => m.id === id) ? prev
        : [...prev.slice(-399), { id, platform: 'x', streamer: d.streamer || 'X', username: d.username || 'X', message: d.message, userColor: '#cbd5e1' }])
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // ── X Chat Listener helper (standalone app on localhost:5124) ───────────────
  // Polls the local listener and merges its X messages. If it isn't running the
  // fetch just fails quietly (slower retry) and nothing breaks.
  useEffect(() => {
    let alive = true, since = 0, delay = 6000, timer
    async function poll() {
      if (!alive) return
      try {
        const r = await fetch(`http://localhost:5124/messages?since=${since}`)
        if (r.ok) {
          const d = await r.json()
          delay = 1500
          setListenerUp(true)
          if (Array.isArray(d.messages) && d.messages.length) {
            since = d.last || since
            setMsgs(prev => [...prev.slice(-399), ...d.messages.map(m => ({ id: 'xl_' + m.seq, platform: 'x', streamer: 'X', username: m.username || 'X', message: m.message, userColor: '#cbd5e1' }))])
          } else if (d.last) since = d.last
        } else { delay = 6000; setListenerUp(false) }
      } catch (_) { delay = 6000; setListenerUp(false) }
      if (alive) timer = setTimeout(poll, delay)
    }
    poll()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  useEffect(() => { msgsRef.current = msgs }, [msgs])

  // ── Combined-chat relay ─────────────────────────────────────────────────────
  // Push our locally-received messages to the room and pull everyone else's, so
  // each person sees both streamers' Twitch/Kick/X chats merged together.
  useEffect(() => {
    if (!roomCode) return
    const pushed = relayPushed.current, remote = relayRemote.current
    // seed with what's already on screen so we relay live-forward, not the backlog
    msgsRef.current.forEach(m => m.id && pushed.add(m.id))
    let alive = true, lastSeq = 0, timer
    async function tick() {
      if (!alive) return
      const toPush = msgsRef.current.filter(m => m.id && !pushed.has(m.id) && !remote.has(m.id))
      if (toPush.length) {
        toPush.forEach(m => pushed.add(m.id))
        try { await fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode, userId: roomUserId, action: 'chat', messages: toPush.map(m => ({ id: m.id, platform: m.platform, streamer: m.streamer, username: m.username, message: m.message, userColor: m.userColor })) }) }) } catch (_) {}
      }
      try {
        const r = await fetch(`/api/presence?room=${encodeURIComponent(roomCode)}&chatSince=${lastSeq}`)
        if (r.ok) {
          const d = await r.json()
          if (Array.isArray(d.chat) && d.chat.length) {
            lastSeq = d.chatLast || lastSeq
            setMsgs(prev => {
              const have = new Set(prev.map(x => x.id))
              const add = []
              for (const m of d.chat) { if (!have.has(m.id) && !pushed.has(m.id)) { remote.add(m.id); add.push({ id: m.id, platform: m.platform, streamer: m.streamer, username: m.username, message: m.message, userColor: m.userColor || '#cbd5e1' }) } }
              return add.length ? [...prev.slice(-399), ...add] : prev
            })
          } else if (d.chatLast) lastSeq = d.chatLast
        }
      } catch (_) {}
      if (alive) timer = setTimeout(tick, 2000)
    }
    timer = setTimeout(tick, 1500)
    return () => { alive = false; clearTimeout(timer) }
  }, [roomCode, roomUserId])

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [msgs, filter])

  async function handleSend() {
    const text = sendMsg.trim()
    if (!text) return
    setSendMsg('')
    const ok = [], failed = []
    if (twSendReady && myTwitchCh) { twSend([myTwitchCh], text); ok.push('Twitch') }
    else if (twSendReady) { twSend(hookStreamers.filter(s => s.twitch).map(s => s.twitch), text); ok.push('Twitch') }
    if (listenerUp) {
      // Post into the X LIVE CHAT via the local listener (the logged-in X window types it in)
      try { const r = await fetch('http://localhost:5124/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); const d = await r.json().catch(() => ({})); if (r.ok && d.ok) ok.push('X'); else failed.push(`X: ${d.reason || 'listener could not post'}`) } catch (e) { failed.push(`X: ${e.message}`) }
    } else if (xReady) {
      // No listener running — fall back to posting a tweet via the API
      try { const r = await fetch('/api/x-tweet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, accessToken: xAuth.token }) }); const d = await r.json(); if (r.ok) ok.push('X (tweet)'); else failed.push(`X: ${d.error}`) } catch (e) { failed.push(`X: ${e.message}`) }
    }
    if (kickReady) {
      try { const r = await fetch('/api/kick-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, accessToken: kickAuth.token, channel: kickChannel || undefined, broadcasterUserId: kickBidRef.current || undefined }) }); const d = await r.json(); if (r.ok) ok.push('Kick'); else failed.push(`Kick: ${d.error}`) } catch (e) { failed.push(`Kick: ${e.message}`) }
    }
    dbg('CHAT send', { ok, failed })
    const anyConnected = twSendReady || xReady || kickReady || listenerUp
    setSendStatus(!anyConnected ? { ok: false, text: 'Connect Twitch, X or Kick to send' } : { ok: ok.length > 0, text: (ok.length ? `✓ ${ok.join(' + ')}` : '') + (failed.length ? `  ⚠ ${failed.join(' · ')}` : '') })
    setTimeout(() => setSendStatus(null), 5000)
  }

  // Prefer a livechat you ADDED as a source over your own auto-added one
  const myX = (localStorage.getItem('x_username') || '').toLowerCase()
  const xLivechats = (sources || []).filter(s => s.platform === 'x' && s.kind === 'livechat')
  const xLivechat = xLivechats.find(s => s.channel.toLowerCase() !== myX) || xLivechats[0]

  const kickNotice = kickStatus?.state === 'blocked'
    ? `Kick chat blocked for ${kickStatus.channel}: ${kickStatus.error}`
    : kickStatus?.state === 'connecting' ? `Connecting to Kick (${kickStatus.channel})…` : ''

  const visible = msgs.filter(m => filter === 'all' || m.platform === filter)
  const twCount = msgs.filter(m => m.platform === 'twitch').length
  const kkCount = msgs.filter(m => m.platform === 'kick').length
  const xCount  = msgs.filter(m => m.platform === 'x').length
  const targets = [twSendReady && 'Twitch', (xReady || listenerUp) && 'X', kickReady && 'Kick'].filter(Boolean)

  const isDesktop = typeof window !== 'undefined' && !!window.desktop
  // Desktop: open/scrape the X chat in its own native window (reads it directly)
  useEffect(() => { if (window.desktop?.setXChatUrl) window.desktop.setXChatUrl(xLivechat?.url || '') }, [xLivechat?.url])
  // Standalone listener: tell it which channel to watch (best-effort)
  useEffect(() => { const u = xLivechat?.channel; if (u) fetch(`http://localhost:5124/set?channel=${encodeURIComponent(u)}`).catch(() => {}) }, [xLivechat?.channel])


  const tabs = [
    { key: 'all',    label: `All ${msgs.length}`, color: '#c8c8e0' },
    { key: 'twitch', label: `🟣 ${twCount}`,       color: '#9147ff' },
    { key: 'kick',   label: `🟢 ${kkCount}`,       color: '#53fc18' },
    { key: 'x',      label: `✖ ${xCount}`,         color: '#cbd5e1' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: filter === tab.key ? tab.color + '22' : 'transparent',
            color: filter === tab.key ? tab.color : '#8a8aa5',
            border: `1px solid ${filter === tab.key ? tab.color + '55' : 'transparent'}`,
          }}>{tab.label}</button>
        ))}
        <button onClick={onOpenSettings} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e8f5', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 700 }}>⚙</button>
      </div>

      {kickNotice && (
        <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: kickStatus?.state === 'blocked' ? '#f87171' : '#8a8aa5', background: 'rgba(83,252,24,0.06)', borderBottom: '1px solid rgba(83,252,24,0.14)' }}>🟢 {kickNotice}</div>
      )}
      {(xLivechat || xReady) && !isDesktop && (
        listenerUp ? (
          <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#22c55e', background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.16)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />✖ X Chat Listener connected — X messages are merging in
          </div>
        ) : (
          <div style={{ flexShrink: 0, padding: '9px 11px', background: 'rgba(29,155,240,0.1)', borderBottom: '1px solid rgba(29,155,240,0.3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: '#cbd5e1', fontWeight: 600, flex: 1, minWidth: 160 }}>✖ <b style={{ color: '#1d9bf0' }}>X chat needs the Listener.</b> Download it, open it, and log into X once — then X chat flows in here.</span>
            <a href="/x-listener.exe" download style={{ background: 'linear-gradient(135deg,#1d9bf0,#0f6fb8)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>⬇ Download &amp; Run</a>
            <a href="/x-listener.zip" download style={{ color: '#8a8aa5', fontSize: 10, textDecoration: 'underline' }}>source</a>
          </div>
        )
      )}

      {/* Combined message list — X messages (from the listener) render here just like Twitch/Kick */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0', minHeight: 0 }}>
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#55556a', fontSize: 12 }}>
            {filter === 'x'
              ? (xLivechat ? 'Waiting for X messages — make sure the X Chat Listener is running.' : 'Add an X stream (x.com/username) as a source.')
              : ((sources || []).length === 0 ? 'Add chat sources in Settings ⚙' : 'Waiting for messages…')}
          </div>
        )}
        {visible.map(msg => {
          const pc = PLAT[msg.platform]?.color || '#c8c8e0'
          const uc = msg.userColor || pc
          const mine = msg.username && ownNames.has(String(msg.username).toLowerCase().replace(/^@/, ''))
          return (
            <div key={msg.id} style={{ padding: '5px 12px', fontSize: 14, lineHeight: 1.55,
              background: mine ? 'rgba(145,71,255,0.14)' : 'transparent',
              borderLeft: mine ? '3px solid #9147ff' : '3px solid transparent' }}
              onMouseOver={e => e.currentTarget.style.background = mine ? 'rgba(145,71,255,0.2)' : 'rgba(255,255,255,0.02)'}
              onMouseOut={e => e.currentTarget.style.background = mine ? 'rgba(145,71,255,0.14)' : 'transparent'}>
              <span style={{ fontSize: 9, color: pc, fontWeight: 700, marginRight: 5, background: pc + '1e', border: `1px solid ${pc}33`, borderRadius: 4, padding: '0 5px', whiteSpace: 'nowrap' }}>{msg.platform === 'twitch' ? '🟣' : msg.platform === 'kick' ? '🟢' : '✖'} {msg.streamer}</span>
              {mine && <span style={{ fontSize: 9, color: '#fff', fontWeight: 800, marginRight: 5, background: '#9147ff', borderRadius: 4, padding: '0 5px' }}>YOU</span>}
              <span style={{ fontWeight: 700, color: uc, marginRight: 4 }}>{msg.username}</span>
              <span style={{ color: '#c0c0d8' }}>{msg.message}</span>
            </div>
          )
        })}
      </div>

      {/* Send box */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sendStatus && (
          <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, textAlign: 'center', background: sendStatus.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: sendStatus.ok ? '#22c55e' : '#f87171', border: `1px solid ${sendStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{sendStatus.text}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, color: '#55556a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posting to:</span>
          {[
            { on: twSendReady, color: '#9147ff', label: twitchAuth?.username ? `🟣 @${twitchAuth.username}` : '🟣 Twitch' },
            { on: xReady,      color: '#cbd5e1', label: xAuth?.username ? `✖ @${xAuth.username}` : '✖ X' },
            { on: kickReady,   color: '#53fc18', label: kickAuth?.username ? `🟢 @${kickAuth.username}` : '🟢 Kick' },
          ].map((p, i) => (
            <span key={i} style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: '2px 7px', color: p.on ? p.color : '#44445a', background: p.on ? p.color + '18' : 'rgba(255,255,255,0.03)', border: `1px solid ${p.on ? p.color + '40' : 'rgba(255,255,255,0.07)'}` }}>{p.on ? p.label : `${p.label} · log in`}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={sendMsg} onChange={e => setSendMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={targets.length ? `Send to ${targets.join(' + ')}…` : 'Connect Twitch, X or Kick to send…'}
            style={{ flex: 1, background: 'rgba(10,10,22,0.85)', border: `1px solid ${sendMsg.trim() && targets.length ? 'rgba(145,71,255,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 9, padding: '7px 12px', fontSize: 13, color: '#eeeef5', outline: 'none' }} />
          <button onClick={handleSend} disabled={!sendMsg.trim() || !targets.length}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: sendMsg.trim() && targets.length ? 'pointer' : 'not-allowed', background: sendMsg.trim() && targets.length ? 'linear-gradient(135deg,#9147ff,#6441a5)' : 'rgba(255,255,255,0.04)', color: sendMsg.trim() && targets.length ? '#fff' : '#55556a', border: 'none', flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  )
}
