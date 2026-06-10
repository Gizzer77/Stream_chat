import { useEffect, useRef, useState } from 'react'

// Connects to Twitch IRC over websocket and sends chat messages.
export function useTwitchSend(token, username) {
  const wsRef  = useRef(null)
  const [ready, setReady] = useState(false)
  const joined = useRef(new Set())
  useEffect(() => {
    if (!token || !username) { setReady(false); return }
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(`PASS oauth:${token}`)
      ws.send(`NICK ${username.toLowerCase()}`)
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands')
      setReady(true)
    }
    ws.onmessage = e => { if (e.data.startsWith('PING')) ws.send('PONG :tmi.twitch.tv') }
    ws.onclose = ws.onerror = () => setReady(false)
    return () => { try { ws.close() } catch (_) {}; joined.current = new Set() }
  }, [token, username])
  function send(channels, message) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return false
    channels.forEach(ch => {
      const c = ch.toLowerCase()
      if (!joined.current.has(c)) { wsRef.current.send(`JOIN #${c}`); joined.current.add(c) }
      wsRef.current.send(`PRIVMSG #${c} :${message}`)
    })
    return true
  }
  return { ready, send }
}
