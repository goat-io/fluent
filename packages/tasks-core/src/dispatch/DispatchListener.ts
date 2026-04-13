/**
 * Provider-agnostic interface for listening to dispatch hints.
 *
 * Each adapter implements this differently based on its native event mechanism:
 * - BullMQ: Persistent Worker on dispatch-hints queue, triggers HTTP POST per hint
 * - GCP Cloud Tasks: No-op (queue natively pushes to HTTP endpoint)
 * - Hatchet: Workflow subscription that triggers HTTP POST on events
 *
 * The listener does NOT process jobs itself. It converts hint arrivals
 * into HTTP requests to the dispatch endpoint, which handles processing.
 * This enables Cloud Run auto-scaling via HTTP request volume.
 */
export interface DispatchListener {
  /**
   * Start listening for dispatch hints.
   * Returns a promise that resolves when the listener is running.
   *
   * IMPORTANT: Call this AFTER the HTTP server is ready.
   * The listener triggers HTTP requests to the dispatch endpoint,
   * so the endpoint must be accepting connections before the listener starts.
   */
  start(): Promise<void>

  /**
   * Stop the listener and clean up all resources.
   * Must be called on graceful shutdown (SIGTERM/SIGINT).
   */
  stop(): Promise<void>

  /**
   * Check if the listener is currently active.
   */
  isRunning(): boolean
}
