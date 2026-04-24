// @goatlab/delphi-core — Distributed Agent Workflow Engine
// npx vitest run

export type { WorkflowHandlers } from './api/WorkflowHandlers.js'
// ── API Handlers ───────────────────────────────────────────────────
export { createWorkflowHandlers } from './api/WorkflowHandlers.js'
export type { AgentDaemonConfig } from './broker/AgentDaemon.js'
export { AgentDaemon } from './broker/AgentDaemon.js'
export type {
  AgentCapabilities,
  AgentRegistryConfig,
  PendingJob,
  RegisteredAgent,
} from './broker/AgentRegistry.js'
// ── Broker (Agent Mode) ──────────────────────────────────────────
export { AgentRegistry } from './broker/AgentRegistry.js'
export type {
  BrokerHandlers,
  BrokerHandlersConfig,
} from './broker/BrokerHandlers.js'
export { createBrokerHandlers } from './broker/BrokerHandlers.js'
export type { WorkerBrokerConfig } from './broker/WorkerBroker.js'
export { WorkerBroker } from './broker/WorkerBroker.js'
// ── DbClient ─────────────────────────────────────────────────────────
export type { DbClient } from './db/DbClient.js'
export { createDbClient, createPool } from './db/DbClient.js'
// ── ID Generation ────────────────────────────────────────────────────
export { nanoId } from './db/ids.js'
// ── Dispatcher (cross-tenant dispatch) ───────────────────────────
export type {
  Dispatcher,
  DispatcherConfig,
  ListTenantsFn,
  ResolvedTenantEngine,
  ResolveTenantFn,
} from './dispatcher/index.js'
export {
  createDispatcher,
  createDispatchHandler,
  PgHintTransport,
  ScheduleSyncer,
} from './dispatcher/index.js'
export type { AdaptivePollerConfig } from './engine/AdaptivePoller.js'
export { AdaptivePoller } from './engine/AdaptivePoller.js'
export type { BatchedJobProcessorConfig } from './engine/BatchedJobProcessor.js'
export { BatchedJobProcessor } from './engine/BatchedJobProcessor.js'
// ── Connection Resilience ─────────────────────────────────────────
export type { DbRetryOptions } from './engine/dbRetry.js'
export { dbRetry } from './engine/dbRetry.js'
export type {
  EngineEvent,
  RunCompletedEvent,
  RunStartedEvent,
  StepCompletedEvent,
  StepFailedEvent,
  StepHumanRequestedEvent,
  StepRunningEvent,
} from './engine/EngineEvent.types.js'
export { isEngineEvent } from './engine/EngineEvent.types.js'
export type { ExternalActionEnforcerConfig } from './engine/ExternalActionEnforcer.js'
// ── ExternalAction Enforcement ─────────────────────────────────────
export { ExternalActionEnforcer } from './engine/ExternalActionEnforcer.js'
export type {
  ExternalActionExecutorConfig,
  ExternalActionFn,
  ExternalActionRequest,
  ExternalActionResult,
  RateLimitConfig,
} from './engine/ExternalActionExecutor.js'
// ── External Actions (consistency layer) ───────────────────────────
export {
  ExternalActionExecutor,
  ExternalActionPendingError,
} from './engine/ExternalActionExecutor.js'
export type { IngestBufferConfig } from './engine/IngestBuffer.js'
export { IngestBuffer } from './engine/IngestBuffer.js'
export type { IngestWorkerConfig } from './engine/IngestWorker.js'
export { IngestWorker } from './engine/IngestWorker.js'
// ── PG Connector (Postgres-only dispatch) ────────────────────────
// Backwards-compat aliases (PgQueueDispatcher was renamed to PgConnector)
export type {
  PgConnectorConfig,
  PgConnectorConfig as PgQueueDispatcherConfig,
} from './engine/PgConnector.js'
export {
  PgConnector,
  PgConnector as PgQueueDispatcher,
} from './engine/PgConnector.js'
// ── LISTEN/NOTIFY ─────────────────────────────────────────────────
export type { NotifyChannel, PgNotifierConfig } from './engine/PgNotifier.js'
export { PG_NOTIFY_SQL, PgNotifier } from './engine/PgNotifier.js'
export type {
  RateLimiterBackend,
  RedisClient,
} from './engine/RateLimiterBackend.js'
// ── Rate Limiter Backends ─────────────────────────────────────────
export {
  InMemoryRateLimiter,
  RedisRateLimiter,
} from './engine/RateLimiterBackend.js'
export type {
  StepCostTrackerConfig,
  StepUsage,
} from './engine/StepCostTracker.js'
// ── Cost Tracking ─────────────────────────────────────────────────
export { StepCostTracker } from './engine/StepCostTracker.js'
export type {
  StepStatusBufferConfig,
  StepStatusUpdate,
} from './engine/StepStatusBuffer.js'
export { StepStatusBuffer } from './engine/StepStatusBuffer.js'
export type { JsonObject, TaskInput, TaskStats } from './engine/TaskManager.js'
// ── Task Manager ──────────────────────────────────────────────────
export { TaskManager } from './engine/TaskManager.js'
export { computeRetryDelay, WorkflowEngine } from './engine/WorkflowEngine.js'
export type {
  BudgetUsed,
  WorkflowBudget,
  WorkflowEngineConfig,
} from './engine/WorkflowEngine.types.js'
export type {
  AggregateMetrics,
  ExternalActionMetrics,
  StepLatencyMetrics,
  WorkflowRunMetrics,
} from './engine/WorkflowMetrics.js'
// ── Observability ─────────────────────────────────────────────────
export { WorkflowMetricsCollector } from './engine/WorkflowMetrics.js'
export type { WriteBufferConfig } from './engine/WriteBuffer.js'
export { WriteBuffer } from './engine/WriteBuffer.js'
// ── Database Schema ───────────────────────────────────────────────────
export type {
  AgentToken,
  AgentTokenTable,
  Database,
  ExternalAction,
  ExternalActionTable,
  ExternalActionUpdate,
  NewWorkflowRun,
  NewWorkflowSignal,
  NewWorkflowStep,
  NewWorkflowStepLog,
  StepLogEvent,
  WorkflowRun,
  WorkflowRunTable,
  WorkflowRunUpdate,
  WorkflowSchedule,
  WorkflowScheduleTable,
  WorkflowSignal,
  WorkflowSignalTable,
  WorkflowStep,
  WorkflowStepLog,
  WorkflowStepTable,
  WorkflowStepUpdate,
  WorkflowStream,
  WorkflowStreamTable,
  WorkflowTask,
  WorkflowTaskStatus,
  WorkflowTaskTable,
} from './entities/Database.js'
export { CREATE_TABLES_SQL, fromJson, toJson } from './entities/Database.js'
// ── Errors ─────────────────────────────────────────────────────────
export {
  DAGValidationError,
  HumanInputError,
  IdempotencyConflictError,
  InputValidationError,
  InvalidTransitionError,
  NonRetryableError,
  StepExecutionError,
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
} from './errors/WorkflowErrors.js'
// ── Event Ingestion ───────────────────────────────────────────────
export { EventIngestionService } from './events/EventIngestion.js'
export type {
  EventStatus,
  EventSubscription,
  IncomingEvent,
} from './events/EventIngestion.types.js'
export { WebhookVerifier } from './events/WebhookVerifier.js'
export { createIntegrationAction } from './integrations/createIntegrationAction.js'
export type { GitHubClient } from './integrations/github/GitHubIntegration.js'
export { createGitHubIntegration } from './integrations/github/GitHubIntegration.js'
export type {
  Integration,
  IntegrationAction,
} from './integrations/Integration.js'
// ── Integrations ──────────────────────────────────────────────────
export { IntegrationRegistry } from './integrations/IntegrationRegistry.js'
export type { LinearClient } from './integrations/linear/LinearIntegration.js'
export { createLinearIntegration } from './integrations/linear/LinearIntegration.js'
export type { SlackClient } from './integrations/slack/SlackIntegration.js'
export { createSlackIntegration } from './integrations/slack/SlackIntegration.js'
// ── Migrations ────────────────────────────────────────────────────
export { MIGRATIONS, runMigrations } from './migrations/runner.js'
export type { SchedulerServiceConfig } from './scheduler/SchedulerService.js'
// ── Scheduler ─────────────────────────────────────────────────────
export { SchedulerService } from './scheduler/SchedulerService.js'
export type { IANATimezone } from './scheduler/timezones.js'
export { codeExecutionSkill } from './skills/builtin/CodeExecutionSkill.js'
export { webSearchSkill } from './skills/builtin/WebSearchSkill.js'
export type { Skill, ToolDefinition } from './skills/Skill.js'
// ── Skills ────────────────────────────────────────────────────────
export { SkillRegistry } from './skills/SkillRegistry.js'
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
export type { ClaudeCodeConfig } from './steps/ClaudeCodeExecutor.js'
export { ClaudeCodeExecutor } from './steps/ClaudeCodeExecutor.js'
export type { StepHandler } from './steps/FunctionStepExecutor.js'
export { FunctionStepExecutor } from './steps/FunctionStepExecutor.js'
export type { StepExecutor } from './steps/StepExecutor.js'
export { TaskRunnerExecutor } from './steps/TaskRunnerExecutor.js'
export { WorkflowStepTask } from './tasks/WorkflowStepTask.js'
export type { ClusterStartConfig } from './worker/clusterStart.js'
export { clusterStart } from './worker/clusterStart.js'
// ── Worker Node ───────────────────────────────────────────────────
export { WorkerNode } from './worker/WorkerNode.js'
export type {
  QueueDepthProvider,
  WorkerCapabilities,
  WorkerNodeConfig,
  WorkerRegistration,
} from './worker/WorkerNode.types.js'
export type { WorkerProvisioner } from './worker/WorkerProvisioner.js'
export { LocalWorkerProvisioner } from './worker/WorkerProvisioner.js'
export type { WorkerSelfRegistrationConfig } from './worker/WorkerRegistration.js'
export { WorkerSelfRegistration } from './worker/WorkerRegistration.js'
export type {
  CreateEngineIngestOptions,
  TypedEngine,
  WorkflowOps,
  WorkflowsApi,
} from './workflow/createEngine.js'
export { createEngine } from './workflow/createEngine.js'
export {
  fromShouldQueue,
  workflowFromShouldQueue,
} from './workflow/fromShouldQueue.js'
export type { TypedStepResult } from './workflow/Step.js'
// ── Core Classes ───────────────────────────────────────────────────
// New typed-class authoring API — subclass Workflow + Step, compose with
// `step(...)`, pass to `createEngine({ workflows: [...] })`.
export { FunctionStep, Step } from './workflow/Step.js'
export type { StepEntry, StepOutputs } from './workflow/Workflow.js'
export { step, Workflow } from './workflow/Workflow.js'
export { WorkflowBuilder } from './workflow/WorkflowBuilder.js'
// ── Types ──────────────────────────────────────────────────────────
export type {
  BackoffConfig,
  HumanInput,
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  StepExecutionContext,
  StepInterceptor,
  StepPayload,
  StepResult,
  StepStatus,
  StepWeight,
  WorkflowDefinition,
  WorkflowDurability,
  WorkflowStatus,
  WorkflowTrigger,
  WorkflowTriggerInput,
} from './workflow/WorkflowBuilder.types.js'
export { WorkflowRegistry } from './workflow/WorkflowRegistry.js'
