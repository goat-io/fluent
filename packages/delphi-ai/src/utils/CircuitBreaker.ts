// npx vitest run src/__tests__/utils/circuit-breaker.spec.ts

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenRetries?: number
  windowSizeMs?: number
  shouldTrip?: (error: any) => boolean
}

export interface CircuitBreakerMetrics {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  state: CircuitState
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures: number[] = [] // timestamps of failures
  private halfOpenSuccesses = 0
  private lastOpenedAt = 0
  private config: Required<CircuitBreakerConfig>
  private metrics = { totalCalls: 0, successfulCalls: 0, failedCalls: 0 }

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      halfOpenRetries: 3,
      windowSizeMs: 60_000,
      shouldTrip: () => true,
      ...config,
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalCalls++

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastOpenedAt
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        this.halfOpenSuccesses = 0
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastOpenedAt
      if (elapsed >= this.config.resetTimeoutMs) {
        return 'HALF_OPEN'
      }
    }
    return this.state
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics, state: this.getState() }
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failures = []
    this.halfOpenSuccesses = 0
    this.lastOpenedAt = 0
    this.metrics = { totalCalls: 0, successfulCalls: 0, failedCalls: 0 }
  }

  private onSuccess(): void {
    this.metrics.successfulCalls++

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++
      if (this.halfOpenSuccesses >= this.config.halfOpenRetries) {
        this.state = 'CLOSED'
        this.failures = []
      }
    }
  }

  private onFailure(error: any): void {
    this.metrics.failedCalls++

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.lastOpenedAt = Date.now()
      return
    }

    if (!this.config.shouldTrip(error)) {
      return
    }

    const now = Date.now()
    this.failures.push(now)

    // Remove failures outside the window
    const windowStart = now - this.config.windowSizeMs
    this.failures = this.failures.filter(t => t >= windowStart)

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'OPEN'
      this.lastOpenedAt = now
    }
  }
}
