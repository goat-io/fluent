// npx vitest run src/__tests__/engine/workflow-versioning.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type { WorkflowDefinition } from '../../workflow/WorkflowBuilder.types.js'
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
      }),
    },
    queuedJobs,
  }
}

describe('workflow versioning', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
  })

  it('uses stored definition snapshot for in-flight workflows, not live registry', async () => {
    // V1: step has 5 retries
    const v1 = WorkflowBuilder.create('versioned_wf')
      .version('1.0.0')
      .defaultRetries(5)
      .step('do_work', {
        executorType: 'function',
        executorConfig: { handler: 'versioned_wf.do_work' },
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()
    executor.register('versioned_wf.do_work', async () => {
      throw new Error('fail')
    })

    const workflows = new Map<string, WorkflowDefinition>([
      ['versioned_wf', v1],
    ])

    const engine = new WorkflowEngine({
      db,
      workflows,
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })

    // Start workflow with v1 definition
    const { runId } = await engine.start({
      workflowName: 'versioned_wf',
      tenantId: 'test',
      input: { foo: 'bar' },
    })

    // Verify v1 snapshot was stored
    const { rows: runRows } = await db.query<any>(
      `SELECT "definitionSnapshot", "workflowVersion" FROM workflow_runs WHERE id = $1`,
      [runId],
    )
    expect(runRows[0].workflowVersion).toBe('1.0.0')
    const snapshot = JSON.parse(runRows[0].definitionSnapshot)
    expect(snapshot.defaultRetries).toBe(5)
    expect(snapshot.version).toBe('1.0.0')

    // Now simulate a deployment: replace registry with v2 (2 retries, different config)
    const v2 = WorkflowBuilder.create('versioned_wf')
      .version('2.0.0')
      .defaultRetries(2)
      .step('do_work', {
        executorType: 'function',
        executorConfig: { handler: 'versioned_wf.do_work_v2' },
      })
      .build()

    workflows.set('versioned_wf', v2)

    // Fail the step — engine should use v1 snapshot (5 retries), not v2 live (2 retries)
    await engine.onStepFailed(runId, 'do_work', 'test', new Error('boom'))

    // Step should be retried (v1 has 5 retries, attempt 0 < 5)
    const { rows: stepRows } = await db.query<any>(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    expect(stepRows[0].status).toBe('QUEUED') // retried, not failed
    expect(stepRows[0].attempt).toBe(1)
    // maxRetries was set from v1 at start time (5), so canRetry = true
    expect(stepRows[0].maxRetries).toBe(5)
  })

  it('still works when workflow is removed from registry (graceful degradation)', async () => {
    const def = WorkflowBuilder.create('ephemeral_wf')
      .version('1.0.0')
      .defaultRetries(3)
      .step('action', {
        executorType: 'function',
        executorConfig: { handler: 'ephemeral_wf.action' },
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()

    const workflows = new Map<string, WorkflowDefinition>([
      ['ephemeral_wf', def],
    ])

    const engine = new WorkflowEngine({
      db,
      workflows,
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })

    const { runId } = await engine.start({
      workflowName: 'ephemeral_wf',
      tenantId: 'test',
      input: {},
    })

    // Remove workflow from registry (simulates code deployment that removes it)
    workflows.delete('ephemeral_wf')

    // onStepFailed should still work using the stored snapshot
    await engine.onStepFailed(runId, 'action', 'test', new Error('boom'))

    const { rows } = await db.query<any>(
      `SELECT status, attempt FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    expect(rows[0].status).toBe('QUEUED') // retried from snapshot
    expect(rows[0].attempt).toBe(1)
  })

  it('snapshot includes backoff, transactional, and requiresLabels', async () => {
    const def = WorkflowBuilder.create('full_snapshot_wf')
      .version('1.0.0')
      .defaultRetries(3)
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'full_snapshot_wf.step_a' },
        backoff: { type: 'exponential', delayMs: 2000 },
        transactional: true,
        requiresLabels: ['gpu', 'high-mem'],
      })
      .build()

    const { connector } = createMockConnector()

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['full_snapshot_wf', def]]),
      executors: new Map([['function', new FunctionStepExecutor()]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })

    const { runId } = await engine.start({
      workflowName: 'full_snapshot_wf',
      tenantId: 'test',
      input: {},
    })

    const { rows } = await db.query<any>(
      `SELECT "definitionSnapshot" FROM workflow_runs WHERE id = $1`,
      [runId],
    )
    const snapshot = JSON.parse(rows[0].definitionSnapshot)
    const stepSnap = snapshot.steps[0]

    expect(stepSnap.backoff).toEqual({ type: 'exponential', delayMs: 2000 })
    expect(stepSnap.transactional).toBe(true)
    expect(stepSnap.requiresLabels).toEqual(['gpu', 'high-mem'])
  })

  it('falls back to live registry when no snapshot exists (legacy runs)', async () => {
    const def = WorkflowBuilder.create('legacy_wf')
      .version('1.0.0')
      .defaultRetries(3)
      .step('work', {
        executorType: 'function',
        executorConfig: { handler: 'legacy_wf.work' },
      })
      .build()

    const { connector } = createMockConnector()

    const workflows = new Map<string, WorkflowDefinition>([['legacy_wf', def]])

    const engine = new WorkflowEngine({
      db,
      workflows,
      executors: new Map([['function', new FunctionStepExecutor()]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
    })

    const { runId } = await engine.start({
      workflowName: 'legacy_wf',
      tenantId: 'test',
      input: {},
    })

    // Simulate legacy: null out the snapshot
    await db.query(
      `UPDATE workflow_runs SET "definitionSnapshot" = NULL WHERE id = $1`,
      [runId],
    )

    // Should fall back to live registry without error
    await engine.onStepFailed(runId, 'work', 'test', new Error('boom'))

    const { rows } = await db.query<any>(
      `SELECT status, attempt FROM workflow_steps WHERE "workflowRunId" = $1`,
      [runId],
    )
    expect(rows[0].status).toBe('QUEUED')
    expect(rows[0].attempt).toBe(1)
  })
})
