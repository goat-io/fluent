// npx vitest run src/__tests__/engine/tasks.spec.ts
//
// Integration tests for TaskManager — real Postgres via testcontainers.
// Tests CRUD, FOR UPDATE SKIP LOCKED concurrency, retry lifecycle, and aggregation.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { TaskManager } from '../../engine/TaskManager.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type { StepResult } from '../../workflow/WorkflowBuilder.types.js'
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

describe('TaskManager', () => {
  let db: TestDb
  let tm: TaskManager

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    tm = new TaskManager(db)
  })

  // Helper: create a real workflow run via the engine so all columns are populated
  async function startRun(): Promise<{
    engine: WorkflowEngine
    runId: string
  }> {
    const executor = new FunctionStepExecutor()
    executor.register('noop', async (): Promise<StepResult> => ({ output: {} }))
    const { connector } = createMockConnector()
    const wf = WorkflowBuilder.create('task-test')
      .step('s1', {
        executorType: 'function',
        executorConfig: { handler: 'noop' },
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
    const { runId } = await engine.start({
      workflowName: 'task-test',
      tenantId: 'test-tenant',
      input: {},
    })
    return { engine, runId }
  }

  // ── Phase 1: CRUD ─────────────────────────────────────────────────

  describe('createTasks', () => {
    it('inserts N rows with correct defaults and verifies in DB', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 'process', [
        { payload: { url: 'a' } },
        { payload: { url: 'b' } },
        { payload: { url: 'c' } },
      ])

      expect(ids).toHaveLength(3)

      // Verify directly in DB
      const rows = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'process')
        .orderBy('createdAt', 'asc')
        .execute()

      expect(rows).toHaveLength(3)
      expect(rows.every(r => r.status === 'pending')).toBe(true)
      expect(rows.every(r => r.attempt === 0)).toBe(true)
      expect(rows.every(r => r.maxRetries === 3)).toBe(true) // default
      expect(rows.map(r => r.id)).toEqual(ids)
    })

    it('stores priority and maxRetries', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 'step1', [
        { payload: { x: 1 }, priority: 10, maxRetries: 5 },
      ])

      const row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()

      expect(row.priority).toBe(10)
      expect(row.maxRetries).toBe(5)
      expect(JSON.parse(row.payload!)).toEqual({ x: 1 })
    })

    it('returns empty array for empty input', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 'step1', [])
      expect(ids).toEqual([])

      const count = await db
        .selectFrom('workflow_tasks')
        .where('workflowRunId', '=', runId)
        .select(db.fn.countAll().as('n'))
        .executeTakeFirstOrThrow()
      expect(Number(count.n)).toBe(0)
    })

    it('enforces FK constraint — rejects invalid workflowRunId', async () => {
      await expect(
        tm.createTasks('nonexistent-run', 'step1', [{ payload: { a: 1 } }]),
      ).rejects.toThrow()
    })
  })

  describe('getTasks', () => {
    it('returns only tasks for the requested run+step combination', async () => {
      const { runId } = await startRun()
      const { runId: runId2 } = await startRun()

      await tm.createTasks(runId, 'step-a', [{ payload: { a: 1 } }])
      await tm.createTasks(runId, 'step-b', [
        { payload: { b: 1 } },
        { payload: { b: 2 } },
      ])
      await tm.createTasks(runId2, 'step-a', [{ payload: { other: true } }])

      const tasksA = await tm.getTasks(runId, 'step-a')
      const tasksB = await tm.getTasks(runId, 'step-b')
      const tasksOther = await tm.getTasks(runId2, 'step-a')

      expect(tasksA).toHaveLength(1)
      expect(tasksB).toHaveLength(2)
      expect(tasksOther).toHaveLength(1)
    })
  })

  describe('getTask', () => {
    it('returns null for non-existent task', async () => {
      expect(await tm.getTask('no-such-id')).toBeNull()
    })

    it('returns the correct task by id', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [{ payload: { k: 'v' } }])
      const task = await tm.getTask(id)
      expect(task).toBeTruthy()
      expect(task!.workflowRunId).toBe(runId)
      expect(task!.stepName).toBe('s')
    })
  })

  describe('getTaskStats', () => {
    it('returns accurate counts across all statuses', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 'step1', [
        { payload: { a: 1 } },
        { payload: { a: 2 } },
        { payload: { a: 3 } },
        { payload: { a: 4 } },
      ])

      await tm.markTaskRunning(ids[0])
      await tm.markTaskRunning(ids[1])
      await tm.markTaskCompleted(ids[1], { done: true })
      await tm.markTaskFailed(ids[2], 'boom')

      const stats = await tm.getTaskStats(runId, 'step1')
      expect(stats).toEqual({
        total: 4,
        pending: 1, // ids[3]
        running: 1, // ids[0]
        completed: 1, // ids[1]
        failed: 1, // ids[2]
      })
    })
  })

  // ── Phase 2: Fetching with Locking ────────────────────────────────

  describe('fetchNextTask', () => {
    it('returns highest priority pending task first', async () => {
      const { runId } = await startRun()
      await tm.createTasks(runId, 'step1', [
        { payload: { name: 'low' }, priority: 1 },
        { payload: { name: 'high' }, priority: 10 },
        { payload: { name: 'mid' }, priority: 5 },
      ])

      const task = await tm.fetchNextTask(runId, 'step1')
      expect(task).toBeTruthy()
      expect(JSON.parse(task!.payload!)).toEqual({ name: 'high' })
    })

    it('returns null when no pending tasks exist', async () => {
      const { runId } = await startRun()
      expect(await tm.fetchNextTask(runId, 'step1')).toBeNull()
    })

    it('skips non-pending tasks (running, completed, failed)', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 'step1', [
        { payload: { s: 'running' } },
        { payload: { s: 'completed' } },
        { payload: { s: 'failed' } },
      ])
      await tm.markTaskRunning(ids[0])
      await tm.markTaskRunning(ids[1])
      await tm.markTaskCompleted(ids[1], {})
      await tm.markTaskFailed(ids[2], 'err')

      expect(await tm.fetchNextTask(runId, 'step1')).toBeNull()
    })

    it('sequential fetches get different tasks (each fetch returns next pending)', async () => {
      const { runId } = await startRun()
      await tm.createTasks(runId, 'step1', [
        { payload: { idx: 0 } },
        { payload: { idx: 1 } },
        { payload: { idx: 2 } },
      ])

      // Fetch and mark running to simulate real usage
      const t1 = await tm.fetchNextTask(runId, 'step1')
      expect(t1).toBeTruthy()
      await tm.markTaskRunning(t1!.id)

      const t2 = await tm.fetchNextTask(runId, 'step1')
      expect(t2).toBeTruthy()
      expect(t2!.id).not.toBe(t1!.id)
      await tm.markTaskRunning(t2!.id)

      const t3 = await tm.fetchNextTask(runId, 'step1')
      expect(t3).toBeTruthy()
      expect(t3!.id).not.toBe(t1!.id)
      expect(t3!.id).not.toBe(t2!.id)

      // No more pending
      await tm.markTaskRunning(t3!.id)
      expect(await tm.fetchNextTask(runId, 'step1')).toBeNull()
    })
  })

  describe('task lifecycle: running → completed / failed → retry', () => {
    it('markTaskCompleted stores result JSON in DB', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [{ payload: { x: 1 } }])
      await tm.markTaskRunning(id)
      await tm.markTaskCompleted(id, { answer: 42 })

      const row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.status).toBe('completed')
      expect(JSON.parse(row.result!)).toEqual({ answer: 42 })
    })

    it('markTaskFailed increments attempt counter atomically', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [{ payload: { x: 1 } }])

      await tm.markTaskRunning(id)
      await tm.markTaskFailed(id, 'err1')
      let row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.attempt).toBe(1)
      expect(row.error).toBe('err1')

      // Reset to pending for second attempt
      await tm.retryTask(id)
      await tm.markTaskRunning(id)
      await tm.markTaskFailed(id, 'err2')
      row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.attempt).toBe(2)
      expect(row.error).toBe('err2')
    })

    it('retryTask resets to pending if under maxRetries', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [
        { payload: {}, maxRetries: 3 },
      ])
      await tm.markTaskRunning(id)
      await tm.markTaskFailed(id, 'transient')
      await tm.retryTask(id)

      const row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.status).toBe('pending')
      expect(row.error).toBeNull()
    })

    it('retryTask throws when maxRetries exceeded', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [
        { payload: {}, maxRetries: 1 },
      ])
      await tm.markTaskRunning(id)
      await tm.markTaskFailed(id, 'fatal')

      await expect(tm.retryTask(id)).rejects.toThrow('exceeded maxRetries')
    })
  })

  describe('checkTaskConcurrency', () => {
    it('returns true when running count is under limit', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 's', [{ payload: {} }])
      await tm.markTaskRunning(id)
      expect(await tm.checkTaskConcurrency(runId, 2)).toBe(true)
    })

    it('returns false when running count meets limit', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 's', [
        { payload: {} },
        { payload: {} },
      ])
      await tm.markTaskRunning(ids[0])
      await tm.markTaskRunning(ids[1])
      expect(await tm.checkTaskConcurrency(runId, 2)).toBe(false)
    })
  })

  // ── Phase 4: Aggregation ──────────────────────────────────────────

  describe('getTaskResults', () => {
    it('returns structured results with parsed JSON payloads', async () => {
      const { runId } = await startRun()
      const ids = await tm.createTasks(runId, 'step1', [
        { payload: { input: 'a' } },
        { payload: { input: 'b' } },
      ])

      await tm.markTaskRunning(ids[0])
      await tm.markTaskCompleted(ids[0], { output: 'A' })
      await tm.markTaskRunning(ids[1])
      await tm.markTaskCompleted(ids[1], { output: 'B' })

      const results = await tm.getTaskResults(runId, 'step1')
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        id: ids[0],
        payload: { input: 'a' },
        result: { output: 'A' },
        status: 'completed',
      })
      expect(results[1]).toEqual({
        id: ids[1],
        payload: { input: 'b' },
        result: { output: 'B' },
        status: 'completed',
      })
    })

    it('includes failed tasks with null results', async () => {
      const { runId } = await startRun()
      const [id] = await tm.createTasks(runId, 'step1', [{ payload: { x: 1 } }])
      await tm.markTaskRunning(id)
      await tm.markTaskFailed(id, 'boom')

      const results = await tm.getTaskResults(runId, 'step1')
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('failed')
      expect(results[0].result).toBeNull()
    })
  })
})
