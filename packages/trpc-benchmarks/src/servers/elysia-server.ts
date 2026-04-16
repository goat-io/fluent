// Run with Bun: bun run src/servers/elysia-server.ts
// Elysia + Bun server with tRPC (manual integration)

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Elysia } from 'elysia'
import { appRouter } from '../shared/router.js'

const PORT = Number(process.env.PORT) || 3003

const app = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    runtime: 'bun',
    framework: 'elysia',
  }))
  .all('/trpc/*', async ({ request }) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: request,
      router: appRouter,
      createContext: () => ({}),
    })
  })
  .listen(PORT)

console.log(
  `[Elysia+Bun] Server running on http://localhost:${app.server?.port}`,
)
console.log(
  `[Elysia+Bun] tRPC endpoint: http://localhost:${app.server?.port}/trpc`,
)
console.log(`[Elysia+Bun] Bun version: ${Bun.version}`)
console.log(`[Elysia+Bun] PID: ${process.pid}`)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Elysia+Bun] SIGTERM received, shutting down...')
  app.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Elysia+Bun] SIGINT received, shutting down...')
  app.stop()
  process.exit(0)
})

export { app }
