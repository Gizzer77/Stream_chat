// Tiny local server for the desktop app. Serves the built React UI and mounts
// every api/*.js (Vercel-style handler) as a route — so all the existing API
// code (x-tweet, kick-send, c3po, polymarket, viewer-counts, oauth, …) works
// unchanged, with no CORS and no Vercel needed.
const express = require('express')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// Load the user's secrets if present (X/Twitch/Kick client secrets, etc.)
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }) } catch (_) {}

async function createServer() {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  const apiDir = path.join(__dirname, '..', 'api')
  if (fs.existsSync(apiDir)) {
    for (const file of fs.readdirSync(apiDir).filter(f => f.endsWith('.js'))) {
      const route = '/api/' + file.replace(/\.js$/, '')
      try {
        const mod = await import(pathToFileURL(path.join(apiDir, file)).href)
        const handler = mod.default
        if (typeof handler === 'function') {
          app.all(route, (req, res) => Promise.resolve(handler(req, res)).catch(e => { try { res.status(500).json({ error: e.message }) } catch (_) {} }))
        }
      } catch (e) { console.error('Failed to mount', route, e.message) }
    }
  }

  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))  // SPA fallback
  return app
}
module.exports = { createServer }
