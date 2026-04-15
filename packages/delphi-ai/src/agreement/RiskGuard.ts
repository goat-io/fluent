// npx vitest run src/__tests__/agreement/risk-guard.spec.ts

export interface RiskGuardConfig {
  maxTokensPerTurn?: number
  cycleSimilarityThreshold?: number
  maxErrorsBeforeCircuitBreak?: number
}

export interface RiskCheckResult {
  safe: boolean
  reason?: string
}

export class RiskGuard {
  private config: Required<RiskGuardConfig>
  private errorCounts = new Map<string, number>()
  private tokenUsage = new Map<string, number>()

  constructor(config: RiskGuardConfig = {}) {
    this.config = {
      maxTokensPerTurn: config.maxTokensPerTurn ?? 5000,
      cycleSimilarityThreshold: config.cycleSimilarityThreshold ?? 0.9,
      maxErrorsBeforeCircuitBreak: config.maxErrorsBeforeCircuitBreak ?? 5,
    }
  }

  async checkRisks(context: {
    messages: Array<{
      tokenUsage?: { total: number }
      payload?: any
      step?: string
    }>
    turnCount: number
  }): Promise<RiskCheckResult> {
    // Check token budget
    const totalTokens = context.messages.reduce(
      (sum, m) => sum + (m.tokenUsage?.total ?? 0),
      0,
    )
    if (
      totalTokens >
      this.config.maxTokensPerTurn * Math.max(context.turnCount, 1)
    ) {
      return {
        safe: false,
        reason: `Token budget exceeded: ${totalTokens} tokens used`,
      }
    }

    // Check circuit breaker errors
    for (const [agentId, count] of this.errorCounts) {
      if (count >= this.config.maxErrorsBeforeCircuitBreak) {
        return {
          safe: false,
          reason: `Agent "${agentId}" circuit breaker tripped (${count} errors)`,
        }
      }
    }

    // Check for cyclical arguments
    if (context.turnCount >= 2) {
      const proposals = context.messages
        .filter(m => m.step === 'propose')
        .map(m => JSON.stringify(m.payload))
      if (proposals.length >= 2) {
        const last = proposals[proposals.length - 1]
        const prev = proposals[proposals.length - 2]
        if (last === prev) {
          return {
            safe: false,
            reason: 'Cyclical arguments detected: identical proposals',
          }
        }
      }
    }

    return { safe: true }
  }

  recordError(agentId: string): void {
    this.errorCounts.set(agentId, (this.errorCounts.get(agentId) ?? 0) + 1)
  }

  recordTokenUsage(agentId: string, tokens: number): void {
    this.tokenUsage.set(agentId, (this.tokenUsage.get(agentId) ?? 0) + tokens)
  }

  getTokenUsage(agentId: string): number {
    return this.tokenUsage.get(agentId) ?? 0
  }

  reset(): void {
    this.errorCounts.clear()
    this.tokenUsage.clear()
  }
}
