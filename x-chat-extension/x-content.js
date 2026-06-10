// Runs on x.com. Scrapes the live chat DOM and forwards new messages to the
// background script, which relays them to the Market Bubble dashboard tab.
(function () {
  const onChatPage = () =>
    location.pathname.endsWith('/livechat') || location.pathname.includes('/broadcasts/') || location.pathname.includes('/i/spaces/')
  // Run anyway — the observer only fires on chat-like rows, so it's harmless
  // even if the heuristic above is wrong for a given URL.

  const seen = new Set()
  function remember(sig) {
    seen.add(sig)
    if (seen.size > 600) seen.delete(seen.values().next().value)
  }

  function extract(el) {
    if (!el || !el.textContent) return null
    let username = ''
    // profile link → @handle
    const link = el.querySelector('a[href^="/"]')
    if (link) {
      const h = (link.getAttribute('href') || '').split('?')[0].replace(/^\//, '')
      if (/^[A-Za-z0-9_]{1,15}$/.test(h)) username = h
    }
    if (!username) {
      const m = el.textContent.match(/@([A-Za-z0-9_]{1,15})/)
      if (m) username = m[1]
    }
    let text = (el.innerText || '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 600) return null
    return { username: username || 'X', message: text }
  }

  function looksLikeMessage(el) {
    if (!(el instanceof HTMLElement)) return false
    // a chat row generally has a profile link + some text and isn't huge
    const hasLink = !!el.querySelector('a[href^="/"]')
    const len = (el.textContent || '').trim().length
    return hasLink && len > 1 && len < 600
  }

  function handleNode(node) {
    if (!(node instanceof HTMLElement)) return
    // The chat row is often a wrapper; check the node and its immediate children
    const candidates = [node, ...node.querySelectorAll(':scope > div, [data-testid="cellInnerDiv"], [data-testid="messageEntry"]')]
    for (const c of candidates) {
      if (!looksLikeMessage(c)) continue
      const item = extract(c)
      if (!item) continue
      const sig = item.username + '|' + item.message
      if (seen.has(sig)) continue
      remember(sig)
      try {
        chrome.runtime.sendMessage({ type: 'x_chat', items: [{ ...item, streamer: 'X', id: sig }] })
        console.log('[MB X] captured', item)
      } catch (_) {}
      break // one message per added node
    }
  }

  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) handleNode(n)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  console.log('[MB X] X Chat Bridge active on', location.pathname, '(chat page:', onChatPage(), ')')
})()
