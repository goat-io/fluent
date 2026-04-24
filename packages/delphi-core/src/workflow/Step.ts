// Step.ts — typed workflow step base classes.
//
// The class-based authoring API: subclass `FunctionStep` (or another
// executor-specific base) and override `handle()`. Generics propagate
// the input/output/name through the workflow chain so the engine surface
// (engine.<workflowName>.start({...})) is fully type-checked end-to-end —
// no string handler names, no JsonObject blobs at the call site.
//
// Companion: ./Workflow.ts (composes Steps), ./createEngine.ts (proxy).
//
// npx vitest run src/__tests__/workflow.spec.ts

import type { JsonObject } from '@goatlab/tasks-core'
import type {
  BackoffConfig,
  StepExecutionContext,
  StepResult,
  StepWeight,
} from './WorkflowBuilder.types.js'

/**
 * Step result narrowed to the step's declared output type.
 * Subclasses return `{ output: TOutput }` (plus optional nextStep / waitForHuman).
 */
export interface TypedStepResult<TOutput extends JsonObject>
  extends Omit<StepResult, 'output'> {
  output: TOutput
}

/**
 * Abstract base for all workflow steps.
 *
 * Don't extend this directly — pick an executor-specific subclass like
 * `FunctionStep`. The generics carry the step's input/output/name through
 * the type system; the runtime fields (stepName, executorType, retries…)
 * declare engine behavior.
 */
export abstract class Step<
  TInput extends JsonObject = JsonObject,
  TOutput extends JsonObject = JsonObject,
> {
  /** Stable identifier used in the DAG and for queue routing. Must be unique within a workflow. Declare with `as const`. */
  abstract readonly stepName: string
  /** Which engine executor handles this step (e.g. 'function', 'sandbox'). */
  abstract readonly executorType: string

  // ── Optional behavior knobs (override in subclass) ────────────────
  readonly retries?: number
  /**
   * Retry backoff configuration. When set, failed steps wait before retrying.
   * Default (unset): immediate retry.
   */
  readonly backoff?: BackoffConfig
  readonly timeoutMs?: number
  readonly heartbeatTimeoutMs?: number
  readonly scheduleToStartTimeoutMs?: number
  readonly stepWeight?: StepWeight
  readonly requiresHumanApproval?: boolean
  readonly maxIterations?: number
  /**
   * Labels a worker MUST advertise to be eligible to run this step.
   * AND-matched against the agent's `capabilities.labels`. Mirrors
   * GitHub Actions `runs-on`. See `StepDefinition.requiresLabels`.
   */
  readonly requiresLabels?: string[]
  /**
   * When true, the step's `handle()` receives a `ctx.tx` (pg PoolClient)
   * and the engine records the step result in the SAME Postgres transaction.
   * COMMIT = app writes + step completion are atomic. ROLLBACK = nothing happened.
   *
   * Only valid for FunctionStep (inline execution). External/AI steps can't
   * participate in a PG transaction.
   *
   * Can be overridden per-workflow via `step(MyStep, { transactional: true })`.
   */
  readonly transactional?: boolean

  /** The work itself. Receives the typed input + engine services context. */
  abstract handle(
    input: TInput,
    ctx: StepExecutionContext,
  ): Promise<TypedStepResult<TOutput>>

  /**
   * Reverse action — called when the workflow fails terminally and this step
   * had already completed. Receives the original input and the output that
   * `handle()` returned, so you can undo side effects (refund a charge,
   * unreserve inventory, revoke an API key, etc.).
   *
   * Rollbacks run in reverse topological order across all completed steps.
   * If a rollback throws, the error is logged and remaining rollbacks continue.
   */
  rollback?(
    input: TInput,
    output: TOutput,
    ctx: StepExecutionContext,
  ): Promise<void>

  // Phantom type witnesses — never accessed at runtime; exist solely so
  // upstream type machinery (StepOutputs, WorkflowOps) can pluck the
  // generics back out of an instance.
  declare readonly _input: TInput
  declare readonly _output: TOutput
  /** Inferred from `stepName` property via `as const` — no need for a TName generic. */
  get _name(): this['stepName'] {
    return this.stepName
  }
}

/**
 * The most common kind of step — a TS function executed inline by the engine's
 * FunctionStepExecutor. `createEngine` auto-registers the step instance under
 * a namespaced handler key (`<workflowName>.<stepName>`); you never call
 * `executor.register()` manually.
 *
 * @example
 *   export class ChargeCardStep extends FunctionStep<
 *     { amountCents: number; customerId: string },
 *     { chargeId: string }
 *   > {
 *     stepName = 'charge_card' as const
 *     retries = 2
 *
 *     async handle(input) {
 *       const charge = await stripe.charges.create({ amount: input.amountCents })
 *       return { output: { chargeId: charge.id } }
 *     }
 *   }
 */
export abstract class FunctionStep<
  TInput extends JsonObject = JsonObject,
  TOutput extends JsonObject = JsonObject,
> extends Step<TInput, TOutput> {
  readonly executorType = 'function' as const
}
