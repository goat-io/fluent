import {
  AgentRole,
  type AgreementMessage,
  type AgreementSessionConfig,
  AgreementState,
  type ConsensusResult,
  type CritiquePayload,
  type VotePayload,
  validatePayloadSize,
} from './AgreementProtocol.types.js'
import { RiskGuard, type RiskGuardConfig } from './RiskGuard.js'

export interface AgreementAgent {
  id: string
  role: AgentRole
  weight: number
  model?: string
  systemPrompt?: string
  execute: (prompt: string, context: any) => Promise<AgreementMessage>
}

export interface OrchestratorOptions {
  riskGuardConfig?: RiskGuardConfig
}

export class AgreementOrchestrator {
  private config: AgreementSessionConfig
  private agents: Map<string, AgreementAgent>
  private riskGuard: RiskGuard
  private messages: AgreementMessage[] = []
  private currentState: AgreementState = AgreementState.PROPOSE
  private turnCount = 0
  private startTime = Date.now()

  constructor(
    config: AgreementSessionConfig,
    agents: AgreementAgent[],
    options: OrchestratorOptions = {},
  ) {
    this.config = config
    this.agents = new Map(agents.map(a => [a.id, a]))
    this.riskGuard = new RiskGuard(options.riskGuardConfig)
  }

  async runAgreement(initialProposal: string): Promise<ConsensusResult | null> {
    // Phase 1: Propose
    await this.handlePropose(initialProposal)

    // Main loop
    while (
      this.currentState !== AgreementState.COMMIT &&
      this.currentState !== AgreementState.ABORT
    ) {
      // Check time limit
      if (Date.now() - this.startTime > this.config.maxDurationMs) {
        this.currentState = AgreementState.ABORT
        break
      }

      // Check turn limit
      if (this.turnCount >= this.config.maxTurns) {
        this.currentState = AgreementState.ABORT
        break
      }

      // Check risks
      const riskCheck = await this.riskGuard.checkRisks({
        messages: this.messages,
        turnCount: this.turnCount,
      })
      if (!riskCheck.safe) {
        this.currentState = AgreementState.ABORT
        break
      }

      switch (this.currentState) {
        case AgreementState.CRITIQUE:
          await this.handleCritique()
          break
        case AgreementState.CONVERGE:
          await this.handleConverge()
          break
        case AgreementState.PROPOSE:
          await this.handleRefine()
          break
      }
    }

    if (this.currentState === AgreementState.COMMIT) {
      return this.createResult()
    }

    return null
  }

  private async handlePropose(proposal: string): Promise<void> {
    const proposer = this.getAgentByRole(AgentRole.PROPOSER)
    if (!proposer) {
      throw new Error('No proposer agent found')
    }

    const message = await proposer.execute(proposal, {
      step: AgreementState.PROPOSE,
    })
    validatePayloadSize(message.payload)
    this.messages.push(message)
    this.currentState = AgreementState.CRITIQUE
    this.turnCount++
  }

  private async handleCritique(): Promise<void> {
    const reviewers = this.getAgentsByRole(AgentRole.REVIEWER)
    const latestProposal = this.messages
      .filter(m => m.step === AgreementState.PROPOSE)
      .pop()

    const critiquePromises = reviewers.map(async reviewer => {
      const message = await reviewer.execute(
        `Review proposal: ${JSON.stringify(latestProposal?.payload)}`,
        { step: AgreementState.CRITIQUE, proposal: latestProposal },
      )
      validatePayloadSize(message.payload)
      this.messages.push(message)
      return message
    })

    await Promise.all(critiquePromises)
    this.currentState = AgreementState.CONVERGE
  }

  private async handleConverge(): Promise<void> {
    const critiques = this.messages.filter(
      m => m.step === AgreementState.CRITIQUE,
    )
    const votes = this.collectVotes(critiques)
    const score = this.calculateConsensus(votes)

    if (score >= this.config.minConsensusScore) {
      this.currentState = AgreementState.COMMIT
    } else {
      this.currentState = AgreementState.PROPOSE
    }
  }

  private async handleRefine(): Promise<void> {
    await this.handlePropose(
      `Refine proposal based on critiques: ${JSON.stringify(
        this.messages
          .filter(m => m.step === AgreementState.CRITIQUE)
          .map(m => m.payload),
      )}`,
    )
  }

  private collectVotes(critiques: AgreementMessage[]): VotePayload[] {
    return critiques.map(c => {
      const payload = c.payload as CritiquePayload
      return {
        proposalId: payload.proposalId ?? c.id,
        vote:
          payload.overallAssessment === 'approve'
            ? ('approve' as const)
            : ('reject' as const),
        rationale: `Assessment: ${payload.overallAssessment}`,
        weight: this.agents.get(c.agentId)?.weight ?? 1,
      }
    })
  }

  private calculateConsensus(votes: VotePayload[]): number {
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0)
    if (totalWeight === 0) {
      return 0
    }
    const approveWeight = votes
      .filter(v => v.vote === 'approve')
      .reduce((sum, v) => sum + v.weight, 0)
    return approveWeight / totalWeight
  }

  private createResult(): ConsensusResult {
    const proposals = this.messages.filter(
      m => m.step === AgreementState.PROPOSE,
    )
    const latestProposal = proposals[proposals.length - 1]
    const critiques = this.messages.filter(
      m => m.step === AgreementState.CRITIQUE,
    )
    const votes = this.collectVotes(critiques)
    const score = this.calculateConsensus(votes)

    const allApprove = votes.every(v => v.vote === 'approve')

    return {
      proposalId: latestProposal?.id ?? '',
      finalContent: JSON.stringify(latestProposal?.payload),
      consensus: {
        method: allApprove ? 'unanimous' : 'majority',
        votes,
        score,
      },
      auditTrail: this.messages.map(m => m.id),
      sessionId: this.config.sessionId,
      duration: Date.now() - this.startTime,
      iterations: this.turnCount,
    }
  }

  private getAgentByRole(role: AgentRole): AgreementAgent | undefined {
    return Array.from(this.agents.values()).find(a => a.role === role)
  }

  private getAgentsByRole(role: AgentRole): AgreementAgent[] {
    return Array.from(this.agents.values()).filter(a => a.role === role)
  }

  getState(): AgreementState {
    return this.currentState
  }
  getMessages(): AgreementMessage[] {
    return [...this.messages]
  }
  getTurnCount(): number {
    return this.turnCount
  }
}
