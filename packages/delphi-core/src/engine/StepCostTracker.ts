// npx vitest run src/__tests__/engine/cost-tracking.spec.ts
//
// StepInterceptor that extracts token usage and cost from step outputs
// and persists them to the workflow_steps table.
//
import type { DbClient } from '../db/DbClient.js'
import type {
  StepInterceptor,
  StepPayload,
  StepResult,
} from '../workflow/WorkflowBuilder.types.js'

export interface StepCostTrackerConfig {
  db: DbClient
  usageKey?: string
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

export class StepCostTracker implements StepInterceptor {
  private db: DbClient
  private usageKey: string
  private pricing: Record<string, number>
  private logger: StepCostTrackerConfig['logger']

  constructor(config: StepCostTrackerConfig) {
    this.db = config.db
    this.usageKey = config.usageKey ?? '_usage'
    this.pricing = config.pricing ?? {}
    this.logger = config.logger
  }

  async afterExecute(
    payload: StepPayload,
    result: StepResult,
  ): Promise<StepResult> {
    const usage = (result.output as any)?.[this.usageKey] as
      | StepUsage
      | undefined
    if (!usage) {
      return result
    }

    const tokens =
      usage.tokens ??
      ((usage.promptTokens ?? 0) + (usage.completionTokens ?? 0) || null)

    const model =
      usage.model ?? (payload.executorConfig.model as string) ?? null

    let costUsd = usage.costUsd ?? null
    if (costUsd === null && tokens && model && this.pricing[model]) {
      costUsd = (tokens / 1000) * this.pricing[model]
    }

    await this.db.query(
      `UPDATE workflow_steps SET "tokensUsed" = $1, "costUsd" = $2, "modelUsed" = $3, "updatedAt" = $4 WHERE "workflowRunId" = $5 AND "stepName" = $6`,
      [
        tokens,
        costUsd !== null ? String(costUsd) : null,
        model,
        new Date(),
        payload.workflowRunId,
        payload.stepName,
      ],
    )

    this.logger?.debug?.(
      `[StepCostTracker] ${payload.stepName}: ${tokens} tokens, $${costUsd ?? '?'} (${model ?? 'unknown'})`,
    )

    return result
  }
}
