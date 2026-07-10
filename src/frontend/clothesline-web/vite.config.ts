import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dev server proxies API calls to the backend so the browser only ever talks
// to the Vite origin. Under GitHub Codespaces, forwarded ports are Private by
// default and a cross-origin background fetch() to the API's own forwarded
// subdomain gets bounced with a sign-in redirect at GitHub's edge before it
// reaches uvicorn — same-origin requests from the already-loaded page don't
// (see specs/01-mvp/fixes/2026-07-05-codespaces-oidc-signin.md §3.2). Routing
// /sync, /auth/me and /health through here keeps everything same-origin, so
// the API port never needs Public visibility. secure:false because uvicorn
// serves a self-signed dev cert. Only for `vite` (dev) — `vite build` ignores
// server config, so production still uses a real VITE_API_BASE_URL.
const apiTarget = process.env.VITE_DEV_API_TARGET ?? 'https://localhost:8000'
const apiProxy = { target: apiTarget, changeOrigin: true, secure: false }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precaches the app shell + category template (spec §6.4) so the
      // installed app opens with no network.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      manifest: {
        name: 'Clothesline',
        short_name: 'Clothesline',
        description: 'Offline-first laundry drop-off tracker',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    host: true,
    // Proxy /auth/me specifically (not /auth/*) so the client-side
    // /auth/callback SPA route keeps being served by Vite.
    proxy: {
      '/sync': apiProxy,
      '/auth/me': apiProxy,
      '/health': apiProxy,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
