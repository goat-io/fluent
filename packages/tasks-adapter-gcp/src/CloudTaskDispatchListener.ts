import type { DispatchListener } from '@goatlab/tasks-core'

/**
 * Configuration for CloudTaskDispatchListener.
 *
 * This listener is intentionally a no-op. GCP Cloud Tasks queues
 * are configured with httpTarget pointing directly to the dispatch endpoint.
 * The queue pushes tasks as HTTP POST requests natively -- no listener process
 * is needed in the backend.
 *
 * This class exists solely for interface compliance and lifecycle tracking.
 */
export interface CloudTaskDispatchListenerConfig {
  /** GCP project ID (for logging/documentation) */
  gcpProject: string
  /** Location/region (for logging/documentation) */
  location: string
  /** Queue name for dispatch hints (for logging/documentation) */
  queueName?: string
  /** Optional logger */
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    debug?: (...args: unknown[]) => void
  }
}

/**
 * DispatchListener implementation for GCP Cloud Tasks.
 *
 * **This is intentionally a no-op implementation.**
 *
 * Unlike BullMQ or Hatchet, GCP Cloud Tasks queues do NOT require a listener process
 * running in the backend. Instead, the queue itself is configured with an `httpTarget`
 * pointing to the dispatch HTTP endpoint. When tasks are enqueued, Cloud Tasks
 * pushes them directly to that endpoint as HTTP POST requests.
 *
 * This class exists to:
 * 1. Satisfy the DispatchListener interface contract
 * 2. Provide lifecycle tracking (start/stop/isRunning)
 * 3. Document WHY no listener logic is needed
 *
 * The actual dispatch mechanism is handled entirely by Cloud Tasks infrastructure
 * via queue configuration (see CloudTaskConnector queue creation).
 */
export class CloudTaskDispatchListener implements DispatchListener {
  private running = false
  private readonly logger: Required<NonNullable<CloudTaskDispatchListenerConfig['logger']>>

  constructor(private readonly config: CloudTaskDispatchListenerConfig) {
    this.logger = {
      info: config.logger?.info ?? console.info,
      warn: config.logger?.warn ?? console.warn,
      error: config.logger?.error ?? console.error,
      debug: config.logger?.debug ?? console.debug,
    }
  }

  /**
   * Start the listener (no-op for Cloud Tasks).
   *
   * This sets the running flag and logs that the queue is managing dispatch
   * directly via httpTarget configuration. No actual listener process starts.
   */
  async start(): Promise<void> {
    this.running = true
    this.logger.info('[CloudTaskDispatchListener] Started (queue-managed push)', {
      gcpProject: this.config.gcpProject,
      location: this.config.location,
      queueName: this.config.queueName ?? 'dispatch-hints',
      note: 'Cloud Tasks queue pushes directly to dispatch HTTP endpoint via httpTarget',
    })
  }

  /**
   * Stop the listener (no-op for Cloud Tasks).
   *
   * This clears the running flag. No actual cleanup needed since no process runs.
   */
  async stop(): Promise<void> {
    this.running = false
    this.logger.info('[CloudTaskDispatchListener] Stopped')
  }

  /**
   * Check if the listener is running.
   */
  isRunning(): boolean {
    return this.running
  }
}
