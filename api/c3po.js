// C3PO AI backend — supports both Anthropic (Claude) and Google (Gemini)

const SYSTEM_PROMPT = `You are C3PO, a quick-fire fact-checker for a live stream.
A viewer or streamer just asked a question. Search the web and give a concise, accurate answer.
- 2-4 sentences max — streamers need fast info
- Always say where you found it (site name is fine)
- If it's yes/no, lead with that then explain briefly
- Plain conversational language only — no markdown, no bullet points
- If unclear, say so honestly`

// ── Anthropic (Claude) ────────────────────────────────────────────────────────

async function askClaude(apiKey, question, askedBy, platform) {
  const userMsg = `${askedBy} on ${platform} asked: "${question}"`
  const messages = [{ role: 'user', content: userMsg }]
  let finalAnswer = null
  let sources = []

  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `Anthropic error ${res.status}`)
    }

    const data = await res.json()

    const textBlocks = (data.content || []).filter(b => b.type === 'text')
    if (textBlocks.length) finalAnswer = textBlocks.map(b => b.text).join('\n')

    // Collect sources
    for (const block of (data.content || [])) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.url) sources.push({ url: r.url, title: r.title || r.url })
        }
      }
    }

    if (data.stop_reason === 'end_turn') break

    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: data.content })
      const toolResults = (data.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: `Searching: ${b.input?.query || question}` }))
      if (toolResults.length) messages.push({ role: 'user', content: toolResults })
      else break
    } else break
  }

  if (!finalAnswer) finalAnswer = "I searched but couldn't find a clear answer."
  const seen = new Set()
  sources = sources.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true }).slice(0, 3)
  return { answer: finalAnswer, sources }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

async function askGemini(apiKey, question, askedBy, platform) {
  const userMsg = `${askedBy} on ${platform} asked: "${question}"`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        tools: [{ google_search: {} }],
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const answer = candidate?.content?.parts?.map(p => p.text).join('') || "Couldn't get an answer."

  // Extract grounding sources
  const chunks = candidate?.groundingMetadata?.groundingChunks || []
  const sources = chunks
    .map(c => ({ url: c.web?.uri, title: c.web?.title || c.web?.uri }))
    .filter(s => s.url)
    .slice(0, 3)

  return { answer, sources }
}

// ── Qwen (Alibaba DashScope) ──────────────────────────────────────────────────

async function askQwen(apiKey, question, askedBy, platform) {
  const userMsg = `${askedBy} on ${platform} asked: "${question}"`

  const res = await fetch(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMsg },
        ],
        tools: [{ type: 'web_search', web_search: { search_result: true } }],
        stream: false,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Qwen error ${res.status}`)
  }

  const data    = await res.json()
  const message = data.choices?.[0]?.message
  const answer  = message?.content || "Couldn't get an answer."

  // Extract sources from search results embedded in tool calls / content
  const sources = []
  const toolCalls = message?.tool_calls || []
  for (const tc of toolCalls) {
    try {
      const results = JSON.parse(tc.function?.arguments || '{}')?.results || []
      for (const r of results) {
        if (r.url) sources.push({ url: r.url, title: r.title || r.url })
      }
    } catch (_) {}
  }

  return { answer, sources: sources.slice(0, 3) }
}

// ── DeepSeek ──────────────────────────────────────────────────────────────────

async function askDeepSeek(apiKey, question, askedBy, platform) {
  const userMsg = `${askedBy} on ${platform} asked: "${question}"`

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMsg },
      ],
      max_tokens: 600,
      stream: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `DeepSeek error ${res.status}`)
  }

  const data   = await res.json()
  const answer = data.choices?.[0]?.message?.content || "Couldn't get an answer."
  return { answer, sources: [] }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-provider')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const apiKey   = req.headers['x-api-key']
  const provider = (req.headers['x-provider'] || 'anthropic').toLowerCase()
  const { question, askedBy = 'Someone', platform = 'the stream' } = req.body || {}

  if (!apiKey)   { res.status(401).json({ error: 'Missing API key' });  return }
  if (!question) { res.status(400).json({ error: 'Missing question' }); return }

  try {
    let result
    if (provider === 'gemini') {
      result = await askGemini(apiKey, question, askedBy, platform)
    } else if (provider === 'qwen') {
      result = await askQwen(apiKey, question, askedBy, platform)
    } else if (provider === 'deepseek') {
      result = await askDeepSeek(apiKey, question, askedBy, platform)
    } else {
      result = await askClaude(apiKey, question, askedBy, platform)
    }
    res.status(200).json(result)
  } catch (err) {
    console.error('[C3PO]', err.message)
    res.status(500).json({ error: err.message || 'Something went wrong' })
  }
}
