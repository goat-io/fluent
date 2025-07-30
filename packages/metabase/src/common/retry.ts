import { setTimeout } from 'node:timers/promises'

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoffMultiplier?: number
  maxDelayMs?: number
  onRetry?: (error: Error, attempt: number) => void
}

/**
 * Executes a function with exponential backoff retry logic
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
    onRetry
  } = options

  let lastError: Error | undefined
  let currentDelay = delayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts) {
        throw lastError
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt)
      }

      // Wait before next attempt
      await setTimeout(currentDelay)

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs)
    }
  }

  throw lastError || new Error('Retry failed with unknown error')
}

/**
 * Checks if an error is retryable based on common patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  // Network errors
  if (error.name === 'NetworkError' || error.message.includes('fetch failed')) {
    return true
  }

  // Timeout errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return true
  }

  // Server errors (5xx)
  if (
    error.message.includes('500') ||
    error.message.includes('502') ||
    error.message.includes('503') ||
    error.message.includes('504')
  ) {
    return true
  }

  // Rate limiting
  if (error.message.includes('429') || error.message.includes('rate limit')) {
    return true
  }

  return false
}
