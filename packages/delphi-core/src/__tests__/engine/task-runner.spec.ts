// npx vitest run src/__tests__/engine/task-runner.spec.ts
//
// Integration tests for TaskRunnerExecutor — real Postgres, real engine,
// real executeStep pattern. Tests the full planner→task_runner fan-out flow.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { TaskRunnerExecutor } from '../../steps/TaskRunnerExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepExecutionContext,
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

describe('TaskRunnerExecutor — Engine Integration', () => {
  let db: TestDb
  let fnExecutor: FunctionStepExecutor
  let taskRunnerExecutor: TaskRunnerExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    fnExecutor = new FunctionStepExecutor()
    taskRunnerExecutor = new TaskRunnerExecutor(
      new Map([['function', fnExecutor as any]]),
    )
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
  ) {
    const { connector, queuedJobs } = createMockConnector()
    const workflows = new Map(workflowDefs.map(w => [w.name, w]))
    const executors = new Map<string, any>([
      ['function', fnExecutor],
      ['task_runner', taskRunnerExecutor],
    ])
    const engine = new WorkflowEngine({
      db,
      connector,
      executors,
      workflows,
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })
    return { engine, queuedJobs }
  }

  /** Simulate what BullMQ worker does: mark RUNNING, execute, call engine callback */
  async function executeStep(engine: WorkflowEngine, job: any) {
    const payload = job.taskBody as StepPayload
    await db.query(
      'UPDATE workflow_steps SET status = $1, "startedAt" = $2, "updatedAt" = $3 WHERE "workflowRunId" = $4 AND "stepName" = $5 AND status = $6',
      [
        'RUNNING',
        new Date(),
        new Date(),
        payload.workflowRunId,
        payload.stepName,
        'QUEUED',
      ],
    )

    const exec = engine.getExecutor(payload.executorType)!
    const context: StepExecutionContext = {
      externalActions: engine.externalActions,
      taskManager: engine.taskManager,
    }
    try {
      const result = await exec.execute(payload, context)
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

  it('planner step creates tasks, task_runner step processes them all', async () => {
    // Planner: fan out work into tasks
    fnExecutor.register(
      'plan',
      async (
        p: StepPayload,
        ctx?: StepExecutionContext,
      ): Promise<StepResult> => {
        const mgr = ctx!.taskManager!
        await mgr.createTasks(p.workflowRunId, 'execute', [
          { payload: { item: 'A' } },
          { payload: { item: 'B' } },
          { payload: { item: 'C' } },
        ])
        return { output: { planned: 3 } }
      },
    )

    // Inner executor for each task
    fnExecutor.register('work', async (p: StepPayload): Promise<StepResult> => {
      return {
        output: {
          processed: (p.input as any).item,
          upper: ((p.input as any).item as string).toUpperCase(),
        },
      }
    })

    const wf = WorkflowBuilder.create('fanout')
      .step('plan', {
        executorType: 'function',
        executorConfig: { handler: 'plan' },
      })
      .step('execute', {
        dependsOn: ['plan'],
        executorType: 'task_runner',
        executorConfig: {
          executor: 'function',
          handler: 'work',
          maxConcurrentTasks: 10,
        },
      })
      .step('summarize', {
        dependsOn: ['execute'],
        executorType: 'function',
        executorConfig: { handler: 'summarize' },
      })
      .build()

    fnExecutor.register(
      'summarize',
      async (_p: StepPayload): Promise<StepResult> => {
        return { output: { summarized: true } }
      },
    )

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'fanout',
      tenantId: 'test-tenant',
      input: {},
    })

    // Step 1: plan
    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskBody.stepName).toBe('plan')
    await executeStep(engine, queuedJobs[0])

    // Verify tasks were created in DB
    const tasksAfterPlan = await db
      .selectFrom('workflow_tasks')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'execute')
      .execute()
    expect(tasksAfterPlan).toHaveLength(3)
    expect(tasksAfterPlan.every(t => t.status === 'pending')).toBe(true)

    // Step 2: task_runner processes all tasks
    expect(queuedJobs).toHaveLength(2)
    expect(queuedJobs[1].taskBody.stepName).toBe('execute')
    await executeStep(engine, queuedJobs[1])

    // Verify all tasks completed in DB
    const tasksAfterRun = await db
      .selectFrom('workflow_tasks')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'execute')
      .execute()
    expect(tasksAfterRun).toHaveLength(3)
    expect(tasksAfterRun.every(t => t.status === 'completed')).toBe(true)
    for (const t of tasksAfterRun) {
      const result = JSON.parse(t.result!)
      expect(result.processed).toBeDefined()
    }

    // Step 3: summarize
    expect(queuedJobs).toHaveLength(3)
    expect(queuedJobs[2].taskBody.stepName).toBe('summarize')
    await executeStep(engine, queuedJobs[2])

    // Workflow should be COMPLETED
    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
    expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)

    // The execute step output should contain taskStats
    const executeStep_ = status.steps.find(s => s.stepName === 'execute')
    expect((executeStep_!.output as any).taskStats.completed).toBe(3)
    expect((executeStep_!.output as any).taskStats.total).toBe(3)
  })

  it('task_runner retries failed tasks and eventually completes', async () => {
    let callCount = 0
    fnExecutor.register(
      'plan_one',
      async (
        p: StepPayload,
        ctx?: StepExecutionContext,
      ): Promise<StepResult> => {
        await ctx!.taskManager!.createTasks(p.workflowRunId, 'run', [
          { payload: { x: 1 }, maxRetries: 3 },
        ])
        return { output: { planned: 1 } }
      },
    )

    fnExecutor.register('flaky', async (): Promise<StepResult> => {
      callCount++
      if (callCount === 1) {
        throw new Error('transient failure')
      }
      return { output: { recovered: true } }
    })

    const wf = WorkflowBuilder.create('retry-fanout')
      .step('plan', {
        executorType: 'function',
        executorConfig: { handler: 'plan_one' },
      })
      .step('run', {
        dependsOn: ['plan'],
        executorType: 'task_runner',
        executorConfig: {
          executor: 'function',
          handler: 'flaky',
          maxConcurrentTasks: 10,
        },
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'retry-fanout',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0]) // plan
    await executeStep(engine, queuedJobs[1]) // task_runner

    // The task should be completed after retry
    const tasks = await db
      .selectFrom('workflow_tasks')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'run')
      .execute()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe('completed')
    expect(JSON.parse(tasks[0].result!)).toEqual({ recovered: true })
    // attempt should be 1 from the failure
    expect(tasks[0].attempt).toBe(1)
  })

  it('task_runner returns taskStats summary even when some tasks fail permanently', async () => {
    fnExecutor.register(
      'plan_mixed',
      async (
        p: StepPayload,
        ctx?: StepExecutionContext,
      ): Promise<StepResult> => {
        await ctx!.taskManager!.createTasks(p.workflowRunId, 'run', [
          { payload: { fail: false } },
          { payload: { fail: true }, maxRetries: 0 },
        ])
        return { output: { planned: 2 } }
      },
    )

    fnExecutor.register(
      'maybe_fail',
      async (p: StepPayload): Promise<StepResult> => {
        if ((p.input as any).fail) {
          throw new Error('permanent')
        }
        return { output: { ok: true } }
      },
    )

    const wf = WorkflowBuilder.create('mixed-fanout')
      .step('plan', {
        executorType: 'function',
        executorConfig: { handler: 'plan_mixed' },
      })
      .step('run', {
        dependsOn: ['plan'],
        executorType: 'task_runner',
        executorConfig: {
          executor: 'function',
          handler: 'maybe_fail',
          maxConcurrentTasks: 10,
        },
      })
      .build()

    const { engine, queuedJobs } = createEngine([wf])
    const { runId } = await engine.start({
      workflowName: 'mixed-fanout',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0]) // plan
    await executeStep(engine, queuedJobs[1]) // task_runner

    const status = await engine.getStatus(runId, 'test-tenant')
    const runStep = status.steps.find(s => s.stepName === 'run')!
    const stats = (runStep.output as any).taskStats
    expect(stats.total).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.failed).toBe(1)
  })

  it('throws if no taskManager is available in context', async () => {
    const { runId } = await (async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'noop',
        async (): Promise<StepResult> => ({ output: {} }),
      )
      const { connector } = createMockConnector()
      const wf = WorkflowBuilder.create('t')
        .step('s', {
          executorType: 'function',
          executorConfig: { handler: 'noop' },
        })
        .build()
      const engine = new WorkflowEngine({
        db,
        connector,
        executors: new Map([['function', executor]]),
        workflows: new Map([[wf.name, wf]]),
        tenantId: 't',
        disableLogBuffering: true,
      })
      return engine.start({ workflowName: 't', tenantId: 't', input: {} })
    })()

    const runner = new TaskRunnerExecutor(
      new Map([['function', fnExecutor as any]]),
    )
    await expect(
      runner.execute(
        {
          workflowRunId: runId,
          stepName: 's',
          tenantId: 't',
          input: {},
          attempt: 0,
          executorType: 'task_runner',
          executorConfig: {},
        },
        { externalActions: {} as any },
      ),
    ).rejects.toThrow('requires taskManager')
  })
})
