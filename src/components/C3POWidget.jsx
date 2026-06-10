import { useState, useEffect, useRef } from 'react'

// C-3PO assistant: voice wake-word listener + manual ask + read-aloud.
// Driven by config: provider, apiKey, wakeWord, autoSpeak.
export default function C3POWidget({ provider = 'anthropic', apiKey = '', wakeWord = 'hey c3po', autoSpeak = true, onOpenSettings }) {
  const [listening,  setListening]  = useState(false)
  const [transcript, setTranscript] = useState('')
  const [answers,    setAnswers]    = useState([])
  const [micError,   setMicError]   = useState('')
  const [supported,  setSupported]  = useState(true)
  const [wakeFlash,  setWakeFlash]  = useState(false)
  const [manualQ,    setManualQ]    = useState('')

  const recognitionRef = useRef(null)
  const bufferRef = useRef('')
  const pendingRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) setSupported(false)
    return () => { try { recognitionRef.current = null } catch (_) {} }
  }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [answers])

  // ── Wake word helpers ───────────────────────────────────────────────────────
  const wake = (wakeWord || 'hey c3po').toLowerCase().trim()
  // tolerate spacing variants like "hey c 3 p o"
  const wakeVariants = [wake, wake.replace(/c3po/g, 'c3 p o'), wake.replace(/c3po/g, 'c 3 p o'), wake.replace(/\s+/g, ' ')]
  function containsWake(t) { const l = t.toLowerCase(); return wakeVariants.some(w => w && l.includes(w)) }
  function extractQuestion(t) {
    const l = t.toLowerCase()
    for (const w of wakeVariants) { const i = w ? l.indexOf(w) : -1; if (i !== -1) return t.slice(i + w.length).trim().replace(/^[,\s!?]+/, '') }
    return ''
  }

  function stopListening() { const r = recognitionRef.current; recognitionRef.current = null; try { r?.stop() } catch (_) {}; setListening(false); setTranscript('') }
  function startListening() {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    r.onstart = () => { setListening(true); setMicError('') }
    r.onerror = e => { if (e.error === 'not-allowed') setMicError('Mic access denied — allow microphone.'); else if (e.error !== 'no-speech') setMicError(`Mic error: ${e.error}`) }
    r.onend = () => { if (recognitionRef.current) { try { recognitionRef.current.start() } catch (_) {} } else setListening(false) }
    r.onresult = e => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else interim += t }
      setTranscript(interim || final)
      if (!final) return
      bufferRef.current = (bufferRef.current + ' ' + final).slice(-250)
      if (pendingRef.current !== null) { const full = (pendingRef.current + ' ' + final).trim(); if (full.length > 3) { pendingRef.current = null; ask(full) } return }
      if (containsWake(bufferRef.current)) { const q = extractQuestion(bufferRef.current); bufferRef.current = ''; if (q.length > 3) ask(q); else pendingRef.current = q }
    }
    recognitionRef.current = r
    try { r.start() } catch (e) { setMicError('Could not start mic: ' + e.message) }
  }
  function toggle() { listening ? stopListening() : startListening() }

  function speak(text) { try { window.speechSynthesis?.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.pitch = 0.9; window.speechSynthesis?.speak(u) } catch (_) {} }

  async function ask(question) {
    setWakeFlash(true); setTimeout(() => setWakeFlash(false), 800)
    const id = Math.random().toString(36).slice(2)
    setAnswers(prev => [...prev.slice(-29), { id, question, answer: null, error: null, loading: true, ts: Date.now() }])
    if (!apiKey) { setAnswers(prev => prev.map(a => a.id === id ? { ...a, loading: false, error: 'Add an AI API key in Settings → C-3PO.' } : a)); return }
    try {
      const res = await fetch('/api/c3po', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-provider': provider }, body: JSON.stringify({ question, askedBy: 'streamer', platform: 'live stream' }) })
      const txt = await res.text()
      let d = {}; try { d = JSON.parse(txt) } catch { throw new Error('Server returned non-JSON (use the deployed site).') }
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setAnswers(prev => prev.map(a => a.id === id ? { ...a, loading: false, answer: d.answer, sources: d.sources || [] } : a))
      if (autoSpeak && d.answer) speak(d.answer)
    } catch (err) { setAnswers(prev => prev.map(a => a.id === id ? { ...a, loading: false, error: err.message } : a)) }
  }

  function submitManual(e) { e.preventDefault(); const q = manualQ.trim(); if (!q) return; ask(q); setManualQ('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Control bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <button onClick={toggle} disabled={!supported} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: supported ? 'pointer' : 'not-allowed',
          background: listening ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          color: listening ? '#ef4444' : '#22c55e',
          border: `1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700,
        }}>{listening ? '⏹ Stop' : '🎙 Start'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: listening ? '#22c55e' : '#555', boxShadow: listening ? '0 0 6px #22c55e' : 'none', animation: listening ? 'pulse 1.6s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: listening ? '#22c55e' : '#8a8aa5' }}>{listening ? 'Listening' : 'Idle'}</span>
        </div>
        <span style={{ fontSize: 10, color: '#55556a' }}>wake: "{wake}"</span>
        <button onClick={onOpenSettings} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e8f5', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 700 }}>⚙</button>
      </div>

      {!supported && <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)' }}>⚠ Voice needs Chrome or Edge. Typing still works.</div>}
      {micError && <div style={{ flexShrink: 0, padding: '5px 10px', fontSize: 10.5, color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>⚠ {micError}</div>}
      {!apiKey && <button onClick={onOpenSettings} style={{ margin: '8px 10px 0', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>⚙ Add an AI API key to enable C-3PO →</button>}

      {/* Live transcript */}
      <div style={{ flexShrink: 0, margin: '8px 10px 0', padding: '8px 11px', borderRadius: 9, fontSize: 12.5, lineHeight: 1.5, minHeight: 20,
        background: wakeFlash ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${wakeFlash ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
        color: wakeFlash ? '#ffd700' : '#8a8aa5', fontStyle: transcript ? 'normal' : 'italic' }}>
        {transcript || (listening ? `Say "${wake}" then your question…` : 'Press Start, or type below')}
      </div>

      {/* Answers */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {answers.length === 0 && <div style={{ textAlign: 'center', color: '#44445a', fontSize: 12, paddingTop: 16 }}>🤖 Ask me anything — voice or text.</div>}
        {[...answers].reverse().map(a => (
          <div key={a.id} style={{ background: 'rgba(255,215,0,0.05)', border: `1px solid ${a.error ? 'rgba(239,68,68,0.3)' : 'rgba(255,215,0,0.18)'}`, borderRadius: 10, padding: '9px 12px' }}>
            <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 700, marginBottom: 5 }}>🎙 "{a.question}"</div>
            {a.loading ? <div style={{ fontSize: 12, color: '#8a8aa5' }}>Looking it up…</div>
              : a.error ? <div style={{ fontSize: 12, color: '#f87171' }}>⚠ {a.error}</div>
              : <>
                  <div style={{ fontSize: 12.5, color: '#eeeef5', lineHeight: 1.55 }}>{a.answer}</div>
                  <button onClick={() => speak(a.answer)} style={{ marginTop: 7, background: 'transparent', border: '1px solid rgba(255,215,0,0.18)', borderRadius: 6, padding: '2px 9px', fontSize: 10.5, color: 'rgba(255,215,0,0.6)', cursor: 'pointer' }}>🔊 Read aloud</button>
                </>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Manual input */}
      <form onSubmit={submitManual} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input value={manualQ} onChange={e => setManualQ(e.target.value)} placeholder="Type a question…"
          style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#eeeef5', outline: 'none' }} />
        <button type="submit" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ask</button>
      </form>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  )
}
