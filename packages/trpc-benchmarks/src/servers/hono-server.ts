// Run with Bun: bun run src/servers/hono-server.ts
// Run with Node: npx tsx src/servers/hono-server.ts (for testing, but use Bun for benchmarks)
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { appRouter } from '../shared/router.js'

const PORT = Number(process.env.PORT) || 3002

const app = new Hono()

// Health check outside of tRPC
app.get('/health', c => {
  return c.json({
    status: 'ok',
    runtime: typeof Bun !== 'undefined' ? 'bun' : 'node',
    framework: 'hono',
  })
})

// tRPC endpoint using Hono adapter
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter as any,
    createContext: () => ({}),
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

  console.log(`[Hono+Bun] Server running on http://localhost:${server.port}`)
  console.log(`[Hono+Bun] tRPC endpoint: http://localhost:${server.port}/trpc`)
  console.log(`[Hono+Bun] Bun version: ${Bun.version}`)
  console.log(`[Hono+Bun] PID: ${process.pid}`)
} else {
  // Node.js fallback using @hono/node-server
  const { serve } = await import('@hono/node-server')

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  })

  console.log(`[Hono+Node] Server running on http://localhost:${PORT}`)
  console.log(`[Hono+Node] tRPC endpoint: http://localhost:${PORT}/trpc`)
  console.log(`[Hono+Node] Node version: ${process.version}`)
  console.log(`[Hono+Node] PID: ${process.pid}`)
  console.log('[Hono+Node] Note: For accurate benchmarks, run with Bun runtime')

  // Graceful shutdown for Node
  process.on('SIGTERM', () => {
    console.log('[Hono+Node] SIGTERM received, shutting down...')
    server.close(() => {
      console.log('[Hono+Node] Server closed')
      process.exit(0)
    })
  })

  process.on('SIGINT', () => {
    console.log('[Hono+Node] SIGINT received, shutting down...')
    server.close(() => {
      console.log('[Hono+Node] Server closed')
      process.exit(0)
    })
  })
}

export { app }
