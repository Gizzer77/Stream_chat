import { useState, useEffect, useRef } from 'react'

// Calls /api/c3po, which needs the user's AI key (set in Settings → C-3PO).
export default function C3POWidget({ provider = 'anthropic', apiKey = '', onOpenSettings }) {
  const [msgs,  setMsgs]  = useState([{ role: 'assistant', text: "Hey! I'm C-3PO, your fact-checking co-pilot. Ask me anything and I'll look it up." }])
  const [input, setInput] = useState('')
  const [busy,  setBusy]  = useState(false)
  const chatRef = useRef(null)

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [msgs])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    if (!apiKey) { setMsgs(p => [...p, { role: 'user', text }, { role: 'assistant', text: '⚙ Add your AI API key in Settings → C-3PO first.' }]); setInput(''); return }
    setInput('')
    setMsgs(p => [...p, { role: 'user', text }])
    setBusy(true)
    try {
      const r = await fetch('/api/c3po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-provider': provider },
        body: JSON.stringify({ question: text, askedBy: 'You', platform: 'the dashboard' }),
      })
      const d = await r.json()
      setMsgs(p => [...p, { role: 'assistant', text: d.answer || d.error || 'No response.' }])
    } catch (e) {
      setMsgs(p => [...p, { role: 'assistant', text: `Error: ${e.message}` }])
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!apiKey && (
        <button onClick={onOpenSettings} style={{ margin: '8px 10px 0', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>⚙ Add an AI API key to enable C-3PO →</button>
      )}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.map((m, i) => {
          const isBot = m.role === 'assistant'
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '85%', padding: '9px 13px', borderRadius: isBot ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: isBot ? 'rgba(255,215,0,0.08)' : 'rgba(145,71,255,0.15)', border: `1px solid ${isBot ? 'rgba(255,215,0,0.2)' : 'rgba(145,71,255,0.3)'}`, fontSize: 12.5, color: '#ddddf5', lineHeight: 1.55 }}>{m.text}</div>
            </div>
          )
        })}
        {busy && <div style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ padding: '9px 16px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)', fontSize: 12, color: '#aaa' }}>Looking it up…</div></div>}
      </div>
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask C-3PO anything…" disabled={busy}
          style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: '#eeeef5', outline: 'none', opacity: busy ? 0.6 : 1 }} />
        <button onClick={send} disabled={busy || !input.trim()} style={{ background: busy || !input.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: busy || !input.trim() ? '#55556a' : '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, cursor: busy || !input.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>➤</button>
      </div>
    </div>
  )
}
