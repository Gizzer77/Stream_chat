# Market Bubble — Desktop App (Electron)

This wraps the exact same dashboard in a desktop app so it can read the **X live
chat directly** (no browser extension), read **Kick** reliably (real browser, no
Cloudflare 403), and run all the `/api` functions locally (Twitch/X/Kick send).

## Run it (development)
```bash
npm install        # installs electron, express, etc.
npm run desktop    # builds the UI and launches the app
```
A second small window titled **"X Live Chat"** opens — log into X there once.
Anything in that chat flows into the dashboard's **All** feed as ✖ X.

## Build a downloadable installer
```bash
npm run dist        # current OS
npm run dist:win    # Windows .exe (NSIS)
npm run dist:mac    # macOS .dmg
```
The installer lands in the `release/` folder. (For distributing to *other* people
without security warnings you'd later add code-signing; for your own machine it
runs fine unsigned.)

## What you need to set up
1. **Secrets** — keep your `.env.local` in the project root (X/Twitch/Kick client
   IDs + secrets). The app loads it automatically; it is bundled into the build.
2. **OAuth redirect URIs** — because the app runs on `http://localhost:5123`, add
   these redirect/callback URLs in each developer console (in addition to your
   Vercel ones):
   - Twitch:  `http://localhost:5123/oauth/twitch`
   - X:       `http://localhost:5123/oauth/x`
   - Kick:    `http://localhost:5123/oauth/kick`

## How the X chat works here
- Add a streamer's X link as a source (e.g. `x.com/AviFelman`).
- The app opens that user's `/livechat` in its own window and reads its DOM every
  ~1.5s, sending new lines into the combined chat. No extension, no API tier.
- Sending: you can type in the X chat window directly, or use the dashboard send
  box (Twitch via IRC, X via the API, Kick via the API).

## Notes
- X changes its page markup often; the scraper selectors live in
  `electron/main.cjs` (`SCRAPER_JS`). If lines stop coming through, that string is
  the one spot to adjust.
- The web version (Vercel) still works exactly as before — this is additive.
