// Domain types for the governance bridge.
//
// These mirror the relevant Brain catalog kinds (`decision`, `action`,
// `classification`) — see @goatlab/delphi-brain `schema/*.schema.json`. They are
// duplicated here (not imported) so this package stays independent of the Brain
// implementation; a BrainClient adapter maps the Brain's JSON onto these shapes.

export type DecisionStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'deprecated'

export type ActionStatus =
  | 'proposed'
  | 'in-progress'
  | 'blocked'
  | 'done'
  | 'superseded'

export interface DecisionOption {
  label: string
  pros?: string[]
  cons?: string[]
}

/** A Decision — the primary governance artifact (an ADR/BDR). */
export interface Decision {
  name: string
  kind: 'decision'
  description: string
  status: DecisionStatus
  context?: string
  options?: DecisionOption[]
  choice?: string
  consequences?: string
  decidedBy?: string
  decidedOn?: string
  tags?: string[]
  system?: string
  layer?: string
}

/**
 * An Action — the executable unit a Decision compiles into (the "task" that an
 * agent generates). `type` selects which workflow runs it (see CompileRegistry).
 */
export interface Action {
  name: string
  kind: 'action'
  description: string
  /** Free-string action type, e.g. 'cost-cut' | 'migration' | 'ticket'. */
  type: string
  status: ActionStatus
  /** Catalog entry name or external id this action operates on. */
  target?: string
  owner?: string
  due?: string
  /** Wiki page (path:line) that justifies this action. */
  source?: string
  /** Outcome text once status = done. */
  result?: string
  blockedBy?: string[]
  tags?: string[]
  system?: string
  layer?: string
  /** Names of `classification` constraints that apply (drives the guard). */
  classifications?: string[]
}

/** A Constitution constraint — a data-sensitivity / risk classification. */
export interface Classification {
  name: string
  kind: 'classification'
  description: string
  severity: 'low' | 'medium' | 'high' | 'highest' | (string & {})
  handlingRules?: string[]
  regulatoryBasis?: string[]
}

/** Any item the governance layer can act on. */
export type GovernedItem = Decision | Action

/**
 * The result of executing one governed item — a run on the execution plane, or
 * a reason it did not start.
 */
export type ExecuteStatus =
  | 'executing' // compiled to a workflow run (exactly-once)
  | 'blocked' // the constitution guard denied it
  | 'awaiting_human' // guard requires a human gate before execution
  | 'no_rule' // no compile rule for this action type

export interface ExecuteResult {
  status: ExecuteStatus
  /** The Decision/Action name. */
  item: string
  runId?: string
  traceId?: string
  workflowName?: string
  /** Whether the constitution flagged this as needing human review. */
  requiresHuman?: boolean
  reasons?: string[]
}

/**
 * An Outcome — written back after a governed run reaches a terminal state.
 * Links the execution-plane run (runId/traceId) to the judgment-plane item.
 */
export interface Outcome {
  /** Name of the Decision/Action that compiled into this run. */
  itemName: string
  runId: string
  traceId: string
  workflowName?: string
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
  output?: unknown
  error?: string
  /** ISO-8601 timestamp. */
  recordedAt: string
}
