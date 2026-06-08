import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For a GitHub Pages deploy, set BASE=/iot-platform-architecture/ before `npm run build`.
  base: process.env.BASE || '/',
  // Dev server proxies /api/* to the Brain CLI on :7613 so frontend code can
  // use bare /api/... paths (instead of hardcoding localhost:7613).
  server: {
    proxy: {
      '/api': { target: 'http://localhost:7613', changeOrigin: true },
    },
  },
})
