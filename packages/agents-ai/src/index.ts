// @goatlab/agents-ai — Multi-provider AI adapter and multi-agent consensus
// npx vitest run

// ── LLM Layer ──────────────────────────────────────────────────────
export { LLMAdapter } from './llm/LLMAdapter.js'
export type {
  AgentDefinition,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelConfig,
  ModelProvider,
  ToolCall,
  ToolDefinition,
} from './llm/LLMAdapter.types.js'
export { ModelConfigSchema, ModelProviderSchema } from './llm/LLMAdapter.types.js'

export {
  DEFAULT_ROLE_MODELS,
  MODEL_PRESETS,
  STRATEGY_MODEL_MAPPINGS,
} from './llm/ModelConfig.js'
export type { RoleModelMapping } from './llm/ModelConfig.js'

export { ModelSelector, modelSelector } from './llm/ModelSelector.js'

// ── Step Executors ─────────────────────────────────────────────────
export { AIStepExecutor } from './executors/AIStepExecutor.js'
export type { AIStepExecutorConfig } from './executors/AIStepExecutor.js'
export { AgreementStepExecutor } from './executors/AgreementStepExecutor.js'

// ── Agreement Protocol ─────────────────────────────────────────────
export {
  AgreementState,
  AgentRole,
  AgreementMessageSchema,
  CommitPayloadSchema,
  CritiquePayloadSchema,
  ProposalPayloadSchema,
  VotePayloadSchema,
  validateMessage,
  validatePayloadSize,
} from './agreement/AgreementProtocol.types.js'
export type {
  AgreementMessage,
  AgreementSessionConfig,
  CommitPayload,
  ConsensusResult,
  CritiquePayload,
  ProposalPayload,
  VotePayload,
} from './agreement/AgreementProtocol.types.js'

export { AgreementOrchestrator } from './agreement/AgreementOrchestrator.js'
export type { AgreementAgent, OrchestratorOptions } from './agreement/AgreementOrchestrator.js'

export { RiskGuard } from './agreement/RiskGuard.js'
export type { RiskCheckResult, RiskGuardConfig } from './agreement/RiskGuard.js'

// ── Utilities ──────────────────────────────────────────────────────
export { CircuitBreaker } from './utils/CircuitBreaker.js'
export type { CircuitBreakerConfig, CircuitBreakerMetrics, CircuitState } from './utils/CircuitBreaker.js'
export { isRetryableError, retryWithBackoff } from './utils/RetryableClient.js'
export type { RetryConfig } from './utils/RetryableClient.js'
