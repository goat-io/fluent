// ResiliencePolicy - Handles circuit breaker and rate limiting
import { TypesenseRateLimitInfo } from '../typesense.model'

export interface ResiliencePolicyOptions {
  maxFailures?: number
  resetTimeout?: number
  retryDelay?: number
  maxRetries?: number
  onStateChange?: (
    state: 'open' | 'closed' | 'half-open',
    metadata?: any,
  ) => void
  onRetry?: (attempt: number, error: any) => void
  onRateLimitUpdate?: (info: TypesenseRateLimitInfo) => void
  enabled?: boolean // Option to disable circuit breaker (useful for tests)
}

export class ResiliencePolicy {
  private failures = 0
  private circuitOpenUntil = 0
  private rateLimitInfo: TypesenseRateLimitInfo | null = null
  private retryAfterUntil = 0

  constructor(private options: ResiliencePolicyOptions = {}) {
    this.options = {
      maxFailures: 5,
      resetTimeout: 60000, // 1 minute
      retryDelay: 1000,
      maxRetries: 3,
      enabled: true, // Enabled by default
      ...options,
    }
  }

  isCircuitOpen(): boolean {
    // If circuit breaker is disabled, always return false
    if (!this.options.enabled) {
      return false
    }

    if (this.circuitOpenUntil > Date.now()) {
      return true
    }

    // Reset circuit if timeout has passed
    if (this.circuitOpenUntil > 0 && this.circuitOpenUntil <= Date.now()) {
      this.reset()
    }

    return false
  }

  shouldRetry(retryCount: number, error: any): boolean {
    // Don't retry if circuit is open
    if (this.isCircuitOpen()) {
      return false
    }

    // Don't retry if we're in a retry-after period
    if (this.retryAfterUntil > Date.now()) {
      return false
    }

    // Don't retry beyond max retries
    if (retryCount >= (this.options.maxRetries || 3)) {
      return false
    }

    // Don't retry on 4xx errors (except 429)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false
    }

    return true
  }

  getRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.options.retryDelay || 1000
    const exponentialDelay = baseDelay * 2 ** retryCount
    const jitter = Math.random() * 0.1 * exponentialDelay
    return exponentialDelay + jitter
  }

  recordSuccess(): void {
    const wasOpen = this.circuitOpenUntil > 0
    this.failures = 0
    this.circuitOpenUntil = 0

    if (wasOpen && this.options.onStateChange) {
      this.options.onStateChange('closed', { previousFailures: this.failures })
    }
  }

  recordFailure(): void {
    this.failures++

    if (this.failures >= (this.options.maxFailures || 5)) {
      const wasOpen = this.circuitOpenUntil > Date.now()
      this.circuitOpenUntil = Date.now() + (this.options.resetTimeout || 60000)

      if (!wasOpen && this.options.onStateChange) {
        this.options.onStateChange('open', {
          failures: this.failures,
          openUntil: new Date(this.circuitOpenUntil),
          resetTimeout: this.options.resetTimeout || 60000,
        })
      }
    }
  }

  updateRateLimit(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit')
    const remaining = headers.get('X-RateLimit-Remaining')
    const resetMs = headers.get('X-RateLimit-ResetMs') // Typesense uses milliseconds
    const retryAfter = headers.get('Retry-After')

    this.rateLimitInfo = {
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      remaining: remaining ? Number.parseInt(remaining, 10) : undefined,
      resetMs: resetMs ? Number.parseInt(resetMs, 10) : undefined,
      retryAfter: retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
    }

    // Set retry-after period if present
    if (retryAfter) {
      this.retryAfterUntil = Date.now() + Number.parseInt(retryAfter, 10) * 1000
    }

    // Notify about rate limit updates
    if (this.rateLimitInfo && this.options.onRateLimitUpdate) {
      this.options.onRateLimitUpdate(this.rateLimitInfo)
    }
  }

  getRateLimit(): TypesenseRateLimitInfo | null {
    return this.rateLimitInfo
  }

  getTimeUntilReset(): number | undefined {
    if (!this.rateLimitInfo?.resetMs) {
      return undefined
    }

    const timeUntilReset = this.rateLimitInfo.resetMs - Date.now()
    return Math.max(0, timeUntilReset)
  }

  isRateLimited(): boolean {
    if (!this.rateLimitInfo) {
      return false
    }

    return (
      this.rateLimitInfo.remaining === 0 || this.retryAfterUntil > Date.now()
    )
  }

  reset(): void {
    this.failures = 0
    this.circuitOpenUntil = 0
    this.retryAfterUntil = 0
  }

  getStatus(): {
    failures: number
    circuitOpen: boolean
    circuitOpenUntil: number
    rateLimited: boolean
    retryAfterUntil: number
    rateLimit: TypesenseRateLimitInfo | null
  } {
    return {
      failures: this.failures,
      circuitOpen: this.isCircuitOpen(),
      circuitOpenUntil: this.circuitOpenUntil,
      rateLimited: this.isRateLimited(),
      retryAfterUntil: this.retryAfterUntil,
      rateLimit: this.rateLimitInfo,
    }
  }
}
