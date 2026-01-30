import type { DispatchConfig, DispatchCycleResult } from './dispatch.types'
import type { DispatchConnector } from './DispatchConnector'

export interface FanOutResult {
  /** Number of additional dispatchers spawned */
  spawned: number
  /** Whether circuit breaker is open (no fan-out) */
  circuitOpen: boolean
  /** Current backlog size */
  backlog: number
  /** Current inflight dispatcher count */
  inflight: number
}

/**
 * Logger interface for DispatchFanOut.
 * If not provided, falls back to console.
 */
export interface DispatchFanOutLogger {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

export interface DispatchFanOutConfig {
  /** The dispatch connector (BullMQ, GCP, etc.) */
  connector: DispatchConnector
  /** Dispatch configuration (fan-out settings, URL, etc.) */
  config: DispatchConfig
  /** Optional logger (defaults to console) */
  logger?: DispatchFanOutLogger
}

/**
 * HTTP self-fan-out with proportional scaling and circuit breaker.
 *
 * After a dispatch batch completes, this decides whether to spawn
 * more dispatchers based on the remaining backlog.
 *
 * Scaling formula:
 *   desired = min(maxParallelism, ceil(backlog / batchSize))
 *   toSpawn = max(0, desired - inflight)
 *
 * Circuit breaker:
 *   If the last N dispatch cycles processed 0 jobs, stop fan-out.
 *   This prevents runaway scaling when the dispatch queue has stale hints.
 *
 * HTTP self-ping:
 *   Spawns fire-and-forget fetch() calls to the dispatch endpoint.
 *   Cloud Run sees concurrent requests and scales up instances.
 *   Each request processes one batch then optionally fans out again.
 */
export class DispatchFanOut {
  private readonly connector: DispatchConnector
  private readonly config: DispatchConfig
  private readonly logger: DispatchFanOutLogger

  constructor(fanOutConfig: DispatchFanOutConfig) {
    this.connector = fanOutConfig.connector
    this.config = fanOutConfig.config
    this.logger = fanOutConfig.logger || console
  }

  /**
   * Decide whether to fan out and spawn additional dispatchers.
   * Called after a dispatch batch completes.
   *
   * @param cycleResult - Result of the completed batch
   * @param isReconciler - If true, skip fan-out (reconciler is periodic, not recursive)
   */
  async maybeSpawn(
    cycleResult: DispatchCycleResult,
    isReconciler = false,
  ): Promise<FanOutResult> {
    // Reconciler pings don't fan out (they're periodic, not recursive)
    if (isReconciler) {
      return {
        spawned: 0,
        circuitOpen: false,
        backlog: await this.connector.getBacklogSize(),
        inflight: await this.connector.getInflightCount(),
      }
    }

    // Update circuit breaker state
    if (cycleResult.processed === 0) {
      const streak = await this.connector.incrementZeroWorkStreak()
      const threshold = this.config.circuitBreakerThreshold || 3

      if (streak >= threshold) {
        this.logger.warn('[FanOut] Circuit breaker open, stopping fan-out', {
          streak,
          threshold,
        })
        // Reset streak so next trigger (enqueue or reconciler) can try again
        await this.connector.resetZeroWorkStreak()

        return {
          spawned: 0,
          circuitOpen: true,
          backlog: await this.connector.getBacklogSize(),
          inflight: await this.connector.getInflightCount(),
        }
      }
    } else {
      // Work was done, reset zero-work streak
      await this.connector.resetZeroWorkStreak()
    }

    // Calculate proportional fan-out
    const backlog = await this.connector.getBacklogSize()
    const batchSize = this.config.batchSize || 50
    const maxParallelism = this.config.maxParallelism || 20

    const desired = Math.min(maxParallelism, Math.ceil(backlog / batchSize))
    const inflight = await this.connector.getInflightCount()
    const toSpawn = Math.max(0, desired - inflight)

    if (toSpawn === 0) {
      this.logger.debug('[FanOut] No fan-out needed', {
        backlog,
        desired,
        inflight,
      })
      return { spawned: 0, circuitOpen: false, backlog, inflight }
    }

    // Check dispatch URL is configured
    const dispatchUrl = this.config.dispatchUrl
    if (!dispatchUrl) {
      this.logger.warn('[FanOut] No DISPATCH_URL configured, cannot fan out')
      return { spawned: 0, circuitOpen: false, backlog, inflight }
    }

    // Atomically increment inflight counter
    await this.connector.incrementInflight(toSpawn)

    this.logger.info('[FanOut] Spawning dispatchers', {
      toSpawn,
      backlog,
      desired,
      inflight,
    })

    // Spawn HTTP requests in background (fire-and-forget)
    // Each request processes one batch, then optionally fans out again
    for (let i = 0; i < toSpawn; i++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      // Use globalThis.fetch to ensure it's available in Node.js 18+
      globalThis.fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dispatch-Source': 'fan-out',
        },
        signal: controller.signal,
      })
        .catch((err) => {
          this.logger.error('[FanOut] Dispatch request failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
        .finally(() => {
          clearTimeout(timeoutId)
          // Decrement inflight when request completes (success or failure)
          this.connector.decrementInflight().catch((err: unknown) => {
            this.logger.error('[FanOut] Failed to decrement inflight', {
              error: err instanceof Error ? err.message : String(err),
            })
          })
        })
    }

    return { spawned: toSpawn, circuitOpen: false, backlog, inflight }
  }
}
