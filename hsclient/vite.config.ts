import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative Asset-Pfade: derselbe dist/-Ordner funktioniert unveraendert unter jedem
  // Unterpfad (/hsclient/, /opt/hsclient/, ...), ohne Rebuild - solange die URL mit
  // abschliessendem "/" aufgerufen wird (sonst werden Assets eine Ebene zu hoch gesucht).
  base: './',
  plugins: [react()],
  // Die App spricht die Homeserver-API nur noch relativ an (kein fester Host mehr im Code) -
  // in echten Deployments reicht der jeweilige Webserver "/hsvisu/" zum Homeserver durch. Lokal
  // (npm run dev / npm run preview) uebernimmt das hier der Vite-Proxy, damit es ohne zusaetzliche
  // Server-Konfiguration weiter funktioniert.
  server: {
    proxy: {
      '/hsvisu': {
        target: process.env.VITE_HS_PROXY_TARGET || 'http://homeserver.local:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    proxy: {
      '/hsvisu': {
        target: process.env.VITE_HS_PROXY_TARGET || 'http://homeserver.local:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
