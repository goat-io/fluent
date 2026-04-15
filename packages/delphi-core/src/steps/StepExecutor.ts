// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type {
  StepExecutionContext,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'

/**
 * Strategy interface for executing a workflow step.
 * Implementations: FunctionStepExecutor, LangGraphStepExecutor, AIStepExecutor
 */
export interface StepExecutor {
  readonly type: string
  execute(
    payload: StepPayload,
    context?: StepExecutionContext,
  ): Promise<StepResult>
}
