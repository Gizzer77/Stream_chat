// Market Bubble — X Chat Listener (standalone helper).
// Opens the X live chat in a window (you log in once), reads its messages, and
// serves them on http://localhost:5124 so the web dashboard can poll + merge.
const { app, BrowserWindow, ipcMain } = require('electron')
const http = require('http')
const path = require('path')

const PORT = 5124
let controlWin = null, xWin = null, scrapeTimer = null
let seq = 0
let buffer = []      // { seq, id, username, message }
let channel = ''

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
      if(link){ var h=(link.getAttribute('href')||'').split('?')[0].replace(/^\\//,''); if(/^[A-Za-z0-9_]{1,15}$/.test(h)) user = h; }
      var sig = user + '|' + text;
      if(window.__mbSeen.has(sig)) return;
      window.__mbSeen.add(sig);
      out.push({ username:user, message:text, id:sig });
    });
    return out;
  }catch(e){ return []; }
})()`

function pushItems(items) {
  for (const it of items) { seq++; buffer.push({ seq, id: it.id, username: it.username, message: it.message }) }
  if (buffer.length > 800) buffer = buffer.slice(-800)
}
function startScrape() {
  if (scrapeTimer) clearInterval(scrapeTimer)
  scrapeTimer = setInterval(async () => {
    if (!xWin || xWin.isDestroyed()) return
    try { const items = await xWin.webContents.executeJavaScript(SCRAPER_JS, true); if (Array.isArray(items) && items.length) pushItems(items) } catch (_) {}
  }, 1500)
}
function openChannel(name) {
  if (!name) return
  channel = name.replace(/^@/, '').trim()
  const url = `https://x.com/${channel}/livechat`
  if (!xWin || xWin.isDestroyed()) {
    xWin = new BrowserWindow({ width: 430, height: 720, title: 'X Live Chat — log in here', backgroundColor: '#000', webPreferences: { partition: 'persist:xlistener' } })
    xWin.on('closed', () => { xWin = null; if (scrapeTimer) { clearInterval(scrapeTimer); scrapeTimer = null } })
  }
  xWin.loadURL(url); xWin.show(); startScrape()
}

ipcMain.handle('set-channel', (_e, name) => { openChannel(name); return { ok: true, channel } })
ipcMain.handle('get-status', () => ({ channel, count: seq, listening: !!xWin }))

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const u = new URL(req.url, 'http://localhost')
  if (u.pathname === '/messages') {
    const since = parseInt(u.searchParams.get('since') || '0', 10) || 0
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ messages: buffer.filter(m => m.seq > since), last: seq, channel }))
    return
  }
  if (u.pathname === '/set') { const c = u.searchParams.get('channel'); if (c) openChannel(c); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, channel })); return }
  if (u.pathname === '/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ channel, count: seq, listening: !!xWin })); return }
  res.writeHead(404); res.end('not found')
}).listen(PORT, () => console.log('X listener on http://localhost:' + PORT))

app.whenReady().then(() => {
  controlWin = new BrowserWindow({ width: 440, height: 320, title: 'Market Bubble — X Chat Listener', backgroundColor: '#0e0e1c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true } })
  controlWin.loadFile(path.join(__dirname, 'control.html'))
})
app.on('window-all-closed', () => app.quit())
