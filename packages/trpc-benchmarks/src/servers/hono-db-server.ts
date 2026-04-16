// Run with Bun: bun run src/servers/hono-db-server.ts
// Hono + Bun server with Prisma/SQLite database
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { prisma } from '../db/client.js'
import { dbRouter } from '../shared/db-router.js'

const PORT = Number(process.env.PORT) || 3002

const app = new Hono()

// Health check outside of tRPC
app.get('/health', c => {
  return c.json({
    status: 'ok',
    runtime: typeof Bun !== 'undefined' ? 'bun' : 'node',
    framework: 'hono',
    database: 'sqlite',
  })
})

// tRPC endpoint using Hono adapter
app.use(
  '/trpc/*',
  trpcServer({
    router: dbRouter as any,
    createContext: () => ({ prisma }) as any,
  }),
)

// Detect runtime and start appropriate server
const isBun = typeof Bun !== 'undefined'

if (isBun) {
  // Bun native server
  const server = Bun.serve({
    port: PORT,
    fetch: app.fetch,
  })

  console.log(
    `[Hono+Bun+SQLite] Server running on http://localhost:${server.port}`,
  )
  console.log(
    `[Hono+Bun+SQLite] tRPC endpoint: http://localhost:${server.port}/trpc`,
  )
  console.log(`[Hono+Bun+SQLite] Bun version: ${Bun.version}`)
  console.log(`[Hono+Bun+SQLite] PID: ${process.pid}`)

  // Graceful shutdown for Bun
  process.on('SIGTERM', async () => {
    console.log('[Hono+Bun+SQLite] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    console.log('[Hono+Bun+SQLite] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })
} else {
  // Node.js fallback using @hono/node-server
  const { serve } = await import('@hono/node-server')

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  })

  console.log(`[Hono+Node+SQLite] Server running on http://localhost:${PORT}`)
  console.log(`[Hono+Node+SQLite] tRPC endpoint: http://localhost:${PORT}/trpc`)
  console.log(`[Hono+Node+SQLite] Node version: ${process.version}`)
  console.log(`[Hono+Node+SQLite] PID: ${process.pid}`)
  console.log(
    '[Hono+Node+SQLite] Note: For accurate benchmarks, run with Bun runtime',
  )

  // Graceful shutdown for Node
  const shutdown = async () => {
    console.log('[Hono+Node+SQLite] Shutting down...')
    await prisma.$disconnect()
    server.close(() => {
      console.log('[Hono+Node+SQLite] Server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

export { app }
