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
