import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dojosoftware - Mitgliederbereich',
        short_name: 'Dojo Member',
        description: 'Mitglieder-Self-Service für Kampfkunstschulen',
        theme_color: '#0f0f23',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['sports', 'health', 'education'],
        shortcuts: [
          {
            name: 'Check-in',
            short_name: 'Check-in',
            description: 'Schneller Check-in zum Training',
            url: '/?action=checkin',
            icons: [{ src: 'icon-checkin-96.png', sizes: '96x96' }]
          },
          {
            name: 'Meine Termine',
            short_name: 'Termine',
            description: 'Trainingsplan anzeigen',
            url: '/dashboard/schedule',
            icons: [{ src: 'icon-schedule-96.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB (erhöht von default 2 MB)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tda-intl\.org\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/auth\//,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/api\/checkin\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'checkin-cache',
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /\/api\/mitglieder\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'member-data',
              expiration: {
                maxAgeSeconds: 60 * 10
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // F�r Production auf false setzen
    minify: 'terser',
    // CSS Minify auf esbuild umstellen (unterdr�ckt die Warnungen)
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  // CSS Einstellungen
  css: {
    devSourcemap: false
  }
});