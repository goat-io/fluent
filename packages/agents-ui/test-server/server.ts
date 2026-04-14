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
import cluster from 'node:cluster'
import os from 'node:os'
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
  IngestBuffer,
  IngestWorker,
} from '@goatlab/agents-core'
import type { Database } from '@goatlab/agents-core'
import type { StepPayload, StepResult } from '@goatlab/agents-core'

const PORT = parseInt(process.env.PORT ?? '4444', 10)
const TENANT = 'e2e-ui-tenant'
const PG_POOL_SIZE = parseInt(process.env.PG_POOL_SIZE ?? '20', 10) // Hatchet: ~20 optimal, too many = lock contention
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '50', 10)
const DISABLE_LOG_BUFFER = process.env.DISABLE_LOG_BUFFER === 'true'

/**
 * Cluster sizing:
 *   CLUSTER_MODE=auto  (default) → forks (cores - 1), min 1
 *   CLUSTER_MODE=off              → single process (no fork)
 *   CLUSTER_MODE=<N>              → forks exactly N
 *
 * All children share Redis + PG; HTTP is kernel-round-robined across children,
 * BullMQ distributes jobs naturally via BRPOP. No role coordination needed —
 * each child runs both HTTP and BullMQ consumers.
 */
function desiredClusterWorkers(): number {
  const mode = process.env.CLUSTER_MODE ?? 'auto'
  const cores = (os as any).availableParallelism?.() ?? os.cpus().length
  if (mode === 'off' || cores <= 1) return 1
  if (mode === 'auto') return Math.max(1, cores - 1)  // leave 1 core for OS + primary
  const n = parseInt(mode, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

async function startContainers() {
  console.log('  📦 Starting Postgres...')
  const pgContainer = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('agents_e2e_ui')
    .withCommand([
      'postgres',
      '-c', 'max_connections=200',
      '-c', 'shared_buffers=256MB',
      '-c', 'work_mem=16MB',
      '-c', 'synchronous_commit=off',
      '-c', 'wal_level=minimal',
      '-c', 'max_wal_senders=0',
      '-c', 'fsync=off',
      '-c', 'full_page_writes=off',
    ])
    .start()
  console.log('  📦 Starting Redis...')
  const redisContainer = await new RedisContainer('redis:7-alpine').start()
  return {
    pgHost: pgContainer.getHost(),
    pgPort: pgContainer.getMappedPort(5432),
    pgDb: 'agents_e2e_ui',
    pgUser: pgContainer.getUsername(),
    pgPass: pgContainer.getPassword(),
    redisHost: redisContainer.getHost(),
    redisPort: redisContainer.getMappedPort(6379),
    pgContainer,
    redisContainer,
  }
}

async function main() {
  const workerId = process.env.CLUSTER_WORKER_ID ?? '0'
  const label = cluster.isPrimary ? 'single' : `w${workerId}`
  console.log(`🚀 [${label}] Starting test backend on pid=${process.pid}`)
  console.log(`   PG pool: ${PG_POOL_SIZE}, Worker concurrency: ${WORKER_CONCURRENCY}, Log buffer: ${!DISABLE_LOG_BUFFER}`)

  // ── Kysely DB ────────────────────────────────────────
  const pgPool = new pg.Pool({
    host: process.env.PG_HOST!,
    port: parseInt(process.env.PG_PORT!, 10),
    database: process.env.PG_DB!,
    user: process.env.PG_USER!,
    password: process.env.PG_PASSWORD!,
    max: PG_POOL_SIZE,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: pgPool,
    }),
  })

  // Only one worker initializes schema; others wait on an advisory lock.
  // CREATE TYPE/INDEX are not concurrency-safe even with IF NOT EXISTS —
  // PG raises duplicate_object when two transactions race.
  await sql.raw(`SELECT pg_advisory_lock(4242)`).execute(db)
  try {
    const statements = CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await sql.raw(stmt).execute(db)
    }
  } finally {
    await sql.raw(`SELECT pg_advisory_unlock(4242)`).execute(db)
  }
  console.log(`  ✅ [${label}] Database ready`)

  // ── BullMQ ───────────────────────────────────────────
  const connector = new BullMQConnector({
    connection: {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!, 10),
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
    pgPool,  // For COPY FROM bulk inserts
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

  // Queue-first ingestion: HTTP → IngestBuffer → BullMQ → IngestWorker → COPY FROM → PG
  const ingestWorker = new IngestWorker({
    engine,
    flushThreshold: 200,
    // Longer interval so batches actually fill to threshold. Per-batch
    // overhead (BEGIN/COMMIT roundtrips) is fixed ~30-60ms, so smaller
    // batches waste that overhead. 100ms × 2500 triggers/s/worker → threshold
    // hits first under load; idle workers just wait a bit longer.
    flushIntervalMs: 100,
    // Cap below pool size to leave headroom for status reads / log flushes
    maxConcurrentFlushes: Math.max(2, Math.floor(PG_POOL_SIZE / 2)),
    logger: console,
  })
  const ingestBuffer = new IngestBuffer({
    // Backend-agnostic via TaskConnector.bulkQueue (BullMQ uses addBulk)
    connector,
    taskName: 'workflow_ingest',
    flushThreshold: 200,
    flushIntervalMs: 50,
    maxJitterMs: 20,
    logger: console,
  })

  const workerHandle = await connector.listen({
    tasks: [
      // Ingest concurrency must be ≥ IngestWorker flushThreshold, otherwise
      // batches can never reach their configured size (BullMQ won't deliver
      // more than `concurrency` in-flight jobs per worker).
      { taskName: 'workflow_ingest', handle: (data: unknown) => ingestWorker.handleJob(data as any), concurrency: 300 },
      { taskName: 'workflow_step_light', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: WORKER_CONCURRENCY },
      { taskName: 'workflow_step_heavy', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: Math.max(5, WORKER_CONCURRENCY / 4) },
      { taskName: 'workflow_step_ai', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: Math.max(10, WORKER_CONCURRENCY / 2) },
      { taskName: 'workflow_step_sandbox', handle: (data: unknown) => stepTask.handle(data as StepPayload), concurrency: 5 },
    ],
  })
  console.log(`  ✅ BullMQ workers started (concurrency: ${WORKER_CONCURRENCY}/queue, ingest + 4 step queues)`)

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
      } else if (path === '/workflows/start-async') {
        // Queue-first ingestion: buffer → addBulk → IngestWorker → COPY FROM.
        // IngestBuffer assigns runId + traceId at the HTTP boundary and returns
        // them synchronously so callers can correlate spans before PG commits.
        const trigger = { ...body, tenantId: TENANT }
        const { runId, traceId } = ingestBuffer.enqueue(trigger)
        result = { runId, traceId, status: 'QUEUED' }
      } else if (path === '/workflows/start-batch') {
        const workflows = (body.workflows || []).map((w: any) => ({ ...w, tenantId: TENANT }))
        result = await handlers.startBatch({ workflows })
      } else if (path === '/workflows/start-batch-copy') {
        const workflows = (body.workflows || []).map((w: any) => ({ ...w, tenantId: TENANT }))
        result = await handlers.startBatchCopy({ workflows })
      } else if (path === '/workflows/status') {
        try {
          result = await handlers.getStatus({ ...body, tenantId: TENANT })
        } catch (err: any) {
          // Queue-first ingest fallback: if PG misses, the run might still be in BullMQ
          if (err.code === 'WORKFLOW_RUN_NOT_FOUND' && body.runId) {
            const ingestQueue = connector.getQueue('workflow_ingest')
            const job = await ingestQueue.getJob(`ingest-${body.runId}`)
            if (job) {
              const state = await job.getState() // 'waiting' | 'active' | 'completed' | 'failed' | ...
              const data: any = job.data ?? {}
              result = {
                id: body.runId,
                traceId: data.trigger?.traceId ?? null,
                workflowName: data.trigger?.workflowName ?? null,
                status: state === 'failed' ? 'INGEST_FAILED' : 'QUEUED',
                ingestState: state,
                steps: [],
                createdAt: new Date(job.timestamp).toISOString(),
              }
            } else {
              throw err
            }
          } else {
            throw err
          }
        }
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
      } else if (path === '/workers/generate-token') {
        result = await handlers.generateWorkerToken({ tenantId: TENANT, engineUrl: `http://localhost:${PORT}` })
      } else if (path === '/workflows/heartbeat') {
        result = await handlers.heartbeat({ ...body, tenantId: TENANT })
      } else if (path === '/workflows/validate') {
        result = await handlers.validateDefinition(body)
      } else if (path === '/health') {
        // Verify ingest queue has an active worker — prevents silent accept-and-stall
        const ingestQueue = connector.getQueue('workflow_ingest')
        const workers = await ingestQueue.getWorkers()
        const depth = ingestBuffer.currentDepth()
        const workerOk = workers.length > 0
        if (!workerOk) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, reason: 'no ingest worker registered', ingestBufferDepth: depth }))
          return
        }
        result = { ok: true, ingestWorkers: workers.length, ingestBufferDepth: depth }
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err: any) {
      const status = err.code === 'IDEMPOTENCY_CONFLICT' ? 409
        : err.code === 'WORKFLOW_RUN_NOT_FOUND' ? 404
        : 500
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
    console.log(`\n🛑 [${label}] Shutting down...`)
    server.close()
    await ingestBuffer.shutdown()
    await ingestWorker.drain()
    await workerHandle.stop()
    await connector.close()
    await engine.shutdown()
    await db.destroy()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// ── Entrypoint: cluster primary vs worker ─────────────────────────────
async function runPrimary() {
  const cores = (os as any).availableParallelism?.() ?? os.cpus().length
  const n = desiredClusterWorkers()
  console.log(`🧠 Primary pid=${process.pid} detected ${cores} CPU cores`)
  console.log(`   CLUSTER_MODE=${process.env.CLUSTER_MODE ?? 'auto'} → forking ${n} worker${n === 1 ? '' : 's'}`)

  // External-services mode: when PG_HOST and REDIS_HOST are pre-set
  // (Docker Compose, Cloud Run, k8s) we skip starting testcontainers.
  // Required env: PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD, REDIS_HOST, REDIS_PORT.
  const externalServices = !!(process.env.PG_HOST && process.env.REDIS_HOST)
  if (externalServices) {
    console.log(`   🌐 External services: PG ${process.env.PG_HOST}:${process.env.PG_PORT}, Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`)
  }

  if (n === 1) {
    // Single-process mode
    if (!externalServices) {
      const c = await startContainers()
      process.env.PG_HOST = c.pgHost
      process.env.PG_PORT = String(c.pgPort)
      process.env.PG_DB = c.pgDb
      process.env.PG_USER = c.pgUser
      process.env.PG_PASSWORD = c.pgPass
      process.env.REDIS_HOST = c.redisHost
      process.env.REDIS_PORT = String(c.redisPort)
      const cleanup = async () => {
        try { await c.redisContainer.stop(); await c.pgContainer.stop() } catch {}
        process.exit(0)
      }
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)
    }
    await main()
    return
  }

  // Multi-worker cluster: only start containers when running locally
  let containerEnv: Record<string, string>
  let cleanupContainers: (() => Promise<void>) | null = null
  if (externalServices) {
    containerEnv = {
      PG_HOST: process.env.PG_HOST!,
      PG_PORT: process.env.PG_PORT ?? '5432',
      PG_DB: process.env.PG_DB ?? 'agents',
      PG_USER: process.env.PG_USER ?? 'postgres',
      PG_PASSWORD: process.env.PG_PASSWORD ?? '',
      REDIS_HOST: process.env.REDIS_HOST!,
      REDIS_PORT: process.env.REDIS_PORT ?? '6379',
    }
  } else {
    const c = await startContainers()
    containerEnv = {
      PG_HOST: c.pgHost,
      PG_PORT: String(c.pgPort),
      PG_DB: c.pgDb,
      PG_USER: c.pgUser,
      PG_PASSWORD: c.pgPass,
      REDIS_HOST: c.redisHost,
      REDIS_PORT: String(c.redisPort),
    }
    cleanupContainers = async () => {
      try { await c.redisContainer.stop(); await c.pgContainer.stop() } catch {}
    }
    console.log(`   📦 Containers ready: PG ${c.pgHost}:${c.pgPort}, Redis ${c.redisHost}:${c.redisPort}`)
  }

  for (let i = 0; i < n; i++) {
    cluster.fork({ ...containerEnv, CLUSTER_WORKER_ID: String(i) })
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`   ⚠️  Worker ${worker.id} (pid=${worker.process.pid}) exited code=${code} signal=${signal}`)
    if (!(worker as any).exitedAfterDisconnect) {
      const newWorker = cluster.fork(containerEnv)
      console.log(`   🔁 Re-forked replacement worker pid=${newWorker.process.pid}`)
    }
  })

  const shutdownPrimary = async () => {
    console.log('\n🛑 Primary: shutting down cluster...')
    for (const w of Object.values(cluster.workers ?? {})) w?.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 3000))
    if (cleanupContainers) await cleanupContainers()
    process.exit(0)
  }
  process.on('SIGINT', shutdownPrimary)
  process.on('SIGTERM', shutdownPrimary)
}

if (cluster.isPrimary) {
  runPrimary().catch(err => { console.error('Primary fatal:', err); process.exit(1) })
} else {
  main().catch(err => { console.error('Worker fatal:', err); process.exit(1) })
}
