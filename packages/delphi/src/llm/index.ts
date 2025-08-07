/**
 * LLM Adapter for OpenCode integration
 * Uses Vercel AI SDK to provide unified interface to any configured model
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { z } from 'zod'
import { isRetryableError, RetryableClient } from '../utils/retry.js'
import { setSpanAttribute, traceAsync } from '../utils/tracing.js'

// Configuration schema
const OpenCodeConfigSchema = z.object({
  model: z.string(),
  small_model: z.string().optional(),
  api_keys: z.record(z.string()).optional(),
  endpoints: z.record(z.string()).optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>

// Message format
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Chat options
export interface ChatOptions {
  messages: Message[]
  useSmall?: boolean
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

// Chat response
export interface ChatResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * LLM Adapter class
 */
export class LLMAdapter {
  private config: OpenCodeConfig
  private providers: Map<string, any> = new Map()
  private retryClient: RetryableClient

  constructor(config?: Partial<OpenCodeConfig>) {
    // Load config from environment or use provided
    this.config = this.loadConfig(config)
    this.initializeProviders()

    // Setup retry client
    this.retryClient = new RetryableClient(
      null,
      {
        maxAttempts: 4,
        initialDelayMs: 2000,
        maxDelayMs: 16000,
        shouldRetry: error => {
          // Retry on rate limits and server errors
          if (isRetryableError(error)) {
            return true
          }
          if (error?.status === 429) {
            return true
          }
          return false
        }
      },
      {
        failureThreshold: 6,
        resetTimeoutMs: 60000
      }
    )
  }

  /**
   * Load configuration from environment or defaults
   */
  private loadConfig(override?: Partial<OpenCodeConfig>): OpenCodeConfig {
    // Try to load from OPENCODE_RUNTIME_CFG environment variable
    let envConfig: Partial<OpenCodeConfig> = {}

    if (process.env.OPENCODE_RUNTIME_CFG) {
      try {
        envConfig = JSON.parse(process.env.OPENCODE_RUNTIME_CFG)
      } catch (error) {
        console.warn('Failed to parse OPENCODE_RUNTIME_CFG:', error)
      }
    }

    // Merge configurations: override > env > defaults
    const config = {
      model:
        override?.model ||
        envConfig.model ||
        process.env.OPENCODE_MODEL ||
        'openai/gpt-4o-mini',
      small_model:
        override?.small_model ||
        envConfig.small_model ||
        process.env.OPENCODE_SMALL_MODEL,
      api_keys: {
        ...envConfig.api_keys,
        ...override?.api_keys
      },
      endpoints: {
        ...envConfig.endpoints,
        ...override?.endpoints
      },
      max_tokens: override?.max_tokens || envConfig.max_tokens || 2000,
      temperature: override?.temperature || envConfig.temperature || 0.7
    }

    return OpenCodeConfigSchema.parse(config)
  }

  /**
   * Initialize model providers based on configuration
   */
  private initializeProviders() {
    // OpenAI provider
    if (this.config.api_keys?.openai || process.env.OPENAI_API_KEY) {
      this.providers.set(
        'openai',
        createOpenAI({
          apiKey: this.config.api_keys?.openai || process.env.OPENAI_API_KEY,
          baseURL: this.config.endpoints?.openai
        })
      )
    }

    // Anthropic provider
    if (this.config.api_keys?.anthropic || process.env.ANTHROPIC_API_KEY) {
      this.providers.set(
        'anthropic',
        createAnthropic({
          apiKey:
            this.config.api_keys?.anthropic || process.env.ANTHROPIC_API_KEY,
          baseURL: this.config.endpoints?.anthropic
        })
      )
    }

    // Google provider
    if (this.config.api_keys?.google || process.env.GOOGLE_API_KEY) {
      this.providers.set(
        'google',
        createGoogleGenerativeAI({
          apiKey: this.config.api_keys?.google || process.env.GOOGLE_API_KEY,
          baseURL: this.config.endpoints?.google
        })
      )
    }

    // Ollama provider (local) - use OpenAI-compatible API
    this.providers.set(
      'ollama',
      createOpenAI({
        baseURL: this.config.endpoints?.ollama || 'http://localhost:11434/v1',
        apiKey: 'ollama' // Ollama doesn't need a real key
      })
    )
  }

