// Run: npx tsx src/servers/express-db-server.ts
// Express + Node.js server with Prisma/SQLite database
import * as trpcExpress from '@trpc/server/adapters/express'
import express from 'express'
import { prisma } from '../db/client.js'
import { type Context, dbRouter } from '../shared/db-router.js'

const PORT = Number(process.env.PORT) || 3001

const app: ReturnType<typeof express> = express()

// Minimal middleware for benchmarking
app.use(express.json({ limit: '1mb' }))
app.disable('x-powered-by')

// Health check outside of tRPC
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtime: 'node',
    framework: 'express',
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
    `[Express+Node+SQLite] Server running on http://localhost:${PORT}`,
  )
  console.log(
    `[Express+Node+SQLite] tRPC endpoint: http://localhost:${PORT}/trpc`,
  )
  console.log(`[Express+Node+SQLite] Node version: ${process.version}`)
  console.log(`[Express+Node+SQLite] PID: ${process.pid}`)
})

// Graceful shutdown
const shutdown = async () => {
  console.log('[Express+Node+SQLite] Shutting down...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('[Express+Node+SQLite] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export { app, server }
