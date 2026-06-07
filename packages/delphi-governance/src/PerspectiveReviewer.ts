import type {
  Perspective,
  PerspectiveEvaluator,
  ReviewContextLoader,
  ReviewMatrix,
} from './Perspective.js'
import type { Decision } from './types.js'

export interface PerspectiveReviewerDeps {
  evaluator: PerspectiveEvaluator
  /** Optional Brain-context loader (RAG) run before each perspective. */
  loadContext?: ReviewContextLoader
}

/**
 * Runs a set of Perspectives against a proposed Decision and collects their
 * verdicts into a tradeoff matrix. Perspectives run concurrently and are
 * independent — one perspective failing degrades to a `not_applicable` verdict
 * rather than failing the whole review.
 */
export class PerspectiveReviewer {
  private evaluator: PerspectiveEvaluator
  private loadContext?: ReviewContextLoader

  constructor(deps: PerspectiveReviewerDeps) {
    this.evaluator = deps.evaluator
    this.loadContext = deps.loadContext
  }

  async review(
    decision: Decision,
    perspectives: Perspective[],
  ): Promise<ReviewMatrix> {
    const verdicts = await Promise.all(
      perspectives.map(async perspective => {
        try {
          const context = this.loadContext
            ? await this.loadContext({ decision, perspective })
            : undefined
          return await this.evaluator({ decision, perspective, context })
        } catch (err) {
          return {
            perspective: perspective.name,
            assessment: 'not_applicable' as const,
            confidence: 0,
            concerns: [
              `Evaluator error: ${err instanceof Error ? err.message : String(err)}`,
            ],
          }
        }
      }),
    )
    return { decision: decision.name, verdicts }
  }
}