  /**
   * Get provider and model from model string
   */
  private parseModel(modelString: string): { provider: string; model: string } {
    const parts = modelString.split('/')
    if (parts.length === 2) {
      return { provider: parts[0], model: parts[1] }
    }
    // Default to OpenAI if no provider specified
    return { provider: 'openai', model: modelString }
  }

  /**
   * Get the appropriate model based on options
   */
  private selectModel(useSmall?: boolean): string {
    if (useSmall && this.config.small_model) {
      return this.config.small_model
    }
    return this.config.model
  }

  /**
   * Main chat method
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    return traceAsync('llm.chat', async _span => {
      const modelString = this.selectModel(options.useSmall)
      const { provider: providerName, model: modelName } =
        this.parseModel(modelString)

      // Set span attributes
      setSpanAttribute('llm.provider', providerName)
      setSpanAttribute('llm.model', modelName)
      setSpanAttribute('llm.use_small', options.useSmall || false)
      setSpanAttribute('llm.message_count', options.messages.length)

      const provider = this.providers.get(providerName)
      if (!provider) {
        throw new Error(`Provider ${providerName} not configured`)
      }

      // Execute with retry
      return this.retryClient.request(async () => {
        const startTime = Date.now()

        if (options.stream) {
          // Streaming response
          const { textStream, usage } = await streamText({
            model: provider(modelName),
            messages: options.messages,
            maxTokens: options.maxTokens || this.config.max_tokens,
            temperature: options.temperature || this.config.temperature
          })

          let content = ''
          for await (const chunk of textStream) {
            content += chunk
          }

          const duration = Date.now() - startTime
          setSpanAttribute('llm.duration_ms', duration)
          setSpanAttribute('llm.tokens.prompt', (await usage)?.promptTokens)
          setSpanAttribute(
            'llm.tokens.completion',
            (await usage)?.completionTokens
          )

          return {
            content,
            model: modelString,
            usage: (await usage)
              ? {
                  promptTokens: (await usage).promptTokens,
                  completionTokens: (await usage).completionTokens,
                  totalTokens: (await usage).totalTokens
                }
              : undefined
          }
        }
        // Non-streaming response
        const { text, usage } = await generateText({
          model: provider(modelName),
          messages: options.messages,
          maxTokens: options.maxTokens || this.config.max_tokens,
          temperature: options.temperature || this.config.temperature
        })

        const duration = Date.now() - startTime
        setSpanAttribute('llm.duration_ms', duration)
        setSpanAttribute('llm.tokens.prompt', usage.promptTokens)
        setSpanAttribute('llm.tokens.completion', usage.completionTokens)

        return {
          content: text,
          model: modelString,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens
          }
        }
      })
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenCodeConfig {
    return this.config
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<OpenCodeConfig>) {
    this.config = { ...this.config, ...config }
    this.initializeProviders()
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState() {
    return this.retryClient.getCircuitState()
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit() {
    this.retryClient.resetCircuit()
  }
}

// Singleton instance
let adapter: LLMAdapter | null = null

/**
 * Get or create LLM adapter instance
 */
export function getLLMAdapter(config?: Partial<OpenCodeConfig>): LLMAdapter {
  if (!adapter) {
    adapter = new LLMAdapter(config)
  } else if (config) {
    adapter.updateConfig(config)
  }
  return adapter
}

/**
 * Simple chat function for convenience
 */
export async function chat(options: ChatOptions): Promise<string> {
  const adapter = getLLMAdapter()
  const response = await adapter.chat(options)
  return response.content
}
