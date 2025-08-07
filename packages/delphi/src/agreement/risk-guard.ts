/**
 * Risk Guard System
 * Monitors and prevents risky behaviors in agent agreement
 */
import { AgreementContext, AgreementMessage } from './protocol.js'

export interface RiskGuardConfig {
  maxTokensPerTurn?: number
  cycleSimilarityThreshold?: number
  maxErrorsBeforeCircuitBreak?: number
  errorWindowMs?: number
}

export interface RiskCheckResult {
  safe: boolean
  reason?: string
  recommendations?: string[]
}

interface AgentMetrics {
  tokenUsage: number[]
  errors: number[]
  lastMessages: string[]
}

export class RiskGuard {
  private config: Required<RiskGuardConfig>
  private agentMetrics: Map<string, AgentMetrics>

  constructor(config: RiskGuardConfig = {}) {
    this.config = {
      maxTokensPerTurn: config.maxTokensPerTurn || 2000,
      cycleSimilarityThreshold: config.cycleSimilarityThreshold || 0.9,
      maxErrorsBeforeCircuitBreak: config.maxErrorsBeforeCircuitBreak || 3,
      errorWindowMs: config.errorWindowMs || 600000 // 10 minutes
    }

    this.agentMetrics = new Map()
  }

  /**
   * Check all risk factors
   */
  async checkRisks(context: AgreementContext): Promise<RiskCheckResult> {
    const checks = [
      this.checkTokenBudget(context),
      this.checkCyclicalArguments(context),
      this.checkCircuitBreaker(),
      this.checkPayloadSize(context),
      this.checkTimeouts(context)
    ]

    for (const check of checks) {
      if (!check.safe) {
        return check
      }
    }

    return { safe: true }
  }

  /**
   * Check token budget per turn
   */
  private checkTokenBudget(context: AgreementContext): RiskCheckResult {
    const currentTurnMessages = this.getMessagesByTurn(
      context.messages,
      context.turnCount
    )
    const turnTokens = currentTurnMessages.reduce((sum, msg) => {
      return sum + (msg.tokenUsage?.total || 0)
    }, 0)

    if (turnTokens > this.config.maxTokensPerTurn) {
      return {
        safe: false,
        reason: `Token budget exceeded: ${turnTokens} > ${this.config.maxTokensPerTurn}`,
        recommendations: [
          'Reduce prompt complexity',
          'Use smaller models for simple tasks',
          'Implement prompt compression'
        ]
      }
    }

    return { safe: true }
  }

  /**
   * Detect cyclical arguments using Jaccard similarity
   */
  private checkCyclicalArguments(context: AgreementContext): RiskCheckResult {
    if (context.messages.length < 4) {
      return { safe: true } // Need at least 2 rounds to detect cycles
    }

    const lastTwoRounds = this.getLastTwoRounds(context.messages)
    if (lastTwoRounds.length !== 2) {
      return { safe: true }
    }

    const similarity = this.calculateJaccardSimilarity(
      JSON.stringify(lastTwoRounds[0]),
      JSON.stringify(lastTwoRounds[1])
    )

    if (similarity > this.config.cycleSimilarityThreshold) {
      return {
        safe: false,
        reason: `Cyclical arguments detected: similarity ${similarity.toFixed(2)} > ${this.config.cycleSimilarityThreshold}`,
        recommendations: [
          'Introduce new perspectives',
          'Switch to arbiter resolution',
          'Abort and use fallback agent'
        ]
      }
    }

    return { safe: true }
  }

  /**
   * Check circuit breaker for agent errors
   */
  private checkCircuitBreaker(): RiskCheckResult {
    const now = Date.now()
    const windowStart = now - this.config.errorWindowMs

    for (const [agentId, metrics] of this.agentMetrics) {
      const recentErrors = metrics.errors.filter(t => t > windowStart).length

      if (recentErrors >= this.config.maxErrorsBeforeCircuitBreak) {
        return {
          safe: false,
          reason: `Agent ${agentId} circuit breaker triggered: ${recentErrors} errors in window`,
          recommendations: [
            'Use fallback agent',
            'Reduce request rate',
            'Check agent health'
          ]
        }
      }
    }

    return { safe: true }
  }

