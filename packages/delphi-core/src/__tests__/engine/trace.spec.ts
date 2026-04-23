// npx vitest run src/__tests__/engine/trace.spec.ts
//
// Integration tests for trace propagation — real Postgres, real engine,
// real step execution. Verifies traceId flows through runs, events, and external actions.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
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

describe('Trace Propagation', () => {
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
      async (payload: StepPayload): Promise<StepResult> => {
        return { output: { echoed: true, step: payload.stepName } }
      },
    )
  })

  function createEngine(extraConfig?: {
    eventIngestion?: EventIngestionService
  }) {
    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('trace-wf')
      .step('step1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('step2', {
        dependsOn: ['step1'],
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      eventIngestion: extraConfig?.eventIngestion,
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

  it('auto-generates traceId on start and persists in DB', async () => {
    const { engine } = createEngine()
    const { runId } = await engine.start({
      workflowName: 'trace-wf',
      tenantId: 'test-tenant',
      input: {},
    })

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    expect(run.traceId).toBeTruthy()
    expect(run.traceId!.length).toBe(21)
    expect(run.parentRunId).toBeNull()
    expect(run.originEventId).toBeNull()
  })

  it('uses provided traceId and stores parentRunId / originEventId', async () => {
    const { engine } = createEngine()
    const { runId } = await engine.start({
      workflowName: 'trace-wf',
      tenantId: 'test-tenant',
      input: {},
      traceId: 'custom-trace-42',
      parentRunId: 'parent-run-1',
      originEventId: 'event-99',
    })

    const run = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirstOrThrow()

    expect(run.traceId).toBe('custom-trace-42')
    expect(run.parentRunId).toBe('parent-run-1')
    expect(run.originEventId).toBe('event-99')
  })

  it('traceId is included in getStatus response after step execution', async () => {
    const { engine, queuedJobs } = createEngine()
    const { runId } = await engine.start({
      workflowName: 'trace-wf',
      tenantId: 'test-tenant',
      input: {},
      traceId: 'status-trace-123',
    })

    // Execute both steps
    await executeStep(engine, queuedJobs[0])
    await executeStep(engine, queuedJobs[1])

    const status = await engine.getStatus(runId, 'test-tenant')
    expect(status.status).toBe('COMPLETED')
    expect(status.traceId).toBe('status-trace-123')
  })

  it('getTrace returns all runs sharing the same traceId', async () => {
    const { engine, queuedJobs } = createEngine()
    const sharedTraceId = 'shared-lineage-001'

    // Start parent workflow
    const { runId: parentId } = await engine.start({
      workflowName: 'trace-wf',
      tenantId: 'test-tenant',
      input: {},
      traceId: sharedTraceId,
    })

    // Start child workflow with same traceId
    const { runId: childId } = await engine.start({
      workflowName: 'trace-wf',
      tenantId: 'test-tenant',
      input: {},
      traceId: sharedTraceId,
      parentRunId: parentId,
    })

    // Execute parent steps
    await executeStep(engine, queuedJobs[0])
    await executeStep(engine, queuedJobs[1])

    const trace = await engine.getTrace(sharedTraceId)
    expect(trace.runs).toHaveLength(2)

    const runIds = trace.runs.map(r => r.id).sort()
    expect(runIds).toEqual([parentId, childId].sort())

    // Child should have parentRunId set
    const child = trace.runs.find(r => r.id === childId)!
    expect(child.parentRunId).toBe(parentId)
  })

  it('traceId propagates to external actions', async () => {
    // Register a step that uses external actions
    executor.register(
      'callExternal',
      async (
        p: StepPayload,
        ctx?: StepExecutionContext,
      ): Promise<StepResult> => {
        await ctx!.externalActions.execute(
          {
            workflowRunId: p.workflowRunId,
            stepName: p.stepName,
            attempt: p.attempt,
            tenantId: p.tenantId,
            provider: 'github',
            actionType: 'create_pr',
            request: { title: 'Test PR' },
          },
          async _req => ({
            externalId: 'pr-42',
            data: { url: 'https://github.com/test/pr/42' },
          }),
        )
        return { output: { prCreated: true } }
      },
    )

    const { connector, queuedJobs } = createMockConnector()
    const wf = WorkflowBuilder.create('trace-external')
      .step('call', {
        executorType: 'function',
        executorConfig: { handler: 'callExternal' },
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    const traceId = 'trace-for-external-actions'
    const { runId } = await engine.start({
      workflowName: 'trace-external',
      tenantId: 'test-tenant',
      input: {},
      traceId,
    })

    // Execute the step that creates an external action
    const payload = queuedJobs[0].taskBody as StepPayload
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
    const ctx: StepExecutionContext = {
      externalActions: engine.externalActions,
    }
    const result = await executor.execute(payload, ctx)
    await engine.onStepCompleted(
      payload.workflowRunId,
      payload.stepName,
      payload.tenantId,
      result,
    )

    // Verify the external action has the traceId
    const actions = await db
      .selectFrom('external_actions')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .execute()
    expect(actions).toHaveLength(1)
    expect(actions[0].traceId).toBe(traceId)
    expect(actions[0].provider).toBe('github')

    // Verify getTrace includes both the run and the action
    const trace = await engine.getTrace(traceId)
    expect(trace.runs).toHaveLength(1)
    expect(trace.actions).toHaveLength(1)
    expect(trace.actions[0].traceId).toBe(traceId)
  })

  it('event-ingested traceId is persisted in workflow_events', async () => {
    const eventIngestion = new EventIngestionService({
      db,
      skipAutoProcess: true,
    })
    const { engine } = createEngine({ eventIngestion })

    const traceId = 'event-trace-555'
    const { eventId } = await eventIngestion.ingest({
      tenantId: 'test-tenant',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 42 },
      traceId,
    })

    const event = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirstOrThrow()

    expect(event.traceId).toBe(traceId)
    await engine.shutdown()
  })

  it('startBatch assigns unique traceIds to each workflow', async () => {
    const { engine } = createEngine()

    const results = await engine.startBatch([
      { workflowName: 'trace-wf', tenantId: 'test-tenant', input: {} },
      { workflowName: 'trace-wf', tenantId: 'test-tenant', input: {} },
    ])

    const run1 = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', results[0].runId)
      .executeTakeFirstOrThrow()
    const run2 = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', results[1].runId)
      .executeTakeFirstOrThrow()

    expect(run1.traceId).toBeTruthy()
    expect(run2.traceId).toBeTruthy()
    expect(run1.traceId).not.toBe(run2.traceId)
    await engine.shutdown()
  })
})
