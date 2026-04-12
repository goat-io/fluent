// @goatlab/agents-core — Distributed Agent Workflow Engine
// npx vitest run

// ── Types ──────────────────────────────────────────────────────────
export type {
  HumanInput,
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  StepExecutionContext,
  StepInterceptor,
  StepPayload,
  StepWeight,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowTrigger,
  WorkflowTriggerInput,
} from './workflow/WorkflowBuilder.types.js'

export type { WorkflowEngineConfig } from './engine/WorkflowEngine.types.js'

export type { StepExecutor } from './steps/StepExecutor.js'
export type { StepHandler } from './steps/FunctionStepExecutor.js'

// ── Core Classes ───────────────────────────────────────────────────
export { WorkflowBuilder } from './workflow/WorkflowBuilder.js'
export type { StepConfig } from './workflow/WorkflowBuilder.js'
export { WorkflowRegistry } from './workflow/WorkflowRegistry.js'
export { WorkflowEngine } from './engine/WorkflowEngine.js'
export { FunctionStepExecutor } from './steps/FunctionStepExecutor.js'
export { WorkflowStepTask } from './tasks/WorkflowStepTask.js'

// ── State Machine (pure functions) ─────────────────────────────────
export {
  canStepTransition,
  canWorkflowTransition,
  deriveWorkflowStatus,
  getReadySteps,
  isTerminalStepStatus,
  isTerminalWorkflowStatus,
  topologicalSort,
} from './state/WorkflowStateMachine.js'

// ── Database Schema (Kysely) ───────────────────────────────────────
export type {
  Database,
  NewWorkflowRun,
  NewWorkflowStep,
  NewWorkflowStepLog,
  NewWorkflowSignal,
  WorkflowRun,
  WorkflowRunTable,
  WorkflowRunUpdate,
  WorkflowStep,
  WorkflowStepLog,
  WorkflowStepTable,
  WorkflowStepUpdate,
  WorkflowSignal,
  WorkflowSignalTable,
  ExternalAction,
  ExternalActionTable,
  ExternalActionUpdate,
  StepLogEvent,
} from './entities/Database.js'
export { CREATE_TABLES_SQL, fromJson, toJson } from './entities/Database.js'

// ── External Actions (consistency layer) ───────────────────────────
export { ExternalActionExecutor, ExternalActionPendingError } from './engine/ExternalActionExecutor.js'
export type {
  ExternalActionRequest,
  ExternalActionFn,
  ExternalActionResult,
  ExternalActionExecutorConfig,
  RateLimitConfig,
} from './engine/ExternalActionExecutor.js'

// ── Rate Limiter Backends ─────────────────────────────────────────
export { InMemoryRateLimiter, RedisRateLimiter } from './engine/RateLimiterBackend.js'
export type { RateLimiterBackend, RedisClient } from './engine/RateLimiterBackend.js'

// ── ExternalAction Enforcement ─────────────────────────────────────
export { ExternalActionEnforcer } from './engine/ExternalActionEnforcer.js'
export type { ExternalActionEnforcerConfig } from './engine/ExternalActionEnforcer.js'

// ── Cost Tracking ─────────────────────────────────────────────────
export { StepCostTracker } from './engine/StepCostTracker.js'
export type { StepCostTrackerConfig, StepUsage } from './engine/StepCostTracker.js'

// ── Observability ─────────────────────────────────────────────────
export { WorkflowMetricsCollector } from './engine/WorkflowMetrics.js'
export type {
  StepLatencyMetrics,
  ExternalActionMetrics,
  WorkflowRunMetrics,
  AggregateMetrics,
} from './engine/WorkflowMetrics.js'

// ── Event Ingestion ───────────────────────────────────────────────
export { EventIngestionService } from './events/EventIngestion.js'
export type { IncomingEvent, EventSubscription, EventStatus } from './events/EventIngestion.types.js'
export { WebhookVerifier } from './events/WebhookVerifier.js'

// ── Integrations ──────────────────────────────────────────────────
export { IntegrationRegistry } from './integrations/IntegrationRegistry.js'
export type { Integration, IntegrationAction } from './integrations/Integration.js'
export { createIntegrationAction } from './integrations/createIntegrationAction.js'
export { createGitHubIntegration } from './integrations/github/GitHubIntegration.js'
export type { GitHubClient } from './integrations/github/GitHubIntegration.js'
export { createLinearIntegration } from './integrations/linear/LinearIntegration.js'
export type { LinearClient } from './integrations/linear/LinearIntegration.js'
export { createSlackIntegration } from './integrations/slack/SlackIntegration.js'
export type { SlackClient } from './integrations/slack/SlackIntegration.js'

// ── Skills ────────────────────────────────────────────────────────
export { SkillRegistry } from './skills/SkillRegistry.js'
export type { Skill, ToolDefinition } from './skills/Skill.js'
export { webSearchSkill } from './skills/builtin/WebSearchSkill.js'
export { codeExecutionSkill } from './skills/builtin/CodeExecutionSkill.js'

// ── Worker Node ───────────────────────────────────────────────────
export { WorkerNode } from './worker/WorkerNode.js'
export type { WorkerNodeConfig, WorkerCapabilities, WorkerRegistration, QueueDepthProvider } from './worker/WorkerNode.types.js'
export { LocalWorkerProvisioner } from './worker/WorkerProvisioner.js'
export type { WorkerProvisioner } from './worker/WorkerProvisioner.js'

// ── Errors ─────────────────────────────────────────────────────────
export {
  DAGValidationError,
  HumanInputError,
  IdempotencyConflictError,
  InvalidTransitionError,
  NonRetryableError,
  StepExecutionError,
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
} from './errors/WorkflowErrors.js'

// ── API Handlers ───────────────────────────────────────────────────
export { createWorkflowHandlers } from './api/WorkflowHandlers.js'
export type { WorkflowHandlers } from './api/WorkflowHandlers.js'