  /**
   * Check payload sizes
   */
  private checkPayloadSize(context: AgreementContext): RiskCheckResult {
    const MAX_SIZE_MB = 10

    for (const message of context.messages) {
      const sizeBytes = new TextEncoder().encode(
        JSON.stringify(message.payload)
      ).length
      const sizeMB = sizeBytes / (1024 * 1024)

      if (sizeMB > MAX_SIZE_MB) {
        return {
          safe: false,
          reason: `Payload size ${sizeMB.toFixed(2)}MB exceeds ${MAX_SIZE_MB}MB limit`,
          recommendations: [
            'Compress payload content',
            'Split into multiple messages',
            'Use reference IDs instead of full content'
          ]
        }
      }
    }

    return { safe: true }
  }

  /**
   * Check for timeout risks
   */
  private checkTimeouts(context: AgreementContext): RiskCheckResult {
    const elapsed = Date.now() - context.startTime
    const remainingTime = context.config.maxDurationMs - elapsed
    const timePerTurn = elapsed / Math.max(context.turnCount, 1)

    // Predict if we'll timeout
    const estimatedTurnsRemaining = context.config.maxTurns - context.turnCount
    const estimatedTimeNeeded = timePerTurn * estimatedTurnsRemaining

    if (estimatedTimeNeeded > remainingTime * 1.2) {
      // 20% buffer
      return {
        safe: false,
        reason: `Likely to timeout: need ${estimatedTimeNeeded}ms but only ${remainingTime}ms remaining`,
        recommendations: [
          'Skip to voting phase',
          'Use faster decision method',
          'Reduce remaining iterations'
        ]
      }
    }

    return { safe: true }
  }

  /**
   * Record token usage for an agent
   */
  recordTokenUsage(agentId: string, tokens: number) {
    const metrics = this.getOrCreateMetrics(agentId)
    metrics.tokenUsage.push(tokens)

    // Keep only last 100 entries
    if (metrics.tokenUsage.length > 100) {
      metrics.tokenUsage.shift()
    }
  }

  /**
   * Record an error for an agent
   */
  recordError(agentId: string) {
    const metrics = this.getOrCreateMetrics(agentId)
    metrics.errors.push(Date.now())

    // Clean old errors
    const windowStart = Date.now() - this.config.errorWindowMs
    metrics.errors = metrics.errors.filter(t => t > windowStart)
  }

  /**
   * Record a message for cycle detection
   */
  recordMessage(agentId: string, message: string) {
    const metrics = this.getOrCreateMetrics(agentId)
    metrics.lastMessages.push(message)

    // Keep only last 5 messages
    if (metrics.lastMessages.length > 5) {
      metrics.lastMessages.shift()
    }
  }

  private getOrCreateMetrics(agentId: string): AgentMetrics {
    if (!this.agentMetrics.has(agentId)) {
      this.agentMetrics.set(agentId, {
        tokenUsage: [],
        errors: [],
        lastMessages: []
      })
    }
    return this.agentMetrics.get(agentId)!
  }

  private getMessagesByTurn(
    messages: AgreementMessage[],
    turn: number
  ): AgreementMessage[] {
    // Simple heuristic: messages are grouped by state cycles
    const turnsMessages: AgreementMessage[][] = []
    let currentTurn: AgreementMessage[] = []
    let lastState: string | null = null

    for (const msg of messages) {
      if (msg.step === 'propose' && lastState !== 'propose') {
        if (currentTurn.length > 0) {
          turnsMessages.push(currentTurn)
          currentTurn = []
        }
      }
      currentTurn.push(msg)
      lastState = msg.step
    }

    if (currentTurn.length > 0) {
      turnsMessages.push(currentTurn)
    }

    return turnsMessages[turn] || []
  }

  private getLastTwoRounds(messages: AgreementMessage[]): AgreementMessage[][] {
    const rounds: AgreementMessage[][] = []
    let currentRound: AgreementMessage[] = []

    for (const msg of messages) {
      if (msg.step === 'propose' && currentRound.length > 0) {
        rounds.push(currentRound)
        currentRound = []
      }
      currentRound.push(msg)
    }

    if (currentRound.length > 0) {
      rounds.push(currentRound)
    }

    return rounds.slice(-2)
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/\s+/))
    const set2 = new Set(str2.toLowerCase().split(/\s+/))

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {}

    for (const [agentId, agentMetrics] of this.agentMetrics) {
      metrics[agentId] = {
        avgTokenUsage:
          agentMetrics.tokenUsage.length > 0
            ? agentMetrics.tokenUsage.reduce((a, b) => a + b, 0) /
              agentMetrics.tokenUsage.length
            : 0,
        totalErrors: agentMetrics.errors.length,
        recentErrors: agentMetrics.errors.filter(t => t > Date.now() - 60000)
          .length
      }
    }

    return metrics
  }
}
