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
import type { ExecuteResult } from './types.js'
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

  return {
    brain: opts.brain,
    registry,
    guard,
    executor,
    tick: () => executor.executePending(opts.brain),
    onEngineEvent,
  }
}
