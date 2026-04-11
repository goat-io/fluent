// @goatlab/agents-core — Distributed Agent Workflow Engine
// npx vitest run

// ── Types ──────────────────────────────────────────────────────────
export type {
  HumanInput,
  QueryHandler,
  SignalHandler,
  StepContext,
  StepDefinition,
  StepInterceptor,
  StepPayload,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowStatus,
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
