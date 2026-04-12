#!/usr/bin/env tsx
/**
 * Test backend server for Playwright E2E tests.
 *
 * Starts: Postgres (testcontainer) + Redis (testcontainer) + Express API + BullMQ worker
 * Exposes: WorkflowHandlers as REST endpoints on port 4444
 *
 * Usage: npx tsx test-server/server.ts
 */
import http from 'node:http'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import {
  WorkflowEngine,
  WorkflowBuilder,
  WorkflowStepTask,
  FunctionStepExecutor,
  createWorkflowHandlers,
  CREATE_TABLES_SQL,
} from '@goatlab/agents-core'
import type { Database } from '@goatlab/agents-core'
import type { StepPayload, StepResult } from '@goatlab/agents-core'

const PORT = 4444
const TENANT = 'e2e-ui-tenant'

async function main() {
  console.log('🚀 Starting E2E test backend...')

  // ── Start containers ─────────────────────────────────
  console.log('  📦 Starting Postgres...')
  const pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('agents_e2e_ui')
    .start()

  console.log('  📦 Starting Redis...')
  const redisContainer = await new RedisContainer('redis:7-alpine').start()

  // ── Kysely DB ────────────────────────────────────────
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        host: pgContainer.getHost(),
        port: pgContainer.getMappedPort(5432),
        database: 'agents_e2e_ui',
        user: pgContainer.getUsername(),
        password: pgContainer.getPassword(),
        max: 10,
      }),
    }),
  })

  // Create tables
  const statements = CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await sql.raw(stmt).execute(db)
  }
  console.log('  ✅ Database ready')

  // ── BullMQ ───────────────────────────────────────────
  const connector = new BullMQConnector({
    connection: {
      host: redisContainer.getHost(),
      port: redisContainer.getMappedPort(6379),
    },
  })

  // ── Executor with demo handlers ──────────────────────
  const executor = new FunctionStepExecutor()
  executor.register('analyze', async (p: StepPayload): Promise<StepResult> => {
    await new Promise(r => setTimeout(r, 500))
    return { output: { analysis: 'Feature looks viable', confidence: 0.9, requirements: ['auth', 'dashboard'] } }
  })
  executor.register('plan', async (p: StepPayload): Promise<StepResult> => {
    await new Promise(r => setTimeout(r, 300))
    return { output: { tasks: [{ name: 'Create API' }, { name: 'Build UI' }, { name: 'Write tests' }], approved: true } }
  })
  executor.register('implement', async (p: StepPayload): Promise<StepResult> => {
    await new Promise(r => setTimeout(r, 800))
    return { output: { filesCreated: 5, linesOfCode: 250, branch: 'feat/new-feature' } }
  })
  executor.register('review', async (p: StepPayload): Promise<StepResult> => {
    return {
      output: { reviewStarted: true },
      waitForHuman: { prompt: 'Please review the implementation and approve or reject.', schema: { type: 'object', properties: { approved: { type: 'boolean' }, comment: { type: 'string' } } } },
    }
  })
  executor.register('deploy', async (p: StepPayload): Promise<StepResult> => {
    await new Promise(r => setTimeout(r, 400))
    return { output: { deployed: true, url: 'https://app.example.com', version: '1.0.0' } }
  })

  // ── Demo workflow ────────────────────────────────────
  const demoWorkflow = WorkflowBuilder.create('demo_pipeline')
    .version('1.0.0')
    .defaultRetries(2)
    .step('analyze', {
      executorType: 'function',
      executorConfig: { handler: 'analyze' },
    })
    .step('plan', {
      dependsOn: ['analyze'],
      executorType: 'function',
      executorConfig: { handler: 'plan' },
      mapInput: (up) => ({ analysis: up.analyze }),
    })
    .step('implement', {
      dependsOn: ['plan'],
      executorType: 'function',
      executorConfig: { handler: 'implement' },
      mapInput: (up) => ({ plan: up.plan }),
    })
    .step('review', {
      dependsOn: ['implement'],
      executorType: 'function',
      executorConfig: { handler: 'review' },
    })
    .step('deploy', {
      dependsOn: ['review'],
      executorType: 'function',
      executorConfig: { handler: 'deploy' },
    })
    .build()

  // ── Engine ───────────────────────────────────────────
  const engine = new WorkflowEngine({
    db,
    connector,
    executors: new Map([['function', executor]]),
    workflows: new Map([['demo_pipeline', demoWorkflow]]),
    tenantId: TENANT,
    disableLogBuffering: true,
  })

  // ── BullMQ Worker ────────────────────────────────────
  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)
  const workerHandle = await connector.listen({
    tasks: [
      { taskName: 'workflow_step_light', handle: (data: unknown) => stepTask.handle(data as StepPayload) },
      { taskName: 'workflow_step_heavy', handle: (data: unknown) => stepTask.handle(data as StepPayload) },
      { taskName: 'workflow_step_ai', handle: (data: unknown) => stepTask.handle(data as StepPayload) },
      { taskName: 'workflow_step_sandbox', handle: (data: unknown) => stepTask.handle(data as StepPayload) },
    ],
    defaultConcurrency: 5,
  })
  console.log('  ✅ BullMQ worker started')

  // ── API Handlers ─────────────────────────────────────
  const handlers = createWorkflowHandlers(engine)

  // ── HTTP Server (minimal, no Express needed) ─────────
  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const path = url.pathname

    try {
      let body: any = {}
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        body = JSON.parse(Buffer.concat(chunks).toString())
      }

      let result: any

      if (path === '/workflows' && req.method === 'GET') {
        result = await handlers.listWorkflows({ tenantId: TENANT })
      } else if (path === '/workflows/start') {
        result = await handlers.start({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/status') {
        result = await handlers.getStatus({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/cancel') {
        result = await handlers.cancel({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/human-input') {
        result = await handlers.submitHumanInput({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/signal') {
        result = await handlers.signal({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/query') {
        result = await handlers.query({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/ingest-event') {
        result = await handlers.ingestEvent({ ...body, tenantId: TENANT })
      } else if (path === '/workers/list') {
        result = await handlers.listWorkers({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/heartbeat') {
        result = await handlers.heartbeat({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/validate') {
        result = await handlers.validateDefinition(body)
      } else if (path === '/health') {
        result = { ok: true }
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err: any) {
      const status = err.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 500
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message, code: err.code }))
    }
  })

  server.listen(PORT, () => {
    console.log(`\n✅ Test backend ready on http://localhost:${PORT}`)
    console.log(`   Tenant: ${TENANT}`)
    console.log(`   Workflow: demo_pipeline (5 steps: analyze → plan → implement → review → deploy)`)
    console.log(`   Review step pauses for human approval\n`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...')
    server.close()
    await workerHandle.stop()
    await connector.close()
    await engine.shutdown()
    await db.destroy()
    await redisContainer.stop()
    await pgContainer.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
