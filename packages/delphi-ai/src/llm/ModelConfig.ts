// npx vitest run src/__tests__/llm/model-config.spec.ts
import type { ModelConfig } from './LLMAdapter.types.js'

export const MODEL_PRESETS: Record<string, ModelConfig> = {
  // OpenAI
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
  },
  o3: { provider: 'openai', model: 'o3', temperature: 0.8, maxTokens: 8192 },
  'o3-mini': {
    provider: 'openai',
    model: 'o3-mini',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Anthropic
  'claude-opus': {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'claude-sonnet': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 4096,
  },
  'claude-haiku': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.7,
    maxTokens: 4096,
  },

  // Google
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 8192,
  },

  // Local (Ollama)
  'llama-3-local': {
    provider: 'ollama',
    model: 'llama3',
    temperature: 0.7,
    baseUrl: 'http://localhost:11434',
  },
  'mistral-local': {
    provider: 'ollama',
    model: 'mistral',
    temperature: 0.7,
    baseUrl: 'http://localhost:11434',
  },
  'codellama-local': {
    provider: 'ollama',
    model: 'codellama',
    temperature: 0.3,
    baseUrl: 'http://localhost:11434',
  },

  // Cloud Mistral
  'mistral-large': {
    provider: 'custom',
    model: 'mistral-large-latest',
    temperature: 0.7,
    maxTokens: 4096,
    baseUrl: 'https://api.mistral.ai/v1',
  },
}

export interface RoleModelMapping {
  proposer: string | ModelConfig
  reviewer: string | ModelConfig | Array<string | ModelConfig>
  arbiter?: string | ModelConfig
}

export const DEFAULT_ROLE_MODELS: RoleModelMapping = {
  proposer: 'claude-opus',
  reviewer: ['gpt-4o', 'gemini-pro'],
  arbiter: 'claude-opus',
}

export const STRATEGY_MODEL_MAPPINGS: Record<string, RoleModelMapping> = {
  'code-review': {
    proposer: 'claude-sonnet',
    reviewer: ['gpt-4o', 'claude-opus', 'gemini-pro'],
    arbiter: 'claude-opus',
  },
  'architecture-decision': {
    proposer: 'claude-opus',
    reviewer: ['gpt-4o', 'gemini-pro', 'mistral-large'],
    arbiter: 'claude-opus',
  },
  'test-strategy': {
    proposer: 'gpt-4o',
    reviewer: ['claude-sonnet', 'gemini-pro'],
    arbiter: 'claude-opus',
  },
  'api-design': {
    proposer: 'claude-opus',
    reviewer: ['gpt-4o', 'gemini-pro'],
    arbiter: 'claude-opus',
  },
  'quick-decision': {
    proposer: 'claude-haiku',
    reviewer: ['gpt-4o-mini'],
    arbiter: 'gemini-flash',
  },
  'local-only': {
    proposer: 'llama-3-local',
    reviewer: ['mistral-local'],
    arbiter: 'llama-3-local',
  },
}
