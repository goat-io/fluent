/**
 * MockCloudTaskConnector - In-memory mock for testing
 *
 * This connector simulates GCP Cloud Tasks behavior locally for testing purposes.
 * It stores tasks in memory and executes them via a simulated worker,
 * allowing us to run the same test suite as BullMQ and Hatchet adapters.
 */

import { Ids } from '@goatlab/js-utils'
import type {
  ShouldQueue,
  TaskConnector,
  TaskStatus,
  TaskStatusName
} from '@goatlab/tasks-core'

interface StoredTask {
  id: string
  name: string
  payload: object
  status: TaskStatusName
  attempts: number
  created: string
  output: string
  handle?: () => Promise<any>
}

export class MockCloudTaskConnector implements TaskConnector<object> {
  private tasks: Map<string, StoredTask> = new Map()
  private taskHandlers: Map<string, ShouldQueue> = new Map()
  private isProcessing = false
  private processInterval: NodeJS.Timeout | null = null

  /**
   * Registers task handlers (similar to BullMQ/Hatchet startWorker).
   * This allows the mock to execute tasks when they are queued.
   */
  async startWorker({
    tasks
  }: {
    workerName?: string
    tasks: ShouldQueue[]
  }): Promise<() => Promise<void>> {
    for (const task of tasks) {
      this.taskHandlers.set(task.taskName, task)
    }

    // Start processing tasks
    this.isProcessing = true
    this.processInterval = setInterval(() => this.processTasks(), 50)

    return async () => {
      this.isProcessing = false
      if (this.processInterval) {
        clearInterval(this.processInterval)
        this.processInterval = null
      }
    }
  }

  /**
   * Processes queued tasks by executing their handlers.
   * Simulates GCP Cloud Tasks calling HTTP endpoints.
   */
  private async processTasks() {
    if (!this.isProcessing) {
      return
    }

    for (const [_id, task] of this.tasks.entries()) {
      if (task.status === 'QUEUED') {
        // Mark as running
        task.status = 'RUNNING'
        task.attempts++

        const handler = this.taskHandlers.get(task.name)
        if (handler) {
          try {
            const result = await handler.handle(task.payload as any)
            task.status = 'COMPLETED'
            task.output = result ? JSON.stringify(result) : ''
          } catch (error: any) {
            task.status = 'FAILED'
            task.output = error?.message || 'Unknown error'
          }
        } else {
          // No handler registered - mark as completed (simulates successful HTTP call)
          task.status = 'COMPLETED'
        }
      }
    }
  }

  /**
   * Gets the status of a task by its ID.
   */
  async getStatus(id: string): Promise<TaskStatus> {
    const task = this.tasks.get(id)

    if (!task) {
      return {
        id,
        name: '',
        status: 'COMPLETED',
        output: 'Task not found',
        attempts: 0,
        created: new Date().toISOString(),
        nextRun: null,
        nextRunMinutes: null,
        payload: {}
      }
    }

    return {
      id: task.id,
      name: task.name,
      status: task.status,
      output: task.output,
      attempts: task.attempts,
      created: task.created,
      nextRun: null,
      nextRunMinutes: null,
      payload: task.payload
    }
  }

  /**
   * Queues a task to be run.
   */
  async queue(params: {
    uniqueTaskName: string
    taskName: string
    postUrl: string
    taskBody: object
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>> {
    const id = `mock-task-${params.uniqueTaskName}_${Ids.nanoId(5)}`
    const now = new Date().toISOString()

    const storedTask: StoredTask = {
      id,
      name: params.taskName,
      payload: params.taskBody,
      status: 'QUEUED',
      attempts: 0,
      created: now,
      output: '',
      handle: params.handle
    }

    this.tasks.set(id, storedTask)

    return {
      id,
      name: params.taskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: now,
      nextRun: null,
      nextRunMinutes: null
    }
  }

  /**
   * Clears all stored tasks.
   */
  clear() {
    this.tasks.clear()
  }

  /**
   * Closes the connector and stops processing.
   */
  async close() {
    this.isProcessing = false
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }
    this.tasks.clear()
    this.taskHandlers.clear()
  }
}
