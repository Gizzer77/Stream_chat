// Market Bubble — desktop (Electron) main process.
//  • Runs a local server that serves the built UI + the existing /api functions.
//  • Opens the X live chat in its own window (logged in), reads its DOM directly
//    (no same-origin block here — we control the engine), and streams each new
//    line into the dashboard's combined chat.
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const PORT = 5123
let mainWin = null
let xWin = null
let scrapeTimer = null
let currentUrl = ''

// Runs inside the X page; returns new chat lines (deduped via window.__mbSeen).
const SCRAPER_JS = `(function(){
  try{
    if(!window.__mbSeen) window.__mbSeen = new Set();
    var out = [];
    var rows = document.querySelectorAll('[data-testid="cellInnerDiv"], div[role="listitem"], [data-testid="messageEntry"]');
    rows.forEach(function(el){
      var text = (el.innerText||'').replace(/\\s+/g,' ').trim();
      if(!text || text.length > 500) return;
      var user = 'X';
      var link = el.querySelector('a[href^="/"]');
      if(link){ var h = (link.getAttribute('href')||'').split('?')[0].replace(/^\\//,''); if(/^[A-Za-z0-9_]{1,15}$/.test(h)) user = h; }
      var sig = user + '|' + text;
      if(window.__mbSeen.has(sig)) return;
      window.__mbSeen.add(sig);
      out.push({ username:user, message:text, id:sig });
    });
    return out;
  }catch(e){ return []; }
})()`

function startScraping() {
  if (scrapeTimer) clearInterval(scrapeTimer)
  scrapeTimer = setInterval(async () => {
    if (!xWin || xWin.isDestroyed()) return
    try {
      const items = await xWin.webContents.executeJavaScript(SCRAPER_JS, true)
      if (Array.isArray(items) && items.length && mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('x-chat', items)
      }
    } catch (_) {}
  }, 1500)
}

function setXChatUrl(url) {
  if (!url) {
    if (scrapeTimer) { clearInterval(scrapeTimer); scrapeTimer = null }
    currentUrl = ''
    return
  }
  if (url === currentUrl && xWin && !xWin.isDestroyed()) return
  currentUrl = url
  if (!xWin || xWin.isDestroyed()) {
    xWin = new BrowserWindow({
      width: 420, height: 720, title: 'X Live Chat (log in here)',
      backgroundColor: '#000000',
      webPreferences: { partition: 'persist:xchat' },  // its own persistent X login
    })
    xWin.on('closed', () => { xWin = null; if (scrapeTimer) { clearInterval(scrapeTimer); scrapeTimer = null } })
  }
  xWin.loadURL(url)
  xWin.show()
  startScraping()
}

ipcMain.handle('set-x-chat-url', (_e, url) => { setXChatUrl(url); return true })
ipcMain.handle('show-x-window', () => { if (xWin && !xWin.isDestroyed()) xWin.show(); return true })

async function createWindow() {
  const { createServer } = require('./server.cjs')
  const server = await createServer()
  await new Promise(res => server.listen(PORT, res))

  mainWin = new BrowserWindow({
    width: 1440, height: 920, backgroundColor: '#07070e',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true },
  })
  mainWin.loadURL(`http://localhost:${PORT}/`)
  mainWin.on('closed', () => { mainWin = null })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
