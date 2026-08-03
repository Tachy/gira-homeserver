import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Optionale, individuelle Schrift: wird zur Laufzeit nachgeladen (kein Build-Time-Import), damit
// der Build ohne jedes Setup funktioniert. Fehlt die Datei, bleibt es einfach bei einem 404 im
// Network-Tab und den Default-Werten aus index.css. Siehe hsclient/public/font/font.css.example.
const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'font/font.css'
document.head.appendChild(fontLink)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
