import type { BrainClient } from './BrainClient.js'
import type { CompileRegistry } from './CompileRegistry.js'
import type { ConstitutionGuard } from './ConstitutionGuard.js'
import type { Action, Classification, ExecuteResult } from './types.js'
import { traceIdForItem, type WorkflowStarter } from './WorkflowStarter.js'

export interface DecisionExecutorDeps {
  starter: WorkflowStarter
  registry: CompileRegistry
  guard: ConstitutionGuard
  /** Used to resolve an action's classification constraints. Optional. */
  brain?: Pick<BrainClient, 'getClassification'>
  /**
   * When true (default), an item the guard flags `requiresHuman` is NOT executed
   * — it returns `awaiting_human`. When false, it executes but the result still
   * carries `requiresHuman` (the workflow is expected to contain its own HITL
   * gate).
   */
  requireHumanGate?: boolean
}

/**
 * Compiles approved Decisions/Actions into delphi-core workflow runs.
 *
 * The single seam that turns the Brain from a wiki into an operating system:
 *   guard (Constitution) → compile (Action.type → workflow) → start (exactly-once).
 *
 * `idempotencyKey = action.name` means re-running the loop never double-executes
 * (delphi-core dedups), and `traceId = decision:<name>` lets outcomes map back to
 * the item with no state store.
 */
export class DecisionExecutor {
  private starter: WorkflowStarter
  private registry: CompileRegistry
  private guard: ConstitutionGuard
  private brain?: Pick<BrainClient, 'getClassification'>
  private requireHumanGate: boolean

  constructor(deps: DecisionExecutorDeps) {
    this.starter = deps.starter
    this.registry = deps.registry
    this.guard = deps.guard
    this.brain = deps.brain
    this.requireHumanGate = deps.requireHumanGate ?? true
  }

  /** Resolve the classification constraints that apply to an action. */
  private async resolveClassifications(
    action: Action,
  ): Promise<Classification[]> {
    if (!this.brain) {
      return []
    }
    const names = new Set<string>([
      ...(action.classifications ?? []),
      ...(action.tags ?? []),
    ])
    const resolved: Classification[] = []
    for (const name of names) {
      const c = await this.brain.getClassification(name)
      if (c) {
        resolved.push(c)
      }
    }
    return resolved
  }

  /** Execute one action through the full guard → compile → start pipeline. */
  async execute(action: Action): Promise<ExecuteResult> {
    const classifications = await this.resolveClassifications(action)
    const verdict = await this.guard.evaluate(action, { classifications })

    if (!verdict.allow) {
      return {
        status: 'blocked',
        item: action.name,
        requiresHuman: verdict.requiresHuman,
        reasons: verdict.reasons,
      }
    }

    if (verdict.requiresHuman && this.requireHumanGate) {
      return {
        status: 'awaiting_human',
        item: action.name,
        requiresHuman: true,
        reasons: verdict.reasons,
      }
    }

    const compiled = this.registry.compile(action)
    if (!compiled) {
      return {
        status: 'no_rule',
        item: action.name,
        reasons: [
          `No compile rule registered for action type '${action.type}'.`,
        ],
      }
    }

    const traceId = traceIdForItem(action.name)
    const { runId } = await this.starter.start({
      workflowName: compiled.workflowName,
      input: compiled.input,
      idempotencyKey: action.name,
      traceId,
    })

    return {
      status: 'executing',
      item: action.name,
      runId,
      traceId,
      workflowName: compiled.workflowName,
      requiresHuman: verdict.requiresHuman,
    }
  }

  /**
   * One loop tick: pull executable actions from the Brain and execute each.
   * Returns a result per action. Requires a full BrainClient.
   */
  async executePending(brain: BrainClient): Promise<ExecuteResult[]> {
    const actions = await brain.listExecutableActions()
    const results: ExecuteResult[] = []
    for (const action of actions) {
      results.push(await this.execute(action))
    }
    return results
  }
}
