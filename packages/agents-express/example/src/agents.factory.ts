// Agent engine factory — single-tenant for example simplicity.
//
// In a real multi-tenant app, replace the singleton with an LRU+TTL cache
// keyed by tenantId (mirror your better-auth.factory.ts shape).

import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { RedisRealtimeBroker } from '@goatlab/realtime-broker'
import {
  WorkflowEngine,
  WorkflowStepTask,
  WorkflowBuilder,
  FunctionStepExecutor,
  IngestBuffer,
  IngestWorker,
  EventIngestionService,
  type Database as AgentsDB,
  type StepPayload,
  type StepResult,
} from '@goatlab/agents-core'

const TENANT_ID    = process.env.TENANT_ID    ?? 'demo-tenant'
const POOL_SIZE    = parseInt(process.env.PG_POOL_SIZE    ?? '20', 10)
const WORKER_CONC  = parseInt(process.env.WORKER_CONCURRENCY ?? '50', 10)

let cached: Promise<{
  engine: WorkflowEngine
  ingestBuffer: IngestBuffer
  pool: pg.Pool
  connector: BullMQConnector
  broker: RedisRealtimeBroker
}> | null = null

export async function getAgents() {
  if (cached) return cached
  cached = (async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env required')

    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: POOL_SIZE,
      idleTimeoutMillis: 30_000,
    })
    const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) })

    const connector = new BullMQConnector({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null,
      },
      tenantId: TENANT_ID,
    })

    // Realtime broker — same Redis as BullMQ (separate connection due to
    // pub/sub mode). Per-tenant subscriber pooling: 1 conn per tenant
    // regardless of how many SSE clients connect.
    const broker = new RedisRealtimeBroker({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null,
      },
    })

    // Step handlers — register your business logic here
    const executor = new FunctionStepExecutor()
    executor.register('echo', async (p: StepPayload): Promise<StepResult> => ({
      output: { echoed: true, step: p.stepName, ts: Date.now() },
    }))
    executor.register('chain', async (p: StepPayload): Promise<StepResult> => ({
      output: { chained: true, input: p.input, ts: Date.now() },
    }))

    // Workflow definitions
    const fastSingle = WorkflowBuilder.create('fast_single')
      .version('1.0.0').defaultRetries(0)
      .step('work', { executorType: 'function', executorConfig: { handler: 'echo' } })
      .build()

    const fastChain = WorkflowBuilder.create('fast_chain')
      .version('1.0.0').defaultRetries(0)
      .step('a', { executorType: 'function', executorConfig: { handler: 'chain' } })
      .step('b', { dependsOn: ['a'], executorType: 'function', executorConfig: { handler: 'chain' }, mapInput: u => ({ from: u.a }) })
      .step('c', { dependsOn: ['b'], executorType: 'function', executorConfig: { handler: 'chain' }, mapInput: u => ({ from: u.b }) })
      .build()

    const engine = new WorkflowEngine({
      db,
      pgPool: pool,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([
        ['fast_single', fastSingle],
        ['fast_chain', fastChain],
      ]),
      tenantId: TENANT_ID,
      schema: 'agents',                          // engine tables live in the `agents` PG schema
      eventIngestion: new EventIngestionService({ db }),
      // Engine event hook → broker: SSE subscribers see live workflow updates.
      // Fires AFTER each PG state-transition write commits — subscribers can
      // immediately query PG and see the new state.
      onEngineEvent: (evt) => {
        // Per-run channel for granular subscriptions
        broker.publish(evt.tenantId, `engine:run:${evt.runId}`, evt).catch(() => {})
        // Tenant-wide firehose for dashboards
        broker.publish(evt.tenantId, `engine:tenant`, evt).catch(() => {})
      },
    })

    const ingestWorker = new IngestWorker({
      engine,
      flushThreshold: 200,
      flushIntervalMs: 20,
      maxConcurrentFlushes: 8,
    })
    const ingestBuffer = new IngestBuffer({
      // Backend-agnostic: TaskConnector.bulkQueue is used when the adapter
      // implements it (BullMQ does, via addBulk). Falls back to a queue()
      // loop for adapters that don't.
      connector,
      taskName: 'workflow_ingest',
      flushThreshold: 200,
      flushIntervalMs: 50,
      maxJitterMs: 20,
    })

    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(connector)

    await connector.listen({
      tasks: [
        // Ingest concurrency must be ≥ ingestWorker.flushThreshold so batches
        // can fill (BullMQ caps in-flight handlers at concurrency).
        { taskName: 'workflow_ingest',         handle: (d: unknown) => ingestWorker.handleJob(d as any), concurrency: 300 },
        { taskName: 'workflow_step_light',     handle: (d: unknown) => stepTask.handle(d as StepPayload), concurrency: WORKER_CONC },
        { taskName: 'workflow_step_heavy',     handle: (d: unknown) => stepTask.handle(d as StepPayload), concurrency: Math.max(5, WORKER_CONC / 4) },
        { taskName: 'workflow_step_ai',        handle: (d: unknown) => stepTask.handle(d as StepPayload), concurrency: Math.max(10, WORKER_CONC / 2) },
        { taskName: 'workflow_step_sandbox',   handle: (d: unknown) => stepTask.handle(d as StepPayload), concurrency: 5 },
      ],
    })

    return { engine, ingestBuffer, pool, connector, broker }
  })()
  return cached
}

export async function shutdownAgents() {
  if (!cached) return
  const { engine, ingestBuffer, pool, connector, broker } = await cached
  await ingestBuffer.shutdown()
  await engine.shutdown()
  await broker.close()
  await connector.close()
  await pool.end()
  cached = null
}
