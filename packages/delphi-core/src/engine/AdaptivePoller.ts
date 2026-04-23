// npx vitest run src/__tests__/engine/dbos-parity-v2.spec.ts
//
// Adaptive queue polling — adjusts interval based on contention/success/idle.
// DBOS-parity: prevents thundering herd on shared queues while keeping
// latency low under load.
//
// Pure class, no DB dependency. Suitable for unit testing.

export interface AdaptivePollerConfig {
  /** Minimum polling interval in ms (floor) */
  minIntervalMs: number
  /** Maximum polling interval in ms (ceiling) */
  maxIntervalMs: number
  /** Multiplier on contention (default: 2.0 — doubles interval) */
  backoffRate?: number
  /** Multiplier on success (default: 0.9 — shrinks interval by 10%) */
  decayRate?: number
}

export class AdaptivePoller {
  private intervalMs: number
  private readonly minIntervalMs: number
  private readonly maxIntervalMs: number
  private readonly backoffRate: number
  private readonly decayRate: number

  constructor(config: AdaptivePollerConfig) {
    this.minIntervalMs = config.minIntervalMs
    this.maxIntervalMs = config.maxIntervalMs
    this.backoffRate = config.backoffRate ?? 2.0
    this.decayRate = config.decayRate ?? 0.9
    this.intervalMs = config.minIntervalMs
  }

  /** Call when a poll attempt hit contention (e.g. lock conflict, empty queue under load). */
  onContention(): void {
    this.intervalMs = Math.min(
      this.intervalMs * this.backoffRate,
      this.maxIntervalMs,
    )
  }

  /** Call when a poll attempt succeeded (found work). */
  onSuccess(): void {
    this.intervalMs = Math.max(
      this.intervalMs * this.decayRate,
      this.minIntervalMs,
    )
  }

  /** Call when a poll attempt found nothing (idle). Slowly grows toward max. */
  onIdle(): void {
    // Gentle growth: 10% toward max per idle cycle
    this.intervalMs = Math.min(this.intervalMs * 1.1, this.maxIntervalMs)
  }

  /** Returns the current polling interval in ms. */
  getIntervalMs(): number {
    return this.intervalMs
  }
}
