import type { DispatchListener } from '@goatlab/tasks-core'
import type { Hatchet } from '@hatchet-dev/typescript-sdk'

/**
 * Configuration for HatchetDispatchListener.
 */
export interface HatchetDispatchListenerConfig {
  /** Hatchet client instance (already initialized). Use HatchetConnector.getHatchetClient() to obtain. */
  hatchet: ReturnType<typeof Hatchet.init>
  /** URL to trigger dispatch HTTP endpoint */
  dispatchUrl: string
  /** Workflow name for dispatch hints. Default: 'dispatch-hint' */
  workflowName?: string
  /** Optional logger */
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    debug?: (...args: unknown[]) => void
  }
}

/**
 * DispatchListener implementation for Hatchet.
 *
 * This listener subscribes to Hatchet workflow events and triggers HTTP POST
 * to the dispatch endpoint when a dispatch-hint workflow runs.
 *
 * Unlike GCP Cloud Tasks (which pushes natively), Hatchet workflows are event-driven.
 * When a hint is enqueued via Hatchet, this worker picks it up and fires an HTTP
 * request to the dispatch endpoint. This enables Cloud Run auto-scaling via HTTP
 * request volume.
 *
 * The listener uses Hatchet's task + worker pattern (same as HatchetConnector.startWorker).
 */
export class HatchetDispatchListener implements DispatchListener {
  private worker: any = null
  private running = false
  private readonly logger: Required<
    NonNullable<HatchetDispatchListenerConfig['logger']>
  >

  constructor(private readonly config: HatchetDispatchListenerConfig) {
    this.logger = {
      info: config.logger?.info ?? console.info,
      warn: config.logger?.warn ?? console.warn,
      error: config.logger?.error ?? console.error,
      debug: config.logger?.debug ?? console.debug,
    }
  }

  /**
   * Start listening for dispatch-hint workflows.
   *
   * Creates a Hatchet worker that subscribes to dispatch-hint workflow events.
   * When a hint is enqueued, the worker executes and triggers HTTP POST to the
   * dispatch endpoint.
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('[HatchetDispatchListener] Already running')
      return
    }

    const workflowName = this.config.workflowName ?? 'dispatch-hint'

    // Create a Hatchet task that triggers HTTP POST on execution
    const dispatchTask = this.config.hatchet.task({
      name: workflowName,
      fn: async () => {
        try {
          // Manual timeout implementation (AbortSignal.timeout not available in all environments)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60_000)

          try {
            const response = await globalThis.fetch(this.config.dispatchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Dispatch-Source': 'listener',
              },
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              throw new Error(`Dispatch failed: ${response.status}`)
            }

            this.logger.debug(
              '[HatchetDispatchListener] Dispatch trigger succeeded',
            )
          } catch (fetchError) {
            clearTimeout(timeoutId)
            throw fetchError
          }
        } catch (error) {
          // Log error but let Hatchet handle retry
          this.logger.error(
            '[HatchetDispatchListener] Dispatch trigger failed',
            {
              error: error instanceof Error ? error.message : String(error),
            },
          )
          throw error
        }
      },
    })

    // Create worker and start listening
    this.worker = await this.config.hatchet.worker('dispatch-listener', {
      workflows: [dispatchTask],
      slots: 5,
    })

    await this.worker.start()

    this.running = true
    this.logger.info('[HatchetDispatchListener] Started', {
      workflowName,
      dispatchUrl: this.config.dispatchUrl,
    })
  }

  /**
   * Stop the listener and clean up resources.
   */
  async stop(): Promise<void> {
    if (this.worker) {
      // Hatchet workers have a stop() method for cleanup
      if (typeof this.worker.stop === 'function') {
        await this.worker.stop()
      }
      this.worker = null
    }

    this.running = false
    this.logger.info('[HatchetDispatchListener] Stopped')
  }

  /**
   * Check if the listener is running.
   */
  isRunning(): boolean {
    return this.running
  }
}
