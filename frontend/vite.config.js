import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // WICHTIG: Browser soll SW nicht cachen
      injectRegister: false, // Wir registrieren manuell in index.html
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-*.png'],
      manifest: {
        name: 'Dojosoftware - Mitgliederbereich',
        short_name: 'Dojo Member',
        description: 'Dein persönlicher Mitgliederbereich für Check-in, Trainingsplan und Statistiken',
        theme_color: '#0f0f23',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Erhöhe Limit für große JS-Dateien
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // WICHTIG: Keine HTML-Dateien cachen (verhindert Flacker-Loop)
        globPatterns: ['**/*.{js,css,png,jpg,jpeg,svg,gif,woff,woff2}'],
        // API-Calls NICHT cachen
        navigateFallbackDenylist: [/^\/api/],
        // AUTO-UPDATE: Sofort neue Version aktivieren
        skipWaiting: true,
        clientsClaim: true,
        // Alte Caches automatisch löschen
        cleanupOutdatedCaches: true,
        // WICHTIG: Source Map für SW generieren (Debugging)
        sourcemap: false,
        runtimeCaching: [
          {
            // Bilder cachen
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Tage
              }
            }
          },
          {
            // Fonts cachen
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 Jahr
              }
            }
          }
        ]
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
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Für Production auf false setzen
    minify: 'terser',
    // CSS Minify auf esbuild umstellen (unterdrückt die Warnungen)
    cssMinify: 'esbuild',
    // Chunk Size Warnungslimit erhöhen (da wir bewusst größere Chunks haben)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manuelle Chunks für große Libraries
        manualChunks: {
          // Core React - wird immer gebraucht
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          // UI Libraries
          'icons': ['lucide-react'],
          'charts': ['recharts'],
          'animation': ['framer-motion'],
          // Heavy Libraries - selten genutzt
          'editor': ['grapesjs', 'grapesjs-preset-webpage'],
          // React Query für API-Caching
          'query': ['@tanstack/react-query'],
        },
        // Bessere Chunk-Namen
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId || '';
          // Komponenten-basierte Chunks
          if (facadeModuleId.includes('/components/')) {
            const match = facadeModuleId.match(/\/components\/([^/]+)\.jsx?$/);
            if (match) {
              return `assets/${match[1]}-[hash].js`;
            }
          }
          // Pages
          if (facadeModuleId.includes('/pages/')) {
            const match = facadeModuleId.match(/\/pages\/([^/]+)\.jsx?$/);
            if (match) {
              return `assets/${match[1]}-[hash].js`;
            }
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  // CSS Einstellungen
  css: {
    devSourcemap: false
  }
});