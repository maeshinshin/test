import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  // Serve the SPA from https://<host>/app/. Vite rewrites <script src> and
  // <link href> to absolute paths under this base.
  base: '/app/',
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
      // Dev: forward the ConnectRPC endpoint to the local Go server while
      // keeping the SPA on the same origin (Vite dev server).
      '/app/streaming.v1.RandomStreamer': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/app/, ''),
      },
    },
  },
})
