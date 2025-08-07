/**
 * Type definitions for Agreement System
 * Provides strong typing for consensus results and state
 */
import { z } from 'zod'
import { VotePayload } from './protocol.js'

/**
 * Consensus result with full type safety
 */
export interface ConsensusResult {
  proposalId: string
  finalContent: string
  consensus: {
    method: 'unanimous' | 'majority' | 'arbiter' | 'timeout'
    votes: VotePayload[]
    score: number
  }
  auditTrail: string[]
  sessionId: string
  duration: number
  iterations: number
}

/**
 * Agreement state for pipeline integration
 */
export interface AgreementState {
  agreementSessionId: string
  agreementResult: ConsensusResult | null
  consensusScore: number
  agreementDuration: number
}

/**
 * Discussion result schema for validation
 */
export const ConsensusResultSchema = z.object({
  proposalId: z.string().uuid(),
  finalContent: z.string(),
  consensus: z.object({
    method: z.enum(['unanimous', 'majority', 'arbiter', 'timeout']),
    votes: z.array(
      z.object({
        proposalId: z.string().uuid(),
        vote: z.enum(['approve', 'reject', 'abstain']),
        rationale: z.string(),
        weight: z.number()
      })
    ),
    score: z.number().min(0).max(1)
  }),
  auditTrail: z.array(z.string().uuid()),
  sessionId: z.string().uuid(),
  duration: z.number().positive(),
  iterations: z.number().int().nonnegative()
})

export type ValidatedConsensusResult = z.infer<typeof ConsensusResultSchema>

/**
 * Type guard for consensus result
 */
export function isConsensusResult(value: unknown): value is ConsensusResult {
  try {
    ConsensusResultSchema.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Safe parser for consensus result
 */
export function parseConsensusResult(value: unknown): ConsensusResult | null {
  const result = ConsensusResultSchema.safeParse(value)
  return result.success ? result.data : null
}
