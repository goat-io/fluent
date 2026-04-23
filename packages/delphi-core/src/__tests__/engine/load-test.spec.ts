// npx vitest run src/__tests__/engine/load-test.spec.ts
//
// Load tests — real Postgres + Redis + BullMQ.
// Exercises the system under concurrent pressure to find:
//   - Race conditions
//   - Deadlocks
//   - Idempotency failures
//   - Performance bottlenecks
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { ExternalActionExecutor } from '../../engine/ExternalActionExecutor.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { WorkflowMetricsCollector } from '../../engine/WorkflowMetrics.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowStepTask } from '../../tasks/WorkflowStepTask.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

interface GlobalTestData {
  redis: { host: string; port: number }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  )
}

describe('Load Tests — Real Infrastructure', () => {
  let db: TestDb
  let connector: BullMQConnector
  let stopWorker: (() => Promise<void>) | null = null

  beforeAll(async () => {
    db = await getSharedDb()
    const data = getGlobalData()
    connector = new BullMQConnector({
      connection: { host: data.redis.host, port: data.redis.port },
    })
  })

  afterAll(async () => {
    if (stopWorker) {
      await stopWorker()
    }
    await connector.close()
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    if (stopWorker) {
      await stopWorker()
      stopWorker = null
    }
  })

  async function setupEngine(
    executor: FunctionStepExecutor,
    workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    opts?: { maxConcurrentStepsPerWorkflow?: number },
  ) {
    const workflowMap = new Map(workflows.map(w => [w.name, w]))

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: workflowMap,
      tenantId: 'load-test',
      disableLogBuffering: true,
      maxConcurrentStepsPerWorkflow: opts?.maxConcurrentStepsPerWorkflow,
    })

    const stepTask = new WorkflowStepTask(engine)
    ;(stepTask as any).connector = connector

    const handle = await connector.listen({
      tasks: [
        {
          taskName: 'workflow_step_light',
          handle: (d: unknown) => stepTask.handle(d as StepPayload),
          concurrency: 20,
        },
        {
          taskName: 'workflow_step_heavy',
          handle: (d: unknown) => stepTask.handle(d as StepPayload),
          concurrency: 5,
        },
        {
          taskName: 'workflow_step_ai',
          handle: (d: unknown) => stepTask.handle(d as StepPayload),
          concurrency: 10,
        },
        {
          taskName: 'workflow_step_sandbox',
          handle: (d: unknown) => stepTask.handle(d as StepPayload),
          concurrency: 3,
        },
      ],
    })
    stopWorker = handle.stop
    await new Promise(r => setTimeout(r, 1000))

    return engine
  }

  async function waitForStatus(
    engine: WorkflowEngine,
    runId: string,
    targets: string[],
    timeoutMs = 30_000,
  ): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const status = await engine.getStatus(runId, 'load-test')
      if (targets.includes(status.status)) {
        return status.status
      }
      await new Promise(r => setTimeout(r, 200))
    }
    const final = await engine.getStatus(runId, 'load-test')
    throw new Error(
      `Workflow ${runId} did not reach ${targets.join('|')} within ${timeoutMs}ms. ` +
        `Current: ${final.status}, steps: ${final.steps.map(s => `${s.stepName}=${s.status}`).join(', ')}`,
    )
  }

  // ── Test 1: Concurrent Workflow Starts ──────────────────────────

  it('handles 50 concurrent workflow starts without conflicts', async () => {
    const executor = new FunctionStepExecutor()
    executor.register(
      'fast',
      async (): Promise<StepResult> => ({
        output: { done: true, ts: Date.now() },
      }),
    )

    const wf = WorkflowBuilder.create('load_concurrent')
      .step('work', {
        executorType: 'function',
        executorConfig: { handler: 'fast' },
      })
      .build()

    const engine = await setupEngine(executor, [wf])

    const COUNT = 50
    const startTime = Date.now()

    // Fire 50 workflow starts in parallel
    const results = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        engine.start({
          workflowName: 'load_concurrent',
          tenantId: 'load-test',
          input: { index: i },
        }),
      ),
    )

    // All should get unique runIds
    const runIds = results.map(r => r.runId)
    expect(new Set(runIds).size).toBe(COUNT)

    // Wait for all to complete
    await Promise.all(
      runIds.map(id =>
        waitForStatus(engine, id, ['COMPLETED', 'FAILED'], 30_000),
      ),
    )

    // Verify all completed
    const statuses = await Promise.all(
      runIds.map(id => engine.getStatus(id, 'load-test')),
    )
    const completed = statuses.filter(s => s.status === 'COMPLETED')
    expect(completed.length).toBe(COUNT)

    const elapsed = Date.now() - startTime
    console.log(
      `  50 concurrent workflows completed in ${elapsed}ms (${Math.round(elapsed / COUNT)}ms/workflow)`,
    )

    await engine.shutdown()
  }, 60_000)

  // ── Test 2: Diamond DAG Under Load ─────────────────────────────

  it('handles 20 concurrent diamond DAGs (80 parallel steps)', async () => {
    const executor = new FunctionStepExecutor()
    executor.register(
      'compute',
      async (p: StepPayload): Promise<StepResult> => {
        await new Promise(r => setTimeout(r, 50)) // Simulate work
        return { output: { step: p.stepName, ts: Date.now() } }
      },
    )

    const wf = WorkflowBuilder.create('load_diamond')
      .step('root', {
        executorType: 'function',
        executorConfig: { handler: 'compute' },
      })
      .step('left', {
        dependsOn: ['root'],
        executorType: 'function',
        executorConfig: { handler: 'compute' },
      })
      .step('right', {
        dependsOn: ['root'],
        executorType: 'function',
        executorConfig: { handler: 'compute' },
      })
      .step('join', {
        dependsOn: ['left', 'right'],
        executorType: 'function',
        executorConfig: { handler: 'compute' },
      })
      .build()

    const engine = await setupEngine(executor, [wf])
    const COUNT = 20

    const results = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        engine.start({
          workflowName: 'load_diamond',
          tenantId: 'load-test',
          input: { i },
        }),
      ),
    )

    await Promise.all(
      results.map(r =>
        waitForStatus(engine, r.runId, ['COMPLETED', 'FAILED'], 45_000),
      ),
    )

    const statuses = await Promise.all(
      results.map(r => engine.getStatus(r.runId, 'load-test')),
    )
    const completed = statuses.filter(s => s.status === 'COMPLETED')
    expect(completed.length).toBe(COUNT)

    // Each workflow has 4 steps
    for (const s of statuses) {
      expect(s.steps.every(step => step.status === 'COMPLETED')).toBe(true)
    }

    console.log(`  ${COUNT} diamond DAGs (${COUNT * 4} total steps) completed`)
    await engine.shutdown()
  }, 60_000)

  // ── Test 3: ExternalAction Idempotency Under Pressure ──────────

  it('ExternalAction handles 100 concurrent calls with same idempotency key', async () => {
    // Insert parent workflow run for FK
    await db
      .insertInto('workflow_runs')
      .values({
        id: 'wf-load',
        tenantId: 'load-test',
        workflowName: 'load_test',
        workflowVersion: '1.0.0',
        status: 'RUNNING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()

    const executor = new ExternalActionExecutor({ db })
    let callCount = 0

    const req = {
      workflowRunId: 'wf-load',
      stepName: 'create_pr',
      attempt: 1,
      tenantId: 'load-test',
      provider: 'github',
      actionType: 'create_pr',
      idempotencyKey: 'load-test-key',
      request: { title: 'Load test PR' },
    }

    const fn = async () => {
      callCount++
      await new Promise(r => setTimeout(r, 20)) // Simulate API latency
      return { externalId: 'PR-1', data: { id: 'PR-1' } }
    }

    // Fire 100 concurrent calls with same idempotency key
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () => executor.execute(req, fn)),
    )

    const successes = results.filter(r => r.status === 'fulfilled')
    const pending = results.filter(
      r =>
        r.status === 'rejected' &&
        (r.reason as any)?.name === 'ExternalActionPendingError',
    )

    // At least 1 success (might be more due to race timing)
    expect(successes.length).toBeGreaterThanOrEqual(1)

    // The external function should only be called a few times (not 100)
    expect(callCount).toBeLessThanOrEqual(5)

    // All successes should return the same externalId
    for (const r of successes) {
      expect((r as any).value.externalId).toBe('PR-1')
    }

    console.log(
      `  100 concurrent ExternalAction calls: ${successes.length} succeeded, ${pending.length} pending, ${callCount} actual API calls`,
    )
  })

  // ── Test 4: Event Ingestion Throughput ──────────────────────────

  it('ingests 200 events with idempotency dedup', async () => {
    const service = new EventIngestionService({ db })
    const startTime = Date.now()

    // 100 unique events + 100 duplicates
    const events = [
      ...Array.from({ length: 100 }, (_, i) => ({
        tenantId: 'load-test',
        eventType: 'github.push',
        source: 'github',
        payload: { index: i },
        idempotencyKey: `push-${i}`,
      })),
      ...Array.from({ length: 100 }, (_, i) => ({
        tenantId: 'load-test',
        eventType: 'github.push',
        source: 'github',
        payload: { index: i },
        idempotencyKey: `push-${i}`, // Duplicates
      })),
    ]

    const results = await Promise.all(events.map(e => service.ingest(e)))

    const unique = results.filter(r => !r.duplicate)
    const dupes = results.filter(r => r.duplicate)

    expect(unique.length).toBe(100)
    expect(dupes.length).toBe(100)

    // Verify exactly 100 events in DB
    const count = await db
      .selectFrom('workflow_events')
      .select(db.fn.count<number>('id').as('count'))
      .executeTakeFirst()
    expect(Number(count?.count)).toBe(100)

    const elapsed = Date.now() - startTime
    console.log(
      `  200 events (100 unique + 100 dupes) ingested in ${elapsed}ms (${Math.round(elapsed / 200)}ms/event)`,
    )
  })

  // ── Test 5: Event-Triggered Workflow Starts Under Load ─────────

  it('100 events trigger 100 workflows via triggers', async () => {
    const executor = new FunctionStepExecutor()
    executor.register(
      'handle_push',
      async (p: StepPayload): Promise<StepResult> => ({
        output: { handled: true, input: p.input },
      }),
    )

    const wf = WorkflowBuilder.create('on_push')
      .trigger({ eventType: 'load.push' })
      .step('handle', {
        executorType: 'function',
        executorConfig: { handler: 'handle_push' },
      })
      .build()

    const eventService = new EventIngestionService({ db })
    const engine = await setupEngine(executor, [wf])
    eventService.setEngine(engine)

    const COUNT = 100

    // Fire 100 events
    await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        eventService.ingest({
          tenantId: 'load-test',
          eventType: 'load.push',
          source: 'test',
          payload: { index: i },
          idempotencyKey: `load-push-${i}`,
        }),
      ),
    )

    // Wait for workflows to be created
    await new Promise(r => setTimeout(r, 2000))

    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'on_push')
      .execute()

    expect(runs.length).toBe(COUNT)

    // Wait for all to complete
    await Promise.all(
      runs.map(r =>
        waitForStatus(engine, r.id, ['COMPLETED', 'FAILED'], 30_000),
      ),
    )

    const finalRuns = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'on_push')
      .where('status', '=', 'COMPLETED')
      .execute()

    expect(finalRuns.length).toBe(COUNT)

    console.log(`  ${COUNT} events → ${COUNT} workflows, all completed`)
    await engine.shutdown()
  }, 60_000)

  // ── Test 6: nextStep Loop Under Load ───────────────────────────

  it('20 concurrent workflows with 10-iteration loops', async () => {
    const executor = new FunctionStepExecutor()
    const iterCounts = new Map<string, number>()

    executor.register('looper', async (p: StepPayload): Promise<StepResult> => {
      const key = p.workflowRunId
      const count = (iterCounts.get(key) ?? 0) + 1
      iterCounts.set(key, count)

      if (count < 10) {
        return { output: { iteration: count }, nextStep: 'loop' }
      }
      return { output: { iteration: count, done: true } }
    })

    const wf = WorkflowBuilder.create('load_loop')
      .step('loop', {
        executorType: 'function',
        executorConfig: { handler: 'looper' },
        maxIterations: 15,
      })
      .build()

    const engine = await setupEngine(executor, [wf])
    const COUNT = 20

    const results = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        engine.start({
          workflowName: 'load_loop',
          tenantId: 'load-test',
          input: { i },
        }),
      ),
    )

    await Promise.all(
      results.map(r =>
        waitForStatus(engine, r.runId, ['COMPLETED', 'FAILED'], 45_000),
      ),
    )

    const statuses = await Promise.all(
      results.map(r => engine.getStatus(r.runId, 'load-test')),
    )
    const completed = statuses.filter(s => s.status === 'COMPLETED')
    expect(completed.length).toBe(COUNT)

    // Each should have done 10 iterations
    for (const s of statuses) {
      expect((s.steps[0].output as any)?.done).toBe(true)
      expect((s.steps[0].output as any)?.iteration).toBe(10)
    }

    console.log(
      `  ${COUNT} looping workflows (${COUNT * 10} total iterations) completed`,
    )
    await engine.shutdown()
  }, 60_000)

  // ── Test 7: Metrics Under Load ─────────────────────────────────

  it('metrics collector handles queries on large dataset', async () => {
    const executor = new FunctionStepExecutor()
    executor.register(
      'metered',
      async (): Promise<StepResult> => ({
        output: { result: 'ok', _usage: { tokens: 100, model: 'test-model' } },
      }),
    )

    const wf = WorkflowBuilder.create('load_metrics')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'metered' },
      })
      .step('b', {
        dependsOn: ['a'],
        executorType: 'function',
        executorConfig: { handler: 'metered' },
      })
      .build()

    const engine = await setupEngine(executor, [wf])

    // Start 30 workflows
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        engine.start({
          workflowName: 'load_metrics',
          tenantId: 'load-test',
          input: { i },
        }),
      ),
    )

    await Promise.all(
      results.map(r =>
        waitForStatus(engine, r.runId, ['COMPLETED', 'FAILED'], 30_000),
      ),
    )

    // Query metrics
    const metrics = new WorkflowMetricsCollector(db)
    const startTime = Date.now()

    const aggregate = await metrics.getAggregateMetrics('load-test')
    const queryTime = Date.now() - startTime

    expect(aggregate.avgExecutionMsByExecutor.function).toBeDefined()
    expect(aggregate.stepExecutionPercentiles).toBeDefined()
    expect(aggregate.stepExecutionPercentiles!.p50).toBeGreaterThan(0)

    // Per-run metrics
    const runMetrics = await metrics.getRunMetrics(results[0].runId)
    expect(runMetrics).toBeDefined()
    expect(runMetrics!.steps).toHaveLength(2)

    console.log(`  Aggregate metrics over 30 runs (60 steps) in ${queryTime}ms`)
    console.log(
      `  p50=${aggregate.stepExecutionPercentiles!.p50}ms, p95=${aggregate.stepExecutionPercentiles!.p95}ms`,
    )
    await engine.shutdown()
  }, 60_000)

  // ── Test 8: Event Ordering Under Concurrent Load ───────────────

  it('event ordering handles 50 concurrent out-of-order events', async () => {
    const service = new EventIngestionService({ db })

    // Send 50 events for 10 entities, out of order
    const events = []
    for (let entity = 0; entity < 10; entity++) {
      // Send sequences 5,3,1,4,2 (out of order) for each entity
      for (const seq of [5, 3, 1, 4, 2]) {
        events.push({
          tenantId: 'load-test',
          eventType: 'entity.updated',
          source: 'test',
          payload: { entity, seq },
          entityKey: `entity:${entity}`,
          sequenceNumber: seq,
          idempotencyKey: `entity-${entity}-seq-${seq}`,
        })
      }
    }

    // Ingest all concurrently
    const _results = await Promise.all(events.map(e => service.ingest(e)))

    // For each entity, check the latest sequence
    for (let entity = 0; entity < 10; entity++) {
      const latest = await service.getLatestSequence(`entity:${entity}`)
      // The highest sequence that was processed (not skipped)
      expect(latest).toBeGreaterThanOrEqual(1)
    }

    // Count skipped vs processed
    const allEvents = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('tenantId', '=', 'load-test')
      .execute()

    const processed = allEvents.filter(e => e.status === 'processed')
    const skipped = allEvents.filter(e => e.status === 'skipped_stale')

    console.log(
      `  50 out-of-order events: ${processed.length} processed, ${skipped.length} skipped`,
    )

    // At least some should be skipped (lower sequences after higher ones)
    // Due to concurrency, exact counts vary
    expect(processed.length + skipped.length).toBe(50)
  })
})
