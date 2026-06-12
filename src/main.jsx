import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react'
import './index.css'

// NOTE: StrictMode intentionally removed. In dev it double-invokes effects,
// which made the OAuth callback consume single-use tokens/codes twice --
// breaking Twitch (token consumed by a throwaway mount) and looping X
// (auth code reused -> "code already used" -> re-prompt).
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <Analytics />
  </BrowserRouter>
)
