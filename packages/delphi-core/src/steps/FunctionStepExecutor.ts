// npx vitest run src/__tests__/engine/lifecycle.spec.ts

import type {
  StepExecutionContext,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'
import type { StepExecutor } from './StepExecutor.js'

export type StepHandler = (
  payload: StepPayload,
  context?: StepExecutionContext,
) => Promise<StepResult>

export class FunctionStepExecutor implements StepExecutor {
  readonly type = 'function'
  private handlers = new Map<string, StepHandler>()

  register(name: string, handler: StepHandler): this {
    this.handlers.set(name, handler)
    return this
  }

  async execute(
    payload: StepPayload,
    context?: StepExecutionContext,
  ): Promise<StepResult> {
    const handlerName = payload.executorConfig.handler as string
    if (!handlerName) {
      throw new Error(
        `FunctionStepExecutor: executorConfig.handler is required for step "${payload.stepName}"`,
      )
    }

    const handler = this.handlers.get(handlerName)
    if (!handler) {
      throw new Error(
        `FunctionStepExecutor: no handler registered for "${handlerName}"`,
      )
    }

    return handler(payload, context)
  }

  hasHandler(name: string): boolean {
    return this.handlers.has(name)
  }

  handlerNames(): string[] {
    return Array.from(this.handlers.keys())
  }
}
