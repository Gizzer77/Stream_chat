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
let lastDebug = { ts: 0, note: 'no scrape yet' }

const SCRAPER_JS = `(function(){
  // Proven against x.com/<channel>/livechat: messages live in [data-testid="chatContainer"].
  // Each message is a text block reading "DisplayName @handle message text".
  try{
    if(!window.__mbSeen) window.__mbSeen = new Set();
    var cc = document.querySelector('[data-testid="chatContainer"]') || document.body;
    var dbg = { container: cc===document.body?'body(fallback)':'chatContainer', handles:0, url:location.href, sample:[] };
    var handleSpans = [].slice.call(cc.querySelectorAll('span')).filter(function(e){
      return e.children.length===0 && /^@[A-Za-z0-9_]{1,15}$/.test((e.textContent||'').trim());
    });
    dbg.handles = handleSpans.length;
    var fresh = [];
    handleSpans.forEach(function(h){
      var handle = h.textContent.trim();              // "@name"
      var row = h.parentElement, hops = 0;
      while(row && hops < 10){
        var t = (row.innerText||'').replace(/\\s+/g,' ').trim();
        var after = t.slice(t.indexOf(handle)+handle.length).trim();
        if(after.length>0) break;
        row = row.parentElement; hops++;
      }
      if(!row) return;
      var full = (row.innerText||'').replace(/\\s+/g,' ').trim();
      var idx = full.indexOf(handle); if(idx<0) return;
      var message = full.slice(idx+handle.length).trim();
      if(!message || message.length>500) return;
      var username = handle.replace(/^@/,'');
      var sig = username+'|'+message;
      if(dbg.sample.length<8) dbg.sample.push(username+': '+message.slice(0,40));
      if(window.__mbSeen.has(sig)) return;
      window.__mbSeen.add(sig);
      fresh.push({ username: username, message: message, id: sig });
    });
    return { items: fresh, debug: dbg };
  }catch(e){ return { items: [], debug: { error: String(e) } }; }
})()`

function pushItems(items) {
  for (const it of items) { seq++; buffer.push({ seq, id: it.id, username: it.username, message: it.message }) }
  if (buffer.length > 800) buffer = buffer.slice(-800)
}
function startScrape() {
  if (scrapeTimer) clearInterval(scrapeTimer)
  scrapeTimer = setInterval(async () => {
    if (!xWin || xWin.isDestroyed()) return
    try {
      const res = await xWin.webContents.executeJavaScript(SCRAPER_JS, true)
      if (res && res.debug) lastDebug = Object.assign({ ts: Date.now() }, res.debug)
      if (res && Array.isArray(res.items) && res.items.length) pushItems(res.items)
    } catch (e) { lastDebug = { ts: Date.now(), error: String(e) } }
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
  res.setHeader('Access-Control-Allow-Methods', '*')
  // Chrome Private Network Access: a public HTTPS page calling http://localhost
  // is blocked unless this header is present on the preflight + response.
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
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
  if (u.pathname === '/debug') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ channel, count: seq, listening: !!xWin, lastDebug }, null, 2)); return }
  res.writeHead(404); res.end('not found')
}).listen(PORT, () => console.log('X listener on http://localhost:' + PORT))

app.whenReady().then(() => {
  controlWin = new BrowserWindow({ width: 440, height: 320, title: 'Market Bubble — X Chat Listener', backgroundColor: '#0e0e1c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true } })
  controlWin.loadFile(path.join(__dirname, 'control.html'))
})
app.on('window-all-closed', () => app.quit())
