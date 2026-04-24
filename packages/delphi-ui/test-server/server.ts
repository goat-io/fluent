#!/usr/bin/env tsx
/**
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  ⚠  NOT FOR PRODUCTION — TEST HARNESS ONLY                                │
 * ├───────────────────────────────────────────────────────────────────────────┤
 * │  This file exists to drive Playwright E2E tests and k6 load tests against │
 * │  a real engine + Postgres + Redis + BullMQ. It is INTENTIONALLY missing   │
 * │  every safety control a real deployment needs:                            │
 * │                                                                           │
 * │    • NO authentication       (no bearer token, no API key, no session)    │
 * │    • Hardcoded tenant        (TENANT='e2e-ui-tenant', no isolation)       │
 * │    • Open CORS               (Access-Control-Allow-Origin: *)             │
 * │    • Open admin endpoints    (/workers/generate-token mints worker        │
 * │                               tokens for ANYONE who can hit the port)     │
 * │    • No rate limiting        (a single client can saturate the engine)    │
 * │    • No input validation     (req.body flows raw into engine handlers)    │
 * │    • Test-friendly PG knobs  (full prod tuning lives in startContainers)  │
 * │                                                                           │
 * │  DO NOT copy this file into a production deployment. For the production   │
 * │  shape, use library mode (call the engine in-process inside your already- │
 * │  authenticated handlers — see packages/delphi-core/README.md "Library vs  │
 * │  service mode") or @goatlab/delphi-express with auth middleware mounted   │
 * │  in front (see that package's README "Security model" section).           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Starts: Postgres (testcontainer) + Redis (testcontainer) + HTTP API + BullMQ workers
 *
 * Usage: npx tsx test-server/server.ts
 *
 * Env vars for tuning:
 *   PG_POOL_SIZE=50      Postgres connection pool size
 *   WORKER_CONCURRENCY=50  BullMQ worker concurrency per queue
 *   DISABLE_LOG_BUFFER=false  Set to 'true' for synchronous log writes
 *   CLUSTER_MODE=auto|off|<N>  Number of cluster workers (default auto = cores-1)
 *   DISPATCH_MODE=redis|pg    Dispatch backend (default: redis). Set to 'pg' for
 *                             Postgres-only mode — skips Redis, uses PgConnector.
 */
import http from 'node:http'
import cluster from 'node:cluster'
import os from 'node:os'
import pg from 'pg'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import {
  FunctionStep,
  Workflow,
  step,
  createEngine,
  createDbClient,
  WorkflowStepTask,
  createWorkflowHandlers,
  CREATE_TABLES_SQL,
  EventIngestionService,
  IngestWorker,
  PgConnector,
  runMigrations,
} from '@goatlab/delphi-core'
import type { DbClient, JsonObject, TypedStepResult } from '@goatlab/delphi-core'

const PORT = parseInt(process.env.PORT ?? '4444', 10)
const TENANT = 'e2e-ui-tenant'
const PG_POOL_SIZE = parseInt(process.env.PG_POOL_SIZE ?? '20', 10)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '50', 10)
const DISABLE_LOG_BUFFER = process.env.DISABLE_LOG_BUFFER === 'true'
const DISPATCH_MODE = process.env.DISPATCH_MODE ?? 'redis' // 'redis' | 'pg'

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
  console.log('  📦 Starting Postgres (production-like: fsync=on, synchronous_commit=on)...')
  // Production-like PG config: fsync ON, synchronous_commit ON, full_page_writes ON.
  // This makes the durability story honest — the 'committed' path actually waits
  // for WAL fsync, and the buffered path's downstream IngestWorker COPY FROM does
  // too. Buffered HTTP latency is unaffected (HTTP returns before the COPY runs)
  // but ingest drain rate is. wal_level=minimal / max_wal_senders=0 kept — no
  // replicas in this harness, and minimal WAL is valid for single-primary prod.
  const pgContainer = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('agents_e2e_ui')
    .withCommand([
      'postgres',
      '-c', 'max_connections=200',
      '-c', 'shared_buffers=256MB',
      '-c', 'work_mem=16MB',
      '-c', 'wal_level=minimal',
      '-c', 'max_wal_senders=0',
    ])
    .start()
  let redisContainer: any = null
  let redisHost = ''
  let redisPort = 0
  if (DISPATCH_MODE !== 'pg') {
    console.log('  📦 Starting Redis...')
    redisContainer = await new RedisContainer('redis:7-alpine').start()
    redisHost = redisContainer.getHost()
    redisPort = redisContainer.getMappedPort(6379)
  } else {
    console.log('  ⚡ PG-only mode — skipping Redis')
  }
  return {
    pgHost: pgContainer.getHost(),
    pgPort: pgContainer.getMappedPort(5432),
    pgDb: 'agents_e2e_ui',
    pgUser: pgContainer.getUsername(),
    pgPass: pgContainer.getPassword(),
    redisHost,
    redisPort,
    pgContainer,
    redisContainer,
  }
}

