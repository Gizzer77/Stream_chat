import { useEffect, useRef } from 'react'

const PUSHER_KEY = 'eb1d5f283081a78b932c'

async function fetchChatroomId(channelName) {
  // Try the Vercel serverless proxy first (deployed), then fall back to direct (local dev)
  const attempts = [
    () => fetch(`/api/kick-chatroom?channel=${encodeURIComponent(channelName)}`),
    () => fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(channelName)}`, {
      headers: { 'Accept': 'application/json' }
    }),
  ]

  for (const attempt of attempts) {
    try {
      const res = await attempt()
      if (!res.ok) continue
      const data = await res.json()
      // Proxy returns { chatroomId }, direct API returns full channel object
      const id = data.chatroomId ?? data.chatroom?.id
      if (id) return id
    } catch (_) {}
  }

  throw new Error(`Could not get chatroom ID for ${channelName}`)
}

function connectPusher(chatroomId, streamerName, onMessage, onClose) {
  const url = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=7.6.0&flash=false`
  const ws = new WebSocket(url)

  ws.onopen = () => {
    ws.send(JSON.stringify({
      event: 'pusher:subscribe',
      data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
    }))
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.event === 'App\\Events\\ChatMessageEvent') {
        const payload = JSON.parse(msg.data)
        onMessage({
          id:        payload.id || Math.random().toString(36).slice(2),
          platform:  'kick',
          streamer:  streamerName,
          username:  payload.sender?.username || 'Unknown',
          message:   payload.content,
          userColor: null,
          ts:        Date.now(),
        })
      }
    } catch (_) {}
  }

  ws.onclose = onClose
  ws.onerror = () => ws.close()
  return ws
}

export function useKickChat(streamers, onMessage) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    const channels = streamers
      .filter(s => s.kick)
      .map(s => ({ channel: s.kick.toLowerCase(), streamer: s.name }))

    if (!channels.length) return

    const sockets = []
    let alive = true

    async function connectChannel(ch) {
      try {
        const chatroomId = await fetchChatroomId(ch.channel)
        if (!alive) return
        const ws = connectPusher(chatroomId, ch.streamer, (msg) => onMessageRef.current(msg), () => {
          if (!alive) return
          setTimeout(() => connectChannel(ch), 8000)
        })
        sockets.push(ws)
      } catch (err) {
        console.warn(`[Kick] ${ch.channel}:`, err.message)
        if (alive) setTimeout(() => connectChannel(ch), 15000)
      }
    }

    channels.forEach(ch => connectChannel(ch))

    return () => {
      alive = false
      sockets.forEach(ws => ws.close())
    }
  }, [JSON.stringify(streamers)])
}
