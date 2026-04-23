// npx vitest run src/__tests__/engine/e2e.spec.ts
//
// Full end-to-end test: engine → BullMQ queue → real worker → WorkflowStepTask.handle() → engine callback → next step → completion
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { ExternalActionEnforcer } from '../../engine/ExternalActionEnforcer.js'
import { StepCostTracker } from '../../engine/StepCostTracker.js'
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

describe('E2E: Full BullMQ Worker Flow', () => {
  let db: TestDb
  let connector: BullMQConnector
  let executor: FunctionStepExecutor
  let stopWorker: (() => Promise<void>) | null = null

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    if (stopWorker) {
      await stopWorker()
    }
    if (connector) {
      await connector.close()
    }
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)

    // Reset executor handlers
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
        await new Promise(r => setTimeout(r, 100))
        return { output: { slow: true } }
      },
    )
  })

  async function setupE2E(
    workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    extraConfig?: { interceptors?: any[] },
  ) {
    // Stop previous worker if running
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
      interceptors: extraConfig?.interceptors,
    })

    // Create the step task and wire it to the engine
    const stepTask = new WorkflowStepTask(engine)
    stepTask.setConnector(connector)

    // Start REAL BullMQ workers for both light and heavy queues
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

    // listen() already waits 1s internally, give extra time
    await new Promise(r => setTimeout(r, 500))

    return { engine, connector }
  }

  it('completes a single-step workflow via real BullMQ worker', async () => {
    const wf = WorkflowBuilder.create('e2e_single')
      .step('only', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine } = await setupE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'e2e_single',
      tenantId: 'e2e-tenant',
      input: { message: 'hello e2e' },
    })

    const finalStatus = await waitForWorkflowStatus(
      engine,
      runId,
      'e2e-tenant',
      ['COMPLETED', 'FAILED'],
    )
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'e2e-tenant')
    expect(status.output).toHaveProperty('only')
    expect((status.output as any).only.echoed).toBe(true)
  })

  it('chains A → B → C through real BullMQ workers', async () => {
    const wf = WorkflowBuilder.create('e2e_chain')
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

    const { engine } = await setupE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'e2e_chain',
      tenantId: 'e2e-tenant',
      input: { original: true },
    })

    const finalStatus = await waitForWorkflowStatus(
      engine,
      runId,
      'e2e-tenant',
      ['COMPLETED', 'FAILED'],
    )
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'e2e-tenant')
    expect(status.steps).toHaveLength(3)

    // Verify all steps completed
    for (const step of status.steps) {
      expect(step.status).toBe('COMPLETED')
    }

    // Verify step B received output from A
    const stepB = status.steps.find(s => s.stepName === 'b')
    expect(stepB?.output).toHaveProperty('transformed')
  })

  it('handles diamond DAG with parallel branches via BullMQ', async () => {
    const wf = WorkflowBuilder.create('e2e_diamond')
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

    const { engine } = await setupE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'e2e_diamond',
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

    const status = await engine.getStatus(runId, 'e2e-tenant')
    expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
  })

  it('retries failed steps and eventually completes', async () => {
    let callCount = 0
    executor.register('flakyE2E', async (): Promise<StepResult> => {
      callCount++
      if (callCount < 3) {
        throw new Error('Transient e2e failure')
      }
      return { output: { recovered: true, attempts: callCount } }
    })

    const wf = WorkflowBuilder.create('e2e_retry')
      .step('flaky', {
        executorType: 'function',
        executorConfig: { handler: 'flakyE2E' },
        retries: 5,
      })
      .build()

    const { engine } = await setupE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'e2e_retry',
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

    const status = await engine.getStatus(runId, 'e2e-tenant')
    const step = status.steps[0]
    expect((step.output as any)?.recovered).toBe(true)
  })

  it('human-in-the-loop: pauses then resumes via engine.submitHumanInput()', async () => {
    executor.register('askHuman', async (): Promise<StepResult> => {
      return {
        output: { analysis: 'done' },
        waitForHuman: { prompt: 'Approve?', schema: { type: 'object' } },
      }
    })

    const wf = WorkflowBuilder.create('e2e_human')
      .step('analyze', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('review', {
        dependsOn: ['analyze'],
        executorType: 'function',
        executorConfig: { handler: 'askHuman' },
      })
      .step('deploy', {
        dependsOn: ['review'],
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine } = await setupE2E([wf])
    const { runId } = await engine.start({
      workflowName: 'e2e_human',
      tenantId: 'e2e-tenant',
      input: {},
    })

    // Wait for workflow to pause at human step
    await waitForWorkflowStatus(engine, runId, 'e2e-tenant', ['WAITING_HUMAN'])

    const paused = await engine.getStatus(runId, 'e2e-tenant')
    expect(paused.status).toBe('WAITING_HUMAN')
    const reviewStep = paused.steps.find(s => s.stepName === 'review')
    expect(reviewStep?.status).toBe('WAITING_HUMAN')

    // Submit human input — this should unblock the workflow
    await engine.submitHumanInput({
      workflowRunId: runId,
      stepName: 'review',
      tenantId: 'e2e-tenant',
      data: { approved: true },
      respondedBy: 'admin@test.com',
    })

    // Wait for workflow to complete (deploy step runs via BullMQ)
    const finalStatus = await waitForWorkflowStatus(
      engine,
      runId,
      'e2e-tenant',
      ['COMPLETED', 'FAILED'],
    )
    expect(finalStatus).toBe('COMPLETED')
  })

  it('StepCostTracker interceptor persists cost data through full workflow', async () => {
    executor.register(
      'aiStep',
      async (): Promise<StepResult> => ({
        output: {
          response: 'The answer is 42.',
          _usage: { tokens: 250, costUsd: 0.005, model: 'gpt-4o' },
        },
      }),
    )

    const wf = WorkflowBuilder.create('e2e_cost')
      .step('ai', {
        executorType: 'function',
        executorConfig: { handler: 'aiStep' },
      })
      .build()

    const { engine } = await setupE2E([wf], {
      interceptors: [new StepCostTracker({ db })],
    })

    const { runId } = await engine.start({
      workflowName: 'e2e_cost',
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

    // Verify cost data persisted in DB
    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', 'ai')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBe(250)
    expect(step!.costUsd).toBe('0.005')
    expect(step!.modelUsed).toBe('gpt-4o')
  })

  it('ExternalActionEnforcer interceptor warns when no ExternalAction records', async () => {
    const warnings: string[] = []

    executor.register(
      'directCall',
      async (): Promise<StepResult> => ({
        output: { result: 'called API directly' },
      }),
    )

    const wf = WorkflowBuilder.create('e2e_enforce')
      .step('direct', {
        executorType: 'function',
        executorConfig: { handler: 'directCall' },
      })
      .build()

    const { engine } = await setupE2E([wf], {
      interceptors: [
        new ExternalActionEnforcer({
          db,
          strict: false,
          enforcedExecutorTypes: ['function'], // Enforce on function for test
          logger: {
            warn: (msg: any) => warnings.push(String(msg)),
            error: () => {},
          },
        }),
      ],
    })

    const { runId } = await engine.start({
      workflowName: 'e2e_enforce',
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

    // Enforcer should have logged a warning (non-strict mode)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings[0]).toContain('ExternalActionEnforcer')
  })
})
