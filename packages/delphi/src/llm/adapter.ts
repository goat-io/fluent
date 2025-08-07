/**
 * LLM Adapter for unified access to multiple LLM providers
 */

import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createOllama } from 'ollama-ai-provider'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  messages: ChatMessage[]
  useSmall?: boolean
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class LLMAdapter {
  private config: any
  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(config?: any) {
    this.config = config || JSON.parse(process.env.OPENCODE_RUNTIME_CFG || '{}')
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    if (this.circuitState === 'OPEN') {
      throw new Error('Circuit breaker is OPEN')
    }

    const modelString = options.useSmall
      ? this.config.small_model || this.config.model
      : this.config.model

    if (!modelString) {
      throw new Error('No model configured')
    }

    const [provider, modelName] = modelString.split('/')

    let model: any
    switch (provider) {
      case 'openai':
        model = openai(modelName)
        break
      case 'anthropic':
        model = anthropic(modelName)
        break
      case 'google':
        model = google(modelName)
        break
      case 'ollama': {
        const ollama = createOllama({ baseURL: 'http://localhost:11434' })
        model = ollama(modelName)
        break
      }
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }

    try {
      const result = await generateText({
        model,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      })

      return {
        content: result.text,
        model: modelString,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens
            }
          : undefined
      }
    } catch (error: any) {
      // Check if retryable
      if (error.status === 429 || error.status >= 500) {
        error.retryable = true
      }
      throw error
    }
  }

  getCircuitState() {
    return this.circuitState
  }

  resetCircuit() {
    this.circuitState = 'CLOSED'
  }
}
