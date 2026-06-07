import type { Decision } from './types.js'

// Perspectives replace roles. A Perspective is a reusable reasoning framework
// (Finance, Security, Customer, Legal, Operations, …) that any agent can assume
// to review a proposed Decision. Reviews produce a tradeoff matrix — the goal is
// visibility into tradeoffs, NOT consensus. The Constitution decides; the
// perspectives inform.

export type ReviewAssessment =
  | 'approve'
  | 'concerns'
  | 'reject'
  | 'not_applicable'

/** A reusable reasoning lens applied to a decision. */
export interface Perspective {
  /** e.g. 'finance' | 'security' | 'customer' | 'legal' | 'operations'. */
  name: string
  /** Relative weight in the decider's score. Default 1. */
  weight?: number
  /** What this perspective evaluates for (feeds its prompt/context). */
  criteria?: string[]
  /** Evidence kinds this perspective expects to ground its review. */
  requiredEvidence?: string[]
}

/** One perspective's verdict on a decision. */
export interface PerspectiveVerdict {
  perspective: string
  assessment: ReviewAssessment
  /** 0..1 confidence in the assessment. */
  confidence: number
  concerns: string[]
  rationale?: string
}

/**
 * A perspective's reasoning function. Back it with `@goatlab/delphi-ai`
 * (`LLMAdapter` / `AgreementOrchestrator`) in production, or a stub in tests.
 * Kept structural so this package never imports delphi-ai.
 */
export type PerspectiveEvaluator = (input: {
  decision: Decision
  perspective: Perspective
  /** Brain context (RAG) for this perspective+decision, if a loader is wired. */
  context?: string
}) => Promise<PerspectiveVerdict> | PerspectiveVerdict

/** Optional hook to load Brain context (e.g. RAG hits) for a review. */
export type ReviewContextLoader = (input: {
  decision: Decision
  perspective: Perspective
}) => Promise<string | undefined> | string | undefined

/** The collected per-perspective verdicts — the tradeoff matrix. */
export interface ReviewMatrix {
  decision: string
  verdicts: PerspectiveVerdict[]
}
