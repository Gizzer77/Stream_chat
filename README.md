# Market Bubble — Multi-Platform Stream Chat Dashboard

A live dashboard that pulls **Twitch, Kick, and X (Twitter)** chats into one combined feed, lets you reply to all of them from one box, shows live viewer counts, prediction markets, and a built-in voice assistant — all in a draggable grid layout you arrange however you like.

## 👉 Open it here: https://stream-chat-neon.vercel.app/

No install needed to use the dashboard — it runs in your browser. Just open the link, connect your accounts, and go.

---

## About the download (please read — it is **not** malware)

To pull in **X (Twitter) live chat**, the dashboard offers an optional small app called the **X Chat Listener** (`x-listener.exe`).

**Your browser and Windows will probably warn you about it.** That is expected and does **not** mean it's dangerous. The warning appears because the file is **new and not yet code-signed** — Microsoft SmartScreen and Chrome flag *any* unsigned program that hasn't built up download history yet, regardless of what it does. It is a reputation check, not a virus scan.

### Exactly what the X Chat Listener does

It is a small open-source helper built on Electron (the same framework behind Slack, Discord, and VS Code). When you run it:

1. It opens a normal X (Twitter) window where **you log into your own X account once.** Your login stays on your computer, in the app's local session — it is never sent anywhere.
2. It reads the chat messages that are **already visible** on the X live-chat page you're watching.
3. It serves those messages **only to your own browser**, locally, at `http://localhost:5124`, so the dashboard can merge them into the combined feed.
4. When you type a message in the dashboard, it types that message into the X chat for you.

### What it does **not** do

- It does **not** collect, upload, or sell any of your data.
- It does **not** run in the background or start with Windows — it only runs while you have it open.
- It does **not** ask for your password — you log into X yourself, in X's own window.
- It does **not** connect to any server except X itself and your own browser on `localhost`.
- It contains **no ads, tracking, or telemetry.**

The full source code is included in the `x-listener/` folder so anyone can read exactly what it does. You can also download the source as a `.zip` from the dashboard instead of the `.exe` if you'd rather build it yourself.

### Running it

Double-click `x-listener.exe`. If Windows SmartScreen appears, click **More info → Run anyway**. Log into X once in the window that opens, and the X chat will start flowing into your dashboard.

---

## What the dashboard does

- **Combined chat** — Twitch, Kick, and X messages merged into one feed, with per-platform tabs and color-coded names. Messages you send are highlighted.
- **Send everywhere at once** — type once and post to Twitch, Kick, and X chat from a single box.
- **Rooms** — share a room link or code so a co-streamer can join; your chats merge so everyone sees both streams' messages in one place.
- **Live viewer counts** — see real-time viewers per streamer and platform.
- **Polymarket** — glance at live prediction markets.
- **Jarvis** — a voice assistant; say "Hey Jarvis, …" and it answers out loud.
- **Draggable grid** — arrange every panel on a snap-to grid; drag headers to move, drag corners to resize, hide what you don't need.

## Privacy

Your account logins are stored only in your own browser (and, for X, in the local listener app). Nothing is sent to any third-party server. Room presence and the shared combined chat pass through the app's own backend only while you're in a room, and are kept in memory for the live session only.

---

*Built with React + Vite, deployed on Vercel.*
