// Run: bun run src/servers/express-trpc-bun-server.ts
// Express + tRPC running on Bun runtime with Prisma/SQLite database
import * as trpcExpress from '@trpc/server/adapters/express'
import express from 'express'
import { prisma } from '../db/client.js'
import { type Context, dbRouter } from '../shared/db-router.js'

const PORT = Number(process.env.PORT) || 3008

const app: ReturnType<typeof express> = express()

// Minimal middleware for benchmarking
app.use(express.json({ limit: '1mb' }))
app.disable('x-powered-by')

// Health check outside of tRPC
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtime: 'bun',
    framework: 'express-trpc',
    database: 'sqlite',
  })
})

// tRPC endpoint with Prisma context
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: dbRouter,
    createContext: (): Context => ({ prisma }),
  }),
)

// Start server
const server = app.listen(PORT, () => {
  console.log(
    `[Express+tRPC+Bun+SQLite] Server running on http://localhost:${PORT}`,
  )
  console.log(
    `[Express+tRPC+Bun+SQLite] tRPC endpoint: http://localhost:${PORT}/trpc`,
  )
  console.log(`[Express+tRPC+Bun+SQLite] Bun version: ${Bun.version}`)
  console.log(`[Express+tRPC+Bun+SQLite] PID: ${process.pid}`)
})

// Graceful shutdown
const shutdown = async () => {
  console.log('[Express+tRPC+Bun+SQLite] Shutting down...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('[Express+tRPC+Bun+SQLite] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export { app, server }
