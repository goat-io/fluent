/**
 * OpenCode Configuration Loader
 *
 * This utility finds and loads OpenCode configuration from various locations:
 * - Environment variable OPENCODE_CONFIG_PATH
 * - ~/.opencode/config.json
 * - ~/.opencode/opencode.json
 * - ./.opencode/opencode.json (project-local)
 * - Environment variables (OPENAI_API_KEY, etc.)
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import pino from 'pino'

const logger = (pino as any)({
  name: 'opencode-config',
  level: process.env.LOG_LEVEL || 'info'
})

export interface OpenCodeConfig {
  model?: string
  small_model?: string
  api_keys?: Record<string, string>
  endpoints?: Record<string, string>
  max_tokens?: number
  temperature?: number
  telemetry?: {
    enabled?: boolean
    endpoint?: string
  }
  mcp?: Record<string, any>
}

/**
 * Common OpenCode configuration file locations
 */
export const CONFIG_LOCATIONS = [
  // Environment variable override
  () => process.env.OPENCODE_CONFIG_PATH,

  // OpenCode auth file (for credentials)
  () => join(homedir(), '.local', 'share', 'opencode', 'auth.json'),

  // User home directory locations
  () => join(homedir(), '.opencode', 'config.json'),
  () => join(homedir(), '.opencode', 'opencode.json'),

  // Project-local locations
  () => join(process.cwd(), '.opencode', 'opencode.json'),
  () => join(process.cwd(), '.opencode', 'config.json')
]

/**
 * Load and parse a JSON configuration file
 */
function loadJsonConfig(filepath: string): OpenCodeConfig | null {
  try {
    if (!existsSync(filepath)) {
      return null
    }

    const content = readFileSync(filepath, 'utf-8')

    // Replace environment variable placeholders
    const expandedContent = content.replace(
      /\$\{([^}]+)\}/g,
      (match, envVar) => process.env[envVar] || match
    )

    const parsed = JSON.parse(expandedContent)

    // Check if this is an auth.json file from OpenCode
    if (filepath.endsWith('auth.json') && !parsed.model && !parsed.api_keys) {
      // Convert auth.json format to our config format
      const config: OpenCodeConfig = {
        api_keys: {}
      }

      // Extract API keys from auth.json
      if (parsed.anthropic) {
        // For OAuth, use the access token
        if (parsed.anthropic.type === 'oauth' && parsed.anthropic.access) {
          config.api_keys!.anthropic = parsed.anthropic.access
        } else if (parsed.anthropic.type === 'api' && parsed.anthropic.key) {
          config.api_keys!.anthropic = parsed.anthropic.key
        }
      }

      if (parsed.openai?.key) {
        config.api_keys!.openai = parsed.openai.key
      }

      if (parsed.openrouter?.key) {
        config.api_keys!.openrouter = parsed.openrouter.key
      }

      if (parsed.google?.key) {
        config.api_keys!.google = parsed.google.key
      }

      logger.debug(
        { filepath, providers: Object.keys(config.api_keys!) },
        'Successfully loaded OpenCode auth.json'
      )
      return config
    }

    logger.debug({ filepath }, 'Successfully loaded OpenCode config')
    return parsed
  } catch (error) {
    logger.warn(
      { filepath, error: error.message },
      'Failed to load config file'
    )
    return null
  }
}

/**
 * Get API keys from environment variables as fallback
 */
function getEnvironmentApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {}

  if (process.env.OPENAI_API_KEY) {
    keys.openai = process.env.OPENAI_API_KEY
  }

  if (process.env.ANTHROPIC_API_KEY) {
    keys.anthropic = process.env.ANTHROPIC_API_KEY
  }

  if (process.env.GOOGLE_API_KEY) {
    keys.google = process.env.GOOGLE_API_KEY
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    keys.google = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  }

  return keys
}

/**
 * Get model configuration from environment variables
 */
function getEnvironmentModelConfig(): Partial<OpenCodeConfig> {
  const config: Partial<OpenCodeConfig> = {}

  if (process.env.OPENCODE_MODEL) {
    config.model = process.env.OPENCODE_MODEL
  }

  if (process.env.OPENCODE_SMALL_MODEL) {
    config.small_model = process.env.OPENCODE_SMALL_MODEL
  }

  if (process.env.OPENCODE_MAX_TOKENS) {
    config.max_tokens = Number.parseInt(process.env.OPENCODE_MAX_TOKENS, 10)
  }

  if (process.env.OPENCODE_TEMPERATURE) {
    config.temperature = Number.parseFloat(process.env.OPENCODE_TEMPERATURE)
  }

  return config
}

/**
 * Find and load OpenCode configuration from all available sources
 */
