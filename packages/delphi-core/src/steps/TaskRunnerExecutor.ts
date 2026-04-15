// npx vitest run src/__tests__/engine/task-runner.spec.ts
//
// TaskRunnerExecutor — pulls tasks from TaskManager and processes them in a loop.
// Each task is delegated to an inner executor (function, ai, sandbox).
//

import type {
  StepExecutionContext,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'
import type { StepExecutor } from './StepExecutor.js'

export class TaskRunnerExecutor implements StepExecutor {
  readonly type = 'task_runner'

  private executors: Map<string, StepExecutor>

  constructor(executors: Map<string, StepExecutor>) {
    this.executors = executors
  }

  async execute(
    payload: StepPayload,
    context?: StepExecutionContext,
  ): Promise<StepResult> {
    const taskManager = context?.taskManager
    if (!taskManager) {
      throw new Error(
        'TaskRunnerExecutor requires taskManager in StepExecutionContext',
      )
    }

    const maxConcurrentTasks =
      (payload.executorConfig.maxConcurrentTasks as number) ?? 5
    const innerExecutorType =
      (payload.executorConfig.executor as string) ?? 'function'
    const innerExecutor = this.executors.get(innerExecutorType)
    if (!innerExecutor) {
      throw new Error(
        `No executor registered for inner type "${innerExecutorType}"`,
      )
    }

    const checkBudget = context?.checkBudget

    while (true) {
      // Check budget guardrails before processing next task
      if (checkBudget) {
        const exceeded = await checkBudget(
          payload.workflowRunId,
          'taskExecutions',
        )
        if (exceeded) {
          break // Stop processing — budget exceeded
        }
      }

      // Check concurrency limit
      const canRun = await taskManager.checkTaskConcurrency(
        payload.workflowRunId,
        maxConcurrentTasks,
      )
      if (!canRun) {
        // Wait briefly and retry — other workers may complete tasks
        await new Promise(r => setTimeout(r, 50))
        continue
      }

      // Fetch next pending task (concurrency-safe via SKIP LOCKED)
      const task = await taskManager.fetchNextTask(
        payload.workflowRunId,
        payload.stepName,
      )
      if (!task) {
        break // No more tasks
      }

      await taskManager.markTaskRunning(task.id)

      try {
        const taskPayload = task.payload ? JSON.parse(task.payload) : {}
        const result = await innerExecutor.execute(
          {
            ...payload,
            input: taskPayload,
          },
          context,
        )

        await taskManager.markTaskCompleted(task.id, result.output)
      } catch (err: any) {
        await taskManager.markTaskFailed(task.id, err.message ?? String(err))
        if (task.attempt < task.maxRetries) {
          await taskManager.retryTask(task.id)
        }
      }
    }

    // Return summary
    const stats = await taskManager.getTaskStats(
      payload.workflowRunId,
      payload.stepName,
    )
    return { output: { taskStats: { ...stats } } }
  }
}
