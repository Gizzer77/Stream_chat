import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const WAKE_ALTS   = ['hey c3po', 'hey c3 p o', 'hey c 3 p o', 'hey three p o', 'a c3po', 'hey c3 po']
const MAX_ANSWERS = 50

// ── Helpers ───────────────────────────────────────────────────────────────────

function containsWake(text) {
  const l = text.toLowerCase()
  return WAKE_ALTS.some(w => l.includes(w))
}

function extractQuestion(text) {
  const l = text.toLowerCase()
  for (const w of WAKE_ALTS) {
    const i = l.indexOf(w)
    if (i !== -1) return text.slice(i + w.length).trim().replace(/^[,\s!?]+/, '')
  }
  return ''
}

// ── Tutorial Modal ────────────────────────────────────────────────────────────

function TutorialModal({ onClose }) {
  const steps = [
    { icon:'⚙️', title:'Set your API key', body:'Tap the ⚙ settings button and pick an AI provider. Paste your API key — it stays in your browser, never sent anywhere else. OpenRouter has a free tier if you don\'t have a key yet.' },
    { icon:'🎙', title:'Say the wake word', body:'Press Start, then say "Hey C3PO" followed by your question out loud — like "Hey C3PO, what\'s the capital of France?" C3PO will hear it through your mic and look it up.' },
    { icon:'⌨️', title:'Or type a question', body:'You can also type any question in the box at the bottom and hit Ask. Works the same way, no mic needed.' },
    { icon:'🌐', title:'Universal vs Separate mode', body:'In Universal mode, both people in the room share one C3PO feed — when one person asks a question, both screens show the answer. In Separate mode, each person has their own private C3PO.' },
    { icon:'🔊', title:'Auto read-aloud', body:'Enable Auto Read-Aloud in settings and C3PO will speak the answer back to you using your browser\'s text-to-speech. Great for keeping eyes on stream.' },
  ]
  return (
    <div className="fade-in" style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(5px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pop-in" style={{
        background:'#16161f', border:'1px solid rgba(255,215,0,0.2)',
        borderRadius:20, padding:28, width:480, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.7)',
        maxHeight:'90vh', display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>🤖</span>
            <div>
              <div style={{ fontWeight:900, fontSize:17, color:'var(--gold)' }}>How to use C3PO</div>
              <div style={{ fontSize:11, color:'#44445a' }}>Your live stream AI assistant</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8,
            color:'#8888aa', fontSize:18, cursor:'pointer', padding:'2px 8px',
          }}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingRight:4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display:'flex', gap:14, padding:'14px 16px', borderRadius:12,
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{
                width:38, height:38, borderRadius:10, flexShrink:0,
                background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#f0f0f5', marginBottom:5 }}>{s.title}</div>
                <div style={{ fontSize:13, color:'#8888aa', lineHeight:1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          marginTop:20, width:'100%', background:'linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.08))',
          color:'var(--gold)', border:'1px solid rgba(255,215,0,0.3)',
          borderRadius:10, padding:'11px', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0,
        }}>Got it — let's go! ⚡</button>
      </div>
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ apiKey, setApiKey, provider, setProvider, c3poMode, setC3poMode, autoSpeak, setAutoSpeak, onClose }) {
  const [draftKey,      setDraftKey]      = useState(apiKey)
  const [draftProvider, setDraftProvider] = useState(provider)
  const [draftMode,     setDraftMode]     = useState(c3poMode)

  const providerMeta = {
    anthropic: {
      label: 'Claude (Anthropic)',
      color: '#c084fc',
      placeholder: 'sk-ant-...',
      hint: 'console.anthropic.com → API Keys',
      hintUrl: 'https://console.anthropic.com',
    },
    gemini: {
      label: 'Gemini (Google)',
      color: '#4ade80',
      placeholder: 'AIza...',
      hint: 'aistudio.google.com → Get API key',
      hintUrl: 'https://aistudio.google.com',
    },
    qwen: {
      label: 'Qwen (Alibaba)',
      color: '#60a5fa',
      placeholder: 'sk-...',
      hint: 'dashscope.aliyuncs.com → API Keys',
      hintUrl: 'https://dashscope.aliyuncs.com',
    },
    deepseek: {
      label: 'DeepSeek',
      color: '#f97316',
      placeholder: 'sk-...',
      hint: 'platform.deepseek.com → API Keys',
      hintUrl: 'https://platform.deepseek.com',
    },
    openrouter: {
      label: 'OpenRouter (Free)',
      color: '#34d399',
      placeholder: 'sk-or-v1-...',
      hint: 'openrouter.ai/keys — free models, no cost',
      hintUrl: 'https://openrouter.ai/keys',
    },
  }
  const meta = providerMeta[draftProvider]

  function save() {
    setApiKey(draftKey)
    setProvider(draftProvider)
    setC3poMode(draftMode)
    localStorage.setItem('c3po_api_key',  draftKey)
    localStorage.setItem('c3po_provider', draftProvider)
    localStorage.setItem('c3po_mode',     draftMode)
    onClose()
  }

  return (
    <div className="fade-in" style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pop-in" style={{
        background:'#16161f', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:20, padding:28, width:460, maxWidth:'100%',
        boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⚙️</span>
            <span style={{ fontWeight:800, fontSize:17, color:'#f0f0f5' }}>C3PO Settings</span>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8,
            color:'#8888aa', fontSize:18, cursor:'pointer', padding:'2px 8px', lineHeight:1,
          }}>✕</button>
        </div>

        {/* Provider selector — scrollable list */}
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>AI Provider</label>
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto', paddingRight:4 }}>
            {Object.entries(providerMeta).map(([key, m]) => {
              const icons = { anthropic:'🟣', gemini:'🟢', qwen:'🔵', deepseek:'🟠', openrouter:'✳️' }
              const selected = draftProvider === key
              return (
                <button key={key} onClick={() => { setDraftProvider(key); setDraftKey('') }} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', borderRadius:10, cursor:'pointer', textAlign:'left',
                  background: selected ? `${m.color}14` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selected ? m.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  transition:'all .15s', flexShrink:0,
                }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{icons[key]}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color: selected ? m.color : '#c0c0d0' }}>{m.label}</div>
                    <div style={{ fontSize:11, color:'#44445a', marginTop:1 }}>{m.hint}</div>
                  </div>
                  {selected && <span style={{ color: m.color, fontSize:16, flexShrink:0 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>{meta.label} API Key</label>
          <input
            type="password"
            value={draftKey}
            onChange={e => setDraftKey(e.target.value)}
            placeholder={meta.placeholder}
            style={inputStyle}
          />
          <div style={{ fontSize:11, color:'#44445a', marginTop:5, lineHeight:1.5 }}>
            Get yours at{' '}
            <a href={meta.hintUrl} target="_blank" rel="noreferrer"
              style={{ color: meta.color, textDecoration:'underline' }}>
              {meta.hint}
            </a>. Stored only in your browser.
          </div>
        </div>

        {/* Wake word (read-only display) */}
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>Wake Word</label>
          <div style={{
            background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, padding:'9px 12px', fontSize:14,
            fontFamily:'monospace', color:'var(--gold)', letterSpacing:'0.05em',
          }}>
            "hey c3po"
          </div>
          <div style={{ fontSize:11, color:'#44445a', marginTop:5 }}>
            Say this followed by your question, or type it manually below.
          </div>
        </div>

        {/* C3PO Mode */}
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>C3PO Mode</label>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { key:'universal', icon:'🌐', title:'Universal', desc:'Both people share one C3PO feed — answers sync across the room' },
              { key:'separate',  icon:'🔒', title:'Separate',  desc:'Each person has their own private C3PO — answers stay local' },
            ].map(({ key, icon, title, desc }) => (
              <button key={key} onClick={() => setDraftMode(key)} style={{
                flex:1, padding:'10px 12px', borderRadius:10, cursor:'pointer',
                textAlign:'left', transition:'all .15s',
                background: draftMode === key ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${draftMode === key ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <div style={{ fontSize:16, marginBottom:3 }}>{icon}</div>
                <div style={{ fontSize:13, fontWeight:700, color: draftMode === key ? 'var(--gold)' : '#f0f0f5', marginBottom:3 }}>{title}</div>
                <div style={{ fontSize:11, color:'#44445a', lineHeight:1.4 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-speak toggle */}
        <div style={{ marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#f0f0f5', marginBottom:2 }}>Auto Read-Aloud</div>
            <div style={{ fontSize:11, color:'#44445a' }}>C3PO reads answers back using text-to-speech</div>
          </div>
          <button
            onClick={() => setAutoSpeak(v => !v)}
            style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background: autoSpeak ? '#9147ff' : '#2a2a3a',
              position:'relative', transition:'background .2s',
              flexShrink:0,
            }}
          >
            <div style={{
              position:'absolute', top:3, left: autoSpeak ? 23 : 3,
              width:18, height:18, borderRadius:'50%', background:'#fff',
              transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.4)',
            }} />
          </button>
        </div>

        {/* Save */}
        <button onClick={save} style={{
          width:'100%', background:'linear-gradient(135deg,#9147ff,#6441a5)',
          color:'#fff', border:'none', borderRadius:10, padding:'11px',
          fontSize:14, fontWeight:700, cursor:'pointer',
          boxShadow:'0 4px 18px rgba(145,71,255,0.35)',
        }}>
          Save Settings
        </button>
      </div>
    </div>
  )
}

// ── Answer card ───────────────────────────────────────────────────────────────

function AnswerCard({ item, onSpeak }) {
  return (
    <div className="fade-up" style={{
      background: item.loading ? 'rgba(255,215,0,0.03)' : 'rgba(255,215,0,0.06)',
      border:`1px solid ${item.error ? 'rgba(239,68,68,0.3)' : 'rgba(255,215,0,0.2)'}`,
      borderRadius:12, padding:'14px 16px', marginBottom:12,
    }}>
      {/* Question */}
      <div style={{ fontSize:13, color:'var(--gold)', fontWeight:700, marginBottom:8, lineHeight:1.4 }}>
        🎙 "{item.question}"
      </div>

      {item.loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#8888aa', fontSize:13 }}>
          <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>⟳</span>
          Searching the web…
        </div>
      ) : item.error ? (
        <div style={{ fontSize:13, color:'#f87171', lineHeight:1.5 }}>⚠ {item.error}</div>
      ) : (
        <>
          <div style={{ fontSize:14, color:'#eeeef5', lineHeight:1.65 }}>{item.answer}</div>
          {item.sources?.length > 0 && (
            <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
              {item.sources.map((s,i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{
                  fontSize:11, color:'rgba(255,215,0,0.55)', textDecoration:'underline', wordBreak:'break-all',
                }}>{s.title || s.url}</a>
              ))}
            </div>
          )}
          <button onClick={() => onSpeak(item.answer)} style={{
            marginTop:10, background:'transparent', border:'1px solid rgba(255,215,0,0.18)',
            borderRadius:6, padding:'3px 10px', fontSize:11, color:'rgba(255,215,0,0.5)',
            cursor:'pointer',
          }}>🔊 Read aloud</button>
        </>
      )}

      <div style={{ fontSize:10, color:'#333350', marginTop:8 }}>
        {new Date(item.ts).toLocaleTimeString()}
      </div>
    </div>
  )
}

// ── Listening animation ───────────────────────────────────────────────────────

function MicOrb({ active, flash }) {
  return (
    <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
      {/* ripple rings */}
      {active && [1,2,3].map(i => (
        <div key={i} style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border:`2px solid ${flash ? 'var(--gold)' : '#9147ff'}44`,
          animation:`ripple ${1 + i*0.4}s ease-out infinite`,
          animationDelay:`${i*0.3}s`,
        }} />
      ))}
      {/* core */}
      <div style={{
        position:'absolute', inset:10, borderRadius:'50%',
        background: flash
          ? 'radial-gradient(circle, #ffd700 0%, #b8860b 100%)'
          : active
            ? 'radial-gradient(circle, #9147ff 0%, #6441a5 100%)'
            : 'radial-gradient(circle, #2a2a3a 0%, #1a1a28 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:22, transition:'background .3s',
        boxShadow: active ? `0 0 20px ${flash ? '#ffd70055' : '#9147ff55'}` : 'none',
      }}>
        {flash ? '⚡' : active ? '🎙' : '🎙'}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function C3PO() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const roomCode     = searchParams.get('room') || null

  const [listening,     setListening]     = useState(false)
  const [transcript,    setTranscript]    = useState('')
  const [answers,       setAnswers]       = useState([])
  const [apiKey,        setApiKey]        = useState('')
  const [provider,      setProvider]      = useState(() => localStorage.getItem('c3po_provider') || 'anthropic')
  const [c3poMode,      setC3poMode]      = useState(() => localStorage.getItem('c3po_mode') || 'universal')
  const [autoSpeak,     setAutoSpeak]     = useState(true)
  const [showSettings,  setShowSettings]  = useState(() => !localStorage.getItem('c3po_api_key'))
  const [showTutorial,  setShowTutorial]  = useState(false)
  const [manualQ,       setManualQ]       = useState('')
  const [supported,     setSupported]     = useState(true)
  const [micError,      setMicError]      = useState('')
  const [wakeFlash,     setWakeFlash]     = useState(false)

  const recognitionRef  = useRef(null)
  const bufferRef       = useRef('')
  const pendingRef      = useRef(null)
  const bottomRef       = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('c3po_api_key')
    if (saved) setApiKey(saved)
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window))
      setSupported(false)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [answers])

  // ── Poll shared room answers ───────────────────────────────────────────────
  const seenIds = useRef(new Set())

  useEffect(() => {
    if (!roomCode || c3poMode !== 'universal') return
    async function poll() {
      try {
        const res  = await fetch(`/api/presence?room=${encodeURIComponent(roomCode)}`)
        if (!res.ok) return
        const data = await res.json()
        const incoming = (data.answers || []).filter(a => !seenIds.current.has(a.id))
        if (!incoming.length) return
        incoming.forEach(a => seenIds.current.add(a.id))
        setAnswers(prev => {
          const all = [...prev, ...incoming].sort((a, b) => a.ts - b.ts)
          return all.slice(-MAX_ANSWERS)
        })
        if (autoSpeak && incoming.length) speakText(incoming[incoming.length - 1].answer)
      } catch (_) {}
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [roomCode, c3poMode])

  // ── Speech recognition ────────────────────────────────────────────────────

  function stopListening() {
    const r = recognitionRef.current
    recognitionRef.current = null
    r?.stop()
    setListening(false)
    setTranscript('')
  }

  function startListening() {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r  = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'

    r.onstart = () => { setListening(true); setMicError('') }
    r.onerror = e => {
      if (e.error === 'not-allowed') setMicError('Microphone access denied — please allow mic access.')
      else if (e.error !== 'no-speech') setMicError(`Mic error: ${e.error}`)
    }
    r.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start() } catch (_) {}
      } else { setListening(false) }
    }
    r.onresult = e => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setTranscript(interim || final)
      if (!final) return

      bufferRef.current = (bufferRef.current + ' ' + final).slice(-250)

      if (pendingRef.current !== null) {
        const full = (pendingRef.current + ' ' + final).trim()
        if (full.length > 3) { pendingRef.current = null; triggerC3PO(full) }
        return
      }

      if (containsWake(bufferRef.current)) {
        const q = extractQuestion(bufferRef.current)
        bufferRef.current = ''
        if (q.length > 3) triggerC3PO(q)
        else pendingRef.current = q
      }
    }

    recognitionRef.current = r
    try { r.start() } catch (e) { setMicError('Could not start mic: ' + e.message) }
  }

  function toggleListening() {
    if (listening) stopListening()
    else startListening()
  }

  // ── C3PO call ─────────────────────────────────────────────────────────────

  function triggerC3PO(question) {
    setWakeFlash(true)
    setTimeout(() => setWakeFlash(false), 900)
    setTranscript(`⚡ "${question}"`)

    const id   = Math.random().toString(36).slice(2)
    const item = { id, question, answer:null, sources:[], loading:true, error:null, ts:Date.now() }
    setAnswers(prev => [...prev.slice(-MAX_ANSWERS + 1), item])

    fetchAnswer(id, question)
  }

  async function fetchAnswer(id, question) {
    const key = apiKey || localStorage.getItem('c3po_api_key') || ''
    if (!key) {
      setAnswers(prev => prev.map(a => a.id === id
        ? { ...a, loading:false, error:'No API key — open ⚙ Settings to add one.' }
        : a))
      return
    }
    try {
      const res  = await fetch('/api/c3po', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'x-provider':provider },
        body: JSON.stringify({ question, askedBy:'streamer (voice)', platform:'live stream' }),
      })
      const text = await res.text()
      if (!text) throw new Error('Empty response from server — if running locally, use `vercel dev` instead of `npm run dev`.')
      let data
      try { data = JSON.parse(text) } catch { throw new Error('Server returned non-JSON — if running locally, use `vercel dev` to enable API functions.') }
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      setAnswers(prev => prev.map(a => a.id === id
        ? { ...a, loading:false, answer:data.answer, sources:data.sources||[] }
        : a))

      if (autoSpeak && data.answer) speakText(data.answer)

      // Broadcast answer to room so the other party sees it too
      if (roomCode && data.answer && c3poMode === 'universal') {
        const myName = localStorage.getItem('mb_name') || 'Streamer'
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode, userId: 'c3po', name: 'C3PO', action: 'answer', question, answer: data.answer, sources: data.sources || [], askedBy: myName }),
        }).catch(() => {})
      }
    } catch (err) {
      setAnswers(prev => prev.map(a => a.id === id
        ? { ...a, loading:false, error:err.message }
        : a))
    }
  }

  function speakText(text) {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05; u.pitch = 0.9
    window.speechSynthesis?.speak(u)
  }

  function handleManual(e) {
    e.preventDefault()
    if (!manualQ.trim()) return
    triggerC3PO(manualQ.trim())
    setManualQ('')
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display:'flex', flexDirection:'column', height:'100vh',
      background:'#08080f', color:'#eeeef5',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", overflow:'hidden',
    }}>

      {/* Tutorial modal */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey} setApiKey={setApiKey}
          provider={provider} setProvider={setProvider}
          c3poMode={c3poMode} setC3poMode={setC3poMode}
          autoSpeak={autoSpeak} setAutoSpeak={setAutoSpeak}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 18px', background:'#111118',
        borderBottom:'1px solid rgba(255,255,255,0.07)',
        flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <MicOrb active={listening} flash={wakeFlash} />
          <div>
            <div style={{ fontWeight:900, fontSize:20, color:'var(--gold)', letterSpacing:'0.05em' }}>C3PO</div>
            <div style={{ fontSize:11, color:'#44445a' }}>Live Stream AI Assistant</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Mic status pill */}
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'5px 12px', borderRadius:20,
            background: listening ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border:`1px solid ${listening ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background: listening ? '#22c55e' : '#ef4444',
              boxShadow: listening ? '0 0 6px #22c55e' : 'none',
              animation: listening ? 'pulse 1.6s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize:12, fontWeight:600, color: listening ? '#22c55e' : '#ef4444' }}>
              {listening ? 'Listening' : 'Stopped'}
            </span>
          </div>

          <button onClick={toggleListening} style={{
            background: listening ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
            color:      listening ? '#ef4444' : '#22c55e',
            border:`1px solid ${listening ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer',
          }}>
            {listening ? '⏹ Stop' : '🎙 Start'}
          </button>

          <button onClick={() => setShowTutorial(true)} style={{ ...hBtn, color:'var(--gold)', border:'1px solid rgba(255,215,0,0.25)' }} title="How to use C3PO">?</button>
          <button onClick={() => setShowSettings(true)} style={hBtn} title="Settings">⚙</button>
          <button onClick={() => navigate('/')} style={hBtn} title="Back to setup">←</button>
        </div>
      </header>

      {/* ── Browser warning ── */}
      {!supported && (
        <div style={{
          margin:'12px 18px 0', padding:'10px 14px', borderRadius:10,
          background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
          fontSize:13, color:'#f87171',
        }}>
          ⚠ Web Speech API requires <strong>Chrome or Edge</strong>.
        </div>
      )}

      {/* ── Mic error ── */}
      {micError && (
        <div style={{
          margin:'8px 18px 0', padding:'8px 14px', borderRadius:8,
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
          fontSize:13, color:'#f87171',
        }}>⚠ {micError}</div>
      )}

      {/* ── Live transcript ── */}
      <div style={{
        margin:'12px 18px 0', padding:'12px 14px', borderRadius:10,
        background: wakeFlash ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
        border:`1px solid ${wakeFlash ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.07)'}`,
        fontSize:14, minHeight:44, lineHeight:1.5,
        color: wakeFlash ? 'var(--gold)' : '#8888aa',
        fontStyle: transcript ? 'normal' : 'italic',
        transition:'all .25s',
        flexShrink:0,
      }}>
        {transcript || (listening ? 'Listening… say "hey c3po" followed by your question' : 'Press Start to begin listening')}
      </div>

      {/* ── Manual input ── */}
      <form onSubmit={handleManual} style={{ display:'flex', gap:8, padding:'10px 18px 12px', flexShrink:0 }}>
        <input
          value={manualQ}
          onChange={e => setManualQ(e.target.value)}
          placeholder='Type a question manually…'
          style={{
            flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:10, padding:'9px 13px', fontSize:13, outline:'none', color:'#eeeef5',
          }}
          onFocus={e  => e.target.style.borderColor = 'rgba(255,215,0,0.35)'}
          onBlur={e   => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button type="submit" style={{
          background:'rgba(255,215,0,0.12)', color:'var(--gold)',
          border:'1px solid rgba(255,215,0,0.3)',
          borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer',
        }}>Ask</button>
      </form>

      {/* ── Answers ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 18px 20px' }}>
        {answers.length === 0 ? (
          <div style={{ textAlign:'center', paddingTop:48, color:'#2a2a3a' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>🤖</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#333350', marginBottom:8 }}>Ready to help</div>
            <div style={{ fontSize:13, color:'#2a2a35', lineHeight:1.9 }}>
              Start listening, then say<br />
              <span style={{ color:'rgba(255,215,0,0.5)', fontWeight:700, fontSize:14 }}>"Hey C3PO, [your question]"</span>
              <br />out loud near a mic
            </div>
          </div>
        ) : (
          [...answers].reverse().map(item => (
            <AnswerCard key={item.id} item={item} onSpeak={speakText} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes ripple { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.6);opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes popIn  { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  )
}

const hBtn = {
  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:8, padding:'6px 11px', color:'#8888aa', cursor:'pointer', fontSize:14,
}

const labelStyle = {
  display:'block', fontSize:12, fontWeight:700, color:'#8888aa',
  textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7,
}

const inputStyle = {
  width:'100%', background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:9, padding:'10px 12px', fontSize:14, color:'#eeeef5', outline:'none',
}
