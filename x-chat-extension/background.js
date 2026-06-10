// Relays scraped X chat messages from the x.com tab to any open dashboard tab.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'x_chat') return
  chrome.tabs.query({}, tabs => {
    for (const t of tabs) {
      const url = t.url || ''
      if (url.includes('.vercel.app') || url.includes('localhost') || url.includes('127.0.0.1')) {
        try { chrome.tabs.sendMessage(t.id, msg, () => void chrome.runtime.lastError) } catch (_) {}
      }
    }
  })
})
