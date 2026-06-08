import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Setup from './pages/Setup.jsx'
import Room  from './pages/Room.jsx'
import C3PO  from './pages/C3PO.jsx'

function TopBanner() {
  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(90deg, #0a0a0f 0%, #1a0a2e 30%, #2a0a1a 50%, #1a0a2e 70%, #0a0a0f 100%)',
      borderBottom: '1px solid rgba(145,71,255,0.3)',
      padding: '7px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(145,71,255,0.15) 0%, transparent 70%)',
      }} />

      {/* Left decoration */}
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        {['#9147ff','#c084fc','#e879f9'].map((c,i) => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:c, opacity:0.8 }} />
        ))}
      </div>

      {/* Banner text */}
      <span style={{
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: '0.35em',
        textTransform: 'uppercase',
        background: 'linear-gradient(90deg, #c084fc, #ffffff, #e879f9)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        userSelect: 'none',
      }}>
        Market Bubble
      </span>

      {/* Right decoration */}
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        {['#e879f9','#c084fc','#9147ff'].map((c,i) => (
          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:c, opacity:0.8 }} />
        ))}
      </div>
    </div>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const hideBanner = pathname === '/c3po'
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {!hideBanner && <TopBanner />}
      <div style={{ flex:1, overflow:'hidden' }}>
        <Routes>
          <Route path="/"      element={<Setup />} />
          <Route path="/room"  element={<Room />} />
          <Route path="/c3po"  element={<C3PO />} />
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <AppShell />
      <Analytics />
    </>
  )
}
