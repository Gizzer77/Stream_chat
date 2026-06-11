import { useRef, useState, useEffect } from 'react'
import { GRID } from '../lib/dash'

// A 4x4 (configurable) snap grid. Panels occupy whole cells, drag by their
// header to move, and drag the bottom-right handle to resize — everything snaps
// to the grid. Layout is { id: {x,y,w,h} } in cell units and is persisted by the parent.
export default function GridLayout({ items, layout, onLayout, renderItem }) {
  const { cols: COLS, rows: ROWS } = GRID
  const ref = useRef(null)
  const [drag, setDrag] = useState(null)       // { id, mode, startX, startY, orig, cellW, cellH }
  const [preview, setPreview] = useState(null) // { id, x, y, w, h }

  function start(e, id, mode) {
    e.preventDefault(); e.stopPropagation()
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
    function up() {
      setPreview(pv => { if (pv) onLayout({ ...layout, [drag.id]: { x: pv.x, y: pv.y, w: pv.w, h: pv.h } }); return null })
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [drag, layout, onLayout, COLS, ROWS])

  const gridStyle = {
    position: 'relative', flex: 1, minHeight: 0,
    display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)`,
    gap: 12, padding: 14,
  }

  return (
    <div ref={ref} style={gridStyle}>
      {/* Faded 4x4 grid in the background — perfectly aligned with the cells */}
      {Array.from({ length: COLS * ROWS }).map((_, i) => (
        <div key={'g' + i} style={{
          gridColumn: (i % COLS) + 1, gridRow: Math.floor(i / COLS) + 1,
          border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 12, pointerEvents: 'none',
        }} />
      ))}

      {items.map(it => {
        const L = (preview && preview.id === it.id) ? preview : layout[it.id]
        if (!L) return null
        const active = drag && drag.id === it.id
        return (
          <div key={it.id} style={{
            gridColumn: `${L.x + 1} / span ${L.w}`, gridRow: `${L.y + 1} / span ${L.h}`,
            position: 'relative', minWidth: 0, minHeight: 0,
            zIndex: active ? 20 : 1,
            transition: active ? 'none' : 'all .12s ease',
            opacity: active ? 0.92 : 1,
          }}>
            {renderItem(it.id, { onPointerDown: e => start(e, it.id, 'move'), style: { cursor: 'grab' } })}
            {/* Resize handle */}
            <div onPointerDown={e => start(e, it.id, 'resize')} title="Drag to resize"
              style={{ position: 'absolute', right: 3, bottom: 3, width: 18, height: 18, cursor: 'nwse-resize',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', color: 'rgba(255,255,255,0.28)',
                fontSize: 12, lineHeight: 1, zIndex: 5, userSelect: 'none' }}>◢</div>
          </div>
        )
      })}
    </div>
  )
}
