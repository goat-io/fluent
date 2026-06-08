// The seam to the execution plane (delphi-core), expressed structurally so this
// package never imports delphi-core. A WorkflowStarter is anything that can
// start a named workflow exactly-once given an idempotency key + trace id.

export interface StartRequest {
  workflowName: string
  input: Record<string, unknown>
  /** Dedup key — delphi-core guarantees one run per (tenant, idempotencyKey). */
  idempotencyKey?: string
  /** Lineage id — carried through the run so outcomes map back to the item. */
  traceId?: string
}

export interface StartResult {
  runId: string
  traceId?: string
}

export interface WorkflowStarter {
  start(req: StartRequest): Promise<StartResult>
}

/**
 * Structural shape of a delphi-core `createEngine()` result: per-workflow ops
 * keyed by workflow name, each with a `start(input, opts)` method. Typed loosely
 * on purpose — binding to delphi-core happens here, by duck-typing, with zero
 * compile-time dependency on it.
 */
export type EngineLike = Record<
  string,
  | {
      start?: (
        input: object,
        opts?: { idempotencyKey?: string; traceId?: string },
      ) => Promise<{ runId: string }>
    }
  | unknown
>

/**
 * Adapt a delphi-core `createEngine()` engine into a WorkflowStarter.
 *
 *   const engine = createEngine({ workflows: [...] })
 *   const starter = fromEngine(engine)
 */
export function fromEngine(engine: EngineLike): WorkflowStarter {
  return {
    async start({ workflowName, input, idempotencyKey, traceId }) {
      const ops = engine[workflowName] as
        | {
            start?: (
              input: object,
              opts?: { idempotencyKey?: string; traceId?: string },
            ) => Promise<{ runId: string }>
          }
        | undefined
      if (!ops || typeof ops.start !== 'function') {
        throw new Error(
          `WorkflowStarter: engine has no startable workflow named '${workflowName}'`,
        )
      }
      const { runId } = await ops.start(input, { idempotencyKey, traceId })
      return { runId, traceId }
    },
  }
}

const TRACE_PREFIX = 'decision:'

/**
 * Derive a deterministic trace id from a governed item's name. Because it is
 * deterministic and prefixed, the outcome subscriber can recover the item name
 * from a `run.completed` event with no external state store.
 */
export function traceIdForItem(itemName: string): string {
  return `${TRACE_PREFIX}${itemName}`
}

/** Inverse of {@link traceIdForItem}; null if the trace id is not governance-owned. */
export function itemNameFromTraceId(
  traceId: string | undefined,
): string | null {
  if (!traceId || !traceId.startsWith(TRACE_PREFIX)) {
    return null
  }
  return traceId.slice(TRACE_PREFIX.length)
}
