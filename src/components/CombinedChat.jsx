import { useState, useEffect, useRef, useCallback } from 'react'
import { useTwitchChat } from '../hooks/useTwitchChat'
import { useKickChat }   from '../hooks/useKickChat'
import { useTwitchSend } from '../hooks/useTwitchSend'
import { PLAT, dbg } from '../lib/dash'

// Combined read + send across Twitch, X and Kick.
//  - Reads: Twitch IRC, Kick chat, and X mentions (polled via /api/x-mentions)
//  - Sends: Twitch IRC, X tweet, Kick chat
export default function CombinedChat({ sources, twitchAuth, xAuth, kickAuth, onOpenSettings }) {
  const [msgs,   setMsgs]   = useState([])
  const [filter, setFilter] = useState('all')
  const chatRef = useRef(null)

  const [sendMsg,    setSendMsg]    = useState('')
  const [sendStatus, setSendStatus] = useState(null)
  const [xNotice,    setXNotice]    = useState('')

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
  useKickChat(hookStreamers, add)

  // ── Read X mentions into the chat (free X tier can't, so we back off) ────────
  useEffect(() => {
    if (!xAuth?.token) return
    let alive = true, failures = 0, timer
    async function poll() {
      if (!alive) return
      try {
        const r = await fetch('/api/x-mentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: xAuth.token }) })
        const d = await r.json()
        if (!alive) return
        if (Array.isArray(d.messages)) {
          setXNotice('')
          setMsgs(prev => {
            const have = new Set(prev.filter(m => m.platform === 'x').map(m => m.id))
            const fresh = d.messages.filter(m => !have.has('x_' + m.id)).reverse()
              .map(m => ({ id: 'x_' + m.id, platform: 'x', username: m.username, message: m.text, userColor: '#cbd5e1' }))
            return fresh.length ? [...prev.slice(-399), ...fresh] : prev
          })
        } else {
          failures++
          setXNotice(d.error || 'X read unavailable')
          dbg('X mentions error', { error: d.error })
        }
      } catch (e) { failures++ }
      // Stop hammering once it's clear reading isn't allowed.
      if (alive && failures < 2) timer = setTimeout(poll, 60000)
    }
    poll()
    return () => { alive = false; clearTimeout(timer) }
  }, [xAuth?.token])

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [msgs])

  async function handleSend() {
    const text = sendMsg.trim()
    if (!text) return
    setSendMsg('')
    const ok = [], failed = []

    if (twSendReady && myTwitchCh) { twSend([myTwitchCh], text); ok.push('Twitch') }
    else if (twSendReady) { twSend(hookStreamers.filter(s => s.twitch).map(s => s.twitch), text); ok.push('Twitch') }

    if (xReady) {
      try {
        const r = await fetch('/api/x-tweet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, accessToken: xAuth.token }) })
        const d = await r.json(); if (r.ok) ok.push('X'); else failed.push(`X: ${d.error}`)
      } catch (e) { failed.push(`X: ${e.message}`) }
    }
    if (kickReady) {
      try {
        const r = await fetch('/api/kick-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, accessToken: kickAuth.token }) })
        const d = await r.json(); if (r.ok) ok.push('Kick'); else failed.push(`Kick: ${d.error}`)
      } catch (e) { failed.push(`Kick: ${e.message}`) }
    }

    dbg('CHAT send', { ok, failed })
    const anyConnected = twSendReady || xReady || kickReady
    setSendStatus(
      !anyConnected ? { ok: false, text: 'Connect Twitch, X or Kick to send' }
      : { ok: ok.length > 0, text: (ok.length ? `✓ ${ok.join(' + ')}` : '') + (failed.length ? `  ⚠ ${failed.join(' · ')}` : '') }
    )
    setTimeout(() => setSendStatus(null), 5000)
  }

  const visible = msgs.filter(m => filter === 'all' || m.platform === filter)
  const twCount = msgs.filter(m => m.platform === 'twitch').length
  const kkCount = msgs.filter(m => m.platform === 'kick').length
  const xCount  = msgs.filter(m => m.platform === 'x').length
  const targets = [twSendReady && 'Twitch', xReady && 'X', kickReady && 'Kick'].filter(Boolean)

  const tabs = [
    { key: 'all',    label: `All ${msgs.length}`, color: '#c8c8e0' },
    { key: 'twitch', label: `🟣 ${twCount}`,       color: '#9147ff' },
    { key: 'kick',   label: `🟢 ${kkCount}`,       color: '#53fc18' },
    { key: 'x',      label: `✖ ${xCount}`,         color: '#cbd5e1' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: filter === tab.key ? tab.color + '22' : 'transparent',
            color: filter === tab.key ? tab.color : '#8a8aa5',
            border: `1px solid ${filter === tab.key ? tab.color + '55' : 'transparent'}`,
          }}>{tab.label}</button>
        ))}
        <button onClick={onOpenSettings} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e8f5', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 700 }}>⚙ Sources</button>
      </div>

      {xNotice && (
        <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.18)' }}>✖ X read: {xNotice}</div>
      )}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#55556a', fontSize: 12 }}>
            {(sources || []).length === 0 && !xReady ? 'Add chat sources in Settings ⚙' : 'Waiting for messages…'}
          </div>
        )}
        {visible.map(msg => {
          const pc = PLAT[msg.platform]?.color || '#c8c8e0'
          const uc = msg.userColor || pc
          return (
            <div key={msg.id} style={{ padding: '4px 12px', fontSize: 12.5, lineHeight: 1.5 }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 8, color: pc, fontWeight: 800, textTransform: 'uppercase', marginRight: 5, background: pc + '22', borderRadius: 3, padding: '1px 4px' }}>{msg.platform[0]}</span>
              <span style={{ fontWeight: 700, color: uc, marginRight: 4 }}>{msg.username}</span>
              <span style={{ color: '#c0c0d8' }}>{msg.message}</span>
            </div>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sendStatus && (
          <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, textAlign: 'center', background: sendStatus.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: sendStatus.ok ? '#22c55e' : '#f87171', border: `1px solid ${sendStatus.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{sendStatus.text}</div>
        )}
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
