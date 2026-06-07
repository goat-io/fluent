import type { Perspective, ReviewMatrix } from './Perspective.js'

// The decider maps a tradeoff matrix to an outcome. This is where the
// Constitution's decision rules live: perspectives inform, the constitution
// decides. The matrix is always returned so tradeoff visibility is preserved
// even when an item is approved.

export type ReviewOutcome = 'approved' | 'rejected' | 'needs_human'

export interface ReviewDecision {
  outcome: ReviewOutcome
  matrix: ReviewMatrix
  /** Weighted approval score in 0..1 across applicable perspectives. */
  score: number
  reasons: string[]
}

export interface ReviewDecider {
  decide(matrix: ReviewMatrix, perspectives: Perspective[]): ReviewDecision
}

export interface DefaultReviewDeciderOptions {
  /** Weighted-approval threshold to auto-approve. Default 0.7. */
  approveThreshold?: number
  /**
   * If any perspective rejects, escalate to a human instead of auto-deciding.
   * Default true — a single objection should be seen, not silently outvoted.
   */
  escalateOnReject?: boolean
  /**
   * Below this score, reject outright instead of escalating. Default undefined
   * (never hard-reject; low scores escalate to a human).
   */
  rejectThreshold?: number
}

const ASSESSMENT_VALUE: Record<string, number | null> = {
  approve: 1,
  concerns: 0.5,
  reject: 0,
  not_applicable: null, // excluded from the score
}

/**
 * Default decider: a weighted approval score with conservative escalation.
 *
 * - Any `reject` (with `escalateOnReject`) → `needs_human`. The objection is
 *   surfaced, not outvoted.
 * - Else score ≥ `approveThreshold` → `approved`.
 * - Else score ≤ `rejectThreshold` (if set) → `rejected`.
 * - Else → `needs_human`.
 *
 * It never collapses the matrix into a single number and throws the rest away —
 * the full matrix rides along on the result.
 */
export class DefaultReviewDecider implements ReviewDecider {
  private approveThreshold: number
  private escalateOnReject: boolean
  private rejectThreshold?: number

  constructor(opts: DefaultReviewDeciderOptions = {}) {
    this.approveThreshold = opts.approveThreshold ?? 0.7
    this.escalateOnReject = opts.escalateOnReject ?? true
    this.rejectThreshold = opts.rejectThreshold
  }

  decide(matrix: ReviewMatrix, perspectives: Perspective[]): ReviewDecision {
    const weightOf = (name: string) =>
      perspectives.find(p => p.name === name)?.weight ?? 1

    let weightedSum = 0
    let totalWeight = 0
    const reasons: string[] = []
    let anyReject = false

    for (const v of matrix.verdicts) {
      const value = ASSESSMENT_VALUE[v.assessment]
      if (value === null || value === undefined) {
        continue // not_applicable
      }
      const w = weightOf(v.perspective)
      weightedSum += value * w
      totalWeight += w
      if (v.assessment === 'reject') {
        anyReject = true
        reasons.push(
          `${v.perspective} rejected${v.concerns[0] ? `: ${v.concerns[0]}` : ''}.`,
        )
      } else if (v.assessment === 'concerns' && v.concerns[0]) {
        reasons.push(`${v.perspective} has concerns: ${v.concerns[0]}.`)
      }
    }

    const score = totalWeight === 0 ? 0 : weightedSum / totalWeight

    let outcome: ReviewOutcome
    if (totalWeight === 0) {
      outcome = 'needs_human'
      reasons.push('No applicable perspectives — escalating to a human.')
    } else if (anyReject && this.escalateOnReject) {
      outcome = 'needs_human'
    } else if (score >= this.approveThreshold) {
      outcome = 'approved'
      reasons.push(
        `Weighted approval ${score.toFixed(2)} ≥ ${this.approveThreshold}.`,
      )
    } else if (
      this.rejectThreshold !== undefined &&
      score <= this.rejectThreshold
    ) {
      outcome = 'rejected'
      reasons.push(
        `Weighted approval ${score.toFixed(2)} ≤ ${this.rejectThreshold}.`,
      )
    } else {
      outcome = 'needs_human'
      reasons.push(
        `Weighted approval ${score.toFixed(2)} is inconclusive — escalating to a human.`,
      )
    }

    return { outcome, matrix, score, reasons }
  }
}
