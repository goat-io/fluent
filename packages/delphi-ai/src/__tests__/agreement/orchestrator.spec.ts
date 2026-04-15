// npx vitest run src/__tests__/agreement/orchestrator.spec.ts
import { describe, expect, it, vi } from 'vitest'
import {
  type AgreementAgent,
  AgreementOrchestrator,
} from '../../agreement/AgreementOrchestrator.js'
import {
  AgentRole,
  type AgreementSessionConfig,
} from '../../agreement/AgreementProtocol.types.js'
import { RiskGuard } from '../../agreement/RiskGuard.js'

function createMockAgent(
  id: string,
  role: AgentRole,
  assessment: 'approve' | 'refine' | 'reject' = 'approve',
): AgreementAgent {
  return {
    id,
    role,
    weight: 1,
    execute: vi.fn().mockImplementation(async (_prompt, ctx) => ({
      id: `${id}-msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      role,
      agentId: id,
      step: ctx.step,
      payload:
        role === AgentRole.PROPOSER
          ? {
              content: 'Test proposal',
              rationale: 'Reasoning',
              confidence: 0.8,
            }
          : {
              proposalId: 'current',
              concerns:
                assessment === 'approve'
                  ? []
                  : [{ severity: 'major', description: 'Issue found' }],
              overallAssessment: assessment,
              confidence: 0.9,
            },
    })),
  }
}

function defaultConfig(
  overrides: Partial<AgreementSessionConfig> = {},
): AgreementSessionConfig {
  return {
    sessionId: 'test-session',
    maxTurns: 5,
    maxDurationMs: 30000,
    tokenBudgetPerTurn: 5000,
    minConsensusScore: 0.5,
    conflictResolution: 'majority',
    ...overrides,
  }
}

describe('AgreementOrchestrator', () => {
  it('reaches consensus with approving reviewers', async () => {
    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      createMockAgent('reviewer-1', AgentRole.REVIEWER, 'approve'),
      createMockAgent('reviewer-2', AgentRole.REVIEWER, 'approve'),
    ]

    const orchestrator = new AgreementOrchestrator(defaultConfig(), agents)
    const result = await orchestrator.runAgreement('Build a new feature')

    expect(result).not.toBeNull()
    expect(result!.consensus.score).toBeGreaterThanOrEqual(0.5)
    expect(result!.consensus.method).toBe('unanimous')
    expect(result!.sessionId).toBe('test-session')
    expect(result!.iterations).toBeGreaterThan(0)
  })

  it('returns null when consensus not reached', async () => {
    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      createMockAgent('reviewer-1', AgentRole.REVIEWER, 'reject'),
      createMockAgent('reviewer-2', AgentRole.REVIEWER, 'reject'),
    ]

    const orchestrator = new AgreementOrchestrator(
      defaultConfig({ maxTurns: 2, minConsensusScore: 0.8 }),
      agents,
    )
    const result = await orchestrator.runAgreement('Bad idea')

    expect(result).toBeNull()
  })

  it('respects turn limit', async () => {
    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      createMockAgent('reviewer-1', AgentRole.REVIEWER, 'reject'),
    ]

    const orchestrator = new AgreementOrchestrator(
      defaultConfig({ maxTurns: 1, minConsensusScore: 1.0 }),
      agents,
    )
    const result = await orchestrator.runAgreement('Test')

    expect(result).toBeNull()
    expect(orchestrator.getTurnCount()).toBeLessThanOrEqual(2)
  })

  it('handles agent failure gracefully', async () => {
    const failingReviewer: AgreementAgent = {
      id: 'bad-reviewer',
      role: AgentRole.REVIEWER,
      weight: 1,
      execute: vi.fn().mockRejectedValue(new Error('Agent crash')),
    }

    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      failingReviewer,
    ]

    const orchestrator = new AgreementOrchestrator(defaultConfig(), agents)

    await expect(orchestrator.runAgreement('Test')).rejects.toThrow()
  })

  it('calls all reviewers', async () => {
    const reviewer1 = createMockAgent('r1', AgentRole.REVIEWER, 'approve')
    const reviewer2 = createMockAgent('r2', AgentRole.REVIEWER, 'approve')

    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      reviewer1,
      reviewer2,
    ]

    const orchestrator = new AgreementOrchestrator(defaultConfig(), agents)
    await orchestrator.runAgreement('Test')

    expect(reviewer1.execute).toHaveBeenCalled()
    expect(reviewer2.execute).toHaveBeenCalled()
  })

  it('records all messages in audit trail', async () => {
    const agents = [
      createMockAgent('proposer', AgentRole.PROPOSER),
      createMockAgent('reviewer', AgentRole.REVIEWER, 'approve'),
    ]

    const orchestrator = new AgreementOrchestrator(defaultConfig(), agents)
    const result = await orchestrator.runAgreement('Test')

    expect(result).not.toBeNull()
    expect(result!.auditTrail.length).toBeGreaterThan(0)
    expect(orchestrator.getMessages().length).toBeGreaterThan(0)
  })
})

describe('RiskGuard', () => {
  it('detects token budget exceeded', async () => {
    const guard = new RiskGuard({ maxTokensPerTurn: 100 })
    const result = await guard.checkRisks({
      messages: [{ tokenUsage: { total: 500 } }],
      turnCount: 1,
    })
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Token budget exceeded')
  })

  it('allows within budget', async () => {
    const guard = new RiskGuard({ maxTokensPerTurn: 1000 })
    const result = await guard.checkRisks({
      messages: [{ tokenUsage: { total: 500 } }],
      turnCount: 1,
    })
    expect(result.safe).toBe(true)
  })

  it('detects cyclical arguments', async () => {
    const guard = new RiskGuard()
    const samePayload = JSON.stringify({ content: 'Same thing' })
    const result = await guard.checkRisks({
      messages: [
        { step: 'propose', payload: samePayload },
        { step: 'critique', payload: 'different' },
        { step: 'propose', payload: samePayload },
      ],
      turnCount: 2,
    })
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('Cyclical')
  })

  it('triggers circuit breaker after errors', async () => {
    const guard = new RiskGuard({ maxErrorsBeforeCircuitBreak: 3 })
    guard.recordError('agent-1')
    guard.recordError('agent-1')
    guard.recordError('agent-1')

    const result = await guard.checkRisks({ messages: [], turnCount: 0 })
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('circuit breaker')
  })

  it('tracks token usage per agent', () => {
    const guard = new RiskGuard()
    guard.recordTokenUsage('agent-1', 100)
    guard.recordTokenUsage('agent-1', 200)
    expect(guard.getTokenUsage('agent-1')).toBe(300)
  })
})
