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