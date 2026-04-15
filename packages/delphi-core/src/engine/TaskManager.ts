// npx vitest run src/__tests__/engine/tasks.spec.ts
//
// TaskManager — CRUD + concurrency-safe task assignment for workflow steps.
// Uses Postgres FOR UPDATE SKIP LOCKED for safe concurrent fetching.
//

import { Ids } from '@goatlab/js-utils'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type {
  Database,
  WorkflowTask,
  WorkflowTaskUpdate,
} from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'

// Re-export JsonObject from tasks-core for type compatibility with StepContext
export type { JsonObject } from '@goatlab/tasks-core'

import type { JsonObject } from '@goatlab/tasks-core'

export interface TaskInput {
  payload: JsonObject
  priority?: number
  maxRetries?: number
}

export interface TaskStats {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
}

export class TaskManager {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Create multiple tasks for a workflow step. Returns the task IDs.
   */
  async createTasks(
    runId: string,
    stepName: string,
    tasks: TaskInput[],
  ): Promise<string[]> {
    if (tasks.length === 0) {
      return []
    }

    const ids: string[] = []
    const rows = tasks.map(t => {
      const id = Ids.nanoId(21)
      ids.push(id)
      return {
        id,
        workflowRunId: runId,
        stepName,
        status: 'pending' as const,
        payload: toJson(t.payload),
        result: null,
        error: null,
        attempt: 0,
        maxRetries: t.maxRetries ?? 3,
        priority: t.priority ?? null,
      }
    })

    await this.db.insertInto('workflow_tasks').values(rows).execute()
    return ids
  }

  /**
   * Get all tasks for a workflow run + step.
   */
  async getTasks(runId: string, stepName: string): Promise<WorkflowTask[]> {
    return this.db
      .selectFrom('workflow_tasks')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', stepName)
      .orderBy('createdAt', 'asc')
      .execute()
  }

  /**
   * Get a single task by ID.
   */
  async getTask(taskId: string): Promise<WorkflowTask | null> {
    const row = await this.db
      .selectFrom('workflow_tasks')
      .selectAll()
      .where('id', '=', taskId)
      .executeTakeFirst()
    return row ?? null
  }

  /**
   * Get aggregate stats for a workflow run + step.
   */
  async getTaskStats(runId: string, stepName: string): Promise<TaskStats> {
    const rows = await this.db
      .selectFrom('workflow_tasks')
      .select('status')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', stepName)
      .groupBy('status')
      .execute()

    const stats: TaskStats = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    }
    for (const row of rows) {
      const c = Number(row.count)
      stats.total += c
      if (row.status === 'pending') {
        stats.pending = c
      } else if (row.status === 'running') {
        stats.running = c
      } else if (row.status === 'completed') {
        stats.completed = c
      } else if (row.status === 'failed') {
        stats.failed = c
      }
    }
    return stats
  }

  // ── Phase 2: Concurrency-safe fetching ────────────────────────────

  /**
   * Fetch the next pending task using FOR UPDATE SKIP LOCKED.
   * Returns null when no tasks remain.
   */
  async fetchNextTask(
    runId: string,
    stepName: string,
  ): Promise<WorkflowTask | null> {
    const row = await sql<WorkflowTask>`
      SELECT * FROM workflow_tasks
      WHERE "workflowRunId" = ${runId}
        AND "stepName" = ${stepName}
        AND status = 'pending'
      ORDER BY priority DESC NULLS LAST, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `.execute(this.db)

    return row.rows[0] ?? null
  }

  async markTaskRunning(taskId: string): Promise<void> {
    await this.db
      .updateTable('workflow_tasks')
      .set({ status: 'running', updatedAt: new Date() } as WorkflowTaskUpdate)
      .where('id', '=', taskId)
      .execute()
  }

  async markTaskCompleted(taskId: string, result: JsonObject): Promise<void> {
    await this.db
      .updateTable('workflow_tasks')
      .set({
        status: 'completed',
        result: toJson(result),
        updatedAt: new Date(),
      } as WorkflowTaskUpdate)
      .where('id', '=', taskId)
      .execute()
  }

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await sql`
      UPDATE workflow_tasks
      SET status = 'failed',
          error = ${error},
          attempt = attempt + 1,
          "updatedAt" = NOW()
      WHERE id = ${taskId}
    `.execute(this.db)
  }

  /**
   * Retry a failed task: reset to pending if under maxRetries.
   * Throws if maxRetries exceeded.
   */
  async retryTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    if (task.attempt >= task.maxRetries) {
      throw new Error(`Task ${taskId} exceeded maxRetries (${task.maxRetries})`)
    }
    await this.db
      .updateTable('workflow_tasks')
      .set({
        status: 'pending',
        error: null,
        updatedAt: new Date(),
      } as WorkflowTaskUpdate)
      .where('id', '=', taskId)
      .execute()
  }

  /**
   * Check if a workflow run has room for more concurrent tasks.
   */
  async checkTaskConcurrency(
    runId: string,
    maxConcurrent: number,
  ): Promise<boolean> {
    const result = await this.db
      .selectFrom('workflow_tasks')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('workflowRunId', '=', runId)
      .where('status', '=', 'running')
      .executeTakeFirstOrThrow()
    return Number(result.count) < maxConcurrent
  }

  // ── Phase 4: Aggregation ──────────────────────────────────────────

  /**
   * Get task results for aggregation (reduce phase).
   */
  async getTaskResults(
    runId: string,
    stepName: string,
  ): Promise<
    Array<{
      id: string
      payload: JsonObject | null
      result: JsonObject | null
      status: string
    }>
  > {
    const rows = await this.db
      .selectFrom('workflow_tasks')
      .select(['id', 'payload', 'result', 'status'])
      .where('workflowRunId', '=', runId)
      .where('stepName', '=', stepName)
      .orderBy('createdAt', 'asc')
      .execute()

    return rows.map(r => ({
      id: r.id,
      payload: fromJson<JsonObject>(r.payload),
      result: fromJson<JsonObject>(r.result),
      status: r.status,
    }))
  }
}
