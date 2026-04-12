#!/usr/bin/env tsx
/**
 * Test backend server for Playwright E2E tests and k6 load tests.
 *
 * Starts: Postgres (testcontainer) + Redis (testcontainer) + HTTP API + BullMQ workers
 *
 * Usage: npx tsx test-server/server.ts
 *
 * Env vars for tuning:
 *   PG_POOL_SIZE=50      Postgres connection pool size
 *   WORKER_CONCURRENCY=50  BullMQ worker concurrency per queue
 *   DISABLE_LOG_BUFFER=false  Set to 'true' for synchronous log writes
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
  EventIngestionService,
} from '@goatlab/agents-core'
import type { Database } from '@goatlab/agents-core'
import type { StepPayload, StepResult } from '@goatlab/agents-core'

const PORT = 4444
const TENANT = 'e2e-ui-tenant'
const PG_POOL_SIZE = parseInt(process.env.PG_POOL_SIZE ?? '20', 10) // Hatchet: ~20 optimal, too many = lock contention
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '50', 10)
const DISABLE_LOG_BUFFER = process.env.DISABLE_LOG_BUFFER === 'true'

async function main() {
  console.log('🚀 Starting E2E test backend...')
  console.log(`   PG pool: ${PG_POOL_SIZE}, Worker concurrency: ${WORKER_CONCURRENCY}, Log buffer: ${!DISABLE_LOG_BUFFER}`)

  // ── Start containers ─────────────────────────────────
  console.log('  📦 Starting Postgres...')
  const pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('agents_e2e_ui')
    .withCommand([
      'postgres',
      '-c', 'max_connections=200',
      '-c', 'shared_buffers=256MB',
      '-c', 'work_mem=16MB',
      '-c', 'synchronous_commit=off',       // Faster writes (acceptable for non-critical data)
      '-c', 'wal_level=minimal',
      '-c', 'max_wal_senders=0',
      '-c', 'fsync=off',                     // Faster for testing (not production!)
      '-c', 'full_page_writes=off',
    ])
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
        max: PG_POOL_SIZE,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
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
      maxRetriesPerRequest: null, // Required for BullMQ workers
    },
  })

  // ── Executors ────────────────────────────────────────
  const executor = new FunctionStepExecutor()

  // Fast workflow handlers (zero delay for load testing)
  executor.register('fast_echo', async (p: StepPayload): Promise<StepResult> => ({
    output: { echoed: true, step: p.stepName, ts: Date.now() },
  }))

  executor.register('fast_chain', async (p: StepPayload): Promise<StepResult> => ({
    output: { chained: true, input: p.input, ts: Date.now() },
  }))

  // Demo pipeline handlers (with realistic delays)
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
  executor.register('review', async (p: StepPayload): Promise<StepResult> => ({
    output: { reviewStarted: true },
    waitForHuman: { prompt: 'Please review the implementation and approve or reject.', schema: { type: 'object', properties: { approved: { type: 'boolean' }, comment: { type: 'string' } } } },
  }))
  executor.register('deploy', async (p: StepPayload): Promise<StepResult> => {
    await new Promise(r => setTimeout(r, 400))
    return { output: { deployed: true, url: 'https://app.example.com', version: '1.0.0' } }
  })

  // ── Workflows ────────────────────────────────────────

  // Fast single-step workflow (for throughput benchmarking)
  const fastWorkflow = WorkflowBuilder.create('fast_single')
    .version('1.0.0')
    .defaultRetries(0)
    .step('work', { executorType: 'function', executorConfig: { handler: 'fast_echo' } })
    .build()

  // Fast 3-step chain (for pipeline throughput)
  const fastChain = WorkflowBuilder.create('fast_chain')
    .version('1.0.0')
    .defaultRetries(0)
    .step('a', { executorType: 'function', executorConfig: { handler: 'fast_chain' } })
    .step('b', { dependsOn: ['a'], executorType: 'function', executorConfig: { handler: 'fast_chain' }, mapInput: (up) => ({ from: up.a }) })
    .step('c', { dependsOn: ['b'], executorType: 'function', executorConfig: { handler: 'fast_chain' }, mapInput: (up) => ({ from: up.b }) })
    .build()

  // Demo pipeline (with realistic delays + human-in-the-loop)
  const demoWorkflow = WorkflowBuilder.create('demo_pipeline')
    .version('1.0.0')
    .defaultRetries(2)
    .step('analyze', { executorType: 'function', executorConfig: { handler: 'analyze' } })
    .step('plan', { dependsOn: ['analyze'], executorType: 'function', executorConfig: { handler: 'plan' }, mapInput: (up) => ({ analysis: up.analyze }) })
    .step('implement', { dependsOn: ['plan'], executorType: 'function', executorConfig: { handler: 'implement' }, mapInput: (up) => ({ plan: up.plan }) })
    .step('review', { dependsOn: ['implement'], executorType: 'function', executorConfig: { handler: 'review' } })
    .step('deploy', { dependsOn: ['review'], executorType: 'function', executorConfig: { handler: 'deploy' } })
    .build()

  // ── Event Ingestion ──────────────────────────────────
  const eventService = new EventIngestionService({ db })

  // ── Engine ───────────────────────────────────────────
  const engine = new WorkflowEngine({
    db,
    connector,
    executors: new Map([['function', executor]]),
    workflows: new Map([
      ['demo_pipeline', demoWorkflow],
      ['fast_single', fastWorkflow],
      ['fast_chain', fastChain],
    ]),
    tenantId: TENANT,
    disableLogBuffering: DISABLE_LOG_BUFFER,
    eventIngestion: eventService,
  })

  // ── BullMQ Workers (high concurrency) ────────────────
  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)
  const workerHandle = await connector.listen({
    tasks: [
      { taskName: 'workflow_step_light', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: WORKER_CONCURRENCY },
      { taskName: 'workflow_step_heavy', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: Math.max(5, WORKER_CONCURRENCY / 4) },
      { taskName: 'workflow_step_ai', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: Math.max(10, WORKER_CONCURRENCY / 2) },
      { taskName: 'workflow_step_sandbox', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: 5 },
    ],
  })
  console.log(`  ✅ BullMQ workers started (concurrency: ${WORKER_CONCURRENCY}/queue)`)

  // ── API Handlers ─────────────────────────────────────
  const handlers = createWorkflowHandlers(engine)

  // ── HTTP Server (optimized) ──────────────────────────
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
    console.log(`   Workflows: demo_pipeline (5 steps), fast_single (1 step), fast_chain (3 steps)`)
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
