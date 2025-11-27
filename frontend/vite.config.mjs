import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // ✅ HMR aktiviert für Auto-Reload
    hmr: {
      overlay: true,
      clientPort: 5173,
    },
    // API-Proxy für Backend
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      '/uploads': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
    // ✅ Browser-Öffnung deaktiviert
    open: false,
    // Watch-Optionen für besseres HMR
    watch: {
      usePolling: false, // ← auf false für bessere Performance
      interval: 100,
    }
  },
  // UTF-8 Support
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  // Optimized Deps für schnelleres HMR
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        }
      }
    }
  }
})