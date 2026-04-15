// npx vitest run src/__tests__/engine/integrations.spec.ts
import type {
  ExternalActionExecutor,
  ExternalActionResult,
} from '../engine/ExternalActionExecutor.js'

export interface IntegrationAction<
  TRequest = Record<string, unknown>,
  TResponse = Record<string, unknown>,
> {
  /** Action type identifier (e.g. 'create_pr', 'create_issue') */
  actionType: string
  /** Execute the action through ExternalActionExecutor */
  execute(
    request: TRequest,
    context: {
      externalActions: ExternalActionExecutor
      workflowRunId: string
      stepName: string
      attempt: number
      tenantId: string
    },
  ): Promise<ExternalActionResult<TResponse>>
}

export interface Integration {
  /** Provider name (e.g. 'github', 'linear', 'slack') */
  readonly provider: string
  /** Available actions */
  readonly actions: Record<string, IntegrationAction>
}
