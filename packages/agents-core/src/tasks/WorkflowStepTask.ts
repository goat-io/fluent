// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import { ShouldQueue } from '@goatlab/tasks-core'
import type { JsonObject } from '@goatlab/tasks-core'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { StepExecutionContext, StepPayload } from '../workflow/WorkflowBuilder.types.js'

export class WorkflowStepTask extends ShouldQueue<
  StepPayload,
  JsonObject,
  'workflow_step'
> {
  readonly taskName = 'workflow_step' as const
  readonly postUrl = '/workflow/step'

  private engine: WorkflowEngine

  constructor(engine: WorkflowEngine) {
    super()
    this.engine = engine
  }

  async handle(payload: StepPayload): Promise<JsonObject> {
    const executor = this.engine.getExecutor(payload.executorType)
    if (!executor) {
      throw new Error(
        `No executor registered for type "${payload.executorType}"`,
      )
    }

    // Mark step as RUNNING (transition from QUEUED)
    await this.engine.markStepRunning(
      payload.workflowRunId,
      payload.stepName,
      payload.tenantId,
    )

    try {
      // Run interceptors beforeExecute
      let processedPayload = payload
      for (const interceptor of this.engine['config'].interceptors ?? []) {
        if (interceptor.beforeExecute) {
          processedPayload = await interceptor.beforeExecute(processedPayload)
        }
      }

      // Build execution context with engine services
      const executionContext: StepExecutionContext = {
        externalActions: this.engine.externalActions,
        integrations: this.engine['config'].integrations,
      }

      // Execute the step
      let result = await executor.execute(processedPayload, executionContext)

      // Run interceptors afterExecute
      for (const interceptor of this.engine['config'].interceptors ?? []) {
        if (interceptor.afterExecute) {
          result = await interceptor.afterExecute(processedPayload, result)
        }
      }

      // Notify engine of completion
      await this.engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )

      return result.output
    } catch (error) {
      // Run interceptors onError
      for (const interceptor of this.engine['config'].interceptors ?? []) {
        if (interceptor.onError) {
          await interceptor.onError(payload, error as Error)
        }
      }

      // Notify engine of failure
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
