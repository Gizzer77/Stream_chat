import { useEffect, useRef } from 'react'
import { dbg } from '../lib/dash'

// Kick's web client uses Pusher. They rotate the app key, so we try a list of
// known keys and stick with whichever Pusher actually accepts.
const PUSHER_KEYS = [
  { key: 'eb1d5f283081a78b932c', cluster: 'us2' },
  { key: '32cbd69e4b950bf97679', cluster: 'us2' },
]

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

function connectPusher(creds, chatroomId, streamerName, onMessage, onClose) {
  const url = `wss://ws-${creds.cluster}.pusher.com/app/${creds.key}?protocol=7&client=js&version=8.4.0&flash=false`
  const ws = new WebSocket(url)
  let established = false
  ws.onmessage = (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch (_) { return }
    if (msg.event === 'pusher:connection_established') {
      established = true
      dbg('KICK pusher established — subscribing', { chatroomId, key: creds.key })
      ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }))
      return
    }
    if (msg.event === 'pusher:error') {
      let info = msg.data; try { info = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data } catch (_) {}
      dbg('KICK pusher error', { code: info?.code, message: info?.message, key: creds.key })
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
  ws.onclose = (e) => { dbg('KICK pusher closed', { code: e.code, established, key: creds.key }); onClose(established) }
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

    // keyIdx cycles through PUSHER_KEYS until one is accepted; rounds counts how
    // many full cycles we've tried (for backoff once all keys keep failing).
    async function connectChannel(ch, keyIdx = 0, rounds = 0) {
      if (!alive) return
      try {
        onStatusRef.current?.({ state: 'connecting', channel: ch.channel })
        const chatroomId = await fetchChatroomId(ch.channel)
        if (!alive) return
        const creds = PUSHER_KEYS[keyIdx % PUSHER_KEYS.length]
        const ws = connectPusher(creds, chatroomId, ch.streamer, m => onMessageRef.current(m), (wasEstablished) => {
          if (!alive) return
          if (wasEstablished) {
            onStatusRef.current?.({ state: 'live', channel: ch.channel })
            setTimeout(() => connectChannel(ch, keyIdx, 0), 6000)   // real drop, same key
          } else {
            // key rejected → try the next key quickly; back off after a full cycle
            const nextIdx = keyIdx + 1
            const cycled = nextIdx % PUSHER_KEYS.length === 0
            if (cycled && rounds >= 1) onStatusRef.current?.({ state: 'blocked', channel: ch.channel, error: 'Kick chat socket rejected by Pusher (key).' })
            setTimeout(() => connectChannel(ch, nextIdx, cycled ? rounds + 1 : rounds), cycled ? 30000 : 1200)
          }
        })
        sockets.push(ws)
        onStatusRef.current?.({ state: 'live', channel: ch.channel })
      } catch (err) {
        dbg('KICK connect failed', { channel: ch.channel, error: err.message })
        onStatusRef.current?.({ state: 'blocked', channel: ch.channel, error: err.message })
        if (alive && rounds < 4) setTimeout(() => connectChannel(ch, keyIdx, rounds + 1), 20000)
      }
    }

    channels.forEach(ch => connectChannel(ch))
    return () => { alive = false; sockets.forEach(ws => { try { ws.close() } catch (_) {} }) }
  }, [JSON.stringify(streamers)])
}
