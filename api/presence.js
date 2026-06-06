// In-memory presence store (persists within warm serverless instances, resets on cold start)
// Each user heartbeats every 12s — evicted after 25s of silence = appears offline

const rooms   = new Map() // roomCode → Map(userId → { name, color, ts })
const answers = new Map() // roomCode → Array of answer objects (max 20)

const COLORS = ['#9147ff','#54c0ff','#ff7b54','#53fc18','#ffd700','#f472b6','#fb923c']
const colorFor = (userId) => COLORS[parseInt(userId.slice(-4), 16) % COLORS.length]

function evict(room) {
  const cutoff = Date.now() - 25000
  for (const [id, user] of room) {
    if (user.ts < cutoff) room.delete(id)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  // ── GET: list users in room ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const code = req.query.room
    if (!code) { res.status(400).json({ error: 'Missing room code' }); return }

    const room = rooms.get(code) || new Map()
    evict(room)

    const users = [...room.values()].map(u => ({
      name:  u.name,
      color: u.color,
      ts:    u.ts,
    }))

    // Check lock state
    const locked      = room.get('__locked__')?.value || false
    const roomAnswers = answers.get(code) || []

    res.status(200).json({ users, count: users.length, locked, answers: roomAnswers })
    return
  }

  // ── POST: heartbeat / join ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const { roomCode, userId, name, action } = req.body || {}
    if (!roomCode || !userId) { res.status(400).json({ error: 'Missing roomCode or userId' }); return }

    if (!rooms.has(roomCode)) rooms.set(roomCode, new Map())
    const room = rooms.get(roomCode)

    // Share a C3PO answer to the room
    if (action === 'answer') {
      const { answer, question, sources, askedBy } = req.body
      if (!answer || !question) { res.status(400).json({ error: 'Missing answer/question' }); return }
      if (!answers.has(roomCode)) answers.set(roomCode, [])
      const list = answers.get(roomCode)
      list.push({ id: Math.random().toString(36).slice(2), question, answer, sources: sources || [], askedBy: askedBy || 'Someone', ts: Date.now() })
      if (list.length > 20) list.splice(0, list.length - 20)
      res.status(200).json({ ok: true })
      return
    }

    // Lock/unlock action (only the host can do this — we trust the client for now)
    if (action === 'lock') {
      room.set('__locked__', { value: true, ts: Date.now() })
      res.status(200).json({ ok: true })
      return
    }
    if (action === 'unlock') {
      room.set('__locked__', { value: false, ts: Date.now() })
      res.status(200).json({ ok: true })
      return
    }

    // Check if room is locked — reject new users
    evict(room)
    const lockEntry = room.get('__locked__')
    const isLocked  = lockEntry?.value || false
    const alreadyIn = room.has(userId)

    if (isLocked && !alreadyIn) {
      res.status(403).json({ error: 'Room is locked', locked: true })
      return
    }

    // Heartbeat / join
    room.set(userId, {
      name:  name || 'Viewer',
      color: colorFor(userId),
      ts:    Date.now(),
    })

    evict(room)

    const users = [...room.values()]
      .filter(u => !u.value) // exclude lock marker
      .map(u => ({ name: u.name, color: u.color }))

    res.status(200).json({ ok: true, users, count: users.length, locked: isLocked })
    return
  }

  // ── DELETE: leave ────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { roomCode, userId } = req.body || {}
    if (roomCode && userId) rooms.get(roomCode)?.delete(userId)
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).end()
}
