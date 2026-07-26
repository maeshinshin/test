import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Output the built assets into the Go backend so they can be served
  // from a single binary via go:embed (see backend/cmd/web.go).
  build: {
    outDir: fileURLToPath(new URL('../backend/web/frontend_dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@gen': fileURLToPath(new URL('./gen', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Proxy Connect RPC to the local Go server during dev.
      '/streaming.v1.RandomStreamer': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