export function loadOpenCodeConfig(): OpenCodeConfig {
  logger.info('Loading OpenCode configuration...')

  let config: OpenCodeConfig = {}
  let configSource = 'defaults'

  // Try to load from configuration files
  for (const getLocation of CONFIG_LOCATIONS) {
    const location = getLocation()
    if (!location) {
      continue
    }

    const fileConfig = loadJsonConfig(location)
    if (fileConfig) {
      config = { ...config, ...fileConfig }
      configSource = location
      logger.info({ source: configSource }, 'Found OpenCode configuration file')
      break
    }
  }

  // Merge with environment variables
  const envApiKeys = getEnvironmentApiKeys()
  const envModelConfig = getEnvironmentModelConfig()

  if (Object.keys(envApiKeys).length > 0) {
    config.api_keys = { ...config.api_keys, ...envApiKeys }
    logger.info(
      { keys: Object.keys(envApiKeys) },
      'Found API keys in environment'
    )
  }

  if (Object.keys(envModelConfig).length > 0) {
    config = { ...config, ...envModelConfig }
    logger.info('Found model configuration in environment')
  }

  // Apply defaults
  config = {
    model: 'openai/gpt-4o-mini',
    small_model: 'openai/gpt-3.5-turbo',
    max_tokens: 2000,
    temperature: 0.7,
    endpoints: {
      ollama: 'http://localhost:11434/v1'
    },
    ...config
  }

  // Validate that we have at least one API key or Ollama endpoint
  const hasApiKeys = config.api_keys && Object.keys(config.api_keys).length > 0
  const hasValidApiKeys =
    hasApiKeys &&
    Object.values(config.api_keys).some(
      key => key && key.trim() !== '' && !key.startsWith('${')
    )

  if (!hasValidApiKeys && !config.model?.startsWith('ollama/')) {
    logger.warn(
      'No valid API keys found and not using Ollama. You may need to set environment variables or create a config file.'
    )
  }

  logger.info(
    {
      source: configSource,
      model: config.model,
      small_model: config.small_model,
      hasApiKeys: hasValidApiKeys,
      availableProviders: hasApiKeys ? Object.keys(config.api_keys) : []
    },
    'OpenCode configuration loaded'
  )

  return config
}

/**
 * Validate that the configuration has the necessary credentials for the specified model
 */
export function validateConfigForModel(
  config: OpenCodeConfig,
  model: string
): boolean {
  const [provider] = model.split('/')

  // Ollama doesn't need API keys
  if (provider === 'ollama') {
    return true
  }

  // Check if we have API key for the provider
  if (!config.api_keys || !config.api_keys[provider]) {
    return false
  }

  const apiKey = config.api_keys[provider]
  return apiKey && apiKey.trim() !== '' && !apiKey.startsWith('${')
}

/**
 * Get available models based on configuration
 */
export function getAvailableModels(config: OpenCodeConfig): string[] {
  const models: string[] = []

  if (config.api_keys) {
    for (const provider of Object.keys(config.api_keys)) {
      const apiKey = config.api_keys[provider]
      if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('${')) {
        switch (provider) {
          case 'openai':
            models.push(
              'openai/gpt-4o',
              'openai/gpt-4o-mini',
              'openai/gpt-3.5-turbo'
            )
            break
          case 'anthropic':
            models.push(
              'anthropic/claude-3-5-sonnet-20241022',
              'anthropic/claude-3-sonnet',
              'anthropic/claude-3-haiku'
            )
            break
          case 'google':
            models.push('google/gemini-1.5-pro', 'google/gemini-1.5-flash')
            break
        }
      }
    }
  }

  // Ollama is always available (assumes local installation)
  models.push(
    'ollama/llama3',
    'ollama/llama3.1',
    'ollama/llama2',
    'ollama/codellama'
  )

  return models
}

/**
 * Create a summary of the configuration for display
 */
export function getConfigSummary(config: OpenCodeConfig): string {
  const lines: string[] = []

  lines.push(`Model: ${config.model || 'not set'}`)
  if (config.small_model) {
    lines.push(`Small Model: ${config.small_model}`)
  }

  if (config.api_keys) {
    const validKeys = Object.entries(config.api_keys)
      .filter(([_, key]) => key && key.trim() !== '' && !key.startsWith('${'))
      .map(([provider, key]) => `${provider} (${key.slice(0, 8)}...)`)

    if (validKeys.length > 0) {
      lines.push(`API Keys: ${validKeys.join(', ')}`)
    }
  }

  const availableModels = getAvailableModels(config)
  if (availableModels.length > 0) {
    lines.push(
      `Available Models: ${availableModels.slice(0, 3).join(', ')}${availableModels.length > 3 ? ` (+${availableModels.length - 3} more)` : ''}`
    )
  }

  return lines.join('\n')
}
