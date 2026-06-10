import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Shared debug logger — writes a timestamped trail to localStorage so the
// Setup page can display exactly what happened during the OAuth round-trip.
function dbg(msg, obj) {
  try {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}` + (obj !== undefined ? ' ' + JSON.stringify(obj) : '')
    const prev = localStorage.getItem('oauth_debug_log') || ''
    localStorage.setItem('oauth_debug_log', (prev + '\n' + line).slice(-8000))
    console.log('[OAuth]', msg, obj !== undefined ? obj : '')
  } catch (_) {}
}

export default function OAuthCallback() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    function returnTo(key) {
      const saved = localStorage.getItem(key)
      localStorage.removeItem(key)
      return saved || '/'
    }

    dbg('CALLBACK hit', { pathname, origin: window.location.origin, hasHash: !!window.location.hash, hasSearch: !!search })

    if (pathname === '/oauth/twitch') {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const token  = params.get('access_token')
      const error  = params.get('error_description') || params.get('error')
      dbg('TWITCH parsed', { hasToken: !!token, tokenLen: token ? token.length : 0, error })
      if (token) localStorage.setItem('twitch_pending_token', token)
      if (error) localStorage.setItem('twitch_pending_error', error)
      const dest = returnTo('twitch_oauth_return')
      dbg('TWITCH redirecting back', { dest })
      window.location.replace(dest)

    } else if (pathname === '/oauth/x') {
      // Always use redirect flow — popup/postMessage breaks because X redirects
      // twitter.com -> x.com, COOP severs window.opener, and the message never
      // reaches the parent (was causing the login loop).
      const params = new URLSearchParams(search)
      const code   = params.get('code')
      const error  = params.get('error')
      dbg('X parsed', { hasCode: !!code, codeLen: code ? code.length : 0, error })
      if (code)  localStorage.setItem('x_pending_code', code)
      if (error) localStorage.setItem('x_pending_error', error)
      const dest = returnTo('x_oauth_return')
      dbg('X redirecting back', { dest })
      window.location.replace(dest)

    } else if (pathname === '/oauth/kick') {
      const params = new URLSearchParams(search)
      const code   = params.get('code')
      const error  = params.get('error')
      dbg('KICK parsed', { hasCode: !!code, error, hasOpener: !!(window.opener && !window.opener.closed) })
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'kick_oauth', code, error }, window.location.origin)
        window.close()
      } else {
        if (code) localStorage.setItem('kick_pending_code', code)
        window.location.replace(returnTo('kick_oauth_return'))
      }
    }
  }, [pathname, search])

  const label = pathname === '/oauth/kick' ? '🟢 Kick' : pathname === '/oauth/x' ? '✖ X' : '🟣 Twitch'
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#08080f', color:'#eeeef5',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", gap:14,
    }}>
      <div style={{ fontSize:32 }}>{label.split(' ')[0]}</div>
      <div style={{ fontSize:15, fontWeight:700 }}>Connecting to {label.slice(3)}...</div>
      <div style={{ fontSize:12, color:'#44445a' }}>This window will close automatically.</div>
    </div>
  )
}
