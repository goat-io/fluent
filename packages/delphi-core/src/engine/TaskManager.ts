// npx vitest run src/__tests__/engine/tasks.spec.ts
//
// TaskManager — CRUD + concurrency-safe task assignment for workflow steps.
// Uses Postgres FOR UPDATE SKIP LOCKED for safe concurrent fetching.
//

import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { WorkflowTask } from '../entities/Database.js'
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
  constructor(private readonly db: DbClient) {}

  async createTasks(
    runId: string,
    stepName: string,
    tasks: TaskInput[],
  ): Promise<string[]> {
    if (tasks.length === 0) {
      return []
    }

    const ids: string[] = []
    const placeholders: string[] = []
    const params: any[] = []
    let idx = 1
    for (const t of tasks) {
      const id = nanoId(21)
      ids.push(id)
      placeholders.push(
        `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9})`,
      )
      params.push(
        id,
        runId,
        stepName,
        'pending',
        toJson(t.payload),
        null,
        null,
        0,
        t.maxRetries ?? 3,
        t.priority ?? null,
      )
      idx += 10
    }

    await this.db.query(
      `INSERT INTO workflow_tasks (id, "workflowRunId", "stepName", status, payload, result, error, attempt, "maxRetries", priority) VALUES ${placeholders.join(',')}`,
      params,
    )
    return ids
  }

  async getTasks(runId: string, stepName: string): Promise<WorkflowTask[]> {
    const { rows } = await this.db.query<WorkflowTask>(
      `SELECT * FROM workflow_tasks WHERE "workflowRunId" = $1 AND "stepName" = $2 ORDER BY "createdAt" ASC`,
      [runId, stepName],
    )
    return rows
  }

  async getTask(taskId: string): Promise<WorkflowTask | null> {
    const { rows } = await this.db.query<WorkflowTask>(
      `SELECT * FROM workflow_tasks WHERE id = $1`,
      [taskId],
    )
    return rows[0] ?? null
  }

  async getTaskStats(runId: string, stepName: string): Promise<TaskStats> {
    const { rows } = await this.db.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM workflow_tasks WHERE "workflowRunId" = $1 AND "stepName" = $2 GROUP BY status`,
      [runId, stepName],
    )

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

  async fetchNextTask(
    runId: string,
    stepName: string,
  ): Promise<WorkflowTask | null> {
    const { rows } = await this.db.query<WorkflowTask>(
      `SELECT * FROM workflow_tasks
       WHERE "workflowRunId" = $1
         AND "stepName" = $2
         AND status = 'pending'
       ORDER BY priority DESC NULLS LAST, "createdAt" ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [runId, stepName],
    )
    return rows[0] ?? null
  }

  async markTaskRunning(taskId: string): Promise<void> {
    await this.db.query(
      `UPDATE workflow_tasks SET status = $1, "updatedAt" = $2 WHERE id = $3`,
      ['running', new Date(), taskId],
    )
  }

  async markTaskCompleted(taskId: string, result: JsonObject): Promise<void> {
    await this.db.query(
      `UPDATE workflow_tasks SET status = $1, result = $2, "updatedAt" = $3 WHERE id = $4`,
      ['completed', toJson(result), new Date(), taskId],
    )
  }

  async markTaskFailed(taskId: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE workflow_tasks SET status = 'failed', error = $1, attempt = attempt + 1, "updatedAt" = NOW() WHERE id = $2`,
      [error, taskId],
    )
  }

  async retryTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    if (task.attempt >= task.maxRetries) {
      throw new Error(`Task ${taskId} exceeded maxRetries (${task.maxRetries})`)
    }
    await this.db.query(
      `UPDATE workflow_tasks SET status = $1, error = $2, "updatedAt" = $3 WHERE id = $4`,
      ['pending', null, new Date(), taskId],
    )
  }

  async checkTaskConcurrency(
    runId: string,
    maxConcurrent: number,
  ): Promise<boolean> {
    const { rows } = await this.db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM workflow_tasks WHERE "workflowRunId" = $1 AND status = $2`,
      [runId, 'running'],
    )
    return Number(rows[0]?.count ?? 0) < maxConcurrent
  }

  // ── Phase 4: Aggregation ──────────────────────────────────────────

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
    const { rows } = await this.db.query<{
      id: string
      payload: string | null
      result: string | null
      status: string
    }>(
      `SELECT id, payload, result, status FROM workflow_tasks WHERE "workflowRunId" = $1 AND "stepName" = $2 ORDER BY "createdAt" ASC`,
      [runId, stepName],
    )

    return rows.map(r => ({
      id: r.id,
      payload: fromJson<JsonObject>(r.payload),
      result: fromJson<JsonObject>(r.result),
      status: r.status,
    }))
  }
}
