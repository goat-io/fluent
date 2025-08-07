/**
 * Agreement Orchestrator
 * Manages agent consensus with bounded loops and conflict resolution
 */

import { EventEmitter } from 'node:events'
import { context, SpanStatusCode, trace } from '@opentelemetry/api'
import { retryWithBackoff } from '../utils/retry.js'
import { Blackboard, SessionCleanupConfig } from './blackboard.js'
import {
  AgentRole,
  AgreementMessage,
  AgreementSessionConfig,
  AgreementState,
  CommitPayload,
  CritiquePayload,
  VotePayload,
  validateMessage,
  validatePayloadSize
} from './protocol.js'
import { RiskGuard } from './risk-guard.js'
import { AgreementStateMachine } from './state-machine.js'

const tracer = trace.getTracer('delphi-agreement')

export interface Agent {
  id: string
  role: AgentRole
  weight: number
  model?: string
  execute: (prompt: string, context: any) => Promise<AgreementMessage>
}

export interface OrchestratorOptions {
  blackboardPath?: string
  enableTracing?: boolean
  riskGuardConfig?: {
    maxTokensPerTurn?: number
    cycleSimilarityThreshold?: number
    maxErrorsBeforeCircuitBreak?: number
  }
  sessionCleanupConfig?: SessionCleanupConfig
}

export class AgreementOrchestrator extends EventEmitter {
  private stateMachine: AgreementStateMachine
  private blackboard: Blackboard
  private riskGuard: RiskGuard
  private agents: Map<string, Agent>
  private options: OrchestratorOptions
  private startTime: number = Date.now()
  private iterationCount: number = 0

  constructor(
    config: AgreementSessionConfig,
    agents: Agent[],
    options: OrchestratorOptions = {}
  ) {
    super()

    this.stateMachine = new AgreementStateMachine(config)
    this.blackboard = new Blackboard(
      options.blackboardPath,
      options.sessionCleanupConfig
    )
    this.riskGuard = new RiskGuard(options.riskGuardConfig)
    this.agents = new Map(agents.map(a => [a.id, a]))
    this.options = options

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.stateMachine.on('transition', ({ from, to, context }) => {
      this.emit('stateChange', { from, to, context })
    })

    this.stateMachine.on('message', message => {
      this.emit('message', message)
    })

    this.stateMachine.on('error', error => {
      this.emit('error', error)
    })
  }

