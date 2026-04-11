// npx vitest run src/__tests__/engine/api-handlers.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Kysely } from 'kysely'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import type { Database } from '../../entities/Database.js'
import { createWorkflowHandlers } from '../../api/WorkflowHandlers.js'
import type { StepPayload, StepResult } from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('WorkflowHandlers API', () => {
  let db: Kysely<Database>
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
    executor.register('echo', async (p: StepPayload): Promise<StepResult> => ({
      output: { echoed: true },
    }))
  })

  function createHandlers() {
    const queuedJobs: any[] = []
    const connector = {
      queue: async (params: any) => {
        queuedJobs.push({ taskName: params.taskName, taskBody: params.taskBody })
        return { id: params.uniqueTaskName, name: params.taskName, status: 'QUEUED', output: '', attempts: 0, created: new Date().toISOString(), nextRun: null, nextRunMinutes: null }
      },
      getStatus: async () => ({ id: '', name: '', status: 'QUEUED' as const, output: '', attempts: 0, created: '', nextRun: null, nextRunMinutes: null, payload: {} }),
      forTenant: () => null as any,
    } as any

    const wf = WorkflowBuilder.create('api_test')
      .step('a', { executorType: 'function', executorConfig: { handler: 'echo' } })
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
    const step = await db.selectFrom('workflow_steps').selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'a')
      .executeTakeFirst()
    await db.updateTable('workflow_steps').set({
      status: 'RUNNING',
      updatedAt: new Date(),
    }).where('id', '=', step!.id).execute()

    const result = await handlers.heartbeat({
      runId,
      stepName: 'a',
      tenantId: 'test-tenant',
      data: { progress: 75 },
    })
    expect(result).toEqual({ success: true })
  })
})
