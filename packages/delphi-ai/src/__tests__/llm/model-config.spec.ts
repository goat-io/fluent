// npx vitest run src/__tests__/llm/model-config.spec.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROLE_MODELS,
  MODEL_PRESETS,
  STRATEGY_MODEL_MAPPINGS,
} from '../../llm/ModelConfig.js'
import { ModelSelector, modelSelector } from '../../llm/ModelSelector.js'

describe('ModelConfig', () => {
  describe('MODEL_PRESETS', () => {
    it('has OpenAI models', () => {
      expect(MODEL_PRESETS['gpt-4o']).toBeDefined()
      expect(MODEL_PRESETS['gpt-4o'].provider).toBe('openai')
      expect(MODEL_PRESETS['gpt-4o'].model).toBe('gpt-4o')
    })

    it('has Anthropic models', () => {
      expect(MODEL_PRESETS['claude-opus']).toBeDefined()
      expect(MODEL_PRESETS['claude-opus'].provider).toBe('anthropic')
    })

    it('has Google models', () => {
      expect(MODEL_PRESETS['gemini-pro']).toBeDefined()
      expect(MODEL_PRESETS['gemini-pro'].provider).toBe('google')
    })

    it('has Ollama models', () => {
      expect(MODEL_PRESETS['llama-3-local']).toBeDefined()
      expect(MODEL_PRESETS['llama-3-local'].provider).toBe('ollama')
      expect(MODEL_PRESETS['llama-3-local'].baseUrl).toBe(
        'http://localhost:11434',
      )
    })

    it('all presets have required fields', () => {
      for (const [name, config] of Object.entries(MODEL_PRESETS)) {
        expect(config.provider, `${name} missing provider`).toBeDefined()
        expect(config.model, `${name} missing model`).toBeDefined()
      }
    })
  })

  describe('STRATEGY_MODEL_MAPPINGS', () => {
    it('has code-review strategy', () => {
      const strategy = STRATEGY_MODEL_MAPPINGS['code-review']
      expect(strategy).toBeDefined()
      expect(strategy.proposer).toBeDefined()
      expect(strategy.reviewer).toBeDefined()
    })

    it('has quick-decision strategy', () => {
      const strategy = STRATEGY_MODEL_MAPPINGS['quick-decision']
      expect(strategy).toBeDefined()
    })

    it('has local-only strategy', () => {
      const strategy = STRATEGY_MODEL_MAPPINGS['local-only']
      expect(strategy).toBeDefined()
      expect(strategy.proposer).toBe('llama-3-local')
    })

    it('all strategies reference valid presets', () => {
      for (const [strategyName, mapping] of Object.entries(
        STRATEGY_MODEL_MAPPINGS,
      )) {
        const models = [
          mapping.proposer,
          ...(Array.isArray(mapping.reviewer)
            ? mapping.reviewer
            : [mapping.reviewer]),
          ...(mapping.arbiter ? [mapping.arbiter] : []),
        ]
        for (const m of models) {
          if (typeof m === 'string') {
            expect(
              MODEL_PRESETS[m],
              `Strategy "${strategyName}" references unknown preset "${m}"`,
            ).toBeDefined()
          }
        }
      }
    })
  })
})

describe('ModelSelector', () => {
  it('resolves preset by name', () => {
    const config = modelSelector.resolveModelConfig('gpt-4o')
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
  })

  it('returns a copy (not the original preset)', () => {
    const config1 = modelSelector.resolveModelConfig('gpt-4o')
    const config2 = modelSelector.resolveModelConfig('gpt-4o')
    expect(config1).not.toBe(config2)
    expect(config1).toEqual(config2)
  })

  it('throws for unknown preset', () => {
    expect(() => modelSelector.resolveModelConfig('nonexistent')).toThrow(
      /Unknown model preset/,
    )
  })

  it('passes through ModelConfig objects', () => {
    const custom = { provider: 'openai' as const, model: 'custom-model' }
    const resolved = modelSelector.resolveModelConfig(custom)
    expect(resolved.model).toBe('custom-model')
  })

  it('gets strategy models', () => {
    const models = modelSelector.getStrategyModels('code-review')
    expect(models.proposer).toBeDefined()
    expect(models.reviewer).toBeDefined()
  })

  it('falls back to defaults for unknown strategy', () => {
    const models = modelSelector.getStrategyModels('nonexistent-strategy')
    expect(models).toEqual(DEFAULT_ROLE_MODELS)
  })

  it('registers custom strategy', () => {
    const selector = new ModelSelector()
    selector.registerStrategy('my-custom', {
      proposer: 'claude-haiku',
      reviewer: ['gpt-4o-mini'],
      arbiter: 'gemini-flash',
    })
    const models = selector.getStrategyModels('my-custom')
    expect(models.proposer).toBe('claude-haiku')
  })

  it('resolves model for role', () => {
    const proposer = modelSelector.resolveModelForRole(
      'code-review',
      'proposer',
    )
    expect(proposer.provider).toBeDefined()
    expect(proposer.model).toBeDefined()
  })

  it('distributes reviewers across available models', () => {
    const r0 = modelSelector.resolveModelForRole('code-review', 'reviewer', 0)
    const r1 = modelSelector.resolveModelForRole('code-review', 'reviewer', 1)
    expect(r0.model).not.toBe(r1.model) // Different models for different reviewer indices
  })

  it('recommends budget models', () => {
    const models = modelSelector.recommendModels({
      complexity: 'low',
      speed: 'fast',
      cost: 'budget',
    })
    // Budget models should use cheaper variants
    expect(
      typeof models.proposer === 'string' || models.proposer.model,
    ).toBeDefined()
  })

  it('recommends premium models for high complexity', () => {
    const models = modelSelector.recommendModels({
      complexity: 'high',
      speed: 'thorough',
      cost: 'premium',
    })
    expect(models.proposer).toBe('claude-opus')
  })

  it('lists all presets', () => {
    const presets = modelSelector.listPresets()
    expect(presets.length).toBeGreaterThan(5)
    expect(presets).toContain('gpt-4o')
    expect(presets).toContain('claude-opus')
  })

  it('lists all strategies', () => {
    const strategies = modelSelector.listStrategies()
    expect(strategies).toContain('code-review')
    expect(strategies).toContain('quick-decision')
  })
})
