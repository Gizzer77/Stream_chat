import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function OAuthCallback() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    // Redirect back to where the auth was initiated, falling back to '/'
    function returnTo(key) {
      const saved = localStorage.getItem(key)
      localStorage.removeItem(key)
      return saved || '/'
    }

    if (pathname === '/oauth/twitch') {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const token  = params.get('access_token')
      const error  = params.get('error_description') || params.get('error')
      // Always use redirect flow — popup/postMessage approach has COOP/blocker issues
      if (token) localStorage.setItem('twitch_pending_token', token)
      if (error) localStorage.setItem('twitch_pending_error', error)
      window.location.replace(returnTo('twitch_oauth_return'))

    } else if (pathname === '/oauth/x') {
      const params = new URLSearchParams(search)
      const code   = params.get('code')
      const error  = params.get('error')
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'x_oauth', code, error }, window.location.origin)
        window.close()
      } else {
        if (code) localStorage.setItem('x_pending_code', code)
        if (error) localStorage.setItem('x_pending_error', error)
        window.location.replace(returnTo('x_oauth_return'))
      }

    } else if (pathname === '/oauth/kick') {
      const params = new URLSearchParams(search)
      const code   = params.get('code')
      const error  = params.get('error')
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
