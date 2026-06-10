const { contextBridge, ipcRenderer } = require('electron')

// Main process sends scraped X messages here → re-post to the page so the
// existing CombinedChat 'mb_x_chat' listener picks them up unchanged.
ipcRenderer.on('x-chat', (_e, items) => {
  for (const it of (items || [])) {
    window.postMessage({ type: 'mb_x_chat', id: it.id, username: it.username, message: it.message, streamer: 'X' }, '*')
  }
})

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  setXChatUrl: (url) => ipcRenderer.invoke('set-x-chat-url', url || ''),
  showXWindow: () => ipcRenderer.invoke('show-x-window'),
})
