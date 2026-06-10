import { useState, useEffect, useRef, useCallback } from 'react'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { useKickChat }   from '../hooks/useKickChat'
import { useTwitchSend } from '../hooks/useTwitchSend'
import { PLAT, dbg } from '../lib/dash'

// Combined chat. Reads Twitch IRC + Kick (Pusher). For X, the "X" filter tab
// shows the pop-out live-chat iframe directly; the browser extension scrapes
// that same iframe and feeds its messages into the "All" feed.
export default function CombinedChat({ sources, twitchAuth, xAuth, kickAuth, onOpenSettings }) {
  const [msgs,   setMsgs]   = useState([])
  const [filter, setFilter] = useState('all')
  const chatRef = useRef(null)

  const [sendMsg,    setSendMsg]    = useState('')
  const [sendStatus, setSendStatus] = useState(null)
  const [kickStatus, setKickStatus] = useState(null)
  const [listenerUp, setListenerUp] = useState(false)

  const myTwitchCh = localStorage.getItem('twitch_username') || ''
  const { ready: twSendReady, send: twSend } = useTwitchSend(twitchAuth?.token, twitchAuth?.username)
  const xReady    = !!xAuth?.token
  const kickReady = !!kickAuth?.token

  const hookStreamers = (sources || []).map(s => ({
    name: s.label || s.channel,
    twitch: s.platform === 'twitch' ? s.channel : '',
    kick:   s.platform === 'kick'   ? s.channel : '',
  }))
  const add = useCallback(msg => setMsgs(p => [...p.slice(-399), msg]), [])
  useTwitchChat(hookStreamers, add)
  useKickChat(hookStreamers, add, setKickStatus)

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

  useEffect(() => { if (chatRef.current && filter !== 'x') chatRef.current.scrollTop = chatRef.current.scrollHeight }, [msgs, filter])

  async function handleSend() {
    const text = sendMsg.trim()
    if (!text) return
    setSendMsg('')
    const ok = [], failed = []
    if (twSendReady && myTwitchCh) { twSend([myTwitchCh], text); ok.push('Twitch') }
    else if (twSendReady) { twSend(hookStreamers.filter(s => s.twitch).map(s => s.twitch), text); ok.push('Twitch') }
    if (xReady) {
      try { const r = await fetch('/api/x-tweet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, accessToken: xAuth.token }) }); const d = await r.json(); if (r.ok) ok.push('X'); else failed.push(`X: ${d.error}`) } catch (e) { failed.push(`X: ${e.message}`) }
    }
    if (kickReady) {
      try { const r = await fetch('/api/kick-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, accessToken: kickAuth.token }) }); const d = await r.json(); if (r.ok) ok.push('Kick'); else failed.push(`Kick: ${d.error}`) } catch (e) { failed.push(`Kick: ${e.message}`) }
    }
    dbg('CHAT send', { ok, failed })
    const anyConnected = twSendReady || xReady || kickReady
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
  const targets = [twSendReady && 'Twitch', xReady && 'X', kickReady && 'Kick'].filter(Boolean)

  const isDesktop = typeof window !== 'undefined' && !!window.desktop
  // Desktop: open/scrape the X chat in its own native window (reads it directly)
  useEffect(() => { if (window.desktop?.setXChatUrl) window.desktop.setXChatUrl(xLivechat?.url || '') }, [xLivechat?.url])
  // Standalone listener: tell it which channel to watch (best-effort)
  useEffect(() => { const u = xLivechat?.channel; if (u) fetch(`http://localhost:5124/set?channel=${encodeURIComponent(u)}`).catch(() => {}) }, [xLivechat?.channel])

  const showIframe = filter === 'x' && !!xLivechat && !isDesktop   // X tab = pop-out iframe (web only)

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
        {xLivechat && <button onClick={() => window.open(xLivechat.url, 'xchat', 'width=420,height=640')} title="Pop out X chat in its own window" style={{ background: 'rgba(29,155,240,0.16)', border: '1px solid rgba(29,155,240,0.4)', borderRadius: 6, color: '#1d9bf0', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 700 }}>✖ ↗</button>}
        <button onClick={onOpenSettings} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e8f5', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 700 }}>⚙</button>
      </div>

      {kickNotice && (
        <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: kickStatus?.state === 'blocked' ? '#f87171' : '#8a8aa5', background: 'rgba(83,252,24,0.06)', borderBottom: '1px solid rgba(83,252,24,0.14)' }}>🟢 {kickNotice}</div>
      )}
      {xLivechat && !isDesktop && (
        listenerUp ? (
          <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#22c55e', background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.16)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />✖ X Chat Listener connected — X messages are merging into All
          </div>
        ) : (
          <div style={{ flexShrink: 0, padding: '6px 10px', fontSize: 10.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.18)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>✖ To pull X chat into the combined feed, download &amp; run the <b>X Chat Listener</b> app.</span>
            <a href="/x-listener.zip" download style={{ background: 'rgba(29,155,240,0.18)', border: '1px solid rgba(29,155,240,0.4)', color: '#1d9bf0', borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>⬇ Download listener</a>
          </div>
        )
      )}

      {/* Body: message list + the always-mounted X iframe (visible only on the X tab) */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={chatRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '4px 0', display: showIframe ? 'none' : 'block' }}>
          {visible.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#55556a', fontSize: 12 }}>
              {(sources || []).length === 0 ? 'Add chat sources in Settings ⚙' : 'Waiting for messages…'}
            </div>
          )}
          {visible.map(msg => {
            const pc = PLAT[msg.platform]?.color || '#c8c8e0'
            const uc = msg.userColor || pc
            return (
              <div key={msg.id} style={{ padding: '4px 12px', fontSize: 12.5, lineHeight: 1.5 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 9, color: pc, fontWeight: 700, marginRight: 5, background: pc + '1e', border: `1px solid ${pc}33`, borderRadius: 4, padding: '0 5px', whiteSpace: 'nowrap' }}>{msg.platform === 'twitch' ? '🟣' : msg.platform === 'kick' ? '🟢' : '✖'} {msg.streamer}</span>
                <span style={{ fontWeight: 700, color: uc, marginRight: 4 }}>{msg.username}</span>
                <span style={{ color: '#c0c0d8' }}>{msg.message}</span>
              </div>
            )
          })}
        </div>

        {/* Kept mounted so the extension can always scrape it; only shown on the X tab. */}
        {xLivechat && (
          <iframe src={xLivechat.url} title="X live chat"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#000', visibility: showIframe ? 'visible' : 'hidden' }} />
        )}
        {filter === 'x' && !xLivechat && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#55556a', fontSize: 12, padding: 20 }}>
            Add an X stream (x.com/username) as a source to embed its live chat.
          </div>
        )}
        {filter === 'x' && xLivechat && isDesktop && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#8a8aa5', fontSize: 12, padding: 20, gap: 12 }}>
            <div>X live chat is open in its own window — log in there once.<br/>Its messages flow into <b>All</b> automatically.</div>
            <button onClick={() => window.desktop?.showXWindow?.()} style={{ background: 'rgba(29,155,240,0.16)', border: '1px solid rgba(29,155,240,0.4)', borderRadius: 8, color: '#1d9bf0', fontSize: 12, fontWeight: 700, padding: '7px 14px', cursor: 'pointer' }}>Show X chat window</button>
          </div>
        )}
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
