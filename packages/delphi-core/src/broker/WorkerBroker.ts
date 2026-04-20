// npx vitest run src/__tests__/broker/worker-broker.spec.ts
//
// WorkerBroker — bridges BullMQ queues to remote HTTP agents.
// Acts as a real BullMQ Worker: handler Promise stays open until agent returns result.
// Handles task_runner fan-out on the platform side (agents have no DB access).
//
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type {
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'
import type { AgentRegistry } from './AgentRegistry.js'

export interface WorkerBrokerConfig {
  engine: WorkflowEngine
  registry: AgentRegistry
  jobExecutionTimeoutMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

const QUEUES = [
  'workflow_step_light',
  'workflow_step_heavy',
  'workflow_step_ai',
  'workflow_step_sandbox',
]

export class WorkerBroker {
  private engine: WorkflowEngine
  private registry: AgentRegistry
  private jobExecutionTimeoutMs: number
  private logger?: WorkerBrokerConfig['logger']
  private stopHandle: { stop: () => Promise<void> } | null = null

  constructor(config: WorkerBrokerConfig) {
    this.engine = config.engine
    this.registry = config.registry
    this.jobExecutionTimeoutMs = config.jobExecutionTimeoutMs ?? 300_000
    this.logger = config.logger
  }

  /**
   * Start the broker: creates BullMQ Workers on all 4 queues via the engine's connector.
   * Each worker's handler holds the Promise open until the agent returns a result.
   */
  async start(connector: {
    listen: (params: {
      tasks: Array<{
        taskName: string
        handle: (data: unknown) => Promise<unknown>
        concurrency?: number
      }>
      defaultConcurrency?: number
    }) => Promise<{ stop: () => Promise<void>; isRunning: () => boolean }>
  }): Promise<void> {
    const tasks = QUEUES.map(queue => ({
      taskName: queue,
      handle: async (data: unknown): Promise<unknown> => {
        const payload = data as StepPayload
        return this.processJob(payload, queue)
      },
      concurrency: 50, // High concurrency — just holding Promises, not doing compute
    }))

    this.stopHandle = await connector.listen({ tasks })
    this.registry.startSweep()
    this.logger?.info('WorkerBroker started on queues:', QUEUES.join(', '))
  }

  async stop(): Promise<void> {
    this.registry.stopSweep()
    if (this.stopHandle) {
      await this.stopHandle.stop()
      this.stopHandle = null
    }
    this.logger?.info('WorkerBroker stopped')
  }

  // ── Core Dispatch ─────────────────────────────────────────────

  private async processJob(
    payload: StepPayload,
    queue: string,
  ): Promise<unknown> {
    if (payload.executorType === 'task_runner') {
      return this.processTaskRunnerStep(payload, queue)
    }
    return this.processRegularStep(payload, queue)
  }

  // ── Path A: Regular Step ──────────────────────────────────────

  private async processRegularStep(
    payload: StepPayload,
    queue: string,
  ): Promise<unknown> {
    // 1. Mark step as RUNNING in engine (DB)
    await this.engine.markStepRunning(
      payload.workflowRunId,
      payload.stepName,
      payload.tenantId,
    )

    try {
      // 2. Enqueue to registry — blocks until agent completes.
      // `requiresLabels` is carried in the StepPayload by the engine's
      // dispatch code and surfaces here so the registry can AND-match
      // agents' advertised labels (GitHub Actions `runs-on` semantics).
      const result = await this.registry.enqueueJob({
        tenantId: payload.tenantId,
        type: 'step',
        queue,
        payload: payload as unknown as Record<string, unknown>,
        timeoutMs: this.jobExecutionTimeoutMs,
        requiresLabels: payload.requiresLabels,
      })

      // 3. Notify engine of completion (all DB work on platform side)
      await this.engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )

      return result.output
    } catch (error) {
      // Agent failure, timeout, or stale — notify engine
      await this.engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )
      throw error
    }
  }

  // ── Path B: task_runner Fan-out ───────────────────────────────

  private async processTaskRunnerStep(
    payload: StepPayload,
    queue: string,
  ): Promise<unknown> {
    const taskManager = this.engine.taskManager
    const maxConcurrentTasks =
      (payload.executorConfig.maxConcurrentTasks as number) ?? 5
    const innerExecutorType =
      (payload.executorConfig.executor as string) ?? 'function'

    // 1. Mark step as RUNNING
    await this.engine.markStepRunning(
      payload.workflowRunId,
      payload.stepName,
      payload.tenantId,
    )

    try {
      // 2. Fan-out loop with concurrency control
      const activeTasks = new Map<string, Promise<void>>()

      while (true) {
        // Budget check
        const budgetExceeded = await this.engine.incrementBudgetUsage(
          payload.workflowRunId,
          'taskExecutions',
        )
        if (budgetExceeded) {
          this.logger?.warn(
            `Budget exceeded for run ${payload.workflowRunId}: ${budgetExceeded}`,
          )
          break
        }

        // Concurrency gate: wait if at max
        while (activeTasks.size >= maxConcurrentTasks) {
          await Promise.race(activeTasks.values())
        }

        // Fetch next task from DB (SKIP LOCKED)
        const task = await taskManager.fetchNextTask(
          payload.workflowRunId,
          payload.stepName,
        )
        if (!task) {
          break // No more tasks
        }

        await taskManager.markTaskRunning(task.id)

        // Build mini-payload for the individual task
        const taskPayload: Record<string, unknown> = {
          ...payload,
          executorType: innerExecutorType,
          input: task.payload ? JSON.parse(task.payload as string) : {},
        }

        // Dispatch to agent (non-blocking). Fan-out tasks inherit
        // their parent step's label requirements — a step that must
        // run on `sdlc` workers produces tasks that must also run there.
        const taskPromise = this.registry
          .enqueueJob({
            tenantId: payload.tenantId,
            type: 'task',
            queue,
            payload: taskPayload,
            timeoutMs: this.jobExecutionTimeoutMs,
            requiresLabels: payload.requiresLabels,
          })
          .then(async result => {
            await taskManager.markTaskCompleted(task.id, result.output)
          })
          .catch(async (err: Error) => {
            await taskManager.markTaskFailed(
              task.id,
              err.message ?? String(err),
            )
            if (task.attempt < task.maxRetries) {
              try {
                await taskManager.retryTask(task.id)
              } catch {
                /* maxRetries exceeded */
              }
            }
          })
          .finally(() => {
            activeTasks.delete(task.id)
          })

        activeTasks.set(task.id, taskPromise)
      }

      // Wait for all in-flight tasks
      await Promise.allSettled(activeTasks.values())

      // 3. Report aggregate stats
      const stats = await taskManager.getTaskStats(
        payload.workflowRunId,
        payload.stepName,
      )

      const result: StepResult = { output: { taskStats: { ...stats } } }

      await this.engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )

      return result.output
    } catch (error) {
      await this.engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )
      throw error
    }
  }
}
