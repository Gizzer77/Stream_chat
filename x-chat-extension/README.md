# Market Bubble — X Chat Bridge (browser extension)

X blocks reading its live chat through any normal web page (cross-origin
security), so this small extension reads the chat **on the X page itself** and
forwards each message to your Market Bubble dashboard, where it merges into the
combined chat tagged as ✖ X.

## Install (Chrome / Edge / Brave)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `x-chat-extension` folder
4. Pin it if you like

## Use
1. Open your dashboard (the Vercel site) in one tab.
2. Open the streamer's X live chat in another tab: `https://x.com/<username>/livechat`
   (you can minimize it — it just has to stay open and logged in).
3. Messages will start flowing into the combined chat as ✖ X.

## Notes / tuning
- Open the X tab's DevTools console; you'll see `[MB X] captured …` for each line it reads.
- X changes its page markup often. If messages stop or look off, the selectors in
  `x-content.js` (`extract` / `looksLikeMessage`) may need a tweak — the console
  logs make it easy to see what it's grabbing.
- The dashboard match list is `*.vercel.app` + localhost. If you move to a custom
  domain, add it to `host_permissions` and the `dash-content.js` matches in
  `manifest.json`.
