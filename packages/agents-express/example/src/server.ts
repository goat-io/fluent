// Blank Express + Prisma app showing how to mount @goatlab/agents-express.
//
// Run:
//   pnpm infra:up && pnpm db:generate && pnpm db:push && pnpm start
//   curl http://localhost:3000/health
//
// Then load test:
//   pnpm loadtest

import express from 'express'
import { agentsRouter } from '@goatlab/agents-express'
import { getAgents, shutdownAgents } from './agents.factory.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const TENANT_ID = process.env.TENANT_ID ?? 'demo-tenant'

async function main() {
  // Boot the engine + workers up-front so the first request doesn't pay a
  // cold-start cost. In a multi-tenant app, you'd boot lazily per tenant.
  console.log('Booting engine...')
  await getAgents()
  console.log('  ✅ engine + workers ready')

  const app = express()
  app.use(express.json({ limit: '1mb' }))

  // Health is dirt-cheap and doesn't touch the engine — used by your LB.
  app.get('/health', (_req, res) => res.json({ ok: true }))

  // Mount every workflow endpoint under /api/workflows.
  // resolveAgents is the plug-in point: return { engine, ingestBuffer, tenantId }.
  // For a multi-tenant app, pull tenantId from your auth middleware.
  app.use(
    '/api/workflows',
    agentsRouter({
      resolveAgents: async (_req) => {
        const { engine, ingestBuffer } = await getAgents()
        return { engine, ingestBuffer, tenantId: TENANT_ID }
      },
    }),
  )

  // Graceful shutdown — drain in-flight buffer + engine before exit
  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log('\n🛑 Shutting down...')
    server.close()
    await shutdownAgents()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  const server = app.listen(PORT, () => {
    console.log(`\n✅ Express + agent engine ready at http://localhost:${PORT}`)
    console.log(`   Tenant: ${TENANT_ID}`)
    console.log(`   Try:`)
    console.log(`     curl -s -X POST http://localhost:${PORT}/api/workflows/start-async \\`)
    console.log(`       -H 'Content-Type: application/json' \\`)
    console.log(`       -d '{"workflowName":"fast_single","input":{"hi":"world"}}'`)
    console.log()
  })
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
