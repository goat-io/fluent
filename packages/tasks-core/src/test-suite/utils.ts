import type { TaskStatus, TaskStatusName } from '../ShouldQueue.types.js'

/**
 * Delays execution for the specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Waits for a task to reach a specific status or one of multiple statuses.
 * Returns the final status when reached, or throws on timeout.
 */
export async function waitForTaskStatus(
  getStatus: () => Promise<TaskStatus>,
  targetStatuses: TaskStatusName | TaskStatusName[],
  options: {
    timeout?: number
    interval?: number
  } = {}
): Promise<TaskStatus> {
  const { timeout = 10000, interval = 500 } = options
  const statuses = Array.isArray(targetStatuses)
    ? targetStatuses
    : [targetStatuses]
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const status = await getStatus()

    if (statuses.includes(status.status)) {
      return status
    }

    await delay(interval)
  }

  throw new Error(
    `Timeout waiting for task status. Expected one of: ${statuses.join(', ')}. ` +
      `Timeout: ${timeout}ms`
  )
}

/**
 * Waits for a task to complete (reach COMPLETED or FAILED status).
 */
export async function waitForTaskCompletion(
  getStatus: () => Promise<TaskStatus>,
  options: {
    timeout?: number
    interval?: number
  } = {}
): Promise<TaskStatus> {
  return waitForTaskStatus(getStatus, ['COMPLETED', 'FAILED'], options)
}

/**
 * Generates a unique task identifier for testing.
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Creates a test payload with the given text.
 */
export function createTestPayload(text: string): { text: string } {
  return { text }
}

/**
 * Asserts that a value is defined (not null or undefined).
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
}

/**
 * Retry a function until it succeeds or reaches max attempts.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    onError?: (error: Error, attempt: number) => void
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay: retryDelay = 1000, onError } = options
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (onError) {
        onError(lastError, attempt)
      }
      if (attempt < maxAttempts) {
        await delay(retryDelay)
      }
    }
  }

  throw lastError
}
