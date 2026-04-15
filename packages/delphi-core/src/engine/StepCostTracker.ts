// npx vitest run src/__tests__/engine/cost-tracking.spec.ts
//
// StepInterceptor that extracts token usage and cost from step outputs
// and persists them to the workflow_steps table.
//
// Step executors that produce LLM outputs should include cost data in their
// output under a `_usage` key:
//
//   { response: "...", _usage: { tokens: 1500, costUsd: 0.003, model: "gpt-4o" } }
//
import type { Kysely } from 'kysely'
import type { Database } from '../entities/Database.js'
import type { StepInterceptor, StepPayload, StepResult } from '../workflow/WorkflowBuilder.types.js'

export interface StepCostTrackerConfig {
  db: Kysely<Database>
  /**
   * Custom key in step output to extract usage from.
   * Default: '_usage'
   */
  usageKey?: string
  /**
   * Pricing table: model name → cost per 1K tokens.
   * Used as fallback when step output doesn't include costUsd.
   */
  pricing?: Record<string, number>
  logger?: {
    debug: (...args: unknown[]) => void
  }
}

export interface StepUsage {
  tokens?: number
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  model?: string
}

/**
 * StepInterceptor that extracts cost data from step outputs and persists to DB.
 * Install via: `interceptors: [new StepCostTracker({ db })]`
 */
export class StepCostTracker implements StepInterceptor {
  private db: Kysely<Database>
  private usageKey: string
  private pricing: Record<string, number>
  private logger: StepCostTrackerConfig['logger']

  constructor(config: StepCostTrackerConfig) {
    this.db = config.db
    this.usageKey = config.usageKey ?? '_usage'
    this.pricing = config.pricing ?? {}
    this.logger = config.logger
  }

  async afterExecute(payload: StepPayload, result: StepResult): Promise<StepResult> {
    const usage = (result.output as any)?.[this.usageKey] as StepUsage | undefined
    if (!usage) return result

    const tokens = usage.tokens
      ?? (((usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)) || null)

    const model = usage.model ?? (payload.executorConfig.model as string) ?? null

    let costUsd = usage.costUsd ?? null
    if (costUsd === null && tokens && model && this.pricing[model]) {
      costUsd = (tokens / 1000) * this.pricing[model]
    }

    // Persist to DB
    await this.db
      .updateTable('workflow_steps')
      .set({
        tokensUsed: tokens,
        costUsd: costUsd !== null ? String(costUsd) : null,
        modelUsed: model,
        updatedAt: new Date(),
      })
      .where('workflowRunId', '=', payload.workflowRunId)
      .where('stepName', '=', payload.stepName)
      .execute()

    this.logger?.debug?.(
      `[StepCostTracker] ${payload.stepName}: ${tokens} tokens, $${costUsd ?? '?'} (${model ?? 'unknown'})`,
    )

    return result
  }
}
