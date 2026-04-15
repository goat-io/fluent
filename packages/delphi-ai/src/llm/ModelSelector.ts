// npx vitest run src/__tests__/llm/model-config.spec.ts
import type { ModelConfig } from './LLMAdapter.types.js'
import {
  DEFAULT_ROLE_MODELS,
  MODEL_PRESETS,
  type RoleModelMapping,
  STRATEGY_MODEL_MAPPINGS,
} from './ModelConfig.js'

export class ModelSelector {
  private customMappings = new Map<string, RoleModelMapping>()

  registerStrategy(name: string, mapping: RoleModelMapping): void {
    this.customMappings.set(name, mapping)
  }

  getStrategyModels(strategy: string): RoleModelMapping {
    if (this.customMappings.has(strategy)) {
      return this.customMappings.get(strategy)!
    }
    if (STRATEGY_MODEL_MAPPINGS[strategy]) {
      return STRATEGY_MODEL_MAPPINGS[strategy]
    }
    return DEFAULT_ROLE_MODELS
  }

  resolveModelConfig(modelOrConfig: string | ModelConfig): ModelConfig {
    if (typeof modelOrConfig === 'string') {
      const preset = MODEL_PRESETS[modelOrConfig]
      if (!preset) {
        throw new Error(`Unknown model preset: "${modelOrConfig}"`)
      }
      return { ...preset }
    }
    return modelOrConfig
  }

  resolveModelForRole(
    strategy: string,
    role: 'proposer' | 'reviewer' | 'arbiter',
    reviewerIndex = 0,
  ): ModelConfig {
    const mapping = this.getStrategyModels(strategy)

    let modelOrConfig: string | ModelConfig | undefined

    if (role === 'proposer') {
      modelOrConfig = mapping.proposer
    } else if (role === 'arbiter') {
      modelOrConfig = mapping.arbiter ?? mapping.proposer
    } else {
      const reviewerModels = Array.isArray(mapping.reviewer)
        ? mapping.reviewer
        : [mapping.reviewer]
      modelOrConfig = reviewerModels[reviewerIndex % reviewerModels.length]
    }

    return this.resolveModelConfig(modelOrConfig)
  }

  recommendModels(characteristics: {
    complexity: 'low' | 'medium' | 'high'
    speed: 'fast' | 'normal' | 'thorough'
    cost: 'budget' | 'balanced' | 'premium'
  }): RoleModelMapping {
    const { complexity, speed, cost } = characteristics

    if (cost === 'budget') {
      return {
        proposer: 'claude-haiku',
        reviewer: ['gpt-4o-mini', 'gemini-flash'],
        arbiter: 'gemini-flash',
      }
    }

    if (complexity === 'high') {
      return {
        proposer: 'claude-opus',
        reviewer: ['gpt-4o', 'gemini-pro', 'claude-sonnet'],
        arbiter: 'claude-opus',
      }
    }

    if (speed === 'fast') {
      return {
        proposer: 'claude-sonnet',
        reviewer: ['gemini-flash', 'gpt-4o-mini'],
        arbiter: 'gemini-pro',
      }
    }

    return DEFAULT_ROLE_MODELS
  }

  listPresets(): string[] {
    return Object.keys(MODEL_PRESETS)
  }

  listStrategies(): string[] {
    return [
      ...Object.keys(STRATEGY_MODEL_MAPPINGS),
      ...Array.from(this.customMappings.keys()),
    ]
  }
}

export const modelSelector = new ModelSelector()
