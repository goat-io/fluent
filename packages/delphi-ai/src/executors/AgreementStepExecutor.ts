// npx vitest run src/__tests__/executors/agreement-step-executor.spec.ts
import type {
  StepExecutor,
  StepPayload,
  StepResult,
} from '@goatlab/delphi-core'
import { Ids } from '@goatlab/js-utils'
import {
  type AgreementAgent,
  AgreementOrchestrator,
} from '../agreement/AgreementOrchestrator.js'
import {
  AgentRole,
  type AgreementSessionConfig,
  AgreementState,
} from '../agreement/AgreementProtocol.types.js'
import { LLMAdapter } from '../llm/LLMAdapter.js'
import { modelSelector } from '../llm/ModelSelector.js'

export class AgreementStepExecutor implements StepExecutor {
  readonly type = 'agreement'
  private adapter: LLMAdapter

  constructor() {
    this.adapter = new LLMAdapter()
  }

  async execute(payload: StepPayload): Promise<StepResult> {
    const config = payload.executorConfig as {
      strategy?: string
      proposer?: { model: string; systemPrompt?: string }
      reviewers?: Array<{
        model: string
        focus?: string
        systemPrompt?: string
      }>
      arbiter?: { model: string; systemPrompt?: string }
      maxTurns?: number
      consensusThreshold?: number
      maxDurationMs?: number
    }

    const strategy = config.strategy ?? 'quick-decision'
    const maxTurns = config.maxTurns ?? 3
    const consensusThreshold = config.consensusThreshold ?? 0.7

    // Build agents from config
    const agents: AgreementAgent[] = []

    // Proposer
    const proposerModel =
      config.proposer?.model ??
      modelSelector.resolveModelForRole(strategy, 'proposer').model
    agents.push(
      this.createAgent(
        'proposer-1',
        AgentRole.PROPOSER,
        proposerModel,
        config.proposer?.systemPrompt,
      ),
    )

    // Reviewers
    if (config.reviewers?.length) {
      for (let i = 0; i < config.reviewers.length; i++) {
        const r = config.reviewers[i]
        agents.push(
          this.createAgent(
            `reviewer-${i + 1}`,
            AgentRole.REVIEWER,
            r.model,
            r.systemPrompt,
          ),
        )
      }
    } else {
      // Default reviewers from strategy
      const mapping = modelSelector.getStrategyModels(strategy)
      const reviewerModels = Array.isArray(mapping.reviewer)
        ? mapping.reviewer
        : [mapping.reviewer]
      for (let i = 0; i < reviewerModels.length; i++) {
        const resolved = modelSelector.resolveModelConfig(reviewerModels[i])
        agents.push(
          this.createAgent(
            `reviewer-${i + 1}`,
            AgentRole.REVIEWER,
            resolved.model,
          ),
        )
      }
    }

    // Arbiter
    if (config.arbiter) {
      agents.push(
        this.createAgent(
          'arbiter-1',
          AgentRole.ARBITER,
          config.arbiter.model,
          config.arbiter.systemPrompt,
        ),
      )
    }

    const sessionConfig: AgreementSessionConfig = {
      sessionId: Ids.nanoId(21),
      maxTurns,
      maxDurationMs: config.maxDurationMs ?? 120_000,
      tokenBudgetPerTurn: 5000,
      minConsensusScore: consensusThreshold,
      conflictResolution: 'majority',
    }

    const orchestrator = new AgreementOrchestrator(sessionConfig, agents)
    const goal =
      typeof payload.input === 'string'
        ? payload.input
        : JSON.stringify(payload.input)

    const result = await orchestrator.runAgreement(goal)

    if (!result) {
      return {
        output: {
          consensus: false,
          reason: 'No consensus reached',
          iterations: orchestrator.getTurnCount(),
        },
      }
    }

    return {
      output: {
        consensus: true,
        finalContent: result.finalContent,
        score: result.consensus.score,
        method: result.consensus.method,
        iterations: result.iterations,
        duration: result.duration,
      },
    }
  }

  private createAgent(
    id: string,
    role: AgentRole,
    model: string,
    systemPrompt?: string,
  ): AgreementAgent {
    return {
      id,
      role,
      weight: role === AgentRole.ARBITER ? 1.5 : 1,
      model,
      systemPrompt,
      execute: async (prompt, context) => {
        const resolved = modelSelector.resolveModelConfig(model)
        const response = await this.adapter.chatFromConfig(resolved, [
          ...(systemPrompt
            ? [{ role: 'system' as const, content: systemPrompt }]
            : []),
          { role: 'user' as const, content: prompt },
        ])

        const parsedPayload = this.parseAgentResponse(
          response.content,
          role,
          context.step,
        )

        return {
          id: Ids.nanoId(21),
          timestamp: new Date().toISOString(),
          role,
          agentId: id,
          step: context.step,
          payload: parsedPayload,
          tokenUsage: response.usage
            ? {
                prompt: response.usage.promptTokens,
                completion: response.usage.completionTokens,
                total: response.usage.totalTokens,
              }
            : undefined,
        }
      },
    }
  }

  private parseAgentResponse(
    content: string,
    _role: AgentRole,
    step: string,
  ): any {
    try {
      return JSON.parse(content)
    } catch {
      if (step === AgreementState.PROPOSE) {
        return { content, rationale: 'Generated proposal', confidence: 0.7 }
      }
      if (step === AgreementState.CRITIQUE) {
        return {
          proposalId: 'current',
          concerns: [],
          overallAssessment: 'refine',
          confidence: 0.6,
        }
      }
      return { content }
    }
  }
}
