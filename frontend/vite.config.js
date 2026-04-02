import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
    // PWA temporär deaktiviert wegen Service Worker Problemen
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
    sourcemap: false,
    minify: 'terser',
    // CSS Minify auf esbuild umstellen (unterdrückt die Warnungen)
    cssMinify: 'esbuild',
    // Chunk Size Warnungslimit erhöhen (da wir bewusst größere Chunks haben)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manuelle Chunks für große Libraries
        // WICHTIG: React + Router + Query MÜSSEN in einem Chunk sein um
        // mehrfache React-Instanziierung und TDZ-Fehler zu vermeiden!
        // WICHTIG: Funktions-Form verwenden! Array-Form matcht Paketnamen nicht korrekt.
        // Jedes Paket SEPARAT um intra-chunk TDZ durch zirkuläre Deps zu verhindern.
        manualChunks(id) {
          // React core (react + react-dom + scheduler) - MUSS als erstes evaluiert werden
          if (id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // React Router - separater Chunk, importiert von vendor-react
          if (id.includes('/node_modules/react-router') ||
              id.includes('/node_modules/@remix-run/')) {
            return 'vendor-router';
          }
          // React Query - separater Chunk, importiert von vendor-react
          if (id.includes('/node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          // UI Libraries
          if (id.includes('/node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('/node_modules/recharts') ||
              id.includes('/node_modules/victory-') ||
              id.includes('/node_modules/d3-') ||
              id.includes('/node_modules/d3/')) {
            return 'charts';
          }
          if (id.includes('/node_modules/framer-motion')) {
            return 'animation';
          }
          if (id.includes('/node_modules/grapesjs')) {
            return 'editor';
          }
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