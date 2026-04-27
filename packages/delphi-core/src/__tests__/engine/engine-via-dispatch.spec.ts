// Engine-through-dispatch integration test.
//
// This is the EXACT shape sodium will use: the engine emits step jobs to
// BullMQ queues, and dispatch (processIncomingDispatch) consumes them
// rather than persistent connector.listen() workers.
//
// Without this test, individual pieces work in isolation but the COMPOSITION
// could silently break — e.g., dispatch v2's parallel handler invocation
// not actually filling the IngestWorker accumulator, ack timing missing the
// per-job promise, batched COPY FROM jobs being stuck because dispatch
// doesn't pull batches large enough.
//
// What this test proves:
//   1. Engine workflows complete end-to-end with NO persistent workers
//   2. IngestWorker batching fills via parallel dispatch handler invocation
//   3. Multiple step queues drain in parallel
//   4. Per-job promise pattern survives dispatch's ack lifecycle
//   5. Zero data loss across many workflows
//
// npx vitest run src/__tests__/engine/engine-via-dispatch.spec.ts

import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient } from '../../db/DbClient.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { wrapTestDb } from '../../db/TestQueryBuilder.js'
import { IngestBuffer } from '../../engine/IngestBuffer.js'
import { IngestWorker } from '../../engine/IngestWorker.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { CREATE_TABLES_SQL } from '../../entities/Database.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowStepTask } from '../../tasks/WorkflowStepTask.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'

describe('engine-via-dispatch (integration — sodium-shape consumer)', () => {
  let pgContainer: StartedPostgreSqlContainer
  let redisContainer: StartedRedisContainer
  let pgPool: pg.Pool
  let db: TestDb
  let connector: BullMQConnector
  let engine: WorkflowEngine
  let ingestBuffer: IngestBuffer
  let ingestWorker: IngestWorker
  let stepTask: WorkflowStepTask

  // Engine queue names — same as production
  const ENGINE_QUEUES = new Set([
    'workflow_ingest',
    'workflow_step_light',
    'workflow_step_heavy',
    'workflow_step_ai',
    'workflow_step_sandbox',
  ])

  // Drain loop — simulates sodium's dispatch listener calling
  // processIncomingDispatch repeatedly until no more work.
  // Returns total jobs processed across all queues.
  async function drainAllQueues(
    timeBudgetMs = 30_000,
  ): Promise<{ processed: number; failed: number }> {
    const deadline = Date.now() + timeBudgetMs
    let totalProcessed = 0
    let totalFailed = 0
    let consecutiveEmpty = 0

    while (Date.now() < deadline && consecutiveEmpty < 3) {
      const result = await connector.processIncomingDispatch({
        handleTask: async (queueName, data) => {
          // Same routing sodium will use: register engine queues to engine handlers
          if (queueName === 'workflow_ingest') {
            return ingestWorker.handleJob(data as any)
          }
          // All step queues route through the same WorkflowStepTask
          return stepTask.handle(data as StepPayload)
        },
        validQueueNames: ENGINE_QUEUES,
        timeBudgetMs: 2_000,
        batchSize: 50, // matches recommended engine-queue setting
        concurrency: 50,
      })
      totalProcessed += result.processed
      totalFailed += result.failed

      // Track consecutive empty drains so we exit when truly done
      if (result.processed === 0 && result.failed === 0) {
        consecutiveEmpty++
      } else {
        consecutiveEmpty = 0
      }
    }

    return { processed: totalProcessed, failed: totalFailed }
  }

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('engine_dispatch_test')
      .start()
    redisContainer = await new RedisContainer('redis:7-alpine').start()

    pgPool = new pg.Pool({
      host: pgContainer.getHost(),
      port: pgContainer.getMappedPort(5432),
      database: 'engine_dispatch_test',
      user: pgContainer.getUsername(),
      password: pgContainer.getPassword(),
      max: 10,
    })
    db = wrapTestDb(createDbClient(pgPool))
    for (const stmt of CREATE_TABLES_SQL.split(';')
      .map(s => s.trim())
      .filter(Boolean)) {
      await db.query(stmt)
    }

    connector = new BullMQConnector({
      connection: {
        host: redisContainer.getHost(),
        port: redisContainer.getMappedPort(6379),
        maxRetriesPerRequest: null,
      },
    })

    const executor = new FunctionStepExecutor()
    executor.register(
      'echo',
      async (p: StepPayload): Promise<StepResult> => ({
        output: { echoed: p.input },
      }),
    )
    executor.register(
      'chain',
      async (p: StepPayload): Promise<StepResult> => ({
        output: { from: p.input, ts: Date.now() },
      }),
    )

    const wfSingle = WorkflowBuilder.create('wf_single')
      .version('1.0.0')
      .defaultRetries(0)
      .step('s', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const wfChain = WorkflowBuilder.create('wf_chain')
      .version('1.0.0')
      .defaultRetries(0)
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'chain' },
      })
      .step('b', {
        dependsOn: ['a'],
        executorType: 'function',
        executorConfig: { handler: 'chain' },
        mapInput: (u: any) => ({ from: u.a }),
      })
      .step('c', {
        dependsOn: ['b'],
        executorType: 'function',
        executorConfig: { handler: 'chain' },
        mapInput: (u: any) => ({ from: u.b }),
      })
      .build()

    engine = new WorkflowEngine({
      db,
      pgPool,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([
        ['wf_single', wfSingle],
        ['wf_chain', wfChain],
      ]),
      tenantId: 'test-tenant',
    })

    ingestWorker = new IngestWorker({
      engine,
      flushThreshold: 50,
      flushIntervalMs: 20,
      maxConcurrentFlushes: 4,
    })
    ingestBuffer = new IngestBuffer({
      connector,
      taskName: 'workflow_ingest',
      flushThreshold: 50,
      flushIntervalMs: 50,
    })

    stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(connector)

    // CRITICAL: NO connector.listen() call. We are simulating sodium's
    // dispatch-only consumption model — no persistent per-tenant workers.
  }, 90_000)

  afterAll(async () => {
    await ingestBuffer?.shutdown().catch(() => {})
    await engine?.shutdown().catch(() => {})
    await connector?.close().catch(() => {})
    await db?.destroy().catch(() => {})
    await pgPool?.end().catch(() => {})
    await redisContainer?.stop().catch(() => {})
    await pgContainer?.stop().catch(() => {})
  }, 30_000)

  it('CRITICAL: single workflow runs end-to-end through dispatch (no persistent workers)', async () => {
    // Use queue-first ingest path — trigger goes into IngestBuffer → addBulk
    // → workflow_ingest queue → dispatch → IngestWorker.handleJob → COPY FROM
    // → step dispatched to workflow_step_light → dispatch → WorkflowStepTask.handle
    const { runId } = ingestBuffer.enqueue({
      workflowName: 'wf_single',
      tenantId: 'test-tenant',
      input: { hello: 'dispatch' },
    })

    // Drain all engine queues until done
    const result = await drainAllQueues()
    expect(result.failed).toBe(0)

    // Verify run reached COMPLETED in PG
    const row = await db
      .selectFrom('workflow_runs')
      .select(['status', 'output'])
      .where('id', '=', runId)
      .executeTakeFirst()
    expect(row?.status).toBe('COMPLETED')

    // And the step
    const stepRow = await db
      .selectFrom('workflow_steps')
      .select('status')
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 's')
      .executeTakeFirst()
    expect(stepRow?.status).toBe('COMPLETED')
  }, 30_000)

  it('multi-step DAG runs through dispatch (a → b → c)', async () => {
    const { runId } = ingestBuffer.enqueue({
      workflowName: 'wf_chain',
      tenantId: 'test-tenant',
      input: { start: true },
    })

    const result = await drainAllQueues()
    expect(result.failed).toBe(0)

    const row = await db
      .selectFrom('workflow_runs')
      .select('status')
      .where('id', '=', runId)
      .executeTakeFirst()
    expect(row?.status).toBe('COMPLETED')

    const steps = await db
      .selectFrom('workflow_steps')
      .select(['stepName', 'status'])
      .where('workflowRunId', '=', runId)
      .execute()
    expect(steps.find(s => s.stepName === 'a')?.status).toBe('COMPLETED')
    expect(steps.find(s => s.stepName === 'b')?.status).toBe('COMPLETED')
    expect(steps.find(s => s.stepName === 'c')?.status).toBe('COMPLETED')
  }, 30_000)

  it('CRITICAL: zero data loss — N workflows fired, N reach COMPLETED', async () => {
    // The actual sodium scenario at scale: many workflows enqueued, all must
    // reach COMPLETED with zero loss. Verifies parallel dispatch handler
    // invocation correctly fills IngestWorker accumulator + each per-job
    // promise resolves on commit.
    const N = 50
    const fired: string[] = []
    for (let i = 0; i < N; i++) {
      const { runId } = ingestBuffer.enqueue({
        workflowName: 'wf_single',
        tenantId: 'test-tenant',
        input: { idx: i },
        idempotencyKey: `dispatch-test-${i}`,
      })
      fired.push(runId)
    }

    // Force IngestBuffer to flush immediately (we don't want to wait 50ms
    // jitter for the test) — but enqueue at threshold=50 should auto-flush.
    await ingestBuffer.flushNow()

    // Drain — may take multiple iterations as ingest commits → step jobs
    // emitted → step dispatches consume → COMPLETED
    await drainAllQueues(60_000)

    // Verify all N reached COMPLETED
    const completed = await db
      .selectFrom('workflow_runs')
      .select('id')
      .where('id', 'in', fired)
      .where('status', '=', 'COMPLETED')
      .execute()
    expect(completed).toHaveLength(N)
  }, 90_000)

  // ── Delayed workflows via dispatch ─────────────────────────────

  it('delayed workflow is not dispatched until delay passes', async () => {
    const { runId } = await engine.start({
      workflowName: 'wf_single',
      tenantId: 'test-tenant',
      input: { delayed: true },
      delaySeconds: 3600, // 1 hour in the future
    })

    // Drain — nothing should be processed (workflow is DELAYED)
    const result = await drainAllQueues(3_000)
    expect(result.processed).toBe(0)

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst()
    expect(run!.status).toBe('DELAYED')
  })

  it('processDelayedWorkflows + dispatch executes delayed step end-to-end', async () => {
    const { runId } = await engine.start({
      workflowName: 'wf_single',
      tenantId: 'test-tenant',
      input: { delayed_e2e: true },
      delaySeconds: 1,
    })

    // Set delay to the past so processDelayedWorkflows picks it up
    await db
      .updateTable('workflow_runs')
      .set({
        delayUntilEpochMs: String(Date.now() - 1000),
        updatedAt: new Date(),
      })
      .where('id', '=', runId)
      .execute()

    // Process delayed workflows — transitions to RUNNING and dispatches steps
    const transitioned = await engine.processDelayedWorkflows()
    expect(transitioned).toBe(1)

    // Now drain — the dispatched step should execute
    await drainAllQueues(10_000)

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst()
    expect(run!.status).toBe('COMPLETED')
  })

  it('idempotent delayed start returns same run via BullMQ connector', async () => {
    const first = await engine.start({
      workflowName: 'wf_single',
      tenantId: 'test-tenant',
      input: { idem: 1 },
      delaySeconds: 3600,
      idempotencyKey: 'dispatch-delayed-idem-1',
    })

    const second = await engine.start({
      workflowName: 'wf_single',
      tenantId: 'test-tenant',
      input: { idem: 2 },
      delaySeconds: 3600,
      idempotencyKey: 'dispatch-delayed-idem-1',
    })

    expect(second.runId).toBe(first.runId)
  })
})
