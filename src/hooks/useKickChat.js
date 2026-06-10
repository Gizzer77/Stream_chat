import { useEffect, useRef } from 'react'
import { dbg } from '../lib/dash'

// Kick's web client Pusher config.
const PUSHER_KEY     = 'eb1d5f283081a78b932c'
const PUSHER_CLUSTER = 'us2'

async function fetchChatroomId(channelName) {
  // Browser-direct works (Cloudflare lets the real browser through); the server
  // proxy gets 403'd, so try direct FIRST and only fall back to the proxy.
  const attempts = [
    () => fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channelName)}`, { headers: { Accept: 'application/json' } }),
    () => fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(channelName)}`, { headers: { Accept: 'application/json' } }),
    () => fetch(`/api/kick-chatroom?channel=${encodeURIComponent(channelName)}&token=${encodeURIComponent(localStorage.getItem('kick_token') || '')}`),
  ]
  let lastErr = ''
  for (const attempt of attempts) {
    try {
      const res = await attempt()
      if (!res.ok) { lastErr = `status ${res.status}`; continue }
      const data = await res.json().catch(() => ({}))
      const id = data.chatroom?.id ?? data.chatroomId ?? data.data?.chatroom?.id
      if (id) { dbg('KICK chatroom id', { channel: channelName, id }); return id }
      lastErr = 'no chatroom id'
    } catch (e) { lastErr = e.message }
  }
  throw new Error(lastErr || `lookup failed for ${channelName}`)
}

function connectPusher(chatroomId, streamerName, onMessage, onClose) {
  const url = `wss://ws-${PUSHER_CLUSTER}.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`
  const ws = new WebSocket(url)
  let established = false
  ws.onmessage = (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch (_) { return }
    if (msg.event === 'pusher:connection_established') {
      established = true
      dbg('KICK pusher established — subscribing', { chatroomId })
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }))
      return
    }
    if (msg.event === 'pusher:error') {
      let info = msg.data; try { info = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data } catch (_) {}
      dbg('KICK pusher error', { code: info?.code, message: info?.message })
      return
    }
    if (msg.event === 'App\\Events\\ChatMessageEvent') {
      try {
        const payload = JSON.parse(msg.data)
        onMessage({
          id: payload.id || Math.random().toString(36).slice(2),
          platform: 'kick', streamer: streamerName,
          username: payload.sender?.username || 'Unknown',
          message: payload.content, userColor: payload.sender?.identity?.color || null, ts: Date.now(),
        })
      } catch (_) {}
    }
  }
  ws.onclose = (e) => { dbg('KICK pusher closed', { code: e.code, reason: e.reason || '(none)', established }); onClose(established) }
  ws.onerror = () => {}
  return ws
}

export function useKickChat(streamers, onMessage, onStatus) {
  const onMessageRef = useRef(onMessage); onMessageRef.current = onMessage
  const onStatusRef  = useRef(onStatus);  onStatusRef.current  = onStatus

  useEffect(() => {
    const channels = streamers.filter(s => s.kick).map(s => ({ channel: s.kick.toLowerCase(), streamer: s.name }))
    if (!channels.length) return
    const sockets = []
    let alive = true

    async function connectChannel(ch, tries = 0) {
      if (!alive) return
      try {
        onStatusRef.current?.({ state: 'connecting', channel: ch.channel })
        const chatroomId = await fetchChatroomId(ch.channel)
        if (!alive) return
        onStatusRef.current?.({ state: 'live', channel: ch.channel })
        const ws = connectPusher(chatroomId, ch.streamer, m => onMessageRef.current(m), (wasEstablished) => {
          if (!alive) return
          // If it never established, the app key/origin was rejected — back off hard
          // to avoid a reconnect storm. A real drop reconnects sooner.
          const delay = wasEstablished ? 6000 : 60000
          if (!wasEstablished) onStatusRef.current?.({ state: 'blocked', channel: ch.channel, error: 'Kick chat socket was rejected (Pusher).' })
          setTimeout(() => connectChannel(ch), delay)
        })
        sockets.push(ws)
      } catch (err) {
        dbg('KICK connect failed', { channel: ch.channel, error: err.message })
        onStatusRef.current?.({ state: 'blocked', channel: ch.channel, error: err.message })
        if (alive && tries < 3) setTimeout(() => connectChannel(ch, tries + 1), 20000)
      }
    }

    channels.forEach(ch => connectChannel(ch))
    return () => { alive = false; sockets.forEach(ws => { try { ws.close() } catch (_) {} }) }
  }, [JSON.stringify(streamers)])
}
