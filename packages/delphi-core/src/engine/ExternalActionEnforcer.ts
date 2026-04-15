// npx vitest run src/__tests__/engine/enforcement.spec.ts
//
// Runtime enforcement that detects steps producing outputs with external IDs
// but not going through ExternalActionExecutor. This is a safety net, not a
// hard block — it logs warnings (or throws in strict mode) when bypasses are detected.
//
import type { Kysely } from 'kysely'
import type { Database } from '../entities/Database.js'
import type {
  StepInterceptor,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'

export interface ExternalActionEnforcerConfig {
  db: Kysely<Database>
  /**
   * In strict mode, throws an error if a step with external-facing executorType
   * completes without any ExternalAction records. In non-strict mode, logs a warning.
   */
  strict?: boolean
  /** Executor types that MUST use ExternalAction (default: all except 'function') */
  enforcedExecutorTypes?: string[]
  /** Step names to skip enforcement for (e.g., pure-compute steps) */
  exemptSteps?: string[]
  logger?: {
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}

/**
 * StepInterceptor that verifies external actions were used.
 * Install via engine config: `interceptors: [new ExternalActionEnforcer(config)]`
 */
export class ExternalActionEnforcer implements StepInterceptor {
  private config: ExternalActionEnforcerConfig
  private db: Kysely<Database>

  constructor(config: ExternalActionEnforcerConfig) {
    this.config = config
    this.db = config.db
  }

  async afterExecute(
    payload: StepPayload,
    result: StepResult,
  ): Promise<StepResult> {
    // Skip exempt steps
    if (this.config.exemptSteps?.includes(payload.stepName)) {
      return result
    }

    // Only enforce on specified executor types
    const enforcedTypes = this.config.enforcedExecutorTypes ?? [
      'sandbox',
      'ai',
      'langgraph',
      'agreement',
    ]
    if (!enforcedTypes.includes(payload.executorType)) {
      return result
    }

    // Check if any ExternalAction records exist for this step execution
    const actions = await this.db
      .selectFrom('external_actions')
      .select('id')
      .where('workflowRunId', '=', payload.workflowRunId)
      .where('stepName', '=', payload.stepName)
      .where('attempt', '=', payload.attempt)
      .executeTakeFirst()

    if (!actions) {
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
