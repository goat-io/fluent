// Typed engine event union — emitted via WorkflowEngineConfig.onEngineEvent.
//
// CRITICAL ORDERING CONTRACT:
//   Events fire ONLY after the corresponding PG write has COMMITTED. This means
//   any subscriber receiving a `step.completed` event can immediately query
//   workflow_steps and see the COMPLETED status (no race window).
//
//   For batched paths (IngestWorker COPY FROM, StepStatusBuffer UPDATE), the
//   engine awaits the buffer's per-job promise (which resolves on commit)
//   before firing events. For sync paths (advanceWorkflow's run.completed),
//   the event fires inline after the UPDATE returns.
//
// HOOK SEMANTICS:
//   - Synchronous from the engine's POV (engine doesn't await your hook). If
//     your hook does I/O (Redis publish, HTTP, etc.) it should be fire-and-forget
//     — the engine moves on immediately.
//   - Errors thrown by your hook are caught and logged, never propagated. A
//     buggy subscriber cannot crash a workflow.
//   - Multiple events from one batch flush fire in deterministic order
//     (per-job order matches the batch order).
//
// SUBSCRIBER PATTERNS:
//   Cheap fan-out — push to an in-memory queue, drain on a separate flush:
//     const q: EngineEvent[] = []
//     onEngineEvent: (evt) => q.push(evt)
//     setInterval(() => { broker.publishBulk(q.splice(0)); }, 50)

import type { WorkflowStatus } from '../workflow/WorkflowBuilder.types.js'

interface BaseEvent {
  /** Tenant the event belongs to. Always present. */
  tenantId: string
  /** Workflow run id. */
  runId: string
  /** Lineage trace id (carried across runs/events/external actions). */
  traceId: string
  /** Wall-clock time the event was emitted (NOT the time the PG write happened). */
  emittedAt: Date
}

export interface RunStartedEvent extends BaseEvent {
  type: 'run.started'
  workflowName: string
  workflowVersion: string
}

export interface RunCompletedEvent extends BaseEvent {
  type: 'run.completed'
  /** Final workflow status — always a terminal state. */
  status: Extract<WorkflowStatus, 'COMPLETED' | 'FAILED' | 'CANCELLED'>
  /** Aggregated run output (merged step outputs), if status is COMPLETED. */
  output?: unknown
  /** Error message if status is FAILED. */
  error?: string
}

export interface StepRunningEvent extends BaseEvent {
  type: 'step.running'
  stepName: string
  attempt: number
}

export interface StepCompletedEvent extends BaseEvent {
  type: 'step.completed'
  stepName: string
  /** Step output (already JSON-serializable; not pre-stringified). */
  output: unknown
}

export interface StepFailedEvent extends BaseEvent {
  type: 'step.failed'
  stepName: string
  error: string
  attempt: number
  /** True if this failure is terminal (no more retries). */
  terminal: boolean
}

export interface StepHumanRequestedEvent extends BaseEvent {
  type: 'step.human_requested'
  stepName: string
  prompt: string
  /** Optional JSON schema describing the expected human input shape. */
  schema?: unknown
}

export type EngineEvent =
  | RunStartedEvent
  | RunCompletedEvent
  | StepRunningEvent
  | StepCompletedEvent
  | StepFailedEvent
  | StepHumanRequestedEvent

/** Type guard — narrows to a specific event type by its `type` discriminator. */
export function isEngineEvent<T extends EngineEvent['type']>(
  type: T,
  evt: EngineEvent,
): evt is Extract<EngineEvent, { type: T }> {
  return evt.type === type
}
