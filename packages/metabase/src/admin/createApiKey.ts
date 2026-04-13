import { metabaseFetch } from '../common/fetch-wrapper'

export interface ApiKeyResponse {
  created_at: string
  updated_at: string
  id: number
  group: { name: string; id: number }
  unmasked_key: string
  name: string
  masked_key: string
}

/**
 * Creates an API key for programmatic access to Metabase
 * @param params - API key configuration and authentication
 * @returns API key response with unmasked key (only shown once)
 * @throws Error if API key creation fails
 *
 * @example
 * const apiKey = await createApiKey({
 *   baseUrl: 'http://localhost:3000',
 *   sessionToken: 'mb-session-token',
 *   keyName: 'My Integration Key',
 *   groupId: 1 // Admin group
 * })
 * console.log('Save this key:', apiKey.unmasked_key)
 */
export async function createApiKey({
  baseUrl,
  sessionToken,
  apiKey,
  keyName = 'Auto-generated API Key',
  groupId = 1,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  keyName?: string
  groupId?: number | null
}): Promise<ApiKeyResponse> {
  // Generate a 6-letter random ID (uppercase letters)
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase()
  const finalKeyName = `${keyName} ${randomId}`

  const response = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/api-key',
    method: 'POST',
    body: {
      name: finalKeyName,
      group_id: groupId,
    },
  })

  return (await response.json()) as ApiKeyResponse
}
