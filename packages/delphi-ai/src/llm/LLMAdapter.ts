// npx vitest run src/__tests__/llm/adapter.spec.ts
import { generateText } from 'ai'
import type {
  ChatOptions,
  ChatResponse,
  ModelConfig,
} from './LLMAdapter.types.js'
import { MODEL_PRESETS } from './ModelConfig.js'

export class LLMAdapter {
  /**
   * Send a chat completion request to any supported provider.
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const model = this.resolveModel(options)

    const result = await generateText({
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    })

    return {
      content: result.text,
      model: `${options.provider}/${options.model}`,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }
  }

  /**
   * Resolve a preset name to ChatOptions.
   */
  chatFromPreset(
    presetName: string,
    messages: ChatOptions['messages'],
    overrides?: Partial<ChatOptions>,
  ): Promise<ChatResponse> {
    const preset = MODEL_PRESETS[presetName]
    if (!preset) {
      throw new Error(`Unknown model preset: "${presetName}"`)
    }
    return this.chat({
      provider: preset.provider,
      model: preset.model,
      messages,
      temperature: overrides?.temperature ?? preset.temperature,
      maxTokens: overrides?.maxTokens ?? preset.maxTokens,
      apiKey: overrides?.apiKey ?? preset.apiKey,
      baseUrl: overrides?.baseUrl ?? preset.baseUrl,
    })
  }

  /**
   * Resolve a ModelConfig to ChatOptions.
   */
  chatFromConfig(
    config: ModelConfig,
    messages: ChatOptions['messages'],
  ): Promise<ChatResponse> {
    return this.chat({
      provider: config.provider,
      model: config.model,
      messages,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    })
  }

  private resolveModel(options: ChatOptions): any {
    const _cacheKey = `${options.provider}:${options.apiKey ?? 'default'}:${options.baseUrl ?? 'default'}`

    switch (options.provider) {
      case 'openai': {
        const { createOpenAI } = require('@ai-sdk/openai')
        const provider = createOpenAI({
          apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
          ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
        })
        return provider(options.model)
      }
      case 'anthropic': {
        const { createAnthropic } = require('@ai-sdk/anthropic')
        const provider = createAnthropic({
          apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY,
        })
        return provider(options.model)
      }
      case 'google': {
        const { createGoogleGenerativeAI } = require('@ai-sdk/google')
        const provider = createGoogleGenerativeAI({
          apiKey: options.apiKey ?? process.env.GOOGLE_API_KEY,
        })
        return provider(options.model)
      }
      case 'ollama': {
        const { createOllama } = require('ollama-ai-provider')
        const provider = createOllama({
          baseURL: options.baseUrl ?? 'http://localhost:11434',
        })
        return provider(options.model)
      }
      case 'custom': {
        // Custom provider uses OpenAI-compatible API
        const { createOpenAI } = require('@ai-sdk/openai')
        const provider = createOpenAI({
          apiKey: options.apiKey ?? '',
          baseURL: options.baseUrl,
        })
        return provider(options.model)
      }
      default:
        throw new Error(`Unknown provider: "${options.provider}"`)
    }
  }
}
