/**
 * OAuth-aware LLM Adapter
 * Handles both API keys and OAuth tokens for Anthropic
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export interface OAuthConfig {
  type: 'oauth' | 'api'
  access?: string
  refresh?: string
  key?: string
  expires?: number
}

/**
 * Check if a token is an OAuth access token
 */
export function isOAuthToken(token: string): boolean {
  // OAuth tokens from OpenCode start with sk-ant-oat (OAuth Access Token)
  // or sk-ant-ort (OAuth Refresh Token)
  return token.startsWith('sk-ant-oat') || token.startsWith('sk-ant-ort')
}

/**
 * Create an Anthropic client that works with both API keys and OAuth tokens
 */
export function createOAuthAwareAnthropic(
  token: string,
): ReturnType<typeof createAnthropic> {
  if (isOAuthToken(token)) {
    // OAuth tokens need to be run through OpenCode's runtime
    // They cannot be used directly with the Anthropic API
    console.warn(
      '[OAuth Adapter] OAuth tokens detected. These tokens only work when running through OpenCode:\n' +
        '  opencode run "your-command-here"',
    )

    // Still try to use them as Bearer tokens in case the API changes
    const customFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers)

      // Replace the x-api-key header with Authorization Bearer
      if (headers.has('x-api-key')) {
        headers.delete('x-api-key')
        headers.set('Authorization', `Bearer ${token}`)
      }

      return fetch(input, {
        ...init,
        headers,
      })
    }

    return createAnthropic({
      apiKey: 'oauth-placeholder',
      fetch: customFetch,
    })
  }
  // Regular API key
  return createAnthropic({
    apiKey: token,
  })
}

/**
 * Load OAuth configuration from OpenCode auth.json
 */
export function loadOAuthConfig(authJson: any): Map<string, OAuthConfig> {
  const configs = new Map<string, OAuthConfig>()

  for (const [provider, config] of Object.entries(authJson)) {
    if (typeof config === 'object' && config !== null) {
      const authConfig = config as any

      if (authConfig.type === 'oauth') {
        configs.set(provider, {
          type: 'oauth',
          access: authConfig.access,
          refresh: authConfig.refresh,
          expires: authConfig.expires,
        })
      } else if (authConfig.type === 'api') {
        configs.set(provider, {
          type: 'api',
          key: authConfig.key,
        })
      }
    }
  }

  return configs
}

/**
 * Get the appropriate token from OAuth config
 */
export function getTokenFromOAuthConfig(
  config: OAuthConfig,
): string | undefined {
  if (config.type === 'oauth') {
    // Check if token is expired
    if (config.expires && Date.now() > config.expires) {
      console.warn('[OAuth Adapter] Access token expired, refresh needed')
      // In a full implementation, we'd refresh the token here
      // For now, we'll try to use it anyway
    }
    return config.access
  }
  if (config.type === 'api') {
    return config.key
  }
  return undefined
}

/**
 * Create a provider that handles OAuth tokens
 */
export function createOAuthProvider(provider: string, token: string): any {
  switch (provider) {
    case 'anthropic':
      return createOAuthAwareAnthropic(token)

    case 'openai':
      // OpenAI uses regular API keys
      return createOpenAI({ apiKey: token })

    default:
      throw new Error(`Provider ${provider} not supported for OAuth`)
  }
}
