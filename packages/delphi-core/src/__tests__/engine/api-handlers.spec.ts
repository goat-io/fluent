// npx vitest run src/__tests__/engine/api-handlers.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createWorkflowHandlers } from '../../api/WorkflowHandlers.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('WorkflowHandlers API', () => {
  let db: TestDb
  let executor: FunctionStepExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    executor = new FunctionStepExecutor()
    executor.register(
      'echo',
      async (_p: StepPayload): Promise<StepResult> => ({
        output: { echoed: true },
      }),
    )
  })

  function createHandlers() {
    const queuedJobs: any[] = []
    const connector = {
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
        payload: {},
      }),
      forTenant: () => null as any,
    } as any

    const wf = WorkflowBuilder.create('api_test')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .onQuery('info', () => ({ version: '1.0' }))
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([['api_test', wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    const handlers = createWorkflowHandlers(engine)
    return { handlers, engine, queuedJobs }
  }

  it('start() creates a workflow and returns runId', async () => {
    const { handlers } = createHandlers()
    const result = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: { key: 'value' },
    })
    expect(result.runId).toBeDefined()
    expect(result.runId.length).toBeGreaterThan(0)
  })

  it('getStatus() returns serialized workflow state', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    const status = await handlers.getStatus({ runId, tenantId: 'test-tenant' })
    expect(status.id).toBe(runId)
    expect(status.workflowName).toBe('api_test')
    expect(status.status).toBe('RUNNING')
    expect(status.steps).toHaveLength(1)
    expect(status.steps[0].stepName).toBe('a')
    expect(status.createdAt).toBeDefined()
    expect(typeof status.createdAt).toBe('string') // ISO string
  })

  it('cancel() cancels a running workflow', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    const result = await handlers.cancel({ runId, tenantId: 'test-tenant' })
    expect(result).toEqual({ success: true })

    const status = await handlers.getStatus({ runId, tenantId: 'test-tenant' })
    expect(status.status).toBe('CANCELLED')
  })

  it('query() returns query handler result', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    const result = await handlers.query({
      runId,
      tenantId: 'test-tenant',
      queryName: 'info',
    })
    expect(result).toEqual({ version: '1.0' })
  })

  it('signal() persists and returns success', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    const result = await handlers.signal({
      runId,
      tenantId: 'test-tenant',
      signalName: 'custom',
      data: { info: 'test' },
    })
    expect(result).toEqual({ success: true })
  })

  it('heartbeat() records and returns success', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    // Mark step as running
    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'a')
      .executeTakeFirst()
    await db
      .updateTable('workflow_steps')
      .set({
        status: 'RUNNING',
        updatedAt: new Date(),
      })
      .where('id', '=', step!.id)
      .execute()

    const result = await handlers.heartbeat({
      runId,
      stepName: 'a',
      tenantId: 'test-tenant',
      data: { progress: 75 },
    })
    expect(result).toEqual({ success: true })
  })

  // ── Definition Snapshot ─────────────────────────────────────────

  it('definition snapshot includes complete step config', async () => {
    const wf = WorkflowBuilder.create('snapshot_test')
      .version('2.0.0')
      .defaultRetries(5)
      .defaultTimeout(30_000)
      .failFast(true)
      .step('compute', {
        executorType: 'ai',
        executorConfig: { model: 'gpt-4o', temperature: 0.7 },
        retries: 2,
        timeoutMs: 10_000,
        heartbeatTimeoutMs: 5_000,
        scheduleToStartTimeoutMs: 15_000,
        requiresHumanApproval: true,
        stepWeight: 'heavy',
      })
      .build()

    const queuedJobs: any[] = []
    const connector = {
      queue: async (params: any) => {
        queuedJobs.push(params)
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
        payload: {},
      }),
      forTenant: () => null as any,
    } as any

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['ai', executor]]),
      workflows: new Map([['snapshot_test', wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    const { runId } = await engine.start({
      workflowName: 'snapshot_test',
      tenantId: 'test-tenant',
      input: {},
    })

    // Read snapshot from DB
    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst()

    const snapshot = JSON.parse(run!.definitionSnapshot!)
    expect(snapshot.name).toBe('snapshot_test')
    expect(snapshot.version).toBe('2.0.0')
    expect(snapshot.defaultRetries).toBe(5)
    expect(snapshot.defaultTimeoutMs).toBe(30_000)
    expect(snapshot.failFast).toBe(true)

    const step = snapshot.steps[0]
    expect(step.name).toBe('compute')
    expect(step.executorType).toBe('ai')
    expect(step.executorConfig).toEqual({ model: 'gpt-4o', temperature: 0.7 })
    expect(step.retries).toBe(2)
    expect(step.timeoutMs).toBe(10_000)
    expect(step.heartbeatTimeoutMs).toBe(5_000)
    expect(step.scheduleToStartTimeoutMs).toBe(15_000)
    expect(step.requiresHumanApproval).toBe(true)
    expect(step.stepWeight).toBe('heavy')
    expect(step.maxIterations).toBeUndefined()
    await engine.shutdown()
  })

  it('definition snapshot includes triggers, stepWeight, and maxIterations', async () => {
    const wf = WorkflowBuilder.create('snapshot_full')
      .version('3.0.0')
      .trigger({ eventType: 'pr.opened' })
      .step('loop_step', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        stepWeight: 'ai',
        maxIterations: 25,
      })
      .build()

    const queuedJobs: any[] = []
    const connector = {
      queue: async (params: any) => {
        queuedJobs.push(params)
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
        payload: {},
      }),
      forTenant: () => null as any,
    } as any

    const engine2 = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([['snapshot_full', wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    const { runId } = await engine2.start({
      workflowName: 'snapshot_full',
      tenantId: 'test-tenant',
      input: {},
    })

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst()

    const snapshot = JSON.parse(run!.definitionSnapshot!)
    expect(snapshot.triggers).toBeDefined()
    expect(snapshot.triggers).toHaveLength(1)
    expect(snapshot.triggers[0].eventType).toBe('pr.opened')

    const step = snapshot.steps[0]
    expect(step.stepWeight).toBe('ai')
    expect(step.maxIterations).toBe(25)
    await engine2.shutdown()
  })

  // ── Metrics API Handlers ────────────────────────────────────────

  it('getRunMetrics() returns metrics for a workflow run', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    // Mark step completed with timing
    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .executeTakeFirst()
    const now = new Date()
    await db
      .updateTable('workflow_steps')
      .set({
        status: 'COMPLETED',
        startedAt: new Date(now.getTime() - 500),
        completedAt: now,
        tokensUsed: 100,
        costUsd: '0.001',
        modelUsed: 'gpt-4o',
      })
      .where('id', '=', step!.id)
      .execute()

    const metrics = await handlers.getRunMetrics({ runId })
    expect(metrics).toBeDefined()
    expect(metrics!.workflowRunId).toBe(runId)
    expect(metrics!.steps).toHaveLength(1)
    expect(metrics!.steps[0].tokensUsed).toBe(100)
    expect(metrics!.steps[0].costUsd).toBeCloseTo(0.001)
    expect(metrics!.totalTokens).toBe(100)
  })

  it('getAggregateMetrics() returns aggregate stats', async () => {
    const { handlers } = createHandlers()
    const { runId } = await handlers.start({
      workflowName: 'api_test',
      tenantId: 'test-tenant',
      input: {},
    })

    // Mark step completed
    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .executeTakeFirst()
    const now = new Date()
    await db
      .updateTable('workflow_steps')
      .set({
        status: 'COMPLETED',
        startedAt: new Date(now.getTime() - 200),
        completedAt: now,
      })
      .where('id', '=', step!.id)
      .execute()

    const metrics = await handlers.getAggregateMetrics({
      tenantId: 'test-tenant',
    })
    expect(metrics).toBeDefined()
    expect(metrics.avgExecutionMsByExecutor).toBeDefined()
    expect(metrics.avgExecutionMsByExecutor.function).toBeGreaterThanOrEqual(0)
  })
})
