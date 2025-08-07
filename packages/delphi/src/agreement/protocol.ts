/**
 * Agreement Protocol Schema and Types
 * Defines structured message formats for agent consensus
 */

import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

// Agreement states for FSM
export enum AgreementState {
  PROPOSE = 'propose',
  CRITIQUE = 'critique',
  CONVERGE = 'converge',
  COMMIT = 'commit',
  ABORT = 'abort'
}

// Agent roles in agreement
export enum AgentRole {
  PROPOSER = 'proposer',
  REVIEWER = 'reviewer',
  ARBITER = 'arbiter',
  OBSERVER = 'observer'
}

// Message payload types
export const ProposalPayloadSchema = z.object({
  content: z.string().min(1).max(50000), // 50KB limit
  rationale: z.string().min(1).max(10000),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
})

export const CritiquePayloadSchema = z.object({
  proposalId: z.string().uuid(),
  concerns: z.array(
    z.object({
      severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
      description: z.string().max(5000),
      suggestedFix: z.string().optional()
    })
  ),
  overallAssessment: z.enum(['approve', 'refine', 'reject']),
  confidence: z.number().min(0).max(1)
})

export const VotePayloadSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.enum(['approve', 'reject', 'abstain']),
  rationale: z.string().max(5000),
  weight: z.number().min(0).max(1).default(1)
})

export const CommitPayloadSchema = z.object({
  proposalId: z.string().uuid(),
  finalContent: z.string().max(50000),
  consensus: z.object({
    method: z.enum(['unanimous', 'majority', 'arbiter', 'timeout']),
    votes: z.array(VotePayloadSchema),
    score: z.number().min(0).max(1)
  }),
  auditTrail: z.array(z.string().uuid())
})

// Main message schema
export const AgreementMessageSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(() => uuidv4()),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  role: z.nativeEnum(AgentRole),
  agentId: z.string().min(1),
  step: z.nativeEnum(AgreementState),
  payload: z.union([
    ProposalPayloadSchema,
    CritiquePayloadSchema,
    VotePayloadSchema,
    CommitPayloadSchema
  ]),
  parentMessageId: z.string().uuid().optional(),
  tokenUsage: z
    .object({
      prompt: z.number().int().nonnegative(),
      completion: z.number().int().nonnegative(),
      total: z.number().int().nonnegative()
    })
    .optional()
})

export type AgreementMessage = z.infer<typeof AgreementMessageSchema>
export type ProposalPayload = z.infer<typeof ProposalPayloadSchema>
export type CritiquePayload = z.infer<typeof CritiquePayloadSchema>
export type VotePayload = z.infer<typeof VotePayloadSchema>
export type CommitPayload = z.infer<typeof CommitPayloadSchema>

// Session configuration
export const AgreementSessionConfigSchema = z.object({
  sessionId: z
    .string()
    .uuid()
    .default(() => uuidv4()),
  maxTurns: z.number().int().min(1).max(10).default(5),
  maxDurationMs: z.number().int().min(1000).max(300000).default(90000), // 90s default
  tokenBudgetPerTurn: z.number().int().min(100).max(10000).default(2000),
  minConsensusScore: z.number().min(0.5).max(1).default(0.66), // 2/3 majority
  conflictResolution: z
    .enum(['majority', 'arbiter', 'hash'])
    .default('majority'),
  agents: z
    .array(
      z.object({
        id: z.string(),
        role: z.nativeEnum(AgentRole),
        weight: z.number().min(0).max(1).default(1),
        model: z.string().optional()
      })
    )
    .min(2)
    .max(10)
})

export type AgreementSessionConfig = z.infer<
  typeof AgreementSessionConfigSchema
>

// Validation helpers
export function validateMessage(message: unknown): AgreementMessage {
  return AgreementMessageSchema.parse(message)
}

export function validateSessionConfig(config: unknown): AgreementSessionConfig {
  return AgreementSessionConfigSchema.parse(config)
}

// Size validation
export function validatePayloadSize(
  payload: unknown,
  maxSizeMB: number = 10
): void {
  const jsonStr = JSON.stringify(payload)
  const sizeBytes = new TextEncoder().encode(jsonStr).length
  const sizeMB = sizeBytes / (1024 * 1024)

  if (sizeMB > maxSizeMB) {
    throw new Error(
      `Payload size ${sizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`
    )
  }
}
