// npx vitest run src/__tests__/engine/temporal.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

function createMockConnector() {
  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
  return {
    connector: {
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
    } as any,
    queuedJobs,
  }
}

describe('Temporal-Inspired Features', () => {
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
      async (p: StepPayload): Promise<StepResult> => ({
        output: { echoed: true, input: p.input },
      }),
    )
    executor.register(
      'longRunning',
      async (_p: StepPayload): Promise<StepResult> => ({
        output: { done: true },
      }),
    )
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
  ) {
    const { connector, queuedJobs: _queuedJobs } = createMockConnector()
    const workflows = new Map(workflowDefs.map(w => [w.name, w]))
    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows,
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })
    return { engine, queuedJobs: _queuedJobs }
  }

  async function executeStep(engine: WorkflowEngine, job: any) {
    const payload = job.taskBody as StepPayload
    const stepEntity = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', payload.workflowRunId)
      .where('stepName', '=', payload.stepName)
      .executeTakeFirst()
    if (stepEntity && stepEntity.status === 'QUEUED') {
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('id', '=', stepEntity.id)
        .execute()
    }
    const exec = engine.getExecutor(payload.executorType)!
    try {
      const result = await exec.execute(payload)
      await engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )
    } catch (error) {
      await engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )
    }
  }

  describe('Heartbeat', () => {
    it('records heartbeat on a running step', async () => {
      const wf = WorkflowBuilder.create('hb_test')
        .step('work', {
          executorType: 'function',
          executorConfig: { handler: 'longRunning' },
        })
        .build()

      const { engine, queuedJobs: _queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'hb_test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Mark step as RUNNING manually (simulating worker pickup)
      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'work')
        .executeTakeFirst()
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('id', '=', step!.id)
        .execute()

      // Send heartbeat
      await engine.heartbeat(runId, 'work', 'test-tenant', {
        processed: 500,
        total: 10000,
      })

      // Verify
      const updated = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('id', '=', step!.id)
        .executeTakeFirst()
      expect(updated!.lastHeartbeatAt).toBeDefined()
      const heartbeatData =
        typeof updated!.lastHeartbeatData === 'string'
          ? JSON.parse(updated!.lastHeartbeatData)
          : updated!.lastHeartbeatData
      expect(heartbeatData).toEqual({ processed: 500, total: 10000 })
    })

    it('creates heartbeat log entry', async () => {
      const wf = WorkflowBuilder.create('hb_log')
        .step('work', {
          executorType: 'function',
          executorConfig: { handler: 'longRunning' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'hb_log',
        tenantId: 'test-tenant',
        input: {},
      })

      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'work')
        .executeTakeFirst()
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'RUNNING',
          updatedAt: new Date(),
        })
        .where('id', '=', step!.id)
        .execute()

      await engine.heartbeat(runId, 'work', 'test-tenant', { progress: 50 })

      const logs = await db
        .selectFrom('workflow_step_logs')
        .selectAll()
        .where('stepId', '=', step!.id)
        .where('event', '=', 'heartbeat')
        .execute()
      expect(logs).toHaveLength(1)
      const logData =
        typeof logs[0].data === 'string'
          ? JSON.parse(logs[0].data)
          : logs[0].data
      expect(logData).toEqual({ progress: 50 })
    })
  })

  describe('Signals', () => {
    it('persists signal in database', async () => {
      const wf = WorkflowBuilder.create('sig_persist')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs: _queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'sig_persist',
        tenantId: 'test-tenant',
        input: {},
      })

      await engine.signal(runId, 'test-tenant', 'custom_event', {
        key: 'value',
      })

      const signals = await db
        .selectFrom('workflow_signals')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .execute()
      expect(signals).toHaveLength(1)
      expect(signals[0].signalName).toBe('custom_event')
      const signalData =
        typeof signals[0].data === 'string'
          ? JSON.parse(signals[0].data)
          : signals[0].data
      expect(signalData).toEqual({ key: 'value' })
    })

    it('executes signal handler when registered', async () => {
      let handlerCalled = false
      let receivedData: any = null

      const wf = WorkflowBuilder.create('sig_handler')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .onSignal('approve', async (_ctx, data) => {
          handlerCalled = true
          receivedData = data
        })
        .build()

      const { engine, queuedJobs: _queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'sig_handler',
        tenantId: 'test-tenant',
        input: {},
      })

      await engine.signal(runId, 'test-tenant', 'approve', { approved: true })

      expect(handlerCalled).toBe(true)
      expect(receivedData).toEqual({ approved: true })
    })

    it('marks signal as processed after handler runs', async () => {
      const wf = WorkflowBuilder.create('sig_processed')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .onSignal('done', async () => {})
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'sig_processed',
        tenantId: 'test-tenant',
        input: {},
      })

      await engine.signal(runId, 'test-tenant', 'done', {})

      const signals = await db
        .selectFrom('workflow_signals')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .execute()
      expect(signals[0].processedAt).toBeDefined()
    })
  })

  describe('Queries', () => {
    it('executes registered query handler', async () => {
      const wf = WorkflowBuilder.create('query_test')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .onQuery('progress', ctx => ({
          completedSteps: Object.keys(ctx.completedOutputs).length,
          tenantId: ctx.tenantId,
        }))
        .build()

      const { engine, queuedJobs: _queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'query_test',
        tenantId: 'test-tenant',
        input: {},
      })

      const result = await engine.query(runId, 'test-tenant', 'progress')
      expect(result.completedSteps).toBe(0)
      expect(result.tenantId).toBe('test-tenant')
    })

    it('reflects completed step outputs in query', async () => {
      const wf = WorkflowBuilder.create('query_output')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .step('b', {
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .onQuery('status', ctx => ({
          completed: Object.keys(ctx.completedOutputs),
        }))
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'query_output',
        tenantId: 'test-tenant',
        input: {},
      })

      // Before any execution
      let result = await engine.query(runId, 'test-tenant', 'status')
      expect(result.completed).toEqual([])

      // Execute step a
      await executeStep(engine, queuedJobs[0])

      result = await engine.query(runId, 'test-tenant', 'status')
      expect(result.completed).toEqual(['a'])
    })

    it('throws for unregistered query', async () => {
      const wf = WorkflowBuilder.create('query_missing')
        .step('a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'query_missing',
        tenantId: 'test-tenant',
        input: {},
      })

      await expect(
        engine.query(runId, 'test-tenant', 'nonexistent'),
      ).rejects.toThrow(/No query handler/)
    })
  })
})
