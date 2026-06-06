import { useEffect, useRef } from 'react'

// Connects to Twitch IRC via WebSocket (anonymous read-only — no credentials needed)
export function useTwitchChat(streamers, onMessage) {
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    const channels = streamers
      .filter(s => s.twitch)
      .map(s => ({ channel: s.twitch.toLowerCase().replace(/^#/, ''), streamer: s.name }))

    if (!channels.length) return

    let ws
    let reconnectTimer
    let alive = true

    function connect() {
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
      wsRef.current = ws

      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags')
        ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 89999))
        channels.forEach(({ channel }) => ws.send(`JOIN #${channel}`))
      }

      ws.onmessage = (e) => {
        // Twitch sends multiple IRC lines per WebSocket frame — split and handle each
        const lines = e.data.split('\r\n')
        for (const raw of lines) {
          if (!raw.trim()) continue

          // Respond to PING
          if (raw.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); continue }

          // Parse PRIVMSG
          const match = raw.match(/^(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.+)$/)
          if (!match) continue

          const [, tagStr, username, channelName, message] = match

          // Parse tags for display name and color
          const tags = {}
          if (tagStr) {
            tagStr.split(';').forEach(pair => {
              const eq = pair.indexOf('=')
              if (eq !== -1) tags[pair.slice(0, eq)] = pair.slice(eq + 1)
            })
          }

          const chanConfig = channels.find(c => c.channel === channelName.toLowerCase())

          onMessageRef.current({
            id:        Math.random().toString(36).slice(2),
            platform:  'twitch',
            streamer:  chanConfig?.streamer || channelName,
            username:  tags['display-name'] || username,
            message:   message.trim(),
            userColor: tags['color'] || null,
            ts:        Date.now(),
          })
        }
      }

      ws.onclose = () => {
        if (!alive) return
        reconnectTimer = setTimeout(connect, 5000)
      }
      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      alive = false
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [JSON.stringify(streamers)])
}
