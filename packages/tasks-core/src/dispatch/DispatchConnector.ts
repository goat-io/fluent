import type {
  DispatchCycleResult,
  DispatchHint,
} from './dispatch.types'

/**
 * Provider-agnostic interface for dispatch operations.
 * Implementations handle the queue-specific details (BullMQ, GCP, etc.).
 *
 * The dispatch system has two sides:
 * 1. Enqueue side: writeHint() writes a pointer to the dispatch queue after tenant enqueue
 * 2. Consumer side: fetchAndProcess() manually fetches jobs from tenant queues
 *
 * Both sides are provider-specific but share this common interface.
 */
export interface DispatchConnector {
  /**
   * Write a dispatch hint to the global dispatch queue.
   * Called after a job is enqueued to a tenant queue.
   * Must be idempotent (duplicate hints are harmless).
   *
   * @param hint - The dispatch hint to write
   */
  writeHint(hint: DispatchHint): Promise<void>

  /**
   * Fetch the next dispatch hint from the global queue.
   * Returns null if no work is available.
   *
   * @returns The next hint, or null if queue is empty
   */
  fetchNextHint(): Promise<DispatchHint | null>

  /**
   * Process a single job from a tenant queue based on a dispatch hint.
   * Manually fetches the job (no blocking Worker), executes it, and moves it to completed/failed.
   *
   * @param hint - The dispatch hint pointing to the tenant queue
   * @param handler - Function to execute the job with tenant context
   * @returns true if a job was processed, false if no job found (hint was stale)
   */
  processHint(
    hint: DispatchHint,
    handler: (
      tenantId: string,
      queueName: string,
      jobData: unknown,
    ) => Promise<unknown>,
  ): Promise<boolean>

  /**
   * Get the current dispatch queue backlog size.
   * Used for proportional fan-out calculation.
   *
   * @returns Number of pending hints in the dispatch queue
   */
  getBacklogSize(): Promise<number>

  /**
   * Get the current number of inflight dispatchers.
   *
   * @returns Number of active dispatcher instances
   */
  getInflightCount(): Promise<number>

  /**
   * Atomically increment the inflight dispatcher counter.
   *
   * @param count - Number of instances to add
   */
  incrementInflight(count: number): Promise<void>

  /**
   * Decrement the inflight dispatcher counter.
   */
  decrementInflight(): Promise<void>

  /**
   * Get and increment the zero-work streak counter.
   * Returns the NEW value after increment.
   *
   * @returns New streak count after increment
   */
  incrementZeroWorkStreak(): Promise<number>

  /**
   * Reset the zero-work streak counter to 0.
   */
  resetZeroWorkStreak(): Promise<void>

  /**
   * Close all connections and clean up resources.
   */
  close(): Promise<void>
}
