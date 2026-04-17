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
import { topologicalSort } from '../state/WorkflowStateMachine.js'
import type { Step } from './Step.js'
import type {
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  WorkflowDefinition,
  WorkflowDurability,
  WorkflowTrigger,
} from './WorkflowBuilder.types.js'

/**
 * Mapped output bag for a step's upstream dependencies — keys are the
 * upstream steps' literal names, values are their declared output types.
 * Powers `mapInput: (up) => ({ chargeId: up.charge_card.chargeId })` with
 * full property-name + property-type autocomplete.
 */
export type StepOutputs<TDeps extends readonly Step<any, any, any>[]> = {
  [D in TDeps[number] as D['_name']]: D['_output']
}

/**
 * One row in a workflow's `steps` array. Bundles the Step instance with
 * its upstream dependencies, optional input mapping, and optional skip
 * condition. Built via the `step(...)` helper for type inference.
 */
export interface StepEntry<
  TStep extends Step<any, any, any>,
  TDeps extends readonly Step<any, any, any>[] = readonly [],
> {
  readonly step: TStep
  readonly dependsOn?: TDeps
  /** Map upstream outputs into this step's input shape. Required if step has dependencies and no default mapping. */
  readonly mapInput?: (upstream: StepOutputs<TDeps>) => TStep['_input']
  /** Skip this step at runtime if condition returns false. */
  readonly condition?: (ctx: StepContext) => boolean | Promise<boolean>
}

/**
 * Compose a typed step entry inside a workflow's `steps` array.
 *
 * @example
 *   step(chargeCardStep, {
 *     dependsOn: [verifyCardStep],
 *     mapInput: (up) => ({ token: up.verify_card.token }),
 *   })
 */
export function step<
  TStep extends Step<any, any, any>,
  const TDeps extends readonly Step<any, any, any>[] = readonly [],
>(
  s: TStep,
  opts?: Omit<StepEntry<TStep, TDeps>, 'step'>,
): StepEntry<TStep, TDeps> {
  return { step: s, ...(opts ?? {}) } as StepEntry<TStep, TDeps>
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
 *     { orderId: string; amountCents: number; customerId: string },
 *     'payment_critical'
 *   > {
 *     workflowName = 'payment_critical' as const
 *     durability = 'committed' as const
 *
 *     steps = [
 *       step(chargeCardStep, {
 *         mapInput: (t) => ({ amountCents: t.amountCents, customerId: t.customerId }),
 *       }),
 *       step(sendReceiptStep, {
 *         dependsOn: [chargeCardStep],
 *         mapInput: (up) => ({ chargeId: up.charge_card.chargeId }),
 *       }),
 *     ]
 *   }
 *   export const paymentWorkflow = new PaymentWorkflow()
 */
export abstract class Workflow<
  TInput extends JsonObject = JsonObject,
  TName extends string = string,
> {
  abstract readonly workflowName: TName
  readonly version: string = '1.0.0'
  readonly defaultRetries: number = 3
  readonly defaultTimeoutMs: number = 300_000 // 5 min
  readonly failFast: boolean = false
  readonly durability?: WorkflowDurability
  /** Declared input field names for runtime introspection. */
  readonly inputFields?: readonly string[]

  /** DAG of typed steps. Use the `step(...)` helper to build entries. */
  abstract readonly steps: readonly StepEntry<
    Step<any, any, any>,
    readonly Step<any, any, any>[]
  >[]

  readonly triggers?: WorkflowTrigger[]
  readonly signals?: Record<string, SignalHandler>
  readonly queries?: Record<string, QueryHandler>
  readonly onComplete?: (ctx: StepContext) => Promise<void>
  readonly onFail?: (ctx: StepContext, error: Error) => Promise<void>

  // Phantom type witnesses for the createEngine proxy.
  declare readonly _input: TInput
  declare readonly _name: TName

  /**
   * Compile this workflow into the engine's internal WorkflowDefinition.
   * Called by `createEngine` — users normally don't invoke directly.
   *
   * The handler key (`<workflowName>.<stepName>`) is generated here and
   * matched by `createEngine`'s auto-registration in FunctionStepExecutor.
   */
  toDefinition(): WorkflowDefinition {
    this.validate()

    const stepDefs: StepDefinition[] = this.steps.map(entry => ({
      name: entry.step.stepName,
      executorType: entry.step.executorType,
      // Namespace by workflowName so the same Step class can be used in
      // multiple workflows without handler-key collisions.
      executorConfig: {
        handler: `${this.workflowName}.${entry.step.stepName}`,
      },
      dependsOn: entry.dependsOn?.map(d => d.stepName),
      retries: entry.step.retries,
      timeoutMs: entry.step.timeoutMs,
      heartbeatTimeoutMs: entry.step.heartbeatTimeoutMs,
      scheduleToStartTimeoutMs: entry.step.scheduleToStartTimeoutMs,
      stepWeight: entry.step.stepWeight,
      requiresHumanApproval: entry.step.requiresHumanApproval,
      maxIterations: entry.step.maxIterations,
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
      durability: this.durability,
      inputFields: this.inputFields,
    }
  }

  private validate(): void {
    if (!this.workflowName || (this.workflowName as string).trim() === '') {
      throw new DAGValidationError('Workflow name is required')
    }
    if (this.steps.length === 0) {
      throw new DAGValidationError('Workflow must have at least one step')
    }

    const names = new Set<string>()
    for (const entry of this.steps) {
      if (names.has(entry.step.stepName)) {
        throw new DAGValidationError(
          `Duplicate step name in workflow "${this.workflowName}": "${entry.step.stepName}"`,
          { step: entry.step.stepName },
        )
      }
      names.add(entry.step.stepName)
    }

    for (const entry of this.steps) {
      for (const dep of entry.dependsOn ?? []) {
        if (!names.has(dep.stepName)) {
          throw new DAGValidationError(
            `Step "${entry.step.stepName}" depends on unknown step "${dep.stepName}"`,
            { step: entry.step.stepName, dependency: dep.stepName },
          )
        }
        if (dep.stepName === entry.step.stepName) {
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
      this.steps.map(e => ({
        name: e.step.stepName,
        executorType: e.step.executorType,
        executorConfig: {},
        dependsOn: e.dependsOn?.map(d => d.stepName),
      })) as StepDefinition[],
    )
  }
}
