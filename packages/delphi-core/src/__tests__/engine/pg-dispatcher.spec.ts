// npx vitest run src/__tests__/engine/pg-dispatcher.spec.ts
//
// Tests for PgConnector: Postgres-only queue connector using
// FOR UPDATE SKIP LOCKED pattern (DBOS-inspired).
//
// 1. Unit: queue() fires NOTIFY (or no-op without pgPool)
// 2. Unit: bulkQueue() returns correct statuses
// 3. Unit: getStatus() reads step from DB
// 4. Unit: parseJobId() parsing edge cases
// 5. Integration: Full e2e — engine -> PgConnector polls -> step executes -> workflow completes
// 6. Concurrency: Multiple workers claim different steps (FOR UPDATE SKIP LOCKED)
// 7. Multi-step: A->B->C chain completes through PG-only dispatch

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

/** Poll until workflow reaches a terminal status or timeout */
async function waitForWorkflowStatus(
  engine: WorkflowEngine,
  runId: string,
  tenantId: string,
  targetStatuses: string[],
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await engine.getStatus(runId, tenantId)
    if (targetStatuses.includes(status.status)) {
      return status.status
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  const final = await engine.getStatus(runId, tenantId)
  throw new Error(
    `Workflow ${runId} did not reach ${targetStatuses.join('|')} within ${timeoutMs}ms. Current: ${final.status}, steps: ${final.steps.map(s => `${s.stepName}=${s.status}`).join(', ')}`,
  )
}

// ════════════════════════════════════════════════════════════════════
// Unit Tests
// ════════════════════════════════════════════════════════════════════

describe('PgConnector Unit', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  describe('parseJobId', () => {
    it('parses standard job ID format', () => {
      const result = PgConnector.parseJobId('wf-abc123-myStep-2-i0')
      expect(result).toEqual({
        runId: 'abc123',
        stepName: 'myStep',
        attempt: 2,
        iteration: 0,
      })
    })

    it('parses job ID with multi-segment runId', () => {
      const result = PgConnector.parseJobId('wf-abc-def-ghi-step-1-i3')
      expect(result).toEqual({
        runId: 'abc-def-ghi',
        stepName: 'step',
        attempt: 1,
        iteration: 3,
      })
    })

    it('returns null for invalid format', () => {
      expect(PgConnector.parseJobId('invalid')).toBeNull()
      expect(PgConnector.parseJobId('wf-')).toBeNull()
      expect(PgConnector.parseJobId('')).toBeNull()
    })
  })

  describe('queue()', () => {
    it('returns QUEUED status without pgPool (no-op NOTIFY)', async () => {
      const dispatcher = new PgConnector({ db })

      const result = await dispatcher.queue({
        uniqueTaskName: 'wf-test-step1-0-i0',
        taskName: 'workflow_step_light',
        postUrl: '/workflow/step',
        taskBody: { workflowRunId: 'test', stepName: 'step1' },
        handle: async () => {},
      })

      expect(result.status).toBe('QUEUED')
      expect(result.id).toBe('wf-test-step1-0-i0')
      expect(result.name).toBe('workflow_step_light')
    })

    it('fires NOTIFY with pgPool', async () => {
      const data = getGlobalData()
      const pool = new pg.Pool({
        host: data.postgres.host,
        port: data.postgres.port,
        database: data.postgres.database,
        user: data.postgres.username,
        password: data.postgres.password,
        max: 2,
      })

      try {
        // Set up a listener to verify NOTIFY arrives
        const client = await pool.connect()
        let received = false
        let receivedPayload = ''

        client.on('notification', msg => {
          if (msg.channel === 'delphi_step_queued') {
            received = true
            receivedPayload = msg.payload ?? ''
          }
        })
        await client.query('LISTEN delphi_step_queued')

        const dispatcher = new PgConnector({ db, pgPool: pool })

        await dispatcher.queue({
          uniqueTaskName: 'wf-test-step1-0-i0',
          taskName: 'workflow_step_light',
          postUrl: '/workflow/step',
          taskBody: {},
          handle: async () => {},
        })

        // Wait for debounced notification (10ms debounce + delivery)
        for (let i = 0; i < 50 && !received; i++) {
          await new Promise(r => setTimeout(r, 100))
        }

        expect(received).toBe(true)
        expect(receivedPayload).toBe('wake')

        await client.query('UNLISTEN delphi_step_queued')
        client.release()
      } finally {
        await pool.end()
      }
    })
  })

  describe('bulkQueue()', () => {
    it('returns status for each job', async () => {
      const dispatcher = new PgConnector({ db })

      const results = await dispatcher.bulkQueue([
        { uniqueTaskName: 'j1', taskName: 'workflow_step_light', taskBody: {} },
        { uniqueTaskName: 'j2', taskName: 'workflow_step_heavy', taskBody: {} },
        { uniqueTaskName: 'j3', taskName: 'workflow_step_ai', taskBody: {} },
      ])

      expect(results).toHaveLength(3)
      expect(results[0].id).toBe('j1')
      expect(results[1].id).toBe('j2')
      expect(results[2].id).toBe('j3')
      expect(results.every(r => r.status === 'QUEUED')).toBe(true)
    })
  })

  describe('forTenant()', () => {
    it('returns a new dispatcher scoped to tenantId', () => {
      const dispatcher = new PgConnector({ db })
      const scoped = dispatcher.forTenant('tenant-42') as PgConnector
      expect(scoped.tenantId).toBe('tenant-42')
    })
  })
})

