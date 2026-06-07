import type { BrainClient } from './BrainClient.js'
import { CompileRegistry } from './CompileRegistry.js'
import {
  type ConstitutionGuard,
  DefaultConstitutionGuard,
} from './ConstitutionGuard.js'
import { DecisionExecutor } from './DecisionExecutor.js'
import {
  createOutcomeSubscriber,
  type OutcomeRecorder,
  type RunCompletedEventLike,
} from './OutcomeSubscriber.js'
import type {
  Perspective,
  PerspectiveEvaluator,
  ReviewContextLoader,
} from './Perspective.js'
import { PerspectiveReviewer } from './PerspectiveReviewer.js'
import {
  DefaultReviewDecider,
  type ReviewDecider,
  type ReviewDecision,
} from './ReviewDecider.js'
import type { Decision, ExecuteResult } from './types.js'
import type { WorkflowStarter } from './WorkflowStarter.js'

export interface CreateGovernanceOptions {
  /** The judgment plane — reads Decisions/Actions, records Outcomes. */
  brain: BrainClient
  /** The execution plane — adapt a delphi-core engine via `fromEngine`. */
  starter: WorkflowStarter
  /** Action.type → workflow mapping. A fresh CompileRegistry if omitted. */
  registry?: CompileRegistry
  /** The Constitution gate. A DefaultConstitutionGuard if omitted. */
  guard?: ConstitutionGuard
  /** Where outcomes are recorded. Defaults to the BrainClient. */
  outcomeRecorder?: OutcomeRecorder
  /** Pass through to DecisionExecutor (default true). */
  requireHumanGate?: boolean
  /**
   * Optional perspective-review wiring (Propose → Review → Decide). Enables
   * `governance.reviewDecision(...)`. The evaluator is the per-perspective
   * reasoning fn (back it with @goatlab/delphi-ai); decider defaults to a
   * weighted-approval DefaultReviewDecider.
   */
  review?: {
    evaluator: PerspectiveEvaluator
    decider?: ReviewDecider
    loadContext?: ReviewContextLoader
  }
  /** Clock injection (tests). */
  now?: () => string
}

export interface Governance {
  readonly brain: BrainClient
  readonly registry: CompileRegistry
  readonly guard: ConstitutionGuard
  readonly executor: DecisionExecutor
  /** Execute one loop tick over the Brain's executable actions. */
  tick(): Promise<ExecuteResult[]>
  /**
   * The Measure seam — wire into `createEngine({ onEngineEvent })`. Records an
   * Outcome for every governance-originated `run.completed`.
   */
  onEngineEvent: (
    evt: { type: string } & Partial<RunCompletedEventLike>,
  ) => void
  /**
   * Run multi-perspective review on a proposed Decision (Propose → Review →
   * Decide). Returns the tradeoff matrix + the constitution's outcome. Throws if
   * `review` was not configured. Perspectives inform; the decider decides.
   */
  reviewDecision(
    decision: Decision,
    perspectives: Perspective[],
  ): Promise<ReviewDecision>
}

/**
 * Wire the governance bridge: Brain (judgment) ⇄ delphi-core (execution).
 *
 *   const governance = createGovernance({
 *     brain,                       // HttpBrainClient pointed at the Brain sidecar
 *     starter: fromEngine(engine), // a delphi-core createEngine() result
 *     registry: new CompileRegistry().register('cost-cut', { workflowName: 'awsCostCut' }),
 *   })
 *   const engine = createEngine({ workflows, onEngineEvent: governance.onEngineEvent })
 *   await governance.tick() // compile approved actions into runs
 */
export function createGovernance(opts: CreateGovernanceOptions): Governance {
  const registry = opts.registry ?? new CompileRegistry()
  const guard = opts.guard ?? new DefaultConstitutionGuard()
  const recorder = opts.outcomeRecorder ?? {
    record: outcome => opts.brain.recordOutcome?.(outcome),
  }

  const executor = new DecisionExecutor({
    starter: opts.starter,
    registry,
    guard,
    brain: opts.brain,
    requireHumanGate: opts.requireHumanGate,
  })

  const onEngineEvent = createOutcomeSubscriber({
    recorder,
    now: opts.now,
  })

  const reviewer = opts.review
    ? new PerspectiveReviewer({
        evaluator: opts.review.evaluator,
        loadContext: opts.review.loadContext,
      })
    : undefined
  const decider = opts.review?.decider ?? new DefaultReviewDecider()

  return {
    brain: opts.brain,
    registry,
    guard,
    executor,
    tick: () => executor.executePending(opts.brain),
    onEngineEvent,
    async reviewDecision(decision, perspectives) {
      if (!reviewer) {
        throw new Error(
          'createGovernance: `review` was not configured — cannot reviewDecision().',
        )
      }
      const matrix = await reviewer.review(decision, perspectives)
      return decider.decide(matrix, perspectives)
    },
  }
}
