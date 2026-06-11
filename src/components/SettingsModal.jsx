import { useState } from 'react'
import { parseSourceInput, PLAT } from '../lib/dash'

const TABS = [
  { key: 'accounts',   label: '👤 Accounts' },
  { key: 'room',       label: '🔗 Room' },
  { key: 'sources',    label: '💬 Chat Sources' },
  { key: 'c3po',       label: '🤖 C-3PO' },
  { key: 'polymarket', label: '📊 Polymarket' },
]

const inputStyle = { width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 12px', fontSize: 13, color: '#eeeef5', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#c8c8e0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {}) }
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input readOnly value={value} onFocus={e => e.target.select()} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} />
        <button onClick={copy} style={{ background: copied ? 'rgba(34,197,94,0.18)' : 'linear-gradient(135deg,#9147ff,#6441a5)', color: copied ? '#22c55e' : '#fff', border: 'none', borderRadius: 9, padding: '0 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}

export default function SettingsModal({ cfg, room, onSave, onClose, initialTab = 'sources' }) {
  const valid = TABS.some(t => t.key === initialTab) ? initialTab : 'sources'
  const [tab, setTab]     = useState(valid)
  const [draft, setDraft] = useState(() => ({ ...cfg }))
  const [srcInput, setSrcInput] = useState('')
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  function addSource() {
    const s = parseSourceInput(srcInput)
    if (!s) return
    setDraft(d => ({ ...d, customSources: [...(d.customSources || []), s] }))
    setSrcInput('')
  }
  function removeSource(i) { setDraft(d => ({ ...d, customSources: d.customSources.filter((_, j) => j !== i) })) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0e0e1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, width: 560, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 12px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Settings</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8e8f5', fontSize: 16, cursor: 'pointer', borderRadius: 8, padding: '2px 9px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '0 22px', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: tab === t.key ? 'rgba(145,71,255,0.18)' : 'rgba(255,255,255,0.04)',
              color: tab === t.key ? '#c084fc' : '#c8c8e0',
              border: `1px solid ${tab === t.key ? 'rgba(145,71,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {tab === 'accounts' && (() => {
            const accounts = [
              { key:'twitch', label:'Twitch', color:'#9147ff', icon:'🟣', user: localStorage.getItem('twitch_username'), token: localStorage.getItem('twitch_token'), keys:['twitch_token','twitch_username'] },
              { key:'x',      label:'X',      color:'#cbd5e1', icon:'✖', user: localStorage.getItem('x_username'),      token: localStorage.getItem('x_token'),      keys:['x_token','x_username','x_refresh_token'] },
              { key:'kick',   label:'Kick',   color:'#53fc18', icon:'🟢', user: localStorage.getItem('kick_username'),   token: localStorage.getItem('kick_token'),   keys:['kick_token','kick_username','kick_refresh_token'] },
            ]
            const unlink = a => { if (window.confirm('Unlink ' + a.label + '? You can reconnect on the Setup page.')) { a.keys.forEach(k => localStorage.removeItem(k)); window.location.reload() } }
            return (
              <>
                <div style={{ fontSize: 11, color: '#8a8aa5', marginBottom: 14, lineHeight: 1.6 }}>Your connected logins. Unlink one to clear its token, then reconnect it on the Setup page (handy if posting stops working — e.g. Kick needs a fresh login for chat permissions).</div>
                {accounts.map(a => (
                  <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, background: a.token ? a.color + '12' : 'rgba(255,255,255,0.03)', border: `1px solid ${a.token ? a.color + '33' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '11px 14px' }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: a.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{a.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: a.token ? '#eeeef5' : '#55556a' }}>{a.token ? '@' + (a.user || 'connected') : 'Not connected'}</div>
                    </div>
                    {a.token
                      ? <button onClick={() => unlink(a)} style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 8, padding: '6px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Unlink</button>
                      : <span style={{ fontSize: 11, color: '#55556a' }}>log in on Setup</span>}
                  </div>
                ))}
                <button onClick={() => { window.location.href = '/' }} style={{ marginTop: 8, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c8c8e0', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬅ Go to Setup page (connect accounts)</button>
              </>
            )
          })()}

          {tab === 'room' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, background: 'rgba(145,71,255,0.06)', border: '1px solid rgba(145,71,255,0.18)', borderRadius: 12, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8a8aa5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Room Code</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 900, letterSpacing: '0.2em', color: '#eeeef5' }}>{room?.code || '——————'}</div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={room?.onToggleLock} style={{ display: 'flex', alignItems: 'center', gap: 7, background: room?.locked ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${room?.locked ? 'rgba(234,179,8,0.35)' : 'rgba(255,255,255,0.12)'}`, color: room?.locked ? '#fbbf24' : '#c8c8e0', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{room?.locked ? '🔒 Locked' : '🔓 Lock Room'}</button>
              </div>
              <div style={{ fontSize: 11, color: '#8a8aa5', marginBottom: 14, lineHeight: 1.6 }}>Share the <b>room link</b> so viewers open this same combined dashboard. Send the <b>invite link</b> to a co-streamer so they log into their own accounts and broadcast alongside you — your chats merge, but each of you only posts from your own logins.</div>
              {room?.code && <CopyRow label="Room code" value={room.code} />}
              {room?.link && <CopyRow label="Room link (open the dashboard)" value={room.link} />}
              {room?.invite && <CopyRow label="Invite link (co-streamer joins)" value={room.invite} />}
            </>
          )}

          {tab === 'sources' && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.useOwnChat} onChange={e => set('useOwnChat', e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#eeeef5', fontWeight: 600 }}>Use my connected accounts + co-streamers</span>
              </label>
              <label style={labelStyle}>Custom chat sources</label>
              <div style={{ fontSize: 11, color: '#8a8aa5', marginBottom: 10 }}>Add Twitch / Kick channels (URL or name) for chat + video. Paste a streamer's X link (x.com/USERNAME) and we'll embed their live chat. Add x.com/i/broadcasts/… to watch a broadcast.</div>
              {(draft.customSources || []).map((s, i) => {
                const pc = PLAT[s.platform]?.color || '#888'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: pc }} />
                    <span style={{ fontSize: 12, color: pc, fontWeight: 700, flex: 1 }}>{s.platform === 'twitch' ? '🟣' : s.platform === 'kick' ? '🟢' : '✖'} {s.label || s.channel}</span>
                    <button onClick={() => removeSource(i)} style={{ background: 'rgba(239,68,68,0.14)', border: 'none', color: '#f87171', borderRadius: 6, padding: '2px 9px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <input value={srcInput} onChange={e => setSrcInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSource()}
                  placeholder="twitch.tv/… · kick.com/… · x.com/i/broadcasts/…" style={inputStyle} />
                <button onClick={addSource} style={{ background: 'linear-gradient(135deg,#9147ff,#6441a5)', color: '#fff', border: 'none', borderRadius: 9, padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ Add</button>
              </div>
            </>
          )}

          {tab === 'c3po' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>AI Provider</label>
                <select value={draft.c3poProvider} onChange={e => set('c3poProvider', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="anthropic">Anthropic (Claude) — with web search</option>
                  <option value="gemini">Google (Gemini)</option>
                  <option value="openrouter">OpenRouter (free models)</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">Qwen</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>API Key</label>
                <input type="password" value={draft.c3poApiKey} onChange={e => set('c3poApiKey', e.target.value)} placeholder="Paste your API key" style={inputStyle} />
                <div style={{ fontSize: 11, color: '#8a8aa5', marginTop: 8 }}>Stored only in your browser. Needed for the C-3PO assistant to answer.</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Wake word</label>
                <input value={draft.c3poWakeWord} onChange={e => set('c3poWakeWord', e.target.value)} placeholder="hey c3po" style={inputStyle} />
                <div style={{ fontSize: 11, color: '#8a8aa5', marginTop: 8 }}>Say this out loud followed by your question while listening is on.</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.c3poAutoSpeak} onChange={e => set('c3poAutoSpeak', e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#eeeef5', fontWeight: 600 }}>Auto read answers aloud (text-to-speech)</span>
              </label>
            </>
          )}

          {tab === 'polymarket' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Default search term (optional)</label>
                <input value={draft.polyQ} onChange={e => set('polyQ', e.target.value)} placeholder="e.g. election, bitcoin, sports" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>How many markets to show</label>
                <input type="number" min="4" max="40" value={draft.polyLimit} onChange={e => set('polyLimit', Math.max(4, Math.min(40, parseInt(e.target.value || '12', 10) || 12)))} style={inputStyle} />
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: '#e8e8f5', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={() => { onSave(draft); onClose() }} style={{ flex: 2, background: 'linear-gradient(135deg,#9147ff,#6441a5)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save Settings</button>
        </div>
      </div>
    </div>
  )
}
