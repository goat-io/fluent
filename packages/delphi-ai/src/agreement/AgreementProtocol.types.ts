// npx vitest run src/__tests__/agreement/protocol.spec.ts
import { z } from 'zod'

export enum AgreementState {
  PROPOSE = 'propose',
  CRITIQUE = 'critique',
  CONVERGE = 'converge',
  COMMIT = 'commit',
  ABORT = 'abort',
}

export enum AgentRole {
  PROPOSER = 'proposer',
  REVIEWER = 'reviewer',
  ARBITER = 'arbiter',
}

export const ProposalPayloadSchema = z.object({
  content: z.string().min(1).max(50_000),
  rationale: z.string().min(1).max(10_000),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string()).optional(),
})

export const CritiquePayloadSchema = z.object({
  proposalId: z.string(),
  concerns: z.array(
    z.object({
      severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
      description: z.string().max(5_000),
      suggestedFix: z.string().optional(),
    }),
  ),
  overallAssessment: z.enum(['approve', 'refine', 'reject']),
  confidence: z.number().min(0).max(1),
})

export const VotePayloadSchema = z.object({
  proposalId: z.string(),
  vote: z.enum(['approve', 'reject', 'abstain']),
  rationale: z.string().max(5_000),
  weight: z.number().min(0).default(1),
})

export const CommitPayloadSchema = z.object({
  proposalId: z.string(),
  finalContent: z.string().max(50_000),
  consensus: z.object({
    method: z.enum(['unanimous', 'majority', 'arbiter', 'timeout']),
    votes: z.array(VotePayloadSchema),
    score: z.number().min(0).max(1),
  }),
  auditTrail: z.array(z.string()),
})

export const AgreementMessageSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  role: z.nativeEnum(AgentRole),
  agentId: z.string(),
  step: z.nativeEnum(AgreementState),
  payload: z.union([
    ProposalPayloadSchema,
    CritiquePayloadSchema,
    VotePayloadSchema,
    CommitPayloadSchema,
  ]),
  tokenUsage: z
    .object({
      prompt: z.number().int().nonnegative(),
      completion: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    })
    .optional(),
})

export type AgreementMessage = z.infer<typeof AgreementMessageSchema>
export type ProposalPayload = z.infer<typeof ProposalPayloadSchema>
export type CritiquePayload = z.infer<typeof CritiquePayloadSchema>
export type VotePayload = z.infer<typeof VotePayloadSchema>
export type CommitPayload = z.infer<typeof CommitPayloadSchema>

export interface AgreementSessionConfig {
  sessionId: string
  maxTurns: number
  maxDurationMs: number
  tokenBudgetPerTurn: number
  minConsensusScore: number
  conflictResolution: 'majority' | 'arbiter' | 'weighted'
}

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

export function validateMessage(message: unknown): AgreementMessage {
  return AgreementMessageSchema.parse(message)
}

export function validatePayloadSize(payload: unknown, maxSizeMB = 10): void {
  const jsonStr = JSON.stringify(payload)
  const sizeBytes = new TextEncoder().encode(jsonStr).length
  const sizeMB = sizeBytes / (1024 * 1024)
  if (sizeMB > maxSizeMB) {
    throw new Error(
      `Payload size ${sizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`,
    )
  }
}
