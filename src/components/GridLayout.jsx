import { useRef, useState, useEffect } from 'react'
import { GRID } from '../lib/dash'

// Configurable snap grid. Panels occupy whole cells, drag by their header to
// move, and drag the bottom-right handle to resize - everything snaps to the
// grid. Layout is { id: {x,y,w,h} } in cell units, persisted by the parent.
//
// During a drag we cover the screen with an overlay AND use pointer capture so
// the mouse-up is always heard even when the cursor passes over the stream/chat
// iframes (which would otherwise swallow the event and make the drag "stick").
// Faint photo shown behind the grid (centered, natural size). To change it,
// drop a new image in /public and update this path.
const BG_IMAGE = '/american-fashion-brand-has-chosen-600nw-2489609919.webp'

export default function GridLayout({ items, layout, onLayout, renderItem }) {
  const { cols: COLS, rows: ROWS } = GRID
  const ref = useRef(null)
  const [drag, setDrag] = useState(null)
  const [preview, setPreview] = useState(null)

  function start(e, id, mode) {
    e.preventDefault(); e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    const rect = ref.current.getBoundingClientRect()
    setDrag({ id, mode, startX: e.clientX, startY: e.clientY, orig: { ...layout[id] }, cellW: rect.width / COLS, cellH: rect.height / ROWS })
    setPreview({ id, ...layout[id] })
  }

  useEffect(() => {
    if (!drag) return
    function move(e) {
      const dx = Math.round((e.clientX - drag.startX) / drag.cellW)
      const dy = Math.round((e.clientY - drag.startY) / drag.cellH)
      let { x, y, w, h } = drag.orig
      if (drag.mode === 'move') {
        x = Math.max(0, Math.min(COLS - w, x + dx))
        y = Math.max(0, Math.min(ROWS - h, y + dy))
      } else {
        w = Math.max(1, Math.min(COLS - x, w + dx))
        h = Math.max(1, Math.min(ROWS - y, h + dy))
      }
      setPreview(p => (p && p.x === x && p.y === y && p.w === w && p.h === h) ? p : { id: drag.id, x, y, w, h })
    }
    function end() {
      setPreview(pv => { if (pv) onLayout({ ...layout, [drag.id]: { x: pv.x, y: pv.y, w: pv.w, h: pv.h } }); return null })
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [drag, layout, onLayout, COLS, ROWS])

  const gridStyle = {
    position: 'relative', flex: 1, minHeight: 0,
    display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)`,
    gap: 10, padding: 12,
  }

  return (
    <div ref={ref} style={gridStyle}>
      {BG_IMAGE && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `url(${BG_IMAGE})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'auto', opacity: 0.15 }} />
      )}
      {Array.from({ length: COLS * ROWS }).map((_, i) => (
        <div key={'g' + i} style={{
          gridColumn: (i % COLS) + 1, gridRow: Math.floor(i / COLS) + 1, zIndex: 1,
          border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.012)', borderRadius: 10, pointerEvents: 'none',
        }} />
      ))}

      {items.map(it => {
        const L = (preview && preview.id === it.id) ? preview : layout[it.id]
        if (!L) return null
        const active = drag && drag.id === it.id
        return (
          <div key={it.id} style={{
            gridColumn: `${L.x + 1} / span ${L.w}`, gridRow: `${L.y + 1} / span ${L.h}`,
            position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden',
            zIndex: active ? 30 : 1,
            transition: active ? 'none' : 'all .12s ease',
            boxShadow: active ? '0 0 0 2px rgba(139,127,181,0.6)' : 'none',
            borderRadius: 16,
          }}>
            {renderItem(it.id, { onPointerDown: e => start(e, it.id, 'move'), style: { cursor: active ? 'grabbing' : 'grab' } })}
            <div onPointerDown={e => start(e, it.id, 'resize')} title="Drag to resize"
              style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, cursor: 'nwse-resize', zIndex: 6,
                touchAction: 'none', background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.28) 60%, transparent 60%, transparent 72%, rgba(255,255,255,0.28) 72%, rgba(255,255,255,0.28) 82%, transparent 82%)',
                borderBottomRightRadius: 14 }} />
          </div>
        )
      })}

      {drag && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, cursor: drag.mode === 'resize' ? 'nwse-resize' : 'grabbing' }} />
      )}
    </div>
  )
}
