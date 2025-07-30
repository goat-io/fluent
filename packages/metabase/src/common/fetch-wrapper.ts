/**
 * Custom error class for Metabase API errors with enhanced debugging info
 */
export class MetabaseApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public responseBody?: string,
    public endpoint?: string
  ) {
    super(message)
    this.name = 'MetabaseApiError'
  }
}

/**
 * Common fetch configuration for Metabase API requests
 */
export interface MetabaseFetchOptions {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

/**
 * Centralized fetch wrapper for consistent error handling and authentication
 * @param options - Configuration for the API request
 * @returns Fetch response object
 * @throws MetabaseApiError for non-ok responses
 */
export async function metabaseFetch({
  baseUrl,
  sessionToken,
  apiKey,
  endpoint,
  method = 'GET',
  body,
  headers = {},
  timeout = 30000
}: MetabaseFetchOptions): Promise<Response> {
  // Build authentication headers
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  }

  // Prefer API key over session token for better reliability
  if (apiKey) {
    authHeaders['X-Api-Key'] = apiKey
  } else if (sessionToken) {
    authHeaders['X-Metabase-Session'] = sessionToken
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: authHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // For successful responses, return as-is
    if (response.ok) {
      return response
    }

    // For error responses, gather debug information
    let responseBody = ''
    try {
      responseBody = await response.text()
    } catch {
      responseBody = 'Unable to parse response body'
    }

    throw new MetabaseApiError(
      `Metabase API error: ${method} ${endpoint} returned ${response.status}`,
      response.status,
      response.statusText,
      responseBody,
      endpoint
    )
  } catch (error) {
    clearTimeout(timeoutId)

    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MetabaseApiError(
        `Request timeout after ${timeout}ms: ${method} ${endpoint}`,
        undefined,
        undefined,
        undefined,
        endpoint
      )
    }

    // Re-throw MetabaseApiError as-is
    if (error instanceof MetabaseApiError) {
      throw error
    }

    // Wrap other errors
    throw new MetabaseApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      undefined,
      endpoint
    )
  }
}

/**
 * Type guard to check if a value is a valid Metabase response
 */
export function isMetabaseResponse<T>(value: unknown): value is T {
  return value !== null && typeof value === 'object'
}