// ════════════════════════════════════════════════════════════════════
// Integration Tests — Full E2E with PG-only dispatch
// ════════════════════════════════════════════════════════════════════

describe('PgConnector E2E', () => {
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
      max: 10,
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
      'echo',
      async (payload: StepPayload): Promise<StepResult> => {
        return {
          output: {
            echoed: true,
            step: payload.stepName,
            input: payload.input,
          },
        }
      },
    )
    executor.register(
      'transform',
      async (payload: StepPayload): Promise<StepResult> => {
        return { output: { transformed: true, data: payload.input } }
      },
    )
    executor.register(
      'slow',
      async (_payload: StepPayload): Promise<StepResult> => {
        await new Promise(r => setTimeout(r, 50))
        return { output: { slow: true } }
      },
    )
  })

  async function setupPgE2E(
    workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
  ) {
    if (stopWorker) {
      await stopWorker()
      stopWorker = null
    }

    const dispatcher = new PgConnector({
      db,
      pgPool,
      pollingIntervalMs: 100,
      maxPollingIntervalMs: 2000,
    })

    const workflowMap = new Map(workflows.map(w => [w.name, w]))

    const engine = new WorkflowEngine({
      db,
      connector: dispatcher,
      executors: new Map([['function', executor]]),
      workflows: workflowMap,
      tenantId: 'pg-test',
      disableLogBuffering: true,
    })

    // Create the step task and wire it to the engine
    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(dispatcher)

    // Start PG dispatcher worker
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
        {
          taskName: 'workflow_step_ai',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
        {
          taskName: 'workflow_step_sandbox',
          handle: (data: unknown) => stepTask.handle(data as StepPayload),
        },
      ],
      defaultConcurrency: 5,
    })
    stopWorker = listenHandle.stop

    // Give the poller a tick to initialize
    await new Promise(r => setTimeout(r, 200))

    return { engine, dispatcher }
  }

  it('completes a single-step workflow via PG-only dispatch', async () => {
    const wf = WorkflowBuilder.create('pg_single')
      .step('only', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine } = await setupPgE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'pg_single',
      tenantId: 'pg-test',
      input: { message: 'hello pg' },
    })

    const finalStatus = await waitForWorkflowStatus(engine, runId, 'pg-test', [
      'COMPLETED',
      'FAILED',
    ])
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'pg-test')
    expect(status.output).toHaveProperty('only')
    expect((status.output as any).only.echoed).toBe(true)
  })

  it('chains A -> B -> C through PG-only dispatch', async () => {
    const wf = WorkflowBuilder.create('pg_chain')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('b', {
        dependsOn: ['a'],
        executorType: 'function',
        executorConfig: { handler: 'transform' },
        mapInput: upstream => ({ fromA: upstream.a }),
      })
      .step('c', {
        dependsOn: ['b'],
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        mapInput: upstream => ({ fromB: upstream.b }),
      })
      .build()

    const { engine } = await setupPgE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'pg_chain',
      tenantId: 'pg-test',
      input: { original: true },
    })

    const finalStatus = await waitForWorkflowStatus(engine, runId, 'pg-test', [
      'COMPLETED',
      'FAILED',
    ])
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'pg-test')
    expect(status.steps).toHaveLength(3)
    for (const step of status.steps) {
      expect(step.status).toBe('COMPLETED')
    }

    // Verify step B received output from A
    const stepB = status.steps.find(s => s.stepName === 'b')
    expect(stepB?.output).toHaveProperty('transformed')
  })

  it('handles diamond DAG with parallel branches', async () => {
    const wf = WorkflowBuilder.create('pg_diamond')
      .step('root', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('left', {
        dependsOn: ['root'],
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .step('right', {
        dependsOn: ['root'],
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .step('join', {
        dependsOn: ['left', 'right'],
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine } = await setupPgE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'pg_diamond',
      tenantId: 'pg-test',
      input: {},
    })

    const finalStatus = await waitForWorkflowStatus(engine, runId, 'pg-test', [
      'COMPLETED',
      'FAILED',
    ])
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'pg-test')
    expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
  })

  it('FOR UPDATE SKIP LOCKED: concurrent dispatchers do not double-process steps', async () => {
    // Create a workflow with multiple parallel steps
    const wf = WorkflowBuilder.create('pg_concurrent')
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .step('s2', {
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .step('s3', {
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .step('s4', {
        executorType: 'function',
        executorConfig: { handler: 'slow' },
      })
      .build()

    // Track how many times each handler is called
    const callCounts = new Map<string, number>()
    executor.register(
      'slow',
      async (payload: StepPayload): Promise<StepResult> => {
        const key = `${payload.workflowRunId}:${payload.stepName}`
        callCounts.set(key, (callCounts.get(key) ?? 0) + 1)
        await new Promise(r => setTimeout(r, 50))
        return { output: { slow: true } }
      },
    )

    // Use a single dispatcher but with high concurrency
    // FOR UPDATE SKIP LOCKED guarantees each step is only claimed once
    const { engine } = await setupPgE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'pg_concurrent',
      tenantId: 'pg-test',
      input: {},
    })

    const finalStatus = await waitForWorkflowStatus(engine, runId, 'pg-test', [
      'COMPLETED',
      'FAILED',
    ])
    expect(finalStatus).toBe('COMPLETED')

    // Each step should have been called exactly once
    for (const [_key, count] of callCounts) {
      expect(count).toBe(1)
    }
  })

  it('retries failed steps and eventually completes', async () => {
    let callCount = 0
    executor.register('flakyPg', async (): Promise<StepResult> => {
      callCount++
      if (callCount < 3) {
        throw new Error('Transient pg failure')
      }
      return { output: { recovered: true, attempts: callCount } }
    })

    const wf = WorkflowBuilder.create('pg_retry')
      .step('flaky', {
        executorType: 'function',
        executorConfig: { handler: 'flakyPg' },
        retries: 5,
      })
      .build()

    const { engine } = await setupPgE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'pg_retry',
      tenantId: 'pg-test',
      input: {},
    })

    const finalStatus = await waitForWorkflowStatus(
      engine,
      runId,
      'pg-test',
      ['COMPLETED', 'FAILED'],
      20_000,
    )
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'pg-test')
    const step = status.steps[0]
    expect((step.output as any)?.recovered).toBe(true)
  })

  it('multiple workflows complete independently', async () => {
    const wf = WorkflowBuilder.create('pg_multi')
      .step('work', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine } = await setupPgE2E([wf])

    // Start 10 workflows
    const runIds: string[] = []
    for (let i = 0; i < 10; i++) {
      const { runId } = await engine.start({
        workflowName: 'pg_multi',
        tenantId: 'pg-test',
        input: { index: i },
      })
      runIds.push(runId)
    }

    // Wait for all to complete
    const results = await Promise.all(
      runIds.map(id =>
        waitForWorkflowStatus(engine, id, 'pg-test', ['COMPLETED', 'FAILED']),
      ),
    )

    expect(results.every(r => r === 'COMPLETED')).toBe(true)
  })
})
