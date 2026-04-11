// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type { StepExecutor } from './StepExecutor.js'
import type { StepPayload, StepResult } from '../workflow/WorkflowBuilder.types.js'

export type StepHandler = (payload: StepPayload) => Promise<StepResult>

export class FunctionStepExecutor implements StepExecutor {
  readonly type = 'function'
  private handlers = new Map<string, StepHandler>()

  register(name: string, handler: StepHandler): this {
    this.handlers.set(name, handler)
    return this
  }

  async execute(payload: StepPayload): Promise<StepResult> {
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

    return handler(payload)
  }

  hasHandler(name: string): boolean {
    return this.handlers.has(name)
  }

  handlerNames(): string[] {
    return Array.from(this.handlers.keys())
  }
}
