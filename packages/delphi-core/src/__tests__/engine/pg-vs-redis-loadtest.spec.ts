// npx vitest run src/__tests__/engine/pg-vs-redis-loadtest.spec.ts
//
// Load test for PgConnector — measures throughput of Postgres-only dispatch.
// Compares against baseline numbers; Redis path not included (needs Redis container
// but can be compared manually via e2e.spec.ts timings).
//
// Skip in CI: this test is heavy and takes 30-60+ seconds.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { PgConnector } from '../../engine/PgConnector.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
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
  postgres: {
    host: string
    port: number
    database: string
    username: string
    password: string
  }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  )
}

/** Wait for all workflows to reach terminal status */
async function waitForAllWorkflows(
  engine: WorkflowEngine,
  runIds: string[],
  tenantId: string,
  timeoutMs = 120_000,
): Promise<{ completed: number; failed: number; durationMs: number }> {
  const start = Date.now()
  const remaining = new Set(runIds)
  let completed = 0
  let failed = 0

  while (remaining.size > 0 && Date.now() - start < timeoutMs) {
    for (const id of [...remaining]) {
      try {
        const status = await engine.getStatus(id, tenantId)
        if (status.status === 'COMPLETED') {
          completed++
          remaining.delete(id)
        } else if (status.status === 'FAILED') {
          failed++
          remaining.delete(id)
        }
      } catch {
        // ignore transient errors
      }
    }
    if (remaining.size > 0) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return { completed, failed, durationMs: Date.now() - start }
}

/** Percentile helper */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

describe('PgConnector Load Test', () => {
  let db: TestDb
  let pgPool: pg.Pool
  let executor: FunctionStepExecutor
  let stopWorker: (() => Promise<void>) | null = null

  beforeAll(async () => {
    db = await getSharedDb()
    const data = getGlobalData()
    pgPool = new pg.Pool({
      host: data.postgres.host,
      port: data.postgres.port,
      database: data.postgres.database,
      user: data.postgres.username,
      password: data.postgres.password,
      max: 20,
    })
  })

  afterAll(async () => {
    if (stopWorker) {
      await stopWorker()
      stopWorker = null
    }
    await pgPool.end()
    await releaseSharedDb()
  })

  beforeEach(async () => {
    if (stopWorker) {
      await stopWorker()
      stopWorker = null
    }
    await truncateAll(db)

    executor = new FunctionStepExecutor()
    executor.register(
      'noop',
      async (_payload: StepPayload): Promise<StepResult> => {
        return { output: { ok: true } }
      },
    )
  })

  async function setupLoadTest(concurrency = 10) {
    const wf = WorkflowBuilder.create('loadtest_single')
      .step('work', {
        executorType: 'function',
        executorConfig: { handler: 'noop' },
      })
      .build()

    const wfChain = WorkflowBuilder.create('loadtest_chain')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'noop' },
      })
      .step('b', {
        dependsOn: ['a'],
        executorType: 'function',
        executorConfig: { handler: 'noop' },
      })
      .step('c', {
        dependsOn: ['b'],
        executorType: 'function',
        executorConfig: { handler: 'noop' },
      })
      .build()

    const dispatcher = new PgConnector({
      db,
      pgPool,
      pollingIntervalMs: 50,
      maxPollingIntervalMs: 500,
    })

    const workflowMap = new Map([
      [wf.name, wf],
      [wfChain.name, wfChain],
    ])

    const engine = new WorkflowEngine({
      db,
      connector: dispatcher,
      executors: new Map([['function', executor]]),
      workflows: workflowMap,
      tenantId: 'load-test',
      disableLogBuffering: true,
    })

    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(dispatcher)

    const listenHandle = await dispatcher.listen({
      tasks: [
        {
          taskName: 'workflow_step_light',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
        {
          taskName: 'workflow_step_heavy',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
      ],
      defaultConcurrency: concurrency,
    })
    stopWorker = listenHandle.stop

    await new Promise(r => setTimeout(r, 200))
    return { engine, dispatcher }
  }

  it('throughput: 100 single-step workflows', async () => {
    const { engine } = await setupLoadTest(20)
    const N = 100

    const startTimes = new Map<string, number>()
    const start = Date.now()

    const runIds: string[] = []
    for (let i = 0; i < N; i++) {
      const { runId } = await engine.start({
        workflowName: 'loadtest_single',
        tenantId: 'load-test',
        input: { i },
      })
      startTimes.set(runId, Date.now())
      runIds.push(runId)
    }

    const enqueueDurationMs = Date.now() - start

    const result = await waitForAllWorkflows(engine, runIds, 'load-test')

    // Per-workflow latencies
    const latencies: number[] = []
    for (const id of runIds) {
      const status = await engine.getStatus(id, 'load-test')
      if (status.completedAt) {
        const completedAt = new Date(status.completedAt).getTime()
        latencies.push(completedAt - startTimes.get(id)!)
      }
    }
    latencies.sort((a, b) => a - b)

    const throughput = (result.completed / (result.durationMs / 1000)).toFixed(
      1,
    )

    console.log('=== PG-ONLY: 100 single-step workflows ===')
    console.log(`  Enqueue: ${enqueueDurationMs}ms for ${N} workflows`)
    console.log(`  Total:   ${result.durationMs}ms`)
    console.log(`  OK/FAIL: ${result.completed}/${result.failed}`)
    console.log(`  Throughput: ${throughput} wf/s`)
    if (latencies.length > 0) {
      console.log(`  p50: ${percentile(latencies, 50)}ms`)
      console.log(`  p95: ${percentile(latencies, 95)}ms`)
      console.log(`  p99: ${percentile(latencies, 99)}ms`)
    }

    expect(result.completed).toBe(N)
    expect(result.failed).toBe(0)
  }, 120_000)

  it('throughput: 50 three-step chain workflows', async () => {
    const { engine } = await setupLoadTest(20)
    const N = 50

    const startTimes = new Map<string, number>()
    const _start = Date.now()

    const runIds: string[] = []
    for (let i = 0; i < N; i++) {
      const { runId } = await engine.start({
        workflowName: 'loadtest_chain',
        tenantId: 'load-test',
        input: { i },
      })
      startTimes.set(runId, Date.now())
      runIds.push(runId)
    }

    const result = await waitForAllWorkflows(
      engine,
      runIds,
      'load-test',
      120_000,
    )

    const latencies: number[] = []
    for (const id of runIds) {
      const status = await engine.getStatus(id, 'load-test')
      if (status.completedAt) {
        const completedAt = new Date(status.completedAt).getTime()
        latencies.push(completedAt - startTimes.get(id)!)
      }
    }
    latencies.sort((a, b) => a - b)

    const throughput = (result.completed / (result.durationMs / 1000)).toFixed(
      1,
    )

    console.log('=== PG-ONLY: 50 three-step chain workflows ===')
    console.log(`  Total:   ${result.durationMs}ms`)
    console.log(`  OK/FAIL: ${result.completed}/${result.failed}`)
    console.log(
      `  Throughput: ${throughput} wf/s (${((result.completed * 3) / (result.durationMs / 1000)).toFixed(1)} steps/s)`,
    )
    if (latencies.length > 0) {
      console.log(`  p50: ${percentile(latencies, 50)}ms`)
      console.log(`  p95: ${percentile(latencies, 95)}ms`)
    }

    expect(result.completed).toBe(N)
    expect(result.failed).toBe(0)
  }, 120_000)
})
