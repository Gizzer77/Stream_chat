// A contained dashboard panel. No dragging — the grid keeps panels from
// overlapping or leaving the screen. Content scrolls inside.
export default function Panel({ title, icon, accent = '#9147ff', onHide, flexBasis = '1 1 360px', height = 360, children }) {
  return (
    <div style={{
      flex: flexBasis, minWidth: 0, height, display: 'flex', flexDirection: 'column',
      background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, overflow: 'hidden', boxShadow: `0 6px 30px rgba(0,0,0,0.5), 0 0 0 1px ${accent}18`,
    }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,${accent},${accent}55,transparent)`, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: `linear-gradient(135deg,${accent}12 0%,transparent 70%)`, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, flex: 1, letterSpacing: '0.03em' }}>{title}</span>
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
