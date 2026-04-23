// npx vitest run src/__tests__/engine/enforcement.spec.ts
//
// Runtime enforcement that detects steps producing outputs with external IDs
// but not going through ExternalActionExecutor.
//
import type { DbClient } from '../db/DbClient.js'
import type {
  StepInterceptor,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'

export interface ExternalActionEnforcerConfig {
  db: DbClient
  strict?: boolean
  enforcedExecutorTypes?: string[]
  exemptSteps?: string[]
  logger?: {
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

export class ExternalActionEnforcer implements StepInterceptor {
  private config: ExternalActionEnforcerConfig
  private db: DbClient

  constructor(config: ExternalActionEnforcerConfig) {
    this.config = config
    this.db = config.db
  }

  async afterExecute(
    payload: StepPayload,
    result: StepResult,
  ): Promise<StepResult> {
    if (this.config.exemptSteps?.includes(payload.stepName)) {
      return result
    }

    const enforcedTypes = this.config.enforcedExecutorTypes ?? [
      'sandbox',
      'ai',
      'langgraph',
      'agreement',
    ]
    if (!enforcedTypes.includes(payload.executorType)) {
      return result
    }

    const { rows } = await this.db.query<{ id: string }>(
      `SELECT id FROM external_actions WHERE "workflowRunId" = $1 AND "stepName" = $2 AND attempt = $3 LIMIT 1`,
      [payload.workflowRunId, payload.stepName, payload.attempt],
    )

    if (rows.length === 0) {
      const msg =
        `[ExternalActionEnforcer] Step "${payload.stepName}" (type: ${payload.executorType}) ` +
        `completed without any ExternalAction records. External calls should go through ` +
        `context.externalActions.execute() for exactly-once guarantees.`

      if (this.config.strict) {
        throw new Error(msg)
      }
      this.config.logger?.warn?.(msg)
    }

    return result
  }
}