async function main() {
  const workerId = process.env.CLUSTER_WORKER_ID ?? '0'
  const label = cluster.isPrimary ? 'single' : `w${workerId}`
  console.log(`🚀 [${label}] Starting test backend on pid=${process.pid}`)
  console.log(`   PG pool: ${PG_POOL_SIZE}, Worker concurrency: ${WORKER_CONCURRENCY}, Log buffer: ${!DISABLE_LOG_BUFFER}`)

  // ── Database ─────────────────────────────────────────
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
  const db = createDbClient(pgPool)

  // Only one worker initializes schema; others wait on an advisory lock.
  await db.query('SELECT pg_advisory_lock(4242)')
  try {
    const statements = CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await db.query(stmt)
    }
    await runMigrations(db)
  } finally {
    await db.query('SELECT pg_advisory_unlock(4242)')
  }
  console.log(`  ✅ [${label}] Database ready (dispatch: ${DISPATCH_MODE})`)

  // ── Dispatch connector ──────────────────────────────
  const connector = DISPATCH_MODE === 'pg'
    ? new PgConnector({
        db,
        pgPool,
        pollingIntervalMs: 50,
        maxPollingIntervalMs: 500,
      })
    : new BullMQConnector({
        connection: {
          host: process.env.REDIS_HOST!,
          port: parseInt(process.env.REDIS_PORT!, 10),
          maxRetriesPerRequest: null,
        },
      })

  // ── Workflow steps (class-based — no string handler refs) ─────
  // Each step declares TInput / TOutput / TName generics. Workflow classes
  // reference these instances directly; createEngine() auto-registers each
  // handler under a namespaced key. This is the same pattern sodium uses
  // for `ShouldQueue` task classes.

  class FastEchoStep extends FunctionStep<JsonObject, { echoed: boolean; step: string; ts: number }> {
    stepName = 'work' as const
    retries = 0
    async handle(_input, _ctx) {
      return { output: { echoed: true, step: this.stepName, ts: Date.now() } }
    }
  }

  class ChargeStep extends FunctionStep<JsonObject, { charged: boolean; ts: number }> {
    stepName = 'charge' as const
    retries = 0
    async handle(_input, _ctx) {
      return { output: { charged: true, ts: Date.now() } }
    }
  }

  class ChainAStep extends FunctionStep<JsonObject, { chained: boolean; at: 'a'; ts: number }> {
    stepName = 'a' as const
    retries = 0
    async handle(input) {
      return { output: { chained: true, at: 'a' as const, ts: Date.now() } }
    }
  }
  class ChainBStep extends FunctionStep<{ from: unknown }, { chained: boolean; at: 'b'; ts: number }> {
    stepName = 'b' as const
    retries = 0
    async handle(input) {
      return { output: { chained: true, at: 'b' as const, ts: Date.now() } }
    }
  }
  class ChainCStep extends FunctionStep<{ from: unknown }, { chained: boolean; at: 'c'; ts: number }> {
    stepName = 'c' as const
    retries = 0
    async handle(input) {
      return { output: { chained: true, at: 'c' as const, ts: Date.now() } }
    }
  }

  // Demo pipeline steps — realistic delays + human-in-the-loop
  class AnalyzeStep extends FunctionStep<JsonObject, { analysis: string; confidence: number; requirements: string[] }> {
    stepName = 'analyze' as const
    async handle(_input) {
      await new Promise(r => setTimeout(r, 500))
      return { output: { analysis: 'Feature looks viable', confidence: 0.9, requirements: ['auth', 'dashboard'] } }
    }
  }
  class PlanStep extends FunctionStep<{ analysis: unknown }, { tasks: { name: string }[]; approved: boolean }> {
    stepName = 'plan' as const
    async handle(_input) {
      await new Promise(r => setTimeout(r, 300))
      return { output: { tasks: [{ name: 'Create API' }, { name: 'Build UI' }, { name: 'Write tests' }], approved: true } }
    }
  }
  class ImplementStep extends FunctionStep<{ plan: unknown }, { filesCreated: number; linesOfCode: number; branch: string }> {
    stepName = 'implement' as const
    async handle(_input) {
      await new Promise(r => setTimeout(r, 800))
      return { output: { filesCreated: 5, linesOfCode: 250, branch: 'feat/new-feature' } }
    }
  }
  class ReviewStep extends FunctionStep<JsonObject, { reviewStarted: boolean }> {
    stepName = 'review' as const
    async handle(_input): Promise<TypedStepResult<{ reviewStarted: boolean }>> {
      return {
        output: { reviewStarted: true },
        waitForHuman: {
          prompt: 'Please review the implementation and approve or reject.',
          schema: { type: 'object', properties: { approved: { type: 'boolean' }, comment: { type: 'string' } } },
        },
      }
    }
  }
  class DeployStep extends FunctionStep<JsonObject, { deployed: boolean; url: string; version: string }> {
    stepName = 'deploy' as const
    async handle(_input) {
      await new Promise(r => setTimeout(r, 400))
      return { output: { deployed: true, url: 'https://app.example.com', version: '1.0.0' } }
    }
  }

  // Singleton step instances — workflows reference these directly.
  const fastEchoStep = new FastEchoStep()
  const chargeStep = new ChargeStep()
  const chainA = new ChainAStep(), chainB = new ChainBStep(), chainC = new ChainCStep()
  const analyze = new AnalyzeStep(), plan = new PlanStep(), implement = new ImplementStep()
  const review = new ReviewStep(), deploy = new DeployStep()

  // ── Workflows (class-based) ──────────────────────────

  class FastSingleWorkflow extends Workflow<JsonObject> {
    workflowName = 'fast_single' as const
    override defaultRetries = 0
    steps = [step(fastEchoStep)] as const
  }

  // Payment-critical: durability='committed' — HTTP blocks until PG COMMIT.
  // Used by loadtest/k6-workflow-committed.js to measure the committed path.
  class PaymentCriticalWorkflow extends Workflow<{ amountCents?: number; ts?: number }> {
    workflowName = 'payment_critical' as const
    override durability = 'committed' as const
    override defaultRetries = 0
    steps = [step(chargeStep)] as const
  }

  class FastChainWorkflow extends Workflow<JsonObject> {
    workflowName = 'fast_chain' as const
    override defaultRetries = 0
    steps = [
      step(chainA),
      step(chainB, { dependsOn: [chainA], mapInput: (up) => ({ from: up.a }) }),
      step(chainC, { dependsOn: [chainB], mapInput: (up) => ({ from: up.b }) }),
    ] as const
  }

  // Demo pipeline (realistic delays + human-in-the-loop)
  class DemoPipelineWorkflow extends Workflow<JsonObject> {
    workflowName = 'demo_pipeline' as const
    override defaultRetries = 2
    steps = [
      step(analyze),
      step(plan, { dependsOn: [analyze], mapInput: (up) => ({ analysis: up.analyze }) }),
      step(implement, { dependsOn: [plan], mapInput: (up) => ({ plan: up.plan }) }),
      step(review, { dependsOn: [implement] }),
      step(deploy, { dependsOn: [review] }),
    ] as const
  }

  // ── Event Ingestion ──────────────────────────────────
  const eventService = new EventIngestionService({ db })

  // ── Engine (typed proxy — engine.<workflowName>.start(…) surface) ─────
  const engine = createEngine({
    workflows: [
      new FastSingleWorkflow(),
      new PaymentCriticalWorkflow(),
      new FastChainWorkflow(),
      new DemoPipelineWorkflow(),
    ] as const,
    database: pgPool,
    connector,
    tenantId: TENANT,
    disableLogBuffering: DISABLE_LOG_BUFFER,
    eventIngestion: eventService,
    ingest: {
      flushThreshold: 200,
      flushIntervalMs: 50,
      maxJitterMs: 20,
      committedFlushThreshold: 100,
      committedFlushIntervalMs: 20,
      committedMaxConcurrentFlushes: Math.max(2, Math.floor(PG_POOL_SIZE / 4)),
    },
  })
  const ingestBuffer = engine.ingestBuffer

  // ── BullMQ step-task consumer (same for all workflows) ─────────
  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)

  // Worker-side ingest consumer: BullMQ → IngestWorker → COPY FROM → PG
  // (the buffered path's downstream drain; committed path bypasses BullMQ)
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
        // Dispatch by workflow.durability:
        //  - 'committed' (e.g. payment_critical) → block until PG COMMIT via
        //    enqueueCommitted() — batched COPY FROM from the HTTP process.
        //  - 'buffered' or unset → return as soon as the trigger hits memory
        //    (fast path: ~1-2ms, PG write happens downstream in IngestWorker).
        const trigger = { ...body, tenantId: TENANT }
        const def = engine.getWorkflows().get(trigger.workflowName)
        if (def?.durability === 'committed') {
          const { runId, traceId } = await ingestBuffer.enqueueCommitted(trigger)
          result = { runId, traceId, status: 'COMMITTED' }
        } else {
          const { runId, traceId } = ingestBuffer.enqueue(trigger)
          result = { runId, traceId, status: 'QUEUED' }
        }
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
    console.log(`   Workflows: demo_pipeline (5 steps), fast_single (1 step), fast_chain (3 steps), payment_critical (1 step, committed)`)
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
