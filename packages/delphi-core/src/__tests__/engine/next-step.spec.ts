// npx vitest run src/__tests__/engine/next-step.spec.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
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

describe('nextStep Runtime Transitions', () => {
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
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
  ) {
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
    await db.query(
      'UPDATE workflow_steps SET status = $1, "startedAt" = $2, "updatedAt" = $3 WHERE "workflowRunId" = $4 AND "stepName" = $5 AND status IN ($6, $7)',
      [
        'RUNNING',
        new Date(),
        new Date(),
        payload.workflowRunId,
        payload.stepName,
        'QUEUED',
        'PENDING',
      ],
    )

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

  it('nextStep causes target step re-dispatch', async () => {
    let callCount = 0
    executor.register('looper', async (): Promise<StepResult> => {
      callCount++
      if (callCount === 1) {
        return { output: { iteration: callCount }, nextStep: 'step_a' }
      }
      return { output: { iteration: callCount } }
    })

    const wf = WorkflowBuilder.create('nextstep_redispatch')
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'looper' },
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'nextstep_redispatch',
      tenantId: 'test-tenant',
      input: {},
    })

    // First execution: step_a completes with nextStep:'step_a'
    expect(queuedJobs).toHaveLength(1)
    await executeStep(engine, queuedJobs[0])

    // step_a should be re-dispatched (back to PENDING then QUEUED)
    expect(queuedJobs).toHaveLength(2)
    expect(queuedJobs[1].taskBody.stepName).toBe('step_a')

    // Verify step was reset to QUEUED (dispatched)
    const statusMid = await engine.getStatus(runId, 'test-tenant')
    const stepA = statusMid.steps.find(s => s.stepName === 'step_a')
    expect(stepA?.status).toBe('QUEUED')

    // Second execution: step_a completes normally
    await executeStep(engine, queuedJobs[1])

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
  })

  it('iterationCount increments on each re-entry', async () => {
    let callCount = 0
    executor.register('counter', async (): Promise<StepResult> => {
      callCount++
      if (callCount <= 3) {
        return { output: { count: callCount }, nextStep: 'step_a' }
      }
      return { output: { count: callCount } }
    })

    const wf = WorkflowBuilder.create('nextstep_iteration')
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'counter' },
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'nextstep_iteration',
      tenantId: 'test-tenant',
      input: {},
    })

    // Execute 3 loops + 1 final
    for (let i = 0; i < 4; i++) {
      await executeStep(engine, queuedJobs[i])
    }

    // Verify iterationCount reached 3
    const stepRow = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'step_a')
      .executeTakeFirst()

    expect(stepRow?.iterationCount).toBe(3)

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
  })

  it('exceeding maxIterations fails the workflow', async () => {
    let callCount = 0
    executor.register('infinite', async (): Promise<StepResult> => {
      callCount++
      return { output: { count: callCount }, nextStep: 'step_a' }
    })

    const wf = WorkflowBuilder.create('nextstep_maxiter')
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'infinite' },
        maxIterations: 2,
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'nextstep_maxiter',
      tenantId: 'test-tenant',
      input: {},
    })

    // Execute twice (iterations 0 and 1 succeed since maxIterations=2)
    await executeStep(engine, queuedJobs[0]) // iteration 0 -> nextStep, count becomes 1
    await executeStep(engine, queuedJobs[1]) // iteration 1 -> nextStep, count becomes 2

    // Third execution: step completes, but the nextStep redirect fails (maxIterations exceeded).
    // The error from onStepCompleted is caught by executeStep and routed to onStepFailed.
    await executeStep(engine, queuedJobs[2])

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('FAILED')
    expect(status.error).toContain('exceeded max iterations')
  })

  it('nextStep to non-existent step throws error', async () => {
    executor.register('badNext', async (): Promise<StepResult> => {
      return { output: { ok: true }, nextStep: 'nonexistent' }
    })

    const wf = WorkflowBuilder.create('nextstep_bad_target')
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'badNext' },
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'nextstep_bad_target',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0])

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('FAILED')

    const failedStep = status.steps.find(s => s.stepName === 'step_a')
    expect(failedStep?.status).toBe('FAILED')
    expect(failedStep?.error).toContain('does not exist')
  })

  describe('E2E with BullMQ', () => {
    let connector: BullMQConnector
    let stopWorker: (() => Promise<void>) | null = null

    afterAll(async () => {
      if (stopWorker) {
        await stopWorker()
      }
      if (connector) {
        await connector.close()
      }
    })

    async function setupE2E(
      workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    ) {
      if (stopWorker) {
        await stopWorker()
        stopWorker = null
      }
      if (connector) {
        await connector.close()
      }

      const data = getGlobalData()
      connector = new BullMQConnector({
        connection: { host: data.redis.host, port: data.redis.port },
      })

      const workflowMap = new Map(workflows.map(w => [w.name, w]))

      const engine = new WorkflowEngine({
        db,
        connector,
        executors: new Map([['function', executor]]),
        workflows: workflowMap,
        tenantId: 'e2e-tenant',
        disableLogBuffering: true,
      })

      const stepTask = new WorkflowStepTask(engine)
      stepTask.setConnector(connector)

      const listenHandle = await connector.listen({
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

      await new Promise(r => setTimeout(r, 500))

      return { engine, connector }
    }

    it('single step loops via nextStep twice then completes', async () => {
      let loopCount = 0
      executor.register(
        'loopHandler',
        async (_payload: StepPayload): Promise<StepResult> => {
          loopCount++
          if (loopCount <= 2) {
            return { output: { loop: loopCount }, nextStep: 'looper' }
          }
          return { output: { loop: loopCount, done: true } }
        },
      )

      const wf = WorkflowBuilder.create('e2e_nextstep_loop')
        .step('looper', {
          executorType: 'function',
          executorConfig: { handler: 'loopHandler' },
        })
        .build()

      const { engine } = await setupE2E([wf])
      const { runId } = await engine.start({
        workflowName: 'e2e_nextstep_loop',
        tenantId: 'e2e-tenant',
        input: {},
      })

      const finalStatus = await waitForWorkflowStatus(
        engine,
        runId,
        'e2e-tenant',
        ['COMPLETED', 'FAILED'],
      )
      expect(finalStatus).toBe('COMPLETED')

      // Should have looped 3 times (2 nextStep redirects + 1 final completion)
      expect(loopCount).toBe(3)

      const status = await engine.getStatus(runId, 'e2e-tenant')
      expect(status.output).toHaveProperty('looper')
      expect((status.output as any).looper.done).toBe(true)

      // Verify iteration count in DB
      const stepRow = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'looper')
        .executeTakeFirst()
      expect(stepRow?.iterationCount).toBe(2)
    })
  })
})
