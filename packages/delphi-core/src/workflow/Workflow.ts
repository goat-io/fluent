// Workflow.ts — typed workflow base class + step() composition helper.
//
// Subclass `Workflow`, declare `workflowName` as a literal, and populate
// `steps` with `step(...)` helper calls that reference Step *instances*
// directly (no string handler names, no string dependsOn). The class
// compiles down to the engine's internal WorkflowDefinition shape via
// toDefinition() — wired up automatically by `createEngine`.
//
// Companion: ./Step.ts (Step base classes), ./createEngine.ts (proxy).
//
// npx vitest run src/__tests__/workflow.spec.ts

import type { JsonObject } from '@goatlab/tasks-core'
import { DAGValidationError } from '../errors/WorkflowErrors.js'
import type { IANATimezone } from '../scheduler/timezones.js'
import { topologicalSort } from '../state/WorkflowStateMachine.js'
import { Step } from './Step.js'
import type {
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  WorkflowDefinition,
  WorkflowDurability,
  WorkflowTrigger,
} from './WorkflowBuilder.types.js'

/** A step reference — class or instance. */
export type StepRef = Step<any, any> | (new () => Step<any, any>)

/** Unwrap a StepRef to get the instance type. */
type Resolve<T> = T extends new () => infer S
  ? S extends Step<any, any>
    ? S
    : never
  : T extends Step<any, any>
    ? T
    : never

/**
 * Mapped output bag for a step's upstream dependencies — keys are the
 * upstream steps' literal names, values are their declared output types.
 * Powers `mapInput: (up) => ({ chargeId: up.charge_card.chargeId })` with
 * full property-name + property-type autocomplete.
 */
export type StepOutputs<TDeps extends readonly StepRef[]> = {
  [D in TDeps[number] as Resolve<D>['stepName']]: Resolve<D>['_output']
}

/**
 * One row in a workflow's `steps` array. Bundles the Step instance with
 * its upstream dependencies, optional input mapping, and optional skip
 * condition. Built via the `step(...)` helper for type inference.
 */
export interface StepEntry<
  TStep extends Step<any, any>,
  TDeps extends readonly StepRef[] = readonly [],
> {
  readonly step: TStep
  readonly dependsOn?: TDeps
  /** Map upstream outputs into this step's input shape. Required if step has dependencies and no default mapping. */
  readonly mapInput?: (upstream: StepOutputs<TDeps>) => TStep['_input']
  /** Skip this step at runtime if condition returns false. */
  readonly condition?: (ctx: StepContext) => boolean | Promise<boolean>
  /**
   * Override the step class's `transactional` flag for this specific wiring.
   * When true, step execution + result recording happen in one PG transaction.
   */
  readonly transactional?: boolean
}

/**
 * When auto-passing (single dep, no mapInput), verify the upstream output
 * satisfies the downstream input at compile time. If it doesn't, mapInput
 * becomes required — you get a clear TS error instead of a runtime surprise.
 */
/**
 * Auto-pass type safety: when a single dep's output satisfies the step's input,
 * mapInput is optional. When it doesn't, mapInput is required — you get a
 * compile error instead of a runtime surprise.
 *
 * Multiple deps always require mapInput (auto-merge shape is ambiguous).
 */
type AutoPassOpts<
  TStep extends Step<any, any>,
  TDeps extends readonly StepRef[],
> = TDeps extends readonly [infer D]
  ? D extends StepRef
    ? Resolve<D>['_output'] extends TStep['_input']
      ? { mapInput?: (upstream: StepOutputs<TDeps>) => TStep['_input'] }
      : { mapInput: (upstream: StepOutputs<TDeps>) => TStep['_input'] }
    : { mapInput?: (upstream: StepOutputs<TDeps>) => TStep['_input'] }
  : TDeps extends readonly [any, any, ...any[]]
    ? { mapInput: (upstream: StepOutputs<TDeps>) => TStep['_input'] }
    : { mapInput?: (upstream: StepOutputs<TDeps>) => TStep['_input'] }

/**
 * Compose a typed step entry inside a workflow's `steps` array.
 * Accepts a Step instance or a Step class (auto-instantiated).
 *
 * Type safety: if `dependsOn` has one dep and no `mapInput`, TypeScript
 * verifies the upstream output satisfies the step's input (structural typing).
 * If it doesn't, `mapInput` becomes required — you get a compile error, not
 * a runtime surprise.
 *
 * @example
 *   // Auto-pass (output satisfies input):
 *   step(ChargeStep, { dependsOn: [verifyStep] })
 *
 *   // Explicit mapping (field names differ):
 *   step(ChargeStep, {
 *     dependsOn: [verifyStep],
 *     mapInput: (up) => ({ token: up.verify.verificationToken }),
 *   })
 */
