# Build the X Chat Listener as a single .exe (Windows)

Run these **once on a Windows PC** (needs Node.js installed only to build — the
resulting .exe does NOT need Node to run):

```bash
cd x-listener
npm install
npm run dist
```

Output: **`x-listener/release/MB-X-Chat-Listener.exe`** — a single portable file.
Anyone can double-click it to run the listener; no install, no Node required.

## Make the dashboard's "Download" button serve it
1. Copy `MB-X-Chat-Listener.exe` into the web app's `public/` folder, renamed to
   `x-listener.exe`:
   ```
   copy x-listener\release\MB-X-Chat-Listener.exe public\x-listener.exe
   ```
2. Redeploy the web app (push to Vercel). The chat's **⬇ Download (.exe)** button
   links to `/x-listener.exe`, so visitors get the one-click app.

(The `x-listener.zip` source download stays as a fallback for developers.)

---

## Code-sign the .exe (stops Chrome / SmartScreen warnings)

The build is now configured for signing. electron-builder automatically picks up
your certificate from two environment variables — no secrets go in the repo:

**Windows (PowerShell):**
```powershell
$env:CSC_LINK="C:\path\to\your-cert.pfx"
$env:CSC_KEY_PASSWORD="your-cert-password"
npm run dist
```

- Use an **EV code-signing certificate** for *instant* SmartScreen trust (no
  reputation wait). A standard **OV** cert also works but builds reputation slowly.
- The `rfc3161TimeStampServer` is already set, so signatures stay valid after the
  cert expires.
- Without these env vars the build still works — it just produces an unsigned exe.

## Debugging "reads 0 chats"

If the dashboard connects but X messages stay at 0, run the listener, open the X
chat window so messages are visible, then visit:

```
http://localhost:5124/debug
```

It returns JSON showing how many elements each selector matched, whether the chat
is inside a cross-origin iframe (which DOM scraping can't read), and a sample of
what was captured. Paste that output back for an exact selector fix.
