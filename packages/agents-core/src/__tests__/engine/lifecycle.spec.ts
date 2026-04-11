// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Kysely } from 'kysely'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import type { Database } from '../../entities/Database.js'
import type { StepPayload, StepResult } from '../../workflow/WorkflowBuilder.types.js'
import {
  IdempotencyConflictError,
  HumanInputError,
} from '../../errors/WorkflowErrors.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

function createMockConnector() {
  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
  return {
    connector: {
      queue: async (params: any) => {
        queuedJobs.push({ taskName: params.taskName, taskBody: params.taskBody })
        return { id: params.uniqueTaskName, name: params.taskName, status: 'QUEUED', output: '', attempts: 0, created: new Date().toISOString(), nextRun: null, nextRunMinutes: null }
      },
      getStatus: async () => ({ id: '', name: '', status: 'QUEUED' as const, output: '', attempts: 0, created: '', nextRun: null, nextRunMinutes: null, payload: {} }),
      forTenant: () => null as any,
    } as any,
    queuedJobs,
  }
}

describe('WorkflowEngine Lifecycle', () => {
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
    executor.register('echo', async (payload: StepPayload): Promise<StepResult> => {
      return { output: { echoed: true, input: payload.input } }
    })
    executor.register('transform', async (payload: StepPayload): Promise<StepResult> => {
      return { output: { transformed: true, data: payload.input } }
    })
    executor.register('requestReview', async (payload: StepPayload): Promise<StepResult> => {
      return {
        output: { needsReview: true },
        waitForHuman: { prompt: 'Please review this', schema: { type: 'object' } },
      }
    })
  })

  function createEngine(workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[]) {
    const { connector, queuedJobs } = createMockConnector()
    const workflows = new Map(workflowDefs.map(w => [w.name, w]))
    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows,
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })
    return { engine, queuedJobs }
  }

  async function executeStep(engine: WorkflowEngine, job: any) {
    const payload = job.taskBody as StepPayload
    // Mark step as RUNNING (normally the worker does this)
    await db.updateTable('workflow_steps')
      .set({ status: 'RUNNING', startedAt: new Date(), updatedAt: new Date() })
      .where('workflowRunId', '=', payload.workflowRunId)
      .where('stepName', '=', payload.stepName)
      .where('status', '=', 'QUEUED')
      .execute()

    const exec = engine.getExecutor(payload.executorType)!
    try {
      const result = await exec.execute(payload)
      await engine.onStepCompleted(payload.workflowRunId, payload.stepName, payload.tenantId, result)
    } catch (error) {
      await engine.onStepFailed(payload.workflowRunId, payload.stepName, payload.tenantId, error as Error)
    }
  }

  describe('simple workflow', () => {
    it('creates a workflow run with correct initial state', async () => {
      const wf = WorkflowBuilder.create('simple')
        .step('step_a', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'simple',
        tenantId: 'test-tenant',
        input: { message: 'hello' },
      })

      expect(runId).toBeDefined()
      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.workflowName).toBe('simple')
      expect(status.status).toBe('RUNNING')
      expect(status.steps).toHaveLength(1)
    })

    it('completes a single-step workflow', async () => {
      const wf = WorkflowBuilder.create('single')
        .step('only', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'single',
        tenantId: 'test-tenant',
        input: { data: 'test' },
      })

      expect(queuedJobs).toHaveLength(1)
      await executeStep(engine, queuedJobs[0])

      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
      expect(status.completedAt).toBeDefined()
    })
  })

  describe('linear chain', () => {
    it('executes steps in order: A → B → C', async () => {
      const wf = WorkflowBuilder.create('linear')
        .step('a', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('b', { dependsOn: ['a'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('c', { dependsOn: ['b'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'linear', tenantId: 'test-tenant', input: {} })

      expect(queuedJobs).toHaveLength(1)
      expect(queuedJobs[0].taskBody.stepName).toBe('a')

      await executeStep(engine, queuedJobs[0])
      expect(queuedJobs).toHaveLength(2)
      expect(queuedJobs[1].taskBody.stepName).toBe('b')

      await executeStep(engine, queuedJobs[1])
      expect(queuedJobs).toHaveLength(3)

      await executeStep(engine, queuedJobs[2])
      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
    })
  })

  describe('diamond DAG', () => {
    it('fans out and joins', async () => {
      const wf = WorkflowBuilder.create('diamond')
        .step('root', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('left', { dependsOn: ['root'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('right', { dependsOn: ['root'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('join', { dependsOn: ['left', 'right'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'diamond', tenantId: 'test-tenant', input: {} })

      await executeStep(engine, queuedJobs[0]) // root
      expect(queuedJobs).toHaveLength(3) // root + left + right

      await executeStep(engine, queuedJobs[1]) // left
      expect(queuedJobs).toHaveLength(3) // join not yet

      await executeStep(engine, queuedJobs[2]) // right → join queued
      expect(queuedJobs).toHaveLength(4)

      await executeStep(engine, queuedJobs[3]) // join
      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
    })
  })

  describe('conditional steps', () => {
    it('skips step when condition returns false', async () => {
      const wf = WorkflowBuilder.create('conditional')
        .step('check', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('optional', {
          dependsOn: ['check'], executorType: 'function', executorConfig: { handler: 'echo' },
          condition: () => false,
        })
        .step('final', { dependsOn: ['check', 'optional'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'conditional', tenantId: 'test-tenant', input: {} })

      await executeStep(engine, queuedJobs[0])
      const lastJob = queuedJobs[queuedJobs.length - 1]
      expect(lastJob.taskBody.stepName).toBe('final')

      await executeStep(engine, lastJob)
      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
      const opt = status.steps.find(s => s.stepName === 'optional')
      expect(opt?.status).toBe('SKIPPED')
    })
  })

  describe('retry and failure', () => {
    it('retries a failing step', async () => {
      let attempts = 0
      executor.register('flaky', async (): Promise<StepResult> => {
        attempts++
        if (attempts < 2) throw new Error('Transient failure')
        return { output: { success: true } }
      })

      const wf = WorkflowBuilder.create('retry')
        .step('flaky', { executorType: 'function', executorConfig: { handler: 'flaky' }, retries: 3 })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'retry', tenantId: 'test-tenant', input: {} })

      await executeStep(engine, queuedJobs[0])
      await executeStep(engine, queuedJobs[1])

      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
    })

    it('fails workflow when retries exhausted', async () => {
      executor.register('alwaysFail', async (): Promise<StepResult> => { throw new Error('Permanent failure') })

      const wf = WorkflowBuilder.create('fail')
        .step('bad', { executorType: 'function', executorConfig: { handler: 'alwaysFail' }, retries: 1 })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'fail', tenantId: 'test-tenant', input: {} })

      await executeStep(engine, queuedJobs[0])
      await executeStep(engine, queuedJobs[1])

      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('FAILED')
      expect(status.error).toContain('Permanent failure')
    })
  })

  describe('human-in-the-loop', () => {
    it('pauses and resumes', async () => {
      const wf = WorkflowBuilder.create('human')
        .step('analyze', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('review', { dependsOn: ['analyze'], executorType: 'function', executorConfig: { handler: 'requestReview' } })
        .step('execute', { dependsOn: ['review'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'human', tenantId: 'test-tenant', input: {} })

      await executeStep(engine, queuedJobs[0])
      await executeStep(engine, queuedJobs[1])

      let status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('WAITING_HUMAN')

      await engine.submitHumanInput({ workflowRunId: runId, stepName: 'review', tenantId: 'test-tenant', data: { approved: true }, respondedBy: 'user@test.com' })

      const lastJob = queuedJobs[queuedJobs.length - 1]
      expect(lastJob.taskBody.stepName).toBe('execute')
      await executeStep(engine, lastJob)

      status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('COMPLETED')
    })

    it('rejects human input for non-waiting step', async () => {
      const wf = WorkflowBuilder.create('invalid_human')
        .step('a', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'invalid_human', tenantId: 'test-tenant', input: {} })
      await executeStep(engine, queuedJobs[0])

      await expect(
        engine.submitHumanInput({ workflowRunId: runId, stepName: 'a', tenantId: 'test-tenant', data: { approved: true } }),
      ).rejects.toThrow(HumanInputError)
    })
  })

  describe('idempotency', () => {
    it('rejects duplicate trigger', async () => {
      const wf = WorkflowBuilder.create('idemp').step('a', { executorType: 'function', executorConfig: { handler: 'echo' } }).build()
      const { engine } = createEngine([wf])

      await engine.start({ workflowName: 'idemp', tenantId: 'test-tenant', input: {}, idempotencyKey: 'key-1' })
      await expect(
        engine.start({ workflowName: 'idemp', tenantId: 'test-tenant', input: {}, idempotencyKey: 'key-1' }),
      ).rejects.toThrow(IdempotencyConflictError)
    })

    it('allows different keys', async () => {
      const wf = WorkflowBuilder.create('idemp2').step('a', { executorType: 'function', executorConfig: { handler: 'echo' } }).build()
      const { engine } = createEngine([wf])

      const { runId: id1 } = await engine.start({ workflowName: 'idemp2', tenantId: 'test-tenant', input: {}, idempotencyKey: 'a' })
      const { runId: id2 } = await engine.start({ workflowName: 'idemp2', tenantId: 'test-tenant', input: {}, idempotencyKey: 'b' })
      expect(id1).not.toBe(id2)
    })
  })

  describe('cancellation', () => {
    it('cancels a running workflow', async () => {
      const wf = WorkflowBuilder.create('cancel')
        .step('a', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .step('b', { dependsOn: ['a'], executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'cancel', tenantId: 'test-tenant', input: {} })
      await executeStep(engine, queuedJobs[0])

      await engine.cancel(runId, 'test-tenant')
      const status = await engine.getStatus(runId, 'test-tenant')
      expect(status.status).toBe('CANCELLED')
    })

    it('cancel is idempotent', async () => {
      const wf = WorkflowBuilder.create('cancel_idemp').step('a', { executorType: 'function', executorConfig: { handler: 'echo' } }).build()
      const { engine } = createEngine([wf])
      const { runId } = await engine.start({ workflowName: 'cancel_idemp', tenantId: 'test-tenant', input: {} })
      await engine.cancel(runId, 'test-tenant')
      await engine.cancel(runId, 'test-tenant') // no throw
      expect((await engine.getStatus(runId, 'test-tenant')).status).toBe('CANCELLED')
    })
  })

  describe('callbacks', () => {
    it('calls onComplete', async () => {
      let ctx: any = null
      const wf = WorkflowBuilder.create('cb_complete')
        .step('a', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .onComplete(async (c) => { ctx = c })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      await engine.start({ workflowName: 'cb_complete', tenantId: 'test-tenant', input: { msg: 'hi' } })
      await executeStep(engine, queuedJobs[0])

      expect(ctx).toBeDefined()
      expect(ctx.tenantId).toBe('test-tenant')
    })

    it('calls onFail', async () => {
      let err: Error | null = null
      executor.register('boom', async (): Promise<StepResult> => { throw new Error('Boom!') })

      const wf = WorkflowBuilder.create('cb_fail')
        .step('a', { executorType: 'function', executorConfig: { handler: 'boom' }, retries: 0 })
        .onFail(async (_c, e) => { err = e })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      await engine.start({ workflowName: 'cb_fail', tenantId: 'test-tenant', input: {} })
      await executeStep(engine, queuedJobs[0])

      expect(err).toBeDefined()
      expect(err!.message).toContain('Boom!')
    })
  })
})
