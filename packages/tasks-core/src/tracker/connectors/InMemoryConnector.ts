/**
 * InMemoryTaskTrackerConnector
 *
 * In-memory implementation of TaskTrackerConnector for:
 * - Unit testing
 * - Single-instance deployments
 * - Development/prototyping
 *
 * Note: Does not persist data and Pub/Sub only works within the same process.
 */

import { EventEmitter } from 'node:events'
import type {
  ListByOwnerOptions,
  TaskStateCallback,
  TaskTrackerConnector,
  TrackedTaskState,
  Unsubscribe,
} from '../tracker.types'

export class InMemoryTaskTrackerConnector implements TaskTrackerConnector {
  private readonly tasks: Map<string, TrackedTaskState> = new Map()
  private readonly emitter: EventEmitter = new EventEmitter()
  /** Owner index: `${tenantId}:${ownerId}` → Set of task IDs */
  private readonly ownerIndex: Map<string, Set<string>> = new Map()

  /**
   * Generate a storage key from tenant and task ID.
   */
  private getKey(tenantId: string, taskId: string): string {
    return `${tenantId}:${taskId}`
  }

  /**
   * Get the channel name for Pub/Sub.
   */
  private getChannel(tenantId: string, taskId: string): string {
    return `task:${tenantId}:${taskId}`
  }

  /**
   * Batch create multiple tasks.
   */
  async createBatch(tasks: TrackedTaskState[]): Promise<void> {
    for (const task of tasks) {
      const key = this.getKey(task.tenantId, task.id)
      this.tasks.set(key, { ...task })

      // Add to owner index if ownerId is set
      if (task.ownerId) {
        const ownerKey = `${task.tenantId}:${task.ownerId}`
        if (!this.ownerIndex.has(ownerKey)) {
          this.ownerIndex.set(ownerKey, new Set())
        }
        this.ownerIndex.get(ownerKey)!.add(task.id)
      }
    }
  }

  /**
   * Update a task's state.
   */
  async update(
    taskId: string,
    tenantId: string,
    updates: Partial<TrackedTaskState>,
  ): Promise<void> {
    const key = this.getKey(tenantId, taskId)
    const existing = this.tasks.get(key)

    if (!existing) {
      // Task doesn't exist - create it with updates
      const now = Date.now()
      this.tasks.set(key, {
        id: taskId,
        tenantId,
        name: updates.name ?? 'unknown',
        status: updates.status ?? 'QUEUED',
        progress: updates.progress ?? 0,
        message: updates.message,
        result: updates.result,
        error: updates.error,
        createdAt: now,
        updatedAt: now,
        completedAt: updates.completedAt,
      })
      return
    }

    // Merge updates
    this.tasks.set(key, {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? Date.now(),
    })
  }

  /**
   * Get a task's current state.
   */
  async get(
    taskId: string,
    tenantId: string,
  ): Promise<TrackedTaskState | null> {
    const key = this.getKey(tenantId, taskId)
    const task = this.tasks.get(key)
    return task ? { ...task } : null
  }

  /**
   * Publish a task state update.
   */
  async publish(
    tenantId: string,
    taskId: string,
    state: TrackedTaskState,
  ): Promise<void> {
    const channel = this.getChannel(tenantId, taskId)
    this.emitter.emit(channel, { ...state })
  }

  /**
   * Subscribe to task state updates.
   */
  subscribe(
    tenantId: string,
    taskId: string,
    callback: TaskStateCallback,
  ): Unsubscribe {
    const channel = this.getChannel(tenantId, taskId)

    const handler = (state: TrackedTaskState) => {
      callback(state)
    }

    this.emitter.on(channel, handler)

    return () => {
      this.emitter.off(channel, handler)
    }
  }

  /**
   * List all tasks for a specific owner.
   */
  async listByOwner(
    tenantId: string,
    ownerId: string,
    options?: ListByOwnerOptions,
  ): Promise<TrackedTaskState[]> {
    const ownerKey = `${tenantId}:${ownerId}`
    const taskIds = this.ownerIndex.get(ownerKey) ?? new Set()

    const tasks: TrackedTaskState[] = []
    for (const taskId of taskIds) {
      const task = this.tasks.get(this.getKey(tenantId, taskId))
      if (task) {
        // Filter by status if specified
        if (options?.status) {
          const statuses = Array.isArray(options.status)
            ? options.status
            : [options.status]
          if (!statuses.includes(task.status)) {
            continue
          }
        }
        tasks.push({ ...task })
      }
    }

    // Sort by createdAt descending (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt)

    // Apply limit
    const limit = options?.limit ?? 100
    return tasks.slice(0, limit)
  }

  /**
   * Clean up old tasks.
   */
  async cleanup(tenantId: string, olderThanMs: number): Promise<number> {
    const now = Date.now()
    const cutoff = now - olderThanMs
    let cleaned = 0

    for (const [key, task] of this.tasks.entries()) {
      if (task.tenantId === tenantId && task.createdAt < cutoff) {
        this.tasks.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Close and clean up.
   * Note: Tasks are NOT cleared to allow inspection after shutdown in tests.
   * Use clear() explicitly if you need to remove all tasks.
   */
  async close(): Promise<void> {
    this.emitter.removeAllListeners()
  }

  // --- Test helpers ---

  /**
   * Get all tasks for a tenant.
   * Test helper method.
   */
  getAllTasks(tenantId?: string): TrackedTaskState[] {
    const tasks: TrackedTaskState[] = []
    for (const task of this.tasks.values()) {
      if (!tenantId || task.tenantId === tenantId) {
        tasks.push({ ...task })
      }
    }
    return tasks
  }

  /**
   * Get total task count.
   * Test helper method.
   */
  get size(): number {
    return this.tasks.size
  }

  /**
   * Clear all tasks.
   * Test helper method.
   */
  clear(): void {
    this.tasks.clear()
    this.ownerIndex.clear()
  }
}
