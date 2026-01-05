/**
 * Model Configuration System
 * Flexible mapping of AI models to agent roles
 */

import { z } from 'zod'

/**
 * Supported AI model providers and their models
 */
export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'cohere',
  'meta',
  'mistral',
  'custom',
])

export type ModelProvider = z.infer<typeof ModelProviderSchema>

/**
 * Model configuration for a specific provider
 */
export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
})

export type ModelConfig = z.infer<typeof ModelConfigSchema>

/**
 * Predefined model configurations
 */
export const MODEL_PRESETS: Record<string, ModelConfig> = {
  // OpenAI Models
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2048,
  },
  o3: {
    provider: 'openai',
    model: 'o3',
    temperature: 0.8,
    maxTokens: 8192,
  },
  'o3-mini': {
    provider: 'openai',
    model: 'o3-mini',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Anthropic Models
  'claude-opus-4.1': {
    provider: 'anthropic',
    model: 'claude-opus-4-1-20250805',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Google Models
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'gemini-ultra': {
    provider: 'google',
    model: 'gemini-ultra',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 8192,
  },

  // Cohere Models
  'command-r': {
    provider: 'cohere',
    model: 'command-r',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'command-r-plus': {
    provider: 'cohere',
    model: 'command-r-plus',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Meta Models
  'llama-3': {
    provider: 'meta',
    model: 'llama-3-70b',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Mistral Models
  'mistral-large': {
    provider: 'mistral',
    model: 'mistral-large-latest',
    temperature: 0.7,
    maxTokens: 4096,
  },
  mixtral: {
    provider: 'mistral',
    model: 'open-mixtral-8x22b',
    temperature: 0.7,
    maxTokens: 4096,
  },
}

/**
 * Role-based model mapping configuration
 */
export const RoleModelMappingSchema = z.object({
  proposer: z.union([z.string(), ModelConfigSchema]),
  reviewer: z.union([
    z.string(),
    ModelConfigSchema,
    z.array(z.union([z.string(), ModelConfigSchema])),
  ]),
  arbiter: z.union([z.string(), ModelConfigSchema]).optional(),
})

export type RoleModelMapping = z.infer<typeof RoleModelMappingSchema>

/**
 * Default role-based model recommendations
 */
export const DEFAULT_ROLE_MODELS: RoleModelMapping = {
  proposer: 'claude-opus-4.1', // Claude for creative proposal generation
  reviewer: ['gpt-4o', 'gemini-pro'], // Multiple reviewers with different models
  arbiter: 'o3', // O3 for final arbitration
}

/**
 * Strategy-specific model mappings
 */
export const STRATEGY_MODEL_MAPPINGS: Record<string, RoleModelMapping> = {
  'code-review': {
    proposer: 'claude-3-sonnet', // Fast, good for code understanding
    reviewer: [
      'gpt-4o', // Good at finding bugs
      'claude-opus-4.1', // Good at architecture review
      'gemini-pro', // Good at suggesting improvements
    ],
    arbiter: 'o3', // Best judgment for final decision
  },

  'architecture-decision': {
    proposer: 'claude-opus-4.1', // Best for complex reasoning
    reviewer: [
      'gpt-4o', // Good at system design
      'gemini-ultra', // Good at scalability analysis
      'mistral-large', // Good at technical feasibility
    ],
    arbiter: 'o3', // Best for strategic decisions
  },

  'test-strategy': {
    proposer: 'gpt-4o', // Good at test planning
    reviewer: [
      'claude-3-sonnet', // Good at edge cases
      'gemini-pro', // Good at coverage analysis
    ],
    arbiter: 'claude-opus-4.1', // Good judgment for test priorities
  },

  'api-design': {
    proposer: 'claude-opus-4.1', // Good at API design
    reviewer: [
      'gpt-4o', // Good at REST/GraphQL best practices
      'gemini-pro', // Good at performance considerations
      'command-r-plus', // Good at documentation needs
    ],
    arbiter: 'o3', // Best for final API decisions
  },

  'quick-decision': {
    proposer: 'claude-3-haiku', // Fast and cheap
    reviewer: 'gpt-3.5-turbo', // Fast and cheap
    arbiter: 'gemini-flash', // Fast and cheap
  },

  'creative-brainstorming': {
    proposer: 'claude-opus-4.1', // Most creative
    reviewer: [
      'gpt-4o', // Creative critique
      'gemini-ultra', // Different perspective
      'mixtral', // Alternative ideas
    ],
    arbiter: 'o3', // Best synthesis
  },
}

/**
 * Model selection helper class
 */
export class ModelSelector {
  private customMappings: Map<string, RoleModelMapping> = new Map()

  /**
   * Register a custom model mapping for a strategy
   */
  registerStrategy(name: string, mapping: RoleModelMapping) {
    this.customMappings.set(name, mapping)
  }

  /**
   * Get model mapping for a strategy
   */
  getStrategyModels(strategy: string): RoleModelMapping {
    // Check custom mappings first
    if (this.customMappings.has(strategy)) {
      return this.customMappings.get(strategy)!
    }

    // Check predefined strategies
    if (STRATEGY_MODEL_MAPPINGS[strategy]) {
      return STRATEGY_MODEL_MAPPINGS[strategy]
    }

    // Return default
    return DEFAULT_ROLE_MODELS
  }

  /**
   * Resolve model configuration from preset or custom config
   */
  resolveModelConfig(modelOrConfig: string | ModelConfig): ModelConfig {
    if (typeof modelOrConfig === 'string') {
      const preset = MODEL_PRESETS[modelOrConfig]
      if (!preset) {
        throw new Error(`Unknown model preset: ${modelOrConfig}`)
      }
      return preset
    }
    return modelOrConfig
  }

  /**
   * Create balanced model distribution for multiple reviewers
   */
  distributeModelsForReviewers(
    count: number,
    preferredModels?: (string | ModelConfig)[],
  ): (string | ModelConfig)[] {
    if (preferredModels && preferredModels.length >= count) {
      return preferredModels.slice(0, count)
    }

    // Default distribution strategy
    const defaultModels = [
      'gpt-4o',
      'claude-opus-4.1',
      'gemini-pro',
      'mistral-large',
    ]
    const result: string[] = []

    for (let i = 0; i < count; i++) {
      if (preferredModels?.[i]) {
        result.push(preferredModels[i] as string)
      } else {
        result.push(defaultModels[i % defaultModels.length])
      }
    }

    return result
  }

  /**
   * Get model recommendations based on task characteristics
   */
  recommendModels(taskCharacteristics: {
    complexity: 'low' | 'medium' | 'high'
    speed: 'fast' | 'normal' | 'thorough'
    creativity: 'low' | 'medium' | 'high'
    cost: 'budget' | 'balanced' | 'premium'
  }): RoleModelMapping {
    const { complexity, speed, creativity, cost } = taskCharacteristics

    // Decision matrix for model selection
    if (cost === 'budget') {
      return {
        proposer: 'claude-3-haiku',
        reviewer: ['gpt-3.5-turbo', 'gemini-flash'],
        arbiter: 'mixtral',
      }
    }

    if (complexity === 'high' && creativity === 'high') {
      return {
        proposer: 'claude-opus-4.1',
        reviewer: ['o3', 'gemini-ultra', 'gpt-4o'],
        arbiter: 'o3',
      }
    }

    if (speed === 'fast') {
      return {
        proposer: 'claude-3-sonnet',
        reviewer: ['gemini-flash', 'gpt-3.5-turbo'],
        arbiter: 'gemini-pro',
      }
    }

    // Default balanced approach
    return DEFAULT_ROLE_MODELS
  }
}

// Export singleton instance
export const modelSelector = new ModelSelector()