export function step<
  TStep extends Step<any, any>,
  const TDeps extends readonly StepRef[] = readonly [],
>(
  s: TStep | (new () => TStep),
  opts?: {
    dependsOn?: TDeps
    condition?: StepEntry<TStep, TDeps>['condition']
    /** Override the step class's transactional flag for this wiring. */
    transactional?: boolean
  } & AutoPassOpts<TStep, TDeps>,
): StepEntry<TStep, TDeps> {
  const instance = typeof s === 'function' ? new (s as new () => TStep)() : s
  // Resolve dependsOn classes to instances (for stepName access at runtime)
  const resolvedDeps = opts?.dependsOn?.map((d: StepRef) =>
    typeof d === 'function' ? new (d as new () => Step<any, any>)() : d,
  )
  return {
    step: instance,
    ...opts,
    ...(resolvedDeps ? { dependsOn: resolvedDeps } : {}),
  } as StepEntry<TStep, TDeps>
}

/**
 * Base class for typed workflows.
 *
 * Subclass and declare `workflowName` as a literal const. Populate `steps`
 * with `step(...)` calls referencing Step *instances*. Optionally set
 * `durability`, `defaultRetries`, signals/queries/triggers, etc.
 *
 * @example
 *   export class PaymentWorkflow extends Workflow<
 *     { orderId: string; amountCents: number; customerId: string }
 *   > {
 *     workflowName = 'payment_critical' as const
 *     durability = 'committed' as const
 *
 *     steps = [
 *       step(chargeCardStep),
 *       step(sendReceiptStep, { dependsOn: [chargeCardStep] }),
 *     ] as const
 *   }
 */
export abstract class Workflow<TInput extends JsonObject = JsonObject> {
  abstract readonly workflowName: string
  readonly version: string = '1.0.0'
  readonly defaultRetries: number = 3
  readonly defaultTimeoutMs: number = 300_000 // 5 min
  readonly failFast: boolean = false
  readonly durability?: WorkflowDurability
  /** Declared input field names for runtime introspection. */
  readonly inputFields?: readonly string[]
  /** Fields containing PII — redacted server-side before API response. */
  readonly sensitiveFields?: readonly string[]

  /** DAG of steps. Raw classes/instances for simple steps, `step()` wrapper when deps/mapInput needed. */
  abstract readonly steps: readonly (
    | StepEntry<Step<any, any>, readonly StepRef[]>
    | Step<any, any>
    | (new () => Step<any, any>)
  )[]

  /**
   * Optional cron schedule for automatic recurring execution.
   * When declared, `dispatcher.syncSchedules()` registers this
   * as a repeatable job for each tenant.
   */
  readonly schedule?: {
    /** Cron expression (5-field standard) */
    cron: string
    /** IANA timezone identifier (e.g., 'America/New_York'). Default: 'UTC'. */
    timezone?: IANATimezone
    /** Fire immediately on first sync/startup, then follow the cron. Default: false. */
    runOnInit?: boolean
    /** Default input for each scheduled run */
    input?: TInput
    /** Only run in specific environments (checked by consumer) */
    environments?: string[]
    /** Only run for specific tenant IDs (e.g., platform-only jobs) */
    tenants?: string[]
  }

  readonly triggers?: WorkflowTrigger[]
  readonly signals?: Record<string, SignalHandler>
  readonly queries?: Record<string, QueryHandler>
  readonly onComplete?: (ctx: StepContext) => Promise<void>
  readonly onFail?: (ctx: StepContext, error: Error) => Promise<void>
  readonly onRollbackFailed?: (ctx: {
    stepName: string
    rollbackError: Error
    workflowRunId: string
    tenantId: string
  }) => Promise<void> | void

  // Phantom type witness for the createEngine proxy.
  declare readonly _input: TInput

  /**
   * Compile this workflow into the engine's internal WorkflowDefinition.
   * Called by `createEngine` — users normally don't invoke directly.
   *
   * The handler key (`<workflowName>.<stepName>`) is generated here and
   * matched by `createEngine`'s auto-registration in FunctionStepExecutor.
   */
  /** Normalize a steps array entry into a StepEntry. */
  private normalizeEntry(
    entry:
      | StepEntry<Step<any, any>, readonly StepRef[]>
      | Step<any, any>
      | (new () => Step<any, any>),
  ): StepEntry<Step<any, any>, readonly StepRef[]> {
    // Class reference → instantiate and wrap
    if (typeof entry === 'function') {
      return { step: new (entry as new () => Step<any, any>)() }
    }
    // Step instance (not a StepEntry) → wrap
    if (entry instanceof Step) {
      return { step: entry }
    }
    // Already a StepEntry
    return entry
  }

