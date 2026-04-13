import { setTimeout } from 'node:timers/promises'

/**
 * Waits for Metabase instance to be ready by polling the session properties endpoint
 * @param baseUrl - The base URL of the Metabase instance
 * @param options - Configuration options for retry behavior
 * @throws Error if Metabase doesn't start within the timeout period
 */
export async function waitForMetabase(
  baseUrl: string,
  options: {
    maxRetries?: number
    retryDelayMs?: number
    timeoutMs?: number
  } = {},
) {
  const {
    maxRetries = 60, // 5 minutes with default retry delay
    retryDelayMs = 5000,
    timeoutMs = maxRetries * retryDelayMs,
  } = options

  const startTime = Date.now()
  let attempts = 0

  while (attempts < maxRetries) {
    try {
      // Add timeout to individual requests to prevent hanging
      const controller = new AbortController()
      const requestTimeout = global.setTimeout(() => controller.abort(), 10000)

      const res = await fetch(`${baseUrl}/api/session/properties`, {
        method: 'GET',
        signal: controller.signal,
      })

      global.clearTimeout(requestTimeout)

      if (res.ok) {
        return
      }
    } catch (_error) {
      // Continue retrying silently
    }

    attempts++

    // Check if we've exceeded the timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Metabase failed to start within ${timeoutMs / 1000} seconds at ${baseUrl}`,
      )
    }

    await setTimeout(retryDelayMs)
  }

  throw new Error(`Metabase failed to start after ${maxRetries} attempts`)
}
