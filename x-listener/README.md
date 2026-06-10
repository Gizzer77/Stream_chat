# Market Bubble — X Chat Listener

A tiny helper that reads an X (Twitter) **live chat** on your computer and serves
it to the Market Bubble web dashboard. This is the free way to pull X chat into
the combined chat without a paid API — the listener reads the chat locally
(allowed, because it runs on your machine), and the website just asks it for the
messages.

## Run it
```bash
cd x-listener
npm install
npm start
```
1. A small control window opens. Type the streamer's X username and click **Start**.
2. A second window opens with their live chat — **log into X there once**.
3. Leave both open. Open your Market Bubble dashboard in your browser — X messages
   now flow into the **All** feed as ✖ X automatically.

## Build an installer (optional)
```bash
npm run start         # to test
npx electron-builder  # makes an installer in release/
```

## How it connects
- The listener serves messages at `http://localhost:5124/messages`.
- The dashboard polls that URL (browsers allow pages to talk to `localhost`).
- If the listener isn't running, the dashboard just shows the X embed as before;
  nothing breaks.

## Tuning
X changes its markup often. If messages stop, adjust the `SCRAPER_JS` selectors
in `main.cjs`.
