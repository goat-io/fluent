// npx vitest run src/__tests__/engine/retry-backoff.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import {
  computeRetryDelay,
  WorkflowEngine,
} from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type { BackoffConfig } from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

// ── Unit tests for computeRetryDelay (no DB needed) ──────────────

describe('computeRetryDelay', () => {
  it('returns null when no backoff configured', () => {
    expect(computeRetryDelay(undefined, 0)).toBeNull()
  })

  it('returns a future timestamp for exponential backoff', () => {
    const backoff: BackoffConfig = { type: 'exponential', delayMs: 1000 }
    const now = Date.now()
    const result = computeRetryDelay(backoff, 0)!
    // First attempt: ~1000ms ± 25% jitter → 750..1250ms from now
    expect(result).toBeGreaterThan(now + 500)
    expect(result).toBeLessThan(now + 1500)
  })

  it('exponential delay grows with attempt', () => {
    const backoff: BackoffConfig = {
      type: 'exponential',
      delayMs: 1000,
      multiplier: 2,
    }
    // Collect many samples to account for jitter
    const attempt0Delays: number[] = []
    const attempt3Delays: number[] = []
    for (let i = 0; i < 50; i++) {
      const now = Date.now()
      attempt0Delays.push(computeRetryDelay(backoff, 0)! - now)
      attempt3Delays.push(computeRetryDelay(backoff, 3)! - now)
    }
    const avg0 =
      attempt0Delays.reduce((a, b) => a + b, 0) / attempt0Delays.length
    const avg3 =
      attempt3Delays.reduce((a, b) => a + b, 0) / attempt3Delays.length
    // attempt 3 should be ~8x attempt 0 (2^3)
    expect(avg3).toBeGreaterThan(avg0 * 4)
  })

  it('respects maxDelayMs cap', () => {
    const backoff: BackoffConfig = {
      type: 'exponential',
      delayMs: 1000,
      maxDelayMs: 5000,
    }
    const now = Date.now()
    // attempt 10 → base would be 1000*2^10 = 1024000, but capped at 5000
    const result = computeRetryDelay(backoff, 10)!
    expect(result - now).toBeLessThan(7000) // 5000 + 25% jitter
  })

  it('fixed backoff uses constant delay', () => {
    const backoff: BackoffConfig = { type: 'fixed', delayMs: 2000 }
    const delays: number[] = []
    for (let i = 0; i < 50; i++) {
      const now = Date.now()
      delays.push(computeRetryDelay(backoff, 0)! - now)
    }
    for (let i = 0; i < 50; i++) {
      const now = Date.now()
      const d5 = computeRetryDelay(backoff, 5)! - now
      delays.push(d5)
    }
    // All delays should be ~2000ms ± 25% jitter → 1500..2500
    for (const d of delays) {
      expect(d).toBeGreaterThan(1200)
      expect(d).toBeLessThan(2800)
    }
  })

  it('uses defaults when config fields omitted', () => {
    const backoff: BackoffConfig = { type: 'exponential' }
    const now = Date.now()
    // Defaults: delayMs=1000, multiplier=2, maxDelayMs=60000
    const result = computeRetryDelay(backoff, 0)!
    expect(result - now).toBeGreaterThan(500)
    expect(result - now).toBeLessThan(1500)
  })
})

// ── Integration tests (requires Postgres via testcontainers) ─────

describe('retry backoff (integration)', () => {
  let db: TestDb
  let engine: WorkflowEngine

  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []

  function createMockConnector() {
    return {
      queue: async (params: any) => {
        queuedJobs.push({
          taskName: params.taskName,
          taskBody: params.taskBody,
        })
        return {
          id: params.uniqueTaskName,
          name: params.taskName,
          status: 'QUEUED',
          output: '',
          attempts: 0,
          created: new Date().toISOString(),
          nextRun: null,
          nextRunMinutes: null,
        }
      },
      getStatus: async () => ({
        id: '',
        name: '',
        status: 'QUEUED' as const,
        output: '',
        attempts: 0,
        created: '',
        nextRun: null,
        nextRunMinutes: null,
      }),
    }
  }

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    queuedJobs.length = 0
    await truncateAll(db)

    const executor = new FunctionStepExecutor()
    executor.register('backoff_test.fail_step', async () => {
      throw new Error('transient failure')
    })

    engine = new WorkflowEngine({
      db: db,
      workflows: new Map([[definition.name, definition]]),
      executors: new Map([['function', executor]]),
      connector: createMockConnector() as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })
  })

  const definition = WorkflowBuilder.create('backoff_test')
    .defaultRetries(3)
    .step('fail_step', {
      executorType: 'function',
      executorConfig: { handler: 'backoff_test.fail_step' },
      backoff: { type: 'exponential', delayMs: 5000 },
    })
    .build()

  it('sets retryAfterMs on step row after failure with backoff', async () => {
    const { runId } = await engine.start({
      workflowName: 'backoff_test',
      tenantId: 'test',
      input: {},
    })

    // Step should be queued
    const stepBefore = await db.query<any>(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    expect(stepBefore.rows[0].status).toBe('QUEUED')
    expect(stepBefore.rows[0].retryAfterMs).toBeNull()

    // Simulate step failure
    await engine.onStepFailed(runId, 'fail_step', 'test', new Error('boom'))

    // Step should be QUEUED with retryAfterMs set in the future
    const stepAfter = await db.query<any>(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    const row = stepAfter.rows[0]
    expect(row.status).toBe('QUEUED')
    expect(row.attempt).toBe(1)
    expect(Number(row.retryAfterMs)).toBeGreaterThan(Date.now())

    // Should NOT have dispatched to queue (backoff delays it)
    const retryDispatches = queuedJobs.filter(
      j => j.taskBody?.stepName === 'fail_step' && j.taskBody?.attempt === 1,
    )
    expect(retryDispatches).toHaveLength(0)
  })

  it('dispatches immediately when no backoff configured', async () => {
    const noBackoffDef = WorkflowBuilder.create('no_backoff_test')
      .defaultRetries(3)
      .step('fail_step', {
        executorType: 'function',
        executorConfig: { handler: 'backoff_test.fail_step' },
        // no backoff
      })
      .build()

    const noBackoffEngine = new WorkflowEngine({
      db: db,
      workflows: new Map([[noBackoffDef.name, noBackoffDef]]),
      executors: new Map([['function', new FunctionStepExecutor()]]),
      connector: createMockConnector() as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })

    const { runId } = await noBackoffEngine.start({
      workflowName: 'no_backoff_test',
      tenantId: 'test',
      input: {},
    })

    await noBackoffEngine.onStepFailed(
      runId,
      'fail_step',
      'test',
      new Error('boom'),
    )

    // Step should be QUEUED with NO retryAfterMs
    const stepAfter = await db.query<any>(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    expect(stepAfter.rows[0].retryAfterMs).toBeNull()

    // Should have dispatched to queue immediately
    const retryDispatches = queuedJobs.filter(
      j => j.taskBody?.stepName === 'fail_step',
    )
    expect(retryDispatches.length).toBeGreaterThanOrEqual(1)
  })
})
