import type { DispatchListener } from '@goatlab/tasks-core'
import type { ConnectionOptions } from 'bullmq'
import { Worker } from 'bullmq'

const DISPATCH_QUEUE_NAME = 'dispatch-hints'
const DISPATCH_PREFIX = 'dispatch'

export interface BullMQDispatchListenerConfig {
  /** Redis connection for the dispatch-hints queue */
  connection: ConnectionOptions
  /** URL of the dispatch HTTP endpoint (e.g., http://localhost:3000/internal/dispatch) */
  dispatchUrl: string
  /** Queue prefix (should match BullMQDispatchConnector prefix). Default: 'dispatch' */
  prefix?: string
  /** Optional logger with info/warn/error/debug methods */
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    debug?: (...args: unknown[]) => void
  }
}

/**
 * BullMQ implementation of DispatchListener.
 *
 * Creates ONE persistent BullMQ Worker on the `dispatch-hints` queue.
 * On each hint arrival, it fires an HTTP POST to the dispatch endpoint URL.
 * It does NOT process jobs itself -- the HTTP endpoint handles batch processing.
 *
 * Key design decisions:
 * - Queue name: 'dispatch-hints' (matches BullMQDispatchConnector)
 * - Prefix: 'dispatch' default (matches BullMQDispatchConnector)
 * - Concurrency: 1 (single-threaded dispatch trigger -- HTTP endpoint handles parallelism)
 * - Rate limiter: max 10 per 1000ms (prevents overwhelming dispatch endpoint)
 * - The Worker processor fires globalThis.fetch() to dispatchUrl with method POST
 * - On fetch failure or non-OK response, throw error so BullMQ retries the hint
 */
export class BullMQDispatchListener implements DispatchListener {
  private worker: Worker | null = null
  private readonly logger: Required<BullMQDispatchListenerConfig['logger']>

  constructor(private readonly config: BullMQDispatchListenerConfig) {
    const log = config.logger ?? {}
    this.logger = {
      info: log.info ?? console.log.bind(console),
      warn: log.warn ?? console.warn.bind(console),
      error: log.error ?? console.error.bind(console),
      debug: log.debug ?? (() => {}),
    }
  }

  async start(): Promise<void> {
    if (this.worker) {
      this.logger.warn(
        '[BullMQDispatchListener] Already started, ignoring start() call',
      )
      return
    }

    this.worker = new Worker(
      DISPATCH_QUEUE_NAME,
      async job => {
        // Fire HTTP POST to the dispatch endpoint
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), 60_000)

        try {
          const hint = job.data || {}
          const response = await globalThis.fetch(this.config.dispatchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Dispatch-Source': 'listener',
              ...(hint.tenantId ? { 'X-Tenant-ID': hint.tenantId } : {}),
            },
            body: JSON.stringify(hint),
            signal: abortController.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            throw new Error(
              `Dispatch endpoint returned ${response.status}: ${errorText}`,
            )
          }

          this.logger.debug(
            `[BullMQDispatchListener] Triggered dispatch for hint ${job.id}`,
          )
        } catch (error) {
          clearTimeout(timeoutId)
          this.logger.error(
            `[BullMQDispatchListener] Failed to trigger dispatch for hint ${job.id}:`,
            error,
          )
          throw error // BullMQ will retry
        }
      },
      {
        connection: this.config.connection,
        prefix: this.config.prefix ?? DISPATCH_PREFIX,
        concurrency: 1,
        limiter: {
          max: 10,
          duration: 1000,
        },
      },
    )

    // Attach event handlers
    this.worker.on('error', error => {
      this.logger.error('[BullMQDispatchListener] Worker error:', error)
    })

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `[BullMQDispatchListener] Job ${job?.id} failed:`,
        error,
      )
    })

    this.logger.info(
      '[BullMQDispatchListener] Started listening on dispatch-hints queue',
    )
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
      this.logger.info('[BullMQDispatchListener] Stopped')
    }
  }

  isRunning(): boolean {
    return this.worker !== null && !this.worker.closing
  }
}
