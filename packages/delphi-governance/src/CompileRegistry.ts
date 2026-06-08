import type { Action } from './types.js'

/**
 * A compile rule turns an Action into a concrete workflow invocation. This is
 * the heart of "tasks are compiled from decisions": an Action of a given `type`
 * maps to a workflow name + the input that workflow expects.
 */
export interface CompileRule {
  workflowName: string
  /**
   * Build the workflow input from the action. Defaults to passing the action's
   * `target` and `name` through if omitted.
   */
  mapInput?: (action: Action) => Record<string, unknown>
}

/** Default input mapping when a rule omits `mapInput`. */
function defaultMapInput(action: Action): Record<string, unknown> {
  return {
    actionName: action.name,
    target: action.target,
    type: action.type,
  }
}

/** Registry of Action.type → CompileRule. */
export class CompileRegistry {
  private rules = new Map<string, CompileRule>()

  /** Register (or replace) the rule for an action type. Chainable. */
  register(actionType: string, rule: CompileRule): this {
    this.rules.set(actionType, rule)
    return this
  }

  /** Whether a rule exists for this action's type. */
  has(actionType: string): boolean {
    return this.rules.has(actionType)
  }

  /** Resolve the rule for an action, or undefined if none is registered. */
  resolve(action: Action): CompileRule | undefined {
    return this.rules.get(action.type)
  }

  /** Resolve the rule and produce its workflow input (applying the default mapper). */
  compile(
    action: Action,
  ): { workflowName: string; input: Record<string, unknown> } | undefined {
    const rule = this.rules.get(action.type)
    if (!rule) {
      return undefined
    }
    const mapInput = rule.mapInput ?? defaultMapInput
    return { workflowName: rule.workflowName, input: mapInput(action) }
  }

  /** All registered action types. */
  types(): string[] {
    return [...this.rules.keys()]
  }
}
