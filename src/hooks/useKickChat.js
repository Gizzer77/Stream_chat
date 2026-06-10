import { useEffect, useRef } from 'react'
import { dbg } from '../lib/dash'

const PUSHER_KEY = 'eb1d5f283081a78b932c'

async function fetchChatroomId(channelName, onStatus) {
  const attempts = [
    () => fetch(`/api/kick-chatroom?channel=${encodeURIComponent(channelName)}&token=${encodeURIComponent(localStorage.getItem('kick_token') || '')}`),
    () => fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(channelName)}`, { headers: { Accept: 'application/json' } }),
  ]
  let lastErr = ''
  for (const attempt of attempts) {
    try {
      const res = await attempt()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { lastErr = data.error || `status ${res.status}`; dbg('KICK lookup fail', { channel: channelName, status: res.status, error: lastErr }); continue }
      const id = data.chatroomId ?? data.chatroom?.id
      if (id) { dbg('KICK chatroom id', { channel: channelName, id }); return id }
      lastErr = 'no chatroom id in response'
    } catch (e) { lastErr = e.message }
  }
  throw new Error(lastErr || `Could not get chatroom ID for ${channelName}`)
}

function connectPusher(chatroomId, streamerName, onMessage, onClose) {
  const url = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=7.6.0&flash=false`
  const ws = new WebSocket(url)
  ws.onopen = () => {
    dbg('KICK pusher open', { chatroomId })
    ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }))
  }
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.event === 'App\\Events\\ChatMessageEvent') {
        const payload = JSON.parse(msg.data)
        onMessage({
          id: payload.id || Math.random().toString(36).slice(2),
          platform: 'kick', streamer: streamerName,
          username: payload.sender?.username || 'Unknown',
          message: payload.content, userColor: payload.sender?.identity?.color || null, ts: Date.now(),
        })
      }
    } catch (_) {}
  }
  ws.onclose = onClose
  ws.onerror = () => { dbg('KICK pusher error'); ws.close() }
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
      try {
        onStatusRef.current?.({ state: 'connecting', channel: ch.channel })
        dbg('KICK connecting', { channel: ch.channel })
        const chatroomId = await fetchChatroomId(ch.channel)
        if (!alive) return
        onStatusRef.current?.({ state: 'live', channel: ch.channel })
        const ws = connectPusher(chatroomId, ch.streamer, m => onMessageRef.current(m), () => {
          if (!alive) return
          dbg('KICK pusher closed — reconnecting', { channel: ch.channel })
          setTimeout(() => connectChannel(ch), 8000)
        })
        sockets.push(ws)
      } catch (err) {
        dbg('KICK connect failed', { channel: ch.channel, error: err.message })
        onStatusRef.current?.({ state: 'blocked', channel: ch.channel, error: err.message })
        if (alive && tries < 3) setTimeout(() => connectChannel(ch, tries + 1), 15000)
      }
    }

    channels.forEach(ch => connectChannel(ch))
    return () => { alive = false; sockets.forEach(ws => { try { ws.close() } catch (_) {} }) }
  }, [JSON.stringify(streamers)])
}
