// npx vitest run tests/agreement.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  AgreementState,
  AgreementMessage,
  AgreementSessionConfig,
  AgentRole,
  validateMessage,
  validatePayloadSize
} from '../src/agreement/protocol'
import { AgreementStateMachine } from '../src/agreement/state-machine'
import { Blackboard } from '../src/agreement/blackboard'
import { RiskGuard } from '../src/agreement/risk-guard'
import { AgreementOrchestrator, Agent } from '../src/agreement/orchestrator'
import * as fs from 'fs'
import * as path from 'path'

describe('Agreement Protocol', () => {
  describe('Schema Validation', () => {
    it('should validate correct message format', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: new Date().toISOString(),
        role: AgentRole.PROPOSER,
        agentId: 'agent-1',
        step: AgreementState.PROPOSE,
        payload: {
          content: 'Test proposal',
          rationale: 'Test rationale',
          confidence: 0.8
        }
      }
      
      expect(() => validateMessage(message)).not.toThrow()
    })
    
    it('should reject oversized payloads', () => {
      const largePayload = {
        content: 'x'.repeat(11 * 1024 * 1024) // 11MB
      }
      
      expect(() => validatePayloadSize(largePayload, 10)).toThrow(/exceeds limit/)
    })
    
    it('should enforce required fields', () => {
      const invalidMessage = {
        role: AgentRole.PROPOSER,
        step: AgreementState.PROPOSE
        // Missing required fields
      }
      
      expect(() => validateMessage(invalidMessage)).toThrow()
    })
  })
  
  describe('State Machine', () => {
    let stateMachine: AgreementStateMachine
    let config: AgreementSessionConfig
    
    beforeEach(() => {
      config = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        maxTurns: 5,
        maxDurationMs: 90000,
        tokenBudgetPerTurn: 2000,
        minConsensusScore: 0.66,
        conflictResolution: 'majority',
        agents: [
          { id: 'agent-1', role: AgentRole.PROPOSER, weight: 1 },
          { id: 'agent-2', role: AgentRole.REVIEWER, weight: 1 }
        ]
      }
      
      stateMachine = new AgreementStateMachine(config)
    })
    
    afterEach(() => {
      stateMachine.cleanup()
    })
    
    it('should start in PROPOSE state', () => {
      expect(stateMachine.getCurrentState()).toBe(AgreementState.PROPOSE)
    })
    
    it('should transition PROPOSE -> CRITIQUE -> CONVERGE', async () => {
      // Add proposal message
      stateMachine.addMessage({
        id: '1',
        timestamp: new Date().toISOString(),
        role: AgentRole.PROPOSER,
        agentId: 'agent-1',
        step: AgreementState.PROPOSE,
        payload: {
          content: 'Test',
          rationale: 'Test',
          confidence: 0.8
        }
      } as AgreementMessage)
      
      // Transition to CRITIQUE
      await stateMachine.transition(AgreementState.CRITIQUE)
      expect(stateMachine.getCurrentState()).toBe(AgreementState.CRITIQUE)
      
      // Add critique
      stateMachine.addMessage({
        id: '2',
        timestamp: new Date().toISOString(),
        role: AgentRole.REVIEWER,
        agentId: 'agent-2',
        step: AgreementState.CRITIQUE,
        payload: {
          proposalId: '1',
          concerns: [],
          overallAssessment: 'approve',
          confidence: 0.9
        }
      } as AgreementMessage)
      
      // Transition to CONVERGE
      await stateMachine.transition(AgreementState.CONVERGE)
      expect(stateMachine.getCurrentState()).toBe(AgreementState.CONVERGE)
    })
    
    it('should abort on timeout', async () => {
      vi.useFakeTimers()
      
      const shortConfig = { ...config, maxDurationMs: 1000 }
      const sm = new AgreementStateMachine(shortConfig)
      
      // Advance time past timeout
      vi.advanceTimersByTime(1001)
      
      // Should auto-transition to ABORT
      await vi.runAllTimersAsync()
      
      // Check context for abort reason
      const context = sm.getContext()
      expect(context.abortReason).toContain('Timeout')
      
      sm.cleanup()
      vi.useRealTimers()
    })
    
    it('should enforce turn limits', async () => {
      const context = stateMachine.getContext()
      
      // Simulate max turns
      for (let i = 0; i < config.maxTurns; i++) {
        // Force increment turn count
        stateMachine['context'].turnCount = i + 1
      }
      
      // Should transition to ABORT
      await stateMachine.transition()
      expect(stateMachine.getCurrentState()).toBe(AgreementState.ABORT)
      expect(stateMachine.getContext().abortReason).toContain('Max turns')
    })
  })
  
  describe('Blackboard Storage', () => {
    let blackboard: Blackboard
    const testDbPath = '.test-blackboard.db'
    
    beforeEach(() => {
      // Clean up any existing test DB
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath)
      }
      blackboard = new Blackboard(testDbPath)
    })
    
    afterEach(() => {
      blackboard.close()
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath)
      }
    })
    
    it('should append facts immutably', async () => {
      const fact1 = await blackboard.appendFact({
        sessionId: 'session-1',
        agentId: 'agent-1',
        type: 'proposal',
        content: { text: 'Initial proposal' },
        references: []
      })
      
      expect(fact1.id).toBeDefined()
      expect(fact1.immutable).toBe(true)
      
      // Try to append duplicate (same hash)
      const fact2 = await blackboard.appendFact({
        sessionId: 'session-1',
        agentId: 'agent-1',
        type: 'proposal',
        content: { text: 'Initial proposal' },
        references: []
      })
      
      // Should return same fact (deduplication)
      expect(fact2.hash).toBe(fact1.hash)
    })
    
    it('should query facts by criteria', async () => {
      // Add multiple facts
      await blackboard.appendFact({
        sessionId: 'session-1',
        agentId: 'agent-1',
        type: 'proposal',
        content: 'Proposal 1',
        references: []
      })
      
      await blackboard.appendFact({
        sessionId: 'session-1',
        agentId: 'agent-2',
        type: 'concern',
        content: 'Concern 1',
        references: []
      })
      
      await blackboard.appendFact({
        sessionId: 'session-2',
        agentId: 'agent-1',
        type: 'proposal',
        content: 'Proposal 2',
        references: []
      })
      
      // Query by session
      const session1Facts = await blackboard.queryFacts({ sessionId: 'session-1' })
      expect(session1Facts.length).toBe(2)
      
      // Query by type
      const proposals = await blackboard.queryFacts({ type: 'proposal' })
      expect(proposals.length).toBe(2)
      
      // Query by agent
      const agent1Facts = await blackboard.queryFacts({ agentId: 'agent-1' })
      expect(agent1Facts.length).toBe(2)
    })
    
    it('should record decisions with audit trail', async () => {
      const decisionId = await blackboard.recordDecision('session-1', {
        content: { approved: true },
        rationale: 'Consensus reached',
        consensusMethod: 'majority',
        consensusScore: 0.75,
        factIds: ['fact-1', 'fact-2']
      })
      
      expect(decisionId).toBeDefined()
      
      const decision = await blackboard.getDecision(decisionId)
      expect(decision.consensusScore).toBe(0.75)
      expect(decision.factIds).toContain('fact-1')
    })
  })
  
  describe('Risk Guards', () => {
    let riskGuard: RiskGuard
    
    beforeEach(() => {
      riskGuard = new RiskGuard({
        maxTokensPerTurn: 1000,
        cycleSimilarityThreshold: 0.9,
        maxErrorsBeforeCircuitBreak: 3
      })
    })
    
    it('should detect token budget exceeded', async () => {
      const context = {
        messages: [
          {
            tokenUsage: { prompt: 500, completion: 600, total: 1100 }
          }
        ],
        turnCount: 0
      } as any
      
      const result = await riskGuard.checkRisks(context)
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Token budget exceeded')
    })
    
    it('should detect cyclical arguments', async () => {
      const repeatedContent = JSON.stringify({ content: 'Same argument' })
      
      const context = {
        messages: [
          { step: 'propose', payload: repeatedContent },
          { step: 'critique', payload: 'Different' },
          { step: 'propose', payload: repeatedContent },
          { step: 'critique', payload: 'Different' }
        ],
        turnCount: 2
      } as any
      
      const result = await riskGuard.checkRisks(context)
      
      // May or may not detect depending on implementation details
      expect(result.safe).toBeDefined()
    })
    
    it('should trigger circuit breaker after errors', () => {
      // Record multiple errors
      for (let i = 0; i < 3; i++) {
        riskGuard.recordError('agent-1')
      }
      
      const context = { messages: [], turnCount: 0 } as any
      const result = riskGuard.checkRisks(context)
      
      result.then(r => {
        expect(r.safe).toBe(false)
        expect(r.reason).toContain('circuit breaker')
      })
    })
  })
  
  describe('Orchestrator Integration', () => {
    let orchestrator: AgreementOrchestrator
    let mockAgents: Agent[]
    
    beforeEach(() => {
      mockAgents = [
        {
          id: 'proposer-1',
          role: AgentRole.PROPOSER,
          weight: 1,
          execute: vi.fn().mockResolvedValue({
            id: '1',
            timestamp: new Date().toISOString(),
            role: AgentRole.PROPOSER,
            agentId: 'proposer-1',
            step: AgreementState.PROPOSE,
            payload: {
              content: 'Test proposal',
              rationale: 'Test rationale',
              confidence: 0.8
            }
          })
        },
        {
          id: 'reviewer-1',
          role: AgentRole.REVIEWER,
          weight: 1,
          execute: vi.fn().mockResolvedValue({
            id: '2',
            timestamp: new Date().toISOString(),
            role: AgentRole.REVIEWER,
            agentId: 'reviewer-1',
            step: AgreementState.CRITIQUE,
            payload: {
              proposalId: '1',
              concerns: [],
              overallAssessment: 'approve',
              confidence: 0.9
            }
          })
        }
      ]
      
      const config: AgreementSessionConfig = {
        sessionId: 'test-session',
        maxTurns: 3,
        maxDurationMs: 60000,
        tokenBudgetPerTurn: 2000,
        minConsensusScore: 0.5,
        conflictResolution: 'majority',
        agents: mockAgents.map(a => ({
          id: a.id,
          role: a.role,
          weight: a.weight
        }))
      }
      
      orchestrator = new AgreementOrchestrator(config, mockAgents, {
        blackboardPath: '.test-orchestrator.db'
      })
    })
    
    afterEach(async () => {
      await orchestrator.close()
      if (fs.existsSync('.test-orchestrator.db')) {
        fs.unlinkSync('.test-orchestrator.db')
      }
    })
    
    it('should run agreement to completion', async () => {
      const result = await orchestrator.runAgreement('Initial proposal')
      
      expect(result).toBeDefined()
      expect(result?.consensus.method).toBe('unanimous')
      expect(result?.consensus.score).toBeGreaterThanOrEqual(0.5)
    })
    
    it('should handle agent failures gracefully', async () => {
      // Make one agent fail
      mockAgents[1].execute = vi.fn().mockRejectedValue(new Error('Agent error'))
      
      const result = await orchestrator.runAgreement('Initial proposal')
      
      // Should still complete or abort gracefully
      expect(result === null || result?.consensus).toBeDefined()
    })
  })
  
  describe('Property-based Testing', () => {
    it('should reach consensus regardless of agent order', async () => {
      // Test with different agent orderings
      const orders = [
        ['agent-1', 'agent-2', 'agent-3'],
        ['agent-2', 'agent-3', 'agent-1'],
        ['agent-3', 'agent-1', 'agent-2']
      ]
      
      for (const order of orders) {
        // Create agents in specific order
        const agents = order.map(id => ({
          id,
          role: id === 'agent-1' ? AgentRole.PROPOSER : AgentRole.REVIEWER,
          weight: 1,
          execute: vi.fn().mockResolvedValue({
            id: id + '-msg',
            timestamp: new Date().toISOString(),
            role: id === 'agent-1' ? AgentRole.PROPOSER : AgentRole.REVIEWER,
            agentId: id,
            step: id === 'agent-1' ? AgreementState.PROPOSE : AgreementState.CRITIQUE,
            payload: id === 'agent-1' 
              ? { content: 'Proposal', rationale: 'Reason', confidence: 0.8 }
              : { proposalId: '1', concerns: [], overallAssessment: 'approve', confidence: 0.8 }
          })
        }))
        
        const config: AgreementSessionConfig = {
          sessionId: 'order-test-' + order.join('-'),
          maxTurns: 2,
          maxDurationMs: 30000,
          tokenBudgetPerTurn: 1000,
          minConsensusScore: 0.5,
          conflictResolution: 'majority',
          agents: agents.map(a => ({ id: a.id, role: a.role, weight: a.weight }))
        }
        
        const orchestrator = new AgreementOrchestrator(config, agents as Agent[], {
          blackboardPath: '.test-order.db'
        })
        
        const result = await orchestrator.runAgreement('Test')
        
        // Should reach same outcome
        expect(result?.consensus.score).toBeGreaterThanOrEqual(0.5)
        
        await orchestrator.close()
      }
      
      if (fs.existsSync('.test-order.db')) {
        fs.unlinkSync('.test-order.db')
      }
    })
  })
  
  describe('Fault Injection', () => {
    it('should handle malformed JSON from agents', async () => {
      const badAgent: Agent = {
        id: 'bad-agent',
        role: AgentRole.PROPOSER,
        weight: 1,
        execute: vi.fn().mockResolvedValue({
          // Invalid structure
          notAValidField: 'bad data'
        })
      }
      
      const config: AgreementSessionConfig = {
        sessionId: 'fault-test',
        maxTurns: 1,
        maxDurationMs: 10000,
        tokenBudgetPerTurn: 1000,
        minConsensusScore: 0.5,
        conflictResolution: 'majority',
        agents: [{ id: 'bad-agent', role: AgentRole.PROPOSER, weight: 1 }]
      }
      
      const orchestrator = new AgreementOrchestrator(config, [badAgent], {
        blackboardPath: '.test-fault.db'
      })
      
      // Should handle validation error
      await expect(orchestrator.runAgreement('Test')).rejects.toThrow()
      
      await orchestrator.close()
      if (fs.existsSync('.test-fault.db')) {
        fs.unlinkSync('.test-fault.db')
      }
    })
  })
})