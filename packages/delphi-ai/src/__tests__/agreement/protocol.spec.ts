// npx vitest run src/__tests__/agreement/protocol.spec.ts
import { describe, expect, it } from 'vitest'
import {
  AgentRole,
  AgreementState,
  CritiquePayloadSchema,
  ProposalPayloadSchema,
  VotePayloadSchema,
  validateMessage,
  validatePayloadSize,
} from '../../agreement/AgreementProtocol.types.js'

describe('AgreementProtocol', () => {
  describe('validateMessage', () => {
    it('validates correct proposal message', () => {
      const message = {
        id: 'msg-1',
        timestamp: new Date().toISOString(),
        role: AgentRole.PROPOSER,
        agentId: 'agent-1',
        step: AgreementState.PROPOSE,
        payload: {
          content: 'Test proposal',
          rationale: 'Test rationale',
          confidence: 0.8,
        },
      }
      expect(() => validateMessage(message)).not.toThrow()
    })

    it('validates correct critique message', () => {
      const message = {
        id: 'msg-2',
        timestamp: new Date().toISOString(),
        role: AgentRole.REVIEWER,
        agentId: 'reviewer-1',
        step: AgreementState.CRITIQUE,
        payload: {
          proposalId: 'msg-1',
          concerns: [{ severity: 'minor', description: 'Consider edge case' }],
          overallAssessment: 'approve',
          confidence: 0.9,
        },
      }
      expect(() => validateMessage(message)).not.toThrow()
    })

    it('rejects message with missing required fields', () => {
      expect(() => validateMessage({ role: AgentRole.PROPOSER })).toThrow()
    })
  })

  describe('validatePayloadSize', () => {
    it('accepts small payloads', () => {
      expect(() => validatePayloadSize({ content: 'small' })).not.toThrow()
    })

    it('rejects oversized payloads', () => {
      const large = { content: 'x'.repeat(11 * 1024 * 1024) }
      expect(() => validatePayloadSize(large, 10)).toThrow(/exceeds limit/)
    })
  })

  describe('ProposalPayloadSchema', () => {
    it('validates valid proposal', () => {
      const result = ProposalPayloadSchema.safeParse({
        content: 'Proposal content',
        rationale: 'Because reasons',
        confidence: 0.85,
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty content', () => {
      const result = ProposalPayloadSchema.safeParse({
        content: '',
        rationale: 'Valid',
        confidence: 0.5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects confidence out of range', () => {
      const result = ProposalPayloadSchema.safeParse({
        content: 'Valid',
        rationale: 'Valid',
        confidence: 1.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('CritiquePayloadSchema', () => {
    it('validates critique with concerns', () => {
      const result = CritiquePayloadSchema.safeParse({
        proposalId: 'p1',
        concerns: [
          { severity: 'critical', description: 'Security issue' },
          {
            severity: 'suggestion',
            description: 'Consider caching',
            suggestedFix: 'Add Redis',
          },
        ],
        overallAssessment: 'refine',
        confidence: 0.7,
      })
      expect(result.success).toBe(true)
    })

    it('validates critique with empty concerns (approve)', () => {
      const result = CritiquePayloadSchema.safeParse({
        proposalId: 'p1',
        concerns: [],
        overallAssessment: 'approve',
        confidence: 0.95,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('VotePayloadSchema', () => {
    it('validates approve vote', () => {
      const result = VotePayloadSchema.safeParse({
        proposalId: 'p1',
        vote: 'approve',
        rationale: 'Looks good',
        weight: 1,
      })
      expect(result.success).toBe(true)
    })

    it('defaults weight to 1', () => {
      const result = VotePayloadSchema.parse({
        proposalId: 'p1',
        vote: 'reject',
        rationale: 'Needs work',
      })
      expect(result.weight).toBe(1)
    })
  })

  describe('AgreementState enum', () => {
    it('has all expected states', () => {
      expect(AgreementState.PROPOSE).toBe('propose')
      expect(AgreementState.CRITIQUE).toBe('critique')
      expect(AgreementState.CONVERGE).toBe('converge')
      expect(AgreementState.COMMIT).toBe('commit')
      expect(AgreementState.ABORT).toBe('abort')
    })
  })
})
