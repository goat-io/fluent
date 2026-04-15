// @goatlab/delphi-ai — Multi-provider AI adapter and multi-agent consensus
// npx vitest run

export type {
  AgreementAgent,
  OrchestratorOptions,
} from './agreement/AgreementOrchestrator.js'
export { AgreementOrchestrator } from './agreement/AgreementOrchestrator.js'
export type {
  AgreementMessage,
  AgreementSessionConfig,
  CommitPayload,
  ConsensusResult,
  CritiquePayload,
  ProposalPayload,
  VotePayload,
} from './agreement/AgreementProtocol.types.js'
// ── Agreement Protocol ─────────────────────────────────────────────
export {
  AgentRole,
  AgreementMessageSchema,
  AgreementState,
  CommitPayloadSchema,
  CritiquePayloadSchema,
  ProposalPayloadSchema,
  VotePayloadSchema,
  validateMessage,
  validatePayloadSize,
} from './agreement/AgreementProtocol.types.js'
export type { RiskCheckResult, RiskGuardConfig } from './agreement/RiskGuard.js'
export { RiskGuard } from './agreement/RiskGuard.js'
export { AgreementStepExecutor } from './executors/AgreementStepExecutor.js'
export type { AIStepExecutorConfig } from './executors/AIStepExecutor.js'
// ── Step Executors ─────────────────────────────────────────────────
export { AIStepExecutor } from './executors/AIStepExecutor.js'
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
export {
  ModelConfigSchema,
  ModelProviderSchema,
} from './llm/LLMAdapter.types.js'
export type { RoleModelMapping } from './llm/ModelConfig.js'
export {
  DEFAULT_ROLE_MODELS,
  MODEL_PRESETS,
  STRATEGY_MODEL_MAPPINGS,
} from './llm/ModelConfig.js'
export { ModelSelector, modelSelector } from './llm/ModelSelector.js'
export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitState,
} from './utils/CircuitBreaker.js'
// ── Utilities ──────────────────────────────────────────────────────
export { CircuitBreaker } from './utils/CircuitBreaker.js'
export type { RetryConfig } from './utils/RetryableClient.js'
export { isRetryableError, retryWithBackoff } from './utils/RetryableClient.js'
