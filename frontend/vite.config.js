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