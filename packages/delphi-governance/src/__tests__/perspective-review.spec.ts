// npx vitest run src/__tests__/perspective-review.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { InMemoryBrainClient } from '../BrainClient.js'
import { createGovernance } from '../createGovernance.js'
import type {
  Perspective,
  PerspectiveEvaluator,
  PerspectiveVerdict,
  ReviewAssessment,
} from '../Perspective.js'
import { PerspectiveReviewer } from '../PerspectiveReviewer.js'
import { DefaultReviewDecider } from '../ReviewDecider.js'
import type { Decision } from '../types.js'
import { fromEngine } from '../WorkflowStarter.js'

const pricingDecision: Decision = {
  name: 'increase-pricing-15pct',
  kind: 'decision',
  description: 'Increase pricing by 15%.',
  status: 'proposed',
  choice: 'Raise prices 15% on the pro tier.',
}

const PERSPECTIVES: Perspective[] = [
  { name: 'finance', weight: 2 },
  { name: 'customer', weight: 1 },
  { name: 'security' },
]

/** Build an evaluator that returns a fixed assessment per perspective name. */
function fixedEvaluator(
  map: Record<string, ReviewAssessment>,
): PerspectiveEvaluator {
  return ({ perspective }): PerspectiveVerdict => ({
    perspective: perspective.name,
    assessment: map[perspective.name] ?? 'not_applicable',
    confidence: 0.9,
    concerns: map[perspective.name] === 'reject' ? ['hurts retention'] : [],
  })
}

describe('PerspectiveReviewer — tradeoff matrix', () => {
  it('runs all perspectives concurrently and collects a verdict each', async () => {
    const reviewer = new PerspectiveReviewer({
      evaluator: fixedEvaluator({
        finance: 'approve',
        customer: 'concerns',
        security: 'not_applicable',
      }),
    })

    const matrix = await reviewer.review(pricingDecision, PERSPECTIVES)

    expect(matrix.decision).toBe('increase-pricing-15pct')
    expect(matrix.verdicts.map(v => v.perspective).sort()).toEqual([
      'customer',
      'finance',
      'security',
    ])
  })

  it('degrades a failing perspective to not_applicable, not a thrown review', async () => {
    const evaluator: PerspectiveEvaluator = ({ perspective }) => {
      if (perspective.name === 'security') {
        throw new Error('LLM timeout')
      }
      return {
        perspective: perspective.name,
        assessment: 'approve',
        confidence: 1,
        concerns: [],
      }
    }
    const reviewer = new PerspectiveReviewer({ evaluator })

    const matrix = await reviewer.review(pricingDecision, PERSPECTIVES)

    const sec = matrix.verdicts.find(v => v.perspective === 'security')
    expect(sec?.assessment).toBe('not_applicable')
    expect(sec?.concerns[0]).toContain('LLM timeout')
  })

  it('passes loaded Brain context into the evaluator', async () => {
    const loadContext = vi.fn(async () => 'retrieved: churn rose last quarter')
    const evaluator = vi.fn(
      ({ perspective }): PerspectiveVerdict => ({
        perspective: perspective.name,
        assessment: 'approve',
        confidence: 1,
        concerns: [],
      }),
    )
    const reviewer = new PerspectiveReviewer({ evaluator, loadContext })

    await reviewer.review(pricingDecision, [{ name: 'finance' }])

    expect(loadContext).toHaveBeenCalledOnce()
    expect(evaluator).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'retrieved: churn rose last quarter',
      }),
    )
  })
})

describe('DefaultReviewDecider — constitution decides, perspectives inform', () => {
  it('approves when weighted approval clears the threshold', () => {
    const decider = new DefaultReviewDecider({ approveThreshold: 0.7 })
    const matrix = {
      decision: 'd',
      verdicts: [
        {
          perspective: 'finance',
          assessment: 'approve' as const,
          confidence: 1,
          concerns: [],
        },
        {
          perspective: 'customer',
          assessment: 'approve' as const,
          confidence: 1,
          concerns: [],
        },
      ],
    }
    const result = decider.decide(matrix, PERSPECTIVES)
    expect(result.outcome).toBe('approved')
    expect(result.score).toBe(1)
    // tradeoff matrix is preserved on the result
    expect(result.matrix).toBe(matrix)
  })

  it('escalates to a human when any perspective rejects (objection not outvoted)', () => {
    const decider = new DefaultReviewDecider()
    const matrix = {
      decision: 'd',
      verdicts: [
        {
          perspective: 'finance',
          assessment: 'approve' as const,
          confidence: 1,
          concerns: [],
        },
        {
          perspective: 'customer',
          assessment: 'reject' as const,
          confidence: 1,
          concerns: ['churn'],
        },
      ],
    }
    const result = decider.decide(matrix, PERSPECTIVES)
    // finance weight 2 + customer weight 1 → score 0.67, but a reject escalates
    expect(result.outcome).toBe('needs_human')
    expect(result.reasons.some(r => r.includes('customer rejected'))).toBe(true)
  })

  it('escalates inconclusive scores rather than guessing', () => {
    const decider = new DefaultReviewDecider({ approveThreshold: 0.9 })
    const matrix = {
      decision: 'd',
      verdicts: [
        {
          perspective: 'finance',
          assessment: 'concerns' as const,
          confidence: 1,
          concerns: ['margin'],
        },
      ],
    }
    const result = decider.decide(matrix, [{ name: 'finance' }])
    expect(result.outcome).toBe('needs_human')
    expect(result.score).toBe(0.5)
  })

  it('hard-rejects only when a rejectThreshold is configured', () => {
    const decider = new DefaultReviewDecider({
      approveThreshold: 0.7,
      escalateOnReject: false,
      rejectThreshold: 0.3,
    })
    const matrix = {
      decision: 'd',
      verdicts: [
        {
          perspective: 'finance',
          assessment: 'reject' as const,
          confidence: 1,
          concerns: [],
        },
        {
          perspective: 'customer',
          assessment: 'reject' as const,
          confidence: 1,
          concerns: [],
        },
      ],
    }
    const result = decider.decide(matrix, PERSPECTIVES)
    expect(result.outcome).toBe('rejected')
    expect(result.score).toBe(0)
  })
})

describe('createGovernance.reviewDecision integration', () => {
  it('reviews a proposed decision and returns matrix + outcome', async () => {
    const governance = createGovernance({
      brain: new InMemoryBrainClient(),
      starter: fromEngine({}),
      review: {
        evaluator: fixedEvaluator({
          finance: 'approve',
          customer: 'approve',
          security: 'approve',
        }),
      },
    })

    const decision = await governance.reviewDecision(
      pricingDecision,
      PERSPECTIVES,
    )

    expect(decision.outcome).toBe('approved')
    expect(decision.matrix.verdicts).toHaveLength(3)
  })

  it('throws when review was not configured', async () => {
    const governance = createGovernance({
      brain: new InMemoryBrainClient(),
      starter: fromEngine({}),
    })
    await expect(
      governance.reviewDecision(pricingDecision, PERSPECTIVES),
    ).rejects.toThrow(/`review` was not configured/)
  })
})
