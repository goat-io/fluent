// npx vitest run src/__tests__/engine/guardrails.spec.ts
//
// Integration tests for budget guardrails — real Postgres, real engine,
// real executeStep pattern. Verifies budgets are enforced and persisted.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { fromJson } from '../../entities/Database.js'
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

describe('Budget Guardrails', () => {
  let db: TestDb
  let fnExecutor: FunctionStepExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    fnExecutor = new FunctionStepExecutor()
    fnExecutor.register(
      'echo',
      async (payload: StepPayload): Promise<StepResult> => {
        return { output: { echoed: true, step: payload.stepName } }
      },
    )
  })

  function createEngine(budget?: {
    maxSteps?: number
    maxTokens?: number
    maxCostUsd?: number
    maxTaskExecutions?: number
  }) {
    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('budget-wf')
      .step('step1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('step2', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        dependsOn: ['step1'],
      })
      .step('step3', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        dependsOn: ['step2'],
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', fnExecutor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      defaultBudget: budget,
    })
    return { engine, queuedJobs }
  }

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

  it('budget is initialized to zero on workflow start', async () => {
    const { engine } = createEngine({ maxSteps: 10 })
    const { runId } = await engine.start({
      workflowName: 'budget-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    const budgetUsed = fromJson<any>(run.budgetUsed)
    expect(budgetUsed).toEqual({
      tokens: 0,
      costUsd: 0,
      steps: 0,
      taskExecutions: 0,
    })

    const budget = fromJson<any>(run.budget)
    expect(budget).toEqual({ maxSteps: 10 })
    await engine.shutdown()
  })

  it('step counter increments after each completed step', async () => {
    const { engine, queuedJobs } = createEngine({ maxSteps: 100 })
    const { runId } = await engine.start({
      workflowName: 'budget-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    // Execute step1
    await executeStep(engine, queuedJobs[0])

    let run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()
    expect(fromJson<any>(run.budgetUsed).steps).toBe(1)

    // Execute step2
    await executeStep(engine, queuedJobs[1])

    run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()
    expect(fromJson<any>(run.budgetUsed).steps).toBe(2)

    // Execute step3
    await executeStep(engine, queuedJobs[2])

    run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()
    expect(fromJson<any>(run.budgetUsed).steps).toBe(3)

    // Workflow completes normally
    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
    await engine.shutdown()
  })

  it('maxSteps=1 stops workflow after first step completes', async () => {
    const { engine, queuedJobs } = createEngine({ maxSteps: 1 })
    const { runId } = await engine.start({
      workflowName: 'budget-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    // Execute step1 — this increments steps to 1, which hits maxSteps
    await executeStep(engine, queuedJobs[0])

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    expect(run.status).toBe('FAILED')
    expect(run.error).toContain('Step budget exceeded')
    expect(fromJson<any>(run.budgetUsed).steps).toBe(1)

    // step2 should NOT have been queued
    expect(queuedJobs).toHaveLength(1) // only step1 was queued
    await engine.shutdown()
  })

  it('tracks token and cost usage from step output _usage field', async () => {
    fnExecutor.register(
      'ai_step',
      async (): Promise<StepResult> => ({
        output: {
          response: 'Generated text',
          _usage: { tokens: 500, costUsd: 0.01, model: 'gpt-4o' },
        },
      }),
    )

    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('cost-wf')
      .step('ai', {
        executorType: 'function',
        executorConfig: { handler: 'ai_step' },
      })
      .step('next', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        dependsOn: ['ai'],
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', fnExecutor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      defaultBudget: { maxTokens: 10000, maxCostUsd: 1.0, maxSteps: 100 },
    })

    const { runId } = await engine.start({
      workflowName: 'cost-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0]) // ai step

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    const used = fromJson<any>(run.budgetUsed)
    expect(used.steps).toBe(1)
    expect(used.tokens).toBe(500)
    expect(used.costUsd).toBe(0.01)
    await engine.shutdown()
  })

  it('maxTokens exceeded fails workflow mid-execution', async () => {
    fnExecutor.register(
      'expensive',
      async (): Promise<StepResult> => ({
        output: {
          data: 'expensive output',
          _usage: { tokens: 5000, costUsd: 0.5 },
        },
      }),
    )

    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('token-wf')
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'expensive' },
      })
      .step('s2', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        dependsOn: ['s1'],
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', fnExecutor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      defaultBudget: { maxTokens: 1000, maxSteps: 100 },
    })

    const { runId } = await engine.start({
      workflowName: 'token-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0]) // s1 uses 5000 tokens > 1000 limit

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    expect(run.status).toBe('FAILED')
    expect(run.error).toContain('Token budget exceeded')
    expect(fromJson<any>(run.budgetUsed).tokens).toBe(5000)
    await engine.shutdown()
  })

  it('maxTaskExecutions stops task_runner before processing all tasks', async () => {
    const taskRunnerExecutor = new TaskRunnerExecutor(
      new Map([['function', fnExecutor as any]]),
    )

    fnExecutor.register(
      'create_tasks',
      async (
        p: StepPayload,
        ctx?: StepExecutionContext,
      ): Promise<StepResult> => {
        await ctx!.taskManager!.createTasks(p.workflowRunId, 'run_tasks', [
          { payload: { i: 1 } },
          { payload: { i: 2 } },
          { payload: { i: 3 } },
          { payload: { i: 4 } },
          { payload: { i: 5 } },
        ])
        return { output: { created: 5 } }
      },
    )

    fnExecutor.register('process', async (): Promise<StepResult> => {
      return { output: { done: true } }
    })

    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('task-budget-wf')
      .step('create', {
        executorType: 'function',
        executorConfig: { handler: 'create_tasks' },
      })
      .step('run_tasks', {
        dependsOn: ['create'],
        executorType: 'task_runner',
        executorConfig: {
          executor: 'function',
          handler: 'process',
          maxConcurrentTasks: 10,
        },
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map<string, any>([
        ['function', fnExecutor],
        ['task_runner', taskRunnerExecutor],
      ]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      defaultBudget: { maxTaskExecutions: 2, maxSteps: 100 },
    })

    const { runId } = await engine.start({
      workflowName: 'task-budget-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    // Execute the create step with taskManager in context
    const createPayload = queuedJobs[0].taskBody as StepPayload
    await db
      .updateTable('workflow_steps')
      .set({ status: 'RUNNING', startedAt: new Date(), updatedAt: new Date() })
      .where('workflowRunId', '=', createPayload.workflowRunId)
      .where('stepName', '=', createPayload.stepName)
      .where('status', '=', 'QUEUED')
      .execute()
    const ctx: StepExecutionContext = {
      externalActions: engine.externalActions,
      taskManager: engine.taskManager,
      checkBudget: (rid, field, amount) =>
        engine.incrementBudgetUsage(rid, field as any, amount),
    }
    const createResult = await fnExecutor.execute(createPayload, ctx)
    await engine.onStepCompleted(
      createPayload.workflowRunId,
      createPayload.stepName,
      createPayload.tenantId,
      createResult,
    )

    // Execute the task_runner step
    const runPayload = queuedJobs[1].taskBody as StepPayload
    await db
      .updateTable('workflow_steps')
      .set({ status: 'RUNNING', startedAt: new Date(), updatedAt: new Date() })
      .where('workflowRunId', '=', runPayload.workflowRunId)
      .where('stepName', '=', runPayload.stepName)
      .where('status', '=', 'QUEUED')
      .execute()
    const runResult = await taskRunnerExecutor.execute(runPayload, ctx)
    await engine.onStepCompleted(
      runPayload.workflowRunId,
      runPayload.stepName,
      runPayload.tenantId,
      runResult,
    )

    // Check that not all 5 tasks were processed
    const stats = (runResult.output as any).taskStats
    expect(stats.completed).toBeLessThanOrEqual(3) // budget kicks in around task 2-3
    expect(stats.completed).toBeGreaterThanOrEqual(1)

    // Verify budget usage was persisted
    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()
    const used = fromJson<any>(run.budgetUsed)
    expect(used.taskExecutions).toBeGreaterThanOrEqual(1)
    await engine.shutdown()
  })

  it('no budget = no enforcement, all steps complete', async () => {
    const { engine, queuedJobs } = createEngine(/* no budget */)
    const { runId } = await engine.start({
      workflowName: 'budget-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    await executeStep(engine, queuedJobs[0])
    await executeStep(engine, queuedJobs[1])
    await executeStep(engine, queuedJobs[2])

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
    expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
    await engine.shutdown()
  })
})
