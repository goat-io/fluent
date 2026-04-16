// Run with Bun: bun run src/servers/elysia-db-server.ts
// Elysia + Bun server with tRPC and Prisma/SQLite database (manual integration)

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Elysia } from 'elysia'
import { prisma } from '../db/client.js'
import { dbRouter } from '../shared/db-router.js'

const PORT = Number(process.env.PORT) || 3003

const app = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    runtime: 'bun',
    framework: 'elysia',
    database: 'sqlite',
  }))
  .all('/trpc/*', async ({ request }) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: request,
      router: dbRouter,
      createContext: () => ({ prisma }),
    })
  })
  .listen(PORT)

console.log(
  `[Elysia+Bun+SQLite] Server running on http://localhost:${app.server?.port}`,
)
console.log(
  `[Elysia+Bun+SQLite] tRPC endpoint: http://localhost:${app.server?.port}/trpc`,
)
console.log(`[Elysia+Bun+SQLite] Bun version: ${Bun.version}`)
console.log(`[Elysia+Bun+SQLite] PID: ${process.pid}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Elysia+Bun+SQLite] SIGTERM received, shutting down...')
  await prisma.$disconnect()
  app.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[Elysia+Bun+SQLite] SIGINT received, shutting down...')
  await prisma.$disconnect()
  app.stop()
  process.exit(0)
})

export { app }
