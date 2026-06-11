// A contained dashboard panel that fills its parent wrapper. The Dashboard
// sizes each wrapper, so panels never overlap or leave the screen.
export default function Panel({ title, icon, accent = '#9147ff', onHide, children }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg,rgba(16,16,30,0.98),rgba(9,9,18,0.98))', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18, overflow: 'hidden', boxShadow: `0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px ${accent}14`,
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${accent}cc,${accent}44 40%,transparent)`, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: `linear-gradient(135deg,${accent}10 0%,transparent 65%)`, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, flex: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{title}</span>
        {onHide && (
          <button onClick={onHide} title="Hide panel"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8e8f5', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '2px 7px', borderRadius: 6 }}
            onMouseOver={e => e.currentTarget.style.color = '#f87171'}
            onMouseOut={e => e.currentTarget.style.color = '#e8e8f5'}>✕</button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  )
}
