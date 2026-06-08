// @goatlab/delphi-governance — the governance bridge for the Delphi agent OS.
// npx vitest run
//
// Makes the Company Brain (judgment) executable on delphi-core (execution):
//   guard (Constitution) → compile (Decision/Action → workflow) → start
//   (exactly-once) → Measure (record outcome back to the Brain).
//
// Independent of delphi-core at compile time — bind to it via `fromEngine()`.

// ── Brain client (judgment plane) ───────────────────────────────────
export type { BrainClient, HttpBrainClientOptions } from './BrainClient.js'
export { HttpBrainClient, InMemoryBrainClient } from './BrainClient.js'
export type { ClaudeCodeChatOptions } from './ClaudeCodeChat.js'
export { claudeCodeAvailable, createClaudeCodeChat } from './ClaudeCodeChat.js'
// ── Compile registry (Action.type → workflow) ───────────────────────
export type { CompileRule } from './CompileRegistry.js'
export { CompileRegistry } from './CompileRegistry.js'
// ── Constitution guard ──────────────────────────────────────────────
export type {
  ConstitutionGuard,
  DefaultConstitutionGuardOptions,
  GuardContext,
  GuardVerdict,
} from './ConstitutionGuard.js'
export { DefaultConstitutionGuard } from './ConstitutionGuard.js'
// ── Factory ─────────────────────────────────────────────────────────
export type { CreateGovernanceOptions, Governance } from './createGovernance.js'
export { createGovernance } from './createGovernance.js'
// ── Decision executor (the compiler) ────────────────────────────────
export type { DecisionExecutorDeps } from './DecisionExecutor.js'
export { DecisionExecutor } from './DecisionExecutor.js'
// ── Outcome subscriber (Measure seam) ───────────────────────────────
export type {
  OutcomeRecorder,
  OutcomeSubscriberOptions,
  RunCompletedEventLike,
} from './OutcomeSubscriber.js'
export { createOutcomeSubscriber } from './OutcomeSubscriber.js'
// ── Perspectives (Propose → Review → Decide) ────────────────────────
export type {
  Perspective,
  PerspectiveEvaluator,
  PerspectiveVerdict,
  ReviewAssessment,
  ReviewContextLoader,
  ReviewMatrix,
} from './Perspective.js'
export type {
  ChatLike,
  HeuristicEvaluatorOptions,
  HeuristicSignal,
  LLMPerspectiveEvaluatorOptions,
} from './PerspectiveEvaluators.js'
export {
  createLLMPerspectiveEvaluator,
  heuristicPerspectiveEvaluator,
  STANDARD_PERSPECTIVES,
} from './PerspectiveEvaluators.js'
export type { PerspectiveReviewerDeps } from './PerspectiveReviewer.js'
export { PerspectiveReviewer } from './PerspectiveReviewer.js'
export type {
  DefaultReviewDeciderOptions,
  ReviewDecider,
  ReviewDecision,
  ReviewOutcome,
} from './ReviewDecider.js'
export { DefaultReviewDecider } from './ReviewDecider.js'
// ── Domain types ────────────────────────────────────────────────────
export type {
  Action,
  ActionStatus,
  Classification,
  Decision,
  DecisionOption,
  DecisionStatus,
  ExecuteResult,
  ExecuteStatus,
  GovernedItem,
  Outcome,
} from './types.js'
// ── Workflow starter (execution-plane seam) ─────────────────────────
export type {
  EngineLike,
  StartRequest,
  StartResult,
  WorkflowStarter,
} from './WorkflowStarter.js'
export {
  fromEngine,
  itemNameFromTraceId,
  traceIdForItem,
} from './WorkflowStarter.js'
