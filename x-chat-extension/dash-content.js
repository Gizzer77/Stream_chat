// Runs on the Market Bubble dashboard. Receives X chat from the background
// relay and posts it to the page, where the combined chat listens for it.
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'x_chat' || !Array.isArray(msg.items)) return
  for (const it of msg.items) {
    window.postMessage({ type: 'mb_x_chat', id: it.id, username: it.username, message: it.message, streamer: it.streamer || 'X' }, '*')
  }
})
console.log('[MB X] dashboard bridge ready')