  /**
   * Run the agreement protocol
   */
  async runAgreement(initialProposal: string): Promise<CommitPayload | null> {
    const span = tracer.startSpan('agreement.run')
    const ctx = trace.setSpan(context.active(), span)

    try {
      return await context.with(ctx, async () => {
        const sessionId = this.stateMachine.getContext().config.sessionId
        span.setAttributes({
          'agreement.session_id': sessionId,
          'agreement.initial_proposal': initialProposal.slice(0, 100)
        })

        // Initial proposal
        await this.handlePropose(initialProposal)

        // Main agreement loop
        while (!this.stateMachine.isTerminal()) {
          const currentState = this.stateMachine.getCurrentState()
          span.addEvent(`Processing state: ${currentState}`)

          switch (currentState) {
            case AgreementState.CRITIQUE:
              await this.handleCritique()
              break

            case AgreementState.CONVERGE:
              await this.handleConverge()
              break

            case AgreementState.PROPOSE:
              // Refine proposal based on feedback
              await this.handleRefine()
              break

            default:
              break
          }

          // Check risk guards
          const riskCheck = await this.riskGuard.checkRisks(
            this.stateMachine.getContext()
          )
          if (!riskCheck.safe) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: riskCheck.reason
            })
            await this.stateMachine.transition(AgreementState.ABORT)
            break
          }
        }

        // Handle terminal states
        const finalState = this.stateMachine.getCurrentState()

        if (finalState === AgreementState.COMMIT) {
          const commit = await this.createCommit()
          span.setStatus({ code: SpanStatusCode.OK })
          span.setAttributes({
            'agreement.consensus_score': commit.consensus.score
          })
          return commit
        }
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Agreement aborted'
        })
        return null
      })
    } finally {
      span.end()
      this.cleanup()
    }
  }

  private async handlePropose(proposal?: string) {
    const proposer = this.getAgentByRole(AgentRole.PROPOSER)
    if (!proposer) {
      throw new Error('No proposer agent found')
    }

    const prompt = proposal || 'Generate initial proposal'

    const message = await this.executeAgent(proposer, prompt, {
      step: AgreementState.PROPOSE,
      sessionFacts: await this.blackboard.getSessionFacts(
        this.stateMachine.getContext().config.sessionId
      )
    })

    // Validate and store
    validatePayloadSize(message.payload)
    this.stateMachine.addMessage(message)

    // Record in blackboard
    await this.blackboard.appendFact({
      sessionId: this.stateMachine.getContext().config.sessionId,
      agentId: proposer.id,
      type: 'proposal',
      content: message.payload,
      references: []
    })

    // Transition to critique
    await this.stateMachine.transition(AgreementState.CRITIQUE)
  }

  private async handleCritique() {
    const reviewers = this.getAgentsByRole(AgentRole.REVIEWER)
    const proposals = this.stateMachine
      .getContext()
      .messages.filter(m => m.step === AgreementState.PROPOSE)
    const latestProposal = proposals[proposals.length - 1]

    const critiquePromises = reviewers.map(async reviewer => {
      const prompt = `Review proposal: ${JSON.stringify(latestProposal.payload)}`

      const message = await this.executeAgent(reviewer, prompt, {
        step: AgreementState.CRITIQUE,
        proposal: latestProposal,
        sessionFacts: await this.blackboard.getSessionFacts(
          this.stateMachine.getContext().config.sessionId
        )
      })

      validatePayloadSize(message.payload)
      this.stateMachine.addMessage(message)

      // Record concerns in blackboard
      const critique = message.payload as CritiquePayload
      for (const concern of critique.concerns) {
        await this.blackboard.appendFact({
          sessionId: this.stateMachine.getContext().config.sessionId,
          agentId: reviewer.id,
          type: 'concern',
          content: concern,
          references: [latestProposal.id]
        })
      }

      return message
    })

    await Promise.all(critiquePromises)
    await this.stateMachine.transition(AgreementState.CONVERGE)
  }

  private async handleConverge() {
    const critiques = this.stateMachine
      .getContext()
      .messages.filter(m => m.step === AgreementState.CRITIQUE) as Array<
      AgreementMessage & { payload: CritiquePayload }
    >

    // Calculate consensus
    const votes = await this.collectVotes(critiques)
    const consensusScore = this.calculateConsensus(votes)

    // Record consensus attempt
    await this.blackboard.appendFact({
      sessionId: this.stateMachine.getContext().config.sessionId,
      agentId: 'orchestrator',
      type: 'metric',
      content: {
        consensusScore,
        votes: votes.map(v => ({ agentId: v.agentId, vote: (v.payload as any).vote }))
      },
      references: critiques.map(c => c.id)
    })

    if (
      consensusScore >= this.stateMachine.getContext().config.minConsensusScore
    ) {
      this.stateMachine.setConsensusReached(true)
      await this.stateMachine.transition(AgreementState.COMMIT)
    } else {
      // Need refinement
      this.stateMachine.setConsensusReached(false)
      await this.stateMachine.transition(AgreementState.PROPOSE)
    }
  }

  private async handleRefine() {
    const proposer = this.getAgentByRole(AgentRole.PROPOSER)
    if (!proposer) {
      throw new Error('No proposer agent found')
    }

    const critiques = this.stateMachine
      .getContext()
      .messages.filter(m => m.step === AgreementState.CRITIQUE)

    const prompt = `Refine proposal based on critiques: ${JSON.stringify(critiques)}`

    await this.handlePropose(prompt)
  }

  private async collectVotes(
    critiques: Array<AgreementMessage & { payload: CritiquePayload }>
  ): Promise<AgreementMessage[]> {
    const voteMessages: AgreementMessage[] = []

    for (const critique of critiques) {
      const vote: VotePayload = {
        proposalId: critique.payload.proposalId,
        vote:
          critique.payload.overallAssessment === 'approve'
            ? 'approve'
            : 'reject',
        rationale: `Based on critique assessment: ${critique.payload.overallAssessment}`,
        weight: this.agents.get(critique.agentId)?.weight || 1
      }

      voteMessages.push({
        id: `${critique.id}-vote`,
        timestamp: new Date().toISOString(),
        role: critique.role,
        agentId: critique.agentId,
        step: AgreementState.CONVERGE,
        payload: vote
      } as AgreementMessage)
    }

    return voteMessages
  }

  private calculateConsensus(votes: AgreementMessage[]): number {
    const votePayloads = votes.map(v => v.payload as VotePayload)
    const totalWeight = votePayloads.reduce((sum, v) => sum + v.weight, 0)
    const approveWeight = votePayloads
      .filter(v => v.vote === 'approve')
      .reduce((sum, v) => sum + v.weight, 0)

    return totalWeight > 0 ? approveWeight / totalWeight : 0
  }

  private async createCommit(): Promise<CommitPayload> {
    const context = this.stateMachine.getContext()
    const proposals = context.messages.filter(
      m => m.step === AgreementState.PROPOSE
    )
    const latestProposal = proposals[proposals.length - 1]
    const votes = context.messages.filter(
      m => m.step === AgreementState.CONVERGE
    )

    const consensusScore = this.calculateConsensus(votes)

    const commit: CommitPayload = {
      proposalId: latestProposal.id,
      finalContent: JSON.stringify(latestProposal.payload),
      consensus: {
        method: this.determineConsensusMethod(votes),
        votes: votes.map(v => v.payload as VotePayload),
        score: consensusScore
      },
      auditTrail: context.messages.map(m => m.id)
    }

    // Record decision
    const _decisionId = await this.blackboard.recordDecision(
      context.config.sessionId,
      {
        content: commit.finalContent,
        rationale: `Consensus reached with score ${consensusScore}`,
        consensusMethod: commit.consensus.method,
        consensusScore,
        factIds: context.messages.map(m => m.id)
      }
    )

    return commit
  }

  private determineConsensusMethod(
    votes: AgreementMessage[]
  ): CommitPayload['consensus']['method'] {
    const votePayloads = votes.map(v => v.payload as VotePayload)
    const allApprove = votePayloads.every(v => v.vote === 'approve')

    if (allApprove) {
      return 'unanimous'
    }

    const config = this.stateMachine.getContext().config
    if (config.conflictResolution === 'arbiter') {
      return 'arbiter'
    }

    return 'majority'
  }

  private async executeAgent(
    agent: Agent,
    prompt: string,
    context: any
  ): Promise<AgreementMessage> {
    return await retryWithBackoff(
      async () => {
        const message = await agent.execute(prompt, context)

        // Track token usage
        if (message.tokenUsage) {
          this.riskGuard.recordTokenUsage(agent.id, message.tokenUsage.total)
        }

        return validateMessage(message)
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        shouldRetry: error => {
          // Record error for circuit breaker
          this.riskGuard.recordError(agent.id)

          // Retry on transient errors
          return error.status === 429 || error.status >= 500
        }
      }
    )
  }

  private getAgentByRole(role: AgentRole): Agent | undefined {
    return Array.from(this.agents.values()).find(a => a.role === role)
  }

  private getAgentsByRole(role: AgentRole): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.role === role)
  }

  private cleanup() {
    this.stateMachine.cleanup()
  }

  async close() {
    this.cleanup()
    await this.blackboard.close()
    this.removeAllListeners()
  }

  getStartTime(): number {
    return this.startTime
  }

  getIterationCount(): number {
    return this.iterationCount
  }
}
