// Shared dashboard helpers + config store.

export function dbg(msg, obj) {
  try {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}` + (obj !== undefined ? ' ' + JSON.stringify(obj) : '')
    const prev = localStorage.getItem('oauth_debug_log') || ''
    localStorage.setItem('oauth_debug_log', (prev + '\n' + line).slice(-8000))
    console.log('[MB]', msg, obj !== undefined ? obj : '')
  } catch (_) {}
}

export function parseConfig() {
  try {
    const h = window.location.hash.slice(1)
    return h ? JSON.parse(atob(h)) : null
  } catch { return null }
}

export function genCodeVerifier() {
  const arr = new Uint8Array(32)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, d => ('0' + d.toString(16)).slice(-2)).join('')
}
export async function genCodeChallenge(verifier) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const PLAT = {
  twitch: { color: '#9147ff', bg: 'rgba(145,71,255,0.12)' },
  kick:   { color: '#53fc18', bg: 'rgba(83,252,24,0.1)' },
  x:      { color: '#e2e8f0', bg: 'rgba(255,255,255,0.06)' },
}

// Parse a URL or handle into a chat/video source. Supports Twitch, Kick and X
// (X broadcasts are watchable in the player; X chat read needs paid API access).
export function parseSourceInput(raw) {
  const v = (raw || '').trim()
  if (!v) return null
  const url = v.startsWith('http') ? v : `https://${v}`
  const xlc = v.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/livechat/i)
  if (xlc) return { platform: 'x', kind: 'livechat', channel: xlc[1], url, label: '@' + xlc[1] + ' (X chat)' }
  const xb = v.match(/(?:x|twitter)\.com\/(?:i\/)?broadcasts\/([A-Za-z0-9]+)/i)
  if (xb) return { platform: 'x', kind: 'broadcast', channel: 'X Broadcast', broadcastId: xb[1], url, label: 'X Broadcast' }
  const km = v.match(/kick\.com\/([a-zA-Z0-9_]+)/i)
  if (km) return { platform: 'kick', channel: km[1], label: km[1] }
  const tm = v.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i)
  if (tm) return { platform: 'twitch', channel: tm[1], label: tm[1] }
  const xp = v.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\/|$)/i)
  if (xp && xp[1].toLowerCase() !== 'i') {
    const u = xp[1]
    return { platform: 'x', kind: 'livechat', channel: u, url: `https://x.com/${u}/livechat`, label: '@' + u + ' (X chat)' }
  }
  // bare "@handle" is ambiguous; default to Twitch (most common here)
  if (/^@?[a-zA-Z0-9_]{2,30}$/.test(v)) { const c = v.replace(/^@/, ''); return { platform: 'twitch', channel: c, label: c } }
  return null
}

// ── Config store ──────────────────────────────────────────────────────────────
export const CFG_KEY = 'mb_cfg_v1'
const DEFAULT_PANELS = { stream: true, chat: true, viewers: true, polymarket: true, c3po: true }

export function loadCfg() {
  let c = {}
  try { c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') } catch (_) { c = {} }
  return {
    twClientId:   c.twClientId   || localStorage.getItem('twitch_client_id') || '',
    xClientId:    c.xClientId    || localStorage.getItem('x_client_id')      || '',
    useOwnChat:   c.useOwnChat !== false,
    customSources: Array.isArray(c.customSources) ? c.customSources : [],
    c3poProvider: c.c3poProvider || 'anthropic',
    c3poApiKey:   c.c3poApiKey   || localStorage.getItem('c3po_api_key') || '',
    c3poWakeWord: 'hey jarvis', // fixed wake word
    c3poAutoSpeak: c.c3poAutoSpeak !== false,
    polyQ:        c.polyQ        || '',
    polyLimit:    c.polyLimit    || 12,
    panels:       { ...DEFAULT_PANELS, ...(c.panels || {}) },
  }
}
export function saveCfg(c) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c))
  // keep legacy keys in sync so OAuth code that reads them still works
  if (c.twClientId) localStorage.setItem('twitch_client_id', c.twClientId)
  if (c.xClientId)  localStorage.setItem('x_client_id', c.xClientId)
  if (c.c3poApiKey) localStorage.setItem('c3po_api_key', c.c3poApiKey)
}

// Effective chat/viewer sources from config + co-streamers + own accounts.
export function effectiveSources(cfg, streamers) {
  const myTwitch = localStorage.getItem('twitch_username') || ''
  const myKick   = localStorage.getItem('kick_username')   || ''
  const out = []
  const seen = new Set()
  const push = s => { const k = s.platform + ':' + s.channel.toLowerCase(); if (s.channel && !seen.has(k)) { seen.add(k); out.push(s) } }
  const myX = localStorage.getItem('x_username') || ''
  if (cfg.useOwnChat) {
    if (myTwitch) push({ platform: 'twitch', channel: myTwitch, label: 'Your Twitch' })
    if (myKick)   push({ platform: 'kick',   channel: myKick,   label: 'Your Kick' })
    // Logged into X → auto-embed your own broadcast live chat (x.com/<you>/livechat)
    if (myX && myX !== 'connected') push({ platform: 'x', kind: 'livechat', channel: myX, url: `https://x.com/${myX}/livechat`, label: '@' + myX + ' (your X chat)' })
    ;(streamers || []).forEach(s => {
      if (s.twitch) push({ platform: 'twitch', channel: s.twitch, label: (s.name || s.twitch) + ' (Twitch)' })
      if (s.kick)   push({ platform: 'kick',   channel: s.kick,   label: (s.name || s.kick) + ' (Kick)' })
    })
  }
  ;(cfg.customSources || []).forEach(push)
  return out
}
