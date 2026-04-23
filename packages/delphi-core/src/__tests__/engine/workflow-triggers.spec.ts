// npx vitest run src/__tests__/engine/workflow-triggers.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
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

describe('Workflow Triggers', () => {
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
        return { output: { echoed: true, input: payload.input } }
      },
    )
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    eventIngestion?: EventIngestionService,
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
      eventIngestion,
    })
    return { engine, queuedJobs }
  }

  it('WorkflowBuilder .trigger() produces correct definition', () => {
    const definition = WorkflowBuilder.create('triggered-wf')
      .trigger({ eventType: 'github.push' })
      .trigger({ eventType: 'github.pr.opened', type: 'event' })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    expect(definition.triggers).toBeDefined()
    expect(definition.triggers).toHaveLength(2)
    expect(definition.triggers![0]).toEqual({
      type: 'event',
      eventType: 'github.push',
    })
    expect(definition.triggers![1]).toEqual({
      type: 'event',
      eventType: 'github.pr.opened',
    })
  })

  it('Event matching starts workflow', async () => {
    const eventIngestion = new EventIngestionService({ db })

    const definition = WorkflowBuilder.create('deploy-on-push')
      .trigger({ eventType: 'github.push' })
      .step('deploy', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: _engine, queuedJobs } = createEngine(
      [definition],
      eventIngestion,
    )

    await eventIngestion.ingest({
      eventType: 'github.push',
      source: 'github',
      payload: { branch: 'main', sha: 'abc123' },
      tenantId: 'test-tenant',
    })

    // A workflow run should have been created
    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'deploy-on-push')
      .execute()

    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('RUNNING')
    expect(queuedJobs.length).toBeGreaterThanOrEqual(1)
  })

  it('mapTriggerInput transforms event payload', async () => {
    const eventIngestion = new EventIngestionService({ db })

    const definition = WorkflowBuilder.create('transform-wf')
      .trigger({
        eventType: 'github.push',
        mapTriggerInput: payload => ({
          ref: payload.branch,
          commit: payload.sha,
        }),
      })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: _engine } = createEngine([definition], eventIngestion)

    await eventIngestion.ingest({
      eventType: 'github.push',
      source: 'github',
      payload: { branch: 'main', sha: 'def456' },
      tenantId: 'test-tenant',
    })

    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'transform-wf')
      .execute()

    expect(runs).toHaveLength(1)
    // The triggerInput should be the mapped version
    const input = JSON.parse(runs[0].triggerInput!)
    expect(input).toEqual({ ref: 'main', commit: 'def456' })
  })

  it('filter rejects non-matching events', async () => {
    const eventIngestion = new EventIngestionService({ db })

    const definition = WorkflowBuilder.create('filtered-wf')
      .trigger({
        eventType: 'github.push',
        filter: payload => payload.branch === 'main',
      })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: _engine } = createEngine([definition], eventIngestion)

    // Ingest event that does NOT match filter
    await eventIngestion.ingest({
      eventType: 'github.push',
      source: 'github',
      payload: { branch: 'feature/xyz', sha: 'aaa' },
      tenantId: 'test-tenant',
    })

    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'filtered-wf')
      .execute()

    expect(runs).toHaveLength(0)
  })

  it('Duplicate event does not start second workflow', async () => {
    const eventIngestion = new EventIngestionService({ db })

    const definition = WorkflowBuilder.create('idempotent-wf')
      .trigger({ eventType: 'github.push' })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: _engine } = createEngine([definition], eventIngestion)

    const event = {
      eventType: 'github.push',
      source: 'github',
      payload: { branch: 'main' },
      tenantId: 'test-tenant',
      idempotencyKey: 'evt-unique-123',
    }

    await eventIngestion.ingest(event)
    await eventIngestion.ingest(event) // same idempotencyKey

    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('workflowName', '=', 'idempotent-wf')
      .execute()

    expect(runs).toHaveLength(1)
  })

  it('Multiple workflows can trigger from same event', async () => {
    const eventIngestion = new EventIngestionService({ db })

    const defA = WorkflowBuilder.create('wf-a')
      .trigger({ eventType: 'github.push' })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const defB = WorkflowBuilder.create('wf-b')
      .trigger({ eventType: 'github.push' })
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: _engine } = createEngine([defA, defB], eventIngestion)

    await eventIngestion.ingest({
      eventType: 'github.push',
      source: 'github',
      payload: { branch: 'main' },
      tenantId: 'test-tenant',
    })

    const runs = await db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('tenantId', '=', 'test-tenant')
      .execute()

    expect(runs).toHaveLength(2)
    const names = runs.map(r => r.workflowName).sort()
    expect(names).toEqual(['wf-a', 'wf-b'])
  })
})
