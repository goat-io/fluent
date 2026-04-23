// npx vitest run src/__tests__/engine/queue-expansion.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
  StepWeight,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('Queue Expansion (4 queue types)', () => {
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
      'noop',
      async (_p: StepPayload): Promise<StepResult> => ({
        output: { done: true },
      }),
    )
  })

  function createEngineWithWeight(stepWeight?: StepWeight) {
    const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
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

    const builder = WorkflowBuilder.create(
      `queue_test_${stepWeight ?? 'default'}`,
    ).step('step_a', {
      executorType: 'function',
      executorConfig: { handler: 'noop' },
      stepWeight,
    })

    const wf = builder.build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    return { engine, queuedJobs, workflowName: wf.name }
  }

  it('routes "ai" weight to workflow_step_ai queue', async () => {
    const { engine, queuedJobs, workflowName } = createEngineWithWeight('ai')
    await engine.start({ workflowName, tenantId: 'test-tenant', input: {} })

    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskName).toBe('workflow_step_ai')
  })

  it('routes "sandbox" weight to workflow_step_sandbox queue', async () => {
    const { engine, queuedJobs, workflowName } =
      createEngineWithWeight('sandbox')
    await engine.start({ workflowName, tenantId: 'test-tenant', input: {} })

    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskName).toBe('workflow_step_sandbox')
  })

  it('routes "light" weight to workflow_step_light queue', async () => {
    const { engine, queuedJobs, workflowName } = createEngineWithWeight('light')
    await engine.start({ workflowName, tenantId: 'test-tenant', input: {} })

    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskName).toBe('workflow_step_light')
  })

  it('routes "heavy" weight to workflow_step_heavy queue', async () => {
    const { engine, queuedJobs, workflowName } = createEngineWithWeight('heavy')
    await engine.start({ workflowName, tenantId: 'test-tenant', input: {} })

    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskName).toBe('workflow_step_heavy')
  })

  it('defaults to workflow_step_light when no weight is specified', async () => {
    const { engine, queuedJobs, workflowName } =
      createEngineWithWeight(undefined)
    await engine.start({ workflowName, tenantId: 'test-tenant', input: {} })

    expect(queuedJobs).toHaveLength(1)
    expect(queuedJobs[0].taskName).toBe('workflow_step_light')
  })
})