  toDefinition(): WorkflowDefinition {
    this.validate()

    const resolveRef = (ref: StepRef): Step<any, any> =>
      typeof ref === 'function' ? new (ref as new () => Step<any, any>)() : ref

    const entries = this.steps.map(e => this.normalizeEntry(e))
    const stepDefs: StepDefinition[] = entries.map(entry => ({
      name: entry.step.stepName,
      executorType: entry.step.executorType,
      // Namespace by workflowName so the same Step class can be used in
      // multiple workflows without handler-key collisions.
      executorConfig: {
        handler: `${this.workflowName}.${entry.step.stepName}`,
      },
      dependsOn: entry.dependsOn?.map(d => resolveRef(d).stepName),
      retries: entry.step.retries,
      backoff: entry.step.backoff,
      timeoutMs: entry.step.timeoutMs,
      heartbeatTimeoutMs: entry.step.heartbeatTimeoutMs,
      scheduleToStartTimeoutMs: entry.step.scheduleToStartTimeoutMs,
      stepWeight: entry.step.stepWeight,
      requiresHumanApproval: entry.step.requiresHumanApproval,
      maxIterations: entry.step.maxIterations,
      requiresLabels: entry.step.requiresLabels,
      // step() flag > class flag > undefined
      transactional: entry.transactional ?? entry.step.transactional,
      condition: entry.condition,
      // mapInput is typed against the upstream's StepOutputs<TDeps> at
      // definition time but the engine treats it as JsonObject → JsonObject.
      mapInput: entry.mapInput as StepDefinition['mapInput'],
    }))

    return {
      name: this.workflowName,
      version: this.version,
      defaultRetries: this.defaultRetries,
      defaultTimeoutMs: this.defaultTimeoutMs,
      failFast: this.failFast,
      steps: stepDefs,
      triggers: this.triggers,
      signals: this.signals,
      queries: this.queries,
      onComplete: this.onComplete,
      onFail: this.onFail,
      onRollbackFailed: this.onRollbackFailed,
      durability: this.durability,
      inputFields: this.inputFields,
      sensitiveFields: this.sensitiveFields,
      schedule: this.schedule
        ? {
            cron: this.schedule.cron,
            timezone: this.schedule.timezone,
            runOnInit: this.schedule.runOnInit,
            input: this.schedule.input,
            environments: this.schedule.environments,
            tenants: this.schedule.tenants,
          }
        : undefined,
    }
  }

  private validate(): void {
    if (!this.workflowName || (this.workflowName as string).trim() === '') {
      throw new DAGValidationError('Workflow name is required')
    }
    if (this.steps.length === 0) {
      throw new DAGValidationError('Workflow must have at least one step')
    }

    const entries = this.steps.map(e => this.normalizeEntry(e))

    const names = new Set<string>()
    for (const entry of entries) {
      if (names.has(entry.step.stepName)) {
        throw new DAGValidationError(
          `Duplicate step name in workflow "${this.workflowName}": "${entry.step.stepName}"`,
          { step: entry.step.stepName },
        )
      }
      names.add(entry.step.stepName)
    }

    const resolveRef = (ref: StepRef): Step<any, any> =>
      typeof ref === 'function' ? new (ref as new () => Step<any, any>)() : ref

    for (const entry of entries) {
      for (const dep of entry.dependsOn ?? []) {
        const resolved = resolveRef(dep)
        if (!names.has(resolved.stepName)) {
          throw new DAGValidationError(
            `Step "${entry.step.stepName}" depends on unknown step "${resolved.stepName}"`,
            { step: entry.step.stepName, dependency: resolved.stepName },
          )
        }
        if (resolved.stepName === entry.step.stepName) {
          throw new DAGValidationError(
            `Step "${entry.step.stepName}" depends on itself`,
            { step: entry.step.stepName },
          )
        }
      }
    }

    // Cycle detection — reuse the engine's topological sort by feeding it
    // a minimal StepDefinition shape. Throws DAGValidationError on cycles.
    topologicalSort(
      entries.map(e => ({
        name: e.step.stepName,
        executorType: e.step.executorType,
        executorConfig: {},
        dependsOn: e.dependsOn?.map(d => resolveRef(d).stepName),
      })) as StepDefinition[],
    )
  }
}
