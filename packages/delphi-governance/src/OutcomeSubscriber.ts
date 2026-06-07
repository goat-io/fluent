import type { Outcome } from './types.js'
import { itemNameFromTraceId } from './WorkflowStarter.js'

/** Sink for terminal outcomes (e.g. the BrainClient, a log, a queue). */
export interface OutcomeRecorder {
  record(outcome: Outcome): Promise<void> | void
}

/**
 * Structural shape of a delphi-core `run.completed` engine event. Typed locally
 * so this package never imports delphi-core. delphi-core fires these AFTER the PG
 * write commits, so reading the run is race-free.
 */
export interface RunCompletedEventLike {
  type: string
  runId: string
  traceId: string
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED'
  output?: unknown
  error?: string
}

export interface OutcomeSubscriberOptions {
  recorder: OutcomeRecorder
  /** Clock injection (tests). Defaults to wall-clock ISO. */
  now?: () => string
  /** Map workflow name from the event if available (delphi-core omits it). */
  workflowNameFor?: (runId: string, traceId: string) => string | undefined
}

/**
 * Build the Measure seam: an `onEngineEvent` handler to pass into
 * `createEngine({ onEngineEvent })`. On every `run.completed` for a
 * governance-originated run (trace id prefixed `decision:`), it records an
 * Outcome linked back to the Decision/Action.
 *
 * Matches delphi-core's hook contract: synchronous, fire-and-forget, never
 * throws back into the engine.
 */
export function createOutcomeSubscriber(
  opts: OutcomeSubscriberOptions,
): (evt: { type: string } & Partial<RunCompletedEventLike>) => void {
  const now = opts.now ?? (() => new Date().toISOString())

  return function onEngineEvent(evt): void {
    try {
      if (evt.type !== 'run.completed') {
        return
      }
      const itemName = itemNameFromTraceId(evt.traceId)
      if (!itemName) {
        return // not a governance-originated run
      }

      const outcome: Outcome = {
        itemName,
        runId: evt.runId as string,
        traceId: evt.traceId as string,
        workflowName: opts.workflowNameFor?.(
          evt.runId as string,
          evt.traceId as string,
        ),
        status: evt.status as Outcome['status'],
        output: evt.output,
        error: evt.error,
        recordedAt: now(),
      }
      // Fire-and-forget; never let a recorder error escape into the engine.
      Promise.resolve(opts.recorder.record(outcome)).catch(() => {})
    } catch {
      // Swallow — a buggy subscriber must not crash a workflow.
    }
  }
}
