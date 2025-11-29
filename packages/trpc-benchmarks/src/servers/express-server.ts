// Run: npx tsx src/servers/express-server.ts
// Or: node --import tsx src/servers/express-server.ts
import * as trpcExpress from '@trpc/server/adapters/express'
import express from 'express'
import { appRouter } from '../shared/router.js'

const PORT = Number(process.env.PORT) || 3001

const app = express()

// Minimal middleware for benchmarking (no unnecessary overhead)
app.use(express.json({ limit: '1mb' }))

// Disable x-powered-by header
app.disable('x-powered-by')

// Health check outside of tRPC
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', runtime: 'node', framework: 'express' })
})

// tRPC endpoint
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({})
  })
)

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Express+Node] Server running on http://localhost:${PORT}`)
  console.log(`[Express+Node] tRPC endpoint: http://localhost:${PORT}/trpc`)
  console.log(`[Express+Node] Node version: ${process.version}`)
  console.log(`[Express+Node] PID: ${process.pid}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Express+Node] SIGTERM received, shutting down...')
  server.close(() => {
    console.log('[Express+Node] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Express+Node] SIGINT received, shutting down...')
  server.close(() => {
    console.log('[Express+Node] Server closed')
    process.exit(0)
  })
})

export { app, server }
