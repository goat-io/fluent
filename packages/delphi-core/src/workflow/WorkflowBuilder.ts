// npx vitest run src/__tests__/workflow-builder.spec.ts
import type { JsonObject } from '@goatlab/tasks-core'
import { DAGValidationError } from '../errors/WorkflowErrors.js'
import { topologicalSort } from '../state/WorkflowStateMachine.js'
import type {
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  WorkflowDefinition,
  WorkflowDurability,
  WorkflowTrigger,
} from './WorkflowBuilder.types.js'

export type StepConfig = Omit<StepDefinition, 'name'>

export class WorkflowBuilder {
  private _name: string
  private _version = '1.0.0'
  private _steps: StepDefinition[] = []
  private _defaultRetries = 3
  private _defaultTimeoutMs = 300_000 // 5 min
  private _failFast = false
  private _triggers: WorkflowTrigger[] = []
  private _signals: Record<string, SignalHandler> = {}
  private _queries: Record<string, QueryHandler> = {}
  private _onComplete?: (ctx: StepContext) => Promise<void>
  private _onFail?: (ctx: StepContext, error: Error) => Promise<void>
  private _durability?: WorkflowDurability
  private _inputSchema?: { parse: (input: unknown) => unknown }

  private constructor(name: string) {
    this._name = name
  }

  static create(name: string): WorkflowBuilder {
    return new WorkflowBuilder(name)
  }

  version(v: string): this {
    this._version = v
    return this
  }

  defaultRetries(n: number): this {
    this._defaultRetries = n
    return this
  }

  defaultTimeout(ms: number): this {
    this._defaultTimeoutMs = ms
    return this
  }

  failFast(enabled = true): this {
    this._failFast = enabled
    return this
  }

  /**
   * Set the ingest durability guarantee for this workflow.
   *
   * 'buffered' (default): HTTP returns ~1-2ms after trigger hits the in-memory
   * buffer. Small crash window before the batch flushes to PG.
   *
   * 'committed': HTTP blocks until the workflow_runs row is COMMITTED to PG.
   * Batched via BatchedJobProcessor so throughput stays high; use for payments
   * and other "must be durable before we acknowledge" flows.
   */
  durability(d: WorkflowDurability): this {
    this._durability = d
    return this
  }

  inputSchema(schema: { parse: (input: unknown) => unknown }): this {
    this._inputSchema = schema
    return this
  }

  trigger(
    config: Omit<WorkflowTrigger, 'type'> & { type?: 'event' | 'manual' },
  ): this {
    const type = config.type ?? (config.eventType ? 'event' : 'manual')
    this._triggers.push({ ...config, type })
    return this
  }

  step(name: string, config: StepConfig): this {
    this._steps.push({ name, ...config })
    return this
  }

  onSignal(
    name: string,
    handler: (ctx: StepContext, data: JsonObject) => Promise<void>,
  ): this {
    this._signals[name] = { handler }
    return this
  }

  onQuery(
    name: string,
    handler: (ctx: StepContext) => JsonObject | Promise<JsonObject>,
  ): this {
    this._queries[name] = { handler }
    return this
  }

  onComplete(fn: (ctx: StepContext) => Promise<void>): this {
    this._onComplete = fn
    return this
  }

  onFail(fn: (ctx: StepContext, error: Error) => Promise<void>): this {
    this._onFail = fn
    return this
  }

  build(): WorkflowDefinition {
    this.validate()
    return {
      name: this._name,
      version: this._version,
      defaultRetries: this._defaultRetries,
      defaultTimeoutMs: this._defaultTimeoutMs,
      failFast: this._failFast,
      steps: [...this._steps],
      triggers: this._triggers.length > 0 ? [...this._triggers] : undefined,
      signals:
        Object.keys(this._signals).length > 0
          ? { ...this._signals }
          : undefined,
      queries:
        Object.keys(this._queries).length > 0
          ? { ...this._queries }
          : undefined,
      onComplete: this._onComplete,
      onFail: this._onFail,
      durability: this._durability,
      inputSchema: this._inputSchema,
    }
  }

  private validate(): void {
    if (!this._name || this._name.trim() === '') {
      throw new DAGValidationError('Workflow name is required')
    }

    if (this._steps.length === 0) {
      throw new DAGValidationError('Workflow must have at least one step')
    }

    // Check for duplicate step names
    const names = new Set<string>()
    for (const step of this._steps) {
      if (names.has(step.name)) {
        throw new DAGValidationError(`Duplicate step name: "${step.name}"`, {
          step: step.name,
        })
      }
      names.add(step.name)
    }

    // Check for missing dependency references
    for (const step of this._steps) {
      for (const dep of step.dependsOn ?? []) {
        if (!names.has(dep)) {
          throw new DAGValidationError(
            `Step "${step.name}" depends on unknown step "${dep}"`,
            { step: step.name, dependency: dep },
          )
        }
      }
    }

    // Check for self-dependencies
    for (const step of this._steps) {
      if (step.dependsOn?.includes(step.name)) {
        throw new DAGValidationError(`Step "${step.name}" depends on itself`, {
          step: step.name,
        })
      }
    }

    // Check for cycles via topological sort
    topologicalSort(this._steps)
  }
}
