import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Dojo MSG',
        short_name: 'Dojo MSG',
        description: 'Messaging App für die Kampfkunstschule',
        start_url: '/',
        display: 'standalone',
        background_color: '#0e1117',
        theme_color: '#0e1117',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5001', changeOrigin: true, ws: true }
    }
  }
})
