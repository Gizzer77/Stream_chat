const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('listener', {
  setChannel: (name) => ipcRenderer.invoke('set-channel', name),
  getStatus:  () => ipcRenderer.invoke('get-status'),
})
