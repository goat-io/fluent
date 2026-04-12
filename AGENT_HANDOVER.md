# Agent Handover — Goat Agents System

## Goal

Build a distributed, event-driven, multi-agent workflow execution system ("Temporal-lite for AI agents") that runs agents ephemerally in Docker containers, supports multi-step DAG workflows with durable execution, human-in-the-loop, distributed workers via BullMQ, exactly-once external side effects, and a visual dashboard.

## Current Progress — ALL GREEN

All packages build. All tests pass. Latest commit: `53e27d9` pushed to master.

| Package | Tests | Status |
|---------|-------|--------|
| agents-core | **145** | ✅ All pass (unit + integration + BullMQ E2E + SDLC E2E + ExternalAction stress) |
| agents-ai | **56** | ✅ All pass |
| agents-langgraph | **15** | ✅ All pass |
| agents-sandbox | **30** | ✅ All pass (unit; Docker integration skipped if no daemon) |
| agents-ui | — | ✅ Builds (SPA + library mode), type-checks clean |

**Total: 246 tests passing**

## What Was Just Completed (this session)

1. **ExternalAction stress tests** — 14 tests covering:
   - Exactly-once execution (idempotency key dedup, cached responses)
   - Race conditions (10 parallel same key → only 1-3 external calls)
   - Failure handling (failed → retryable with new attempt)
   - Stale pending recovery (>5 min pending auto-deleted and re-executed)
   - Concurrency protection (recent pending blocks duplicates)
   - Rate limiting (per-provider token bucket)
   - Audit trail (request/response payloads stored)
   - Query methods (getActionsForStep, getActionsForWorkflow)

2. **Bug fix in ExternalActionExecutor** — Stale/failed actions now deleted (not updated) before retry, so unique constraint on idempotencyKey doesn't block re-execution.

## Key Decisions

1. **Kysely over TypeORM** — 5-8x faster. `src/entities/Database.ts` = plain TS interfaces + `CREATE_TABLES_SQL`
2. **Single BullMQ queue** — `workflow_step` for all step types, executor routing via payload
3. **Engine-driven step chaining** — `onStepCompleted()` evaluates DAG, dispatches next
4. **JSON as TEXT** — `toJson()`/`fromJson()` helpers. Postgres + SQLite compatible
5. **Buffered log writes** — Hatchet pattern. Flush every 50ms/50 items. `disableLogBuffering: true` in tests
6. **SSE real-time** — 1s server-side poll → push to EventSource clients
7. **ExternalAction** — Consistency gate for ALL external API calls. Idempotency + rate limiting + audit

## Key Files

```
packages/agents-core/
  src/engine/WorkflowEngine.ts          ← Core orchestrator
  src/engine/ExternalActionExecutor.ts  ← External call consistency layer
  src/entities/Database.ts              ← Kysely schema + CREATE_TABLES_SQL
  src/state/WorkflowStateMachine.ts     ← Pure state functions
  src/tasks/WorkflowStepTask.ts         ← BullMQ bridge
  src/api/WorkflowHandlers.ts           ← REST API handlers
  src/__tests__/engine/external-actions.spec.ts  ← ExternalAction stress tests
  src/__tests__/sdlc/                   ← Full SDLC E2E (17 tests)
  src/__tests__/engine/e2e.spec.ts      ← BullMQ E2E (5 tests)

packages/agents-sandbox/
  src/SandboxStepExecutor.ts            ← Docker executor
  src/container/ContainerManager.ts     ← dockerode lifecycle

packages/agents-ui/
  example/start.ts                      ← Full runnable example (3 demo workflows)
  src/hooks/useRealtimeWorkflow.ts      ← SSE hook
  src/pages/WorkflowRun.tsx             ← DAG visualization
```

## Open Issues (priority order)

### 1. ExternalAction is bypassable
Steps CAN still call external APIs directly. Need to enforce via StepPayload/StepContext.
- **5-Why**: StepPayload doesn't include externalActions ref → executor pattern predates ExternalAction → no enforcement mechanism
- **Fix**: Add `externalActions` to StepPayload or create a StepContext wrapper

### 2. SDLC workflow not wired through ExternalAction
`src/__tests__/sdlc/workflow.ts` calls mock adapters directly.
- **Fix**: Refactor `createSDLCExecutor()` to use `engine.externalActions.execute()`

### 3. Definition snapshot incomplete
Freezes step names/deps/executorType but NOT executor config (model names, temperatures).
- **Fix**: Include fully resolved config in `definitionSnapshot`

### 4. Worker specialization
Single queue — Docker steps (4GB) compete with function steps (100MB).
- **Fix**: Split into `workflow_step:light` and `workflow_step:heavy`

### 5. Sandbox network isolation
Default `NetworkMode: 'bridge'` (full access). Should be `none` + allowlists.
- **Fix**: Default `NetworkMode: 'none'`, add `allowedDomains` config

### 6. Rate limiter is in-memory
Resets on worker restart. Needs Redis backing for multi-worker.

### 7. Observability
No step latency, external action latency, or cost-per-step metrics yet.

## Tips for Next Agent

- Run `npx tsc` in agents-core BEFORE running downstream tests (imports from `dist/`)
- Always `disableLogBuffering: true` in tests (async flush breaks log assertions)
- `fileParallelism: false` in agents-core vitest — tests share Postgres
- `engine.markStepRunning()` in WorkflowStepTask is critical — without it steps stuck in QUEUED
- ExternalAction tests need a parent `workflow_runs` row (FK constraint)
- Docker tests auto-skip if daemon unavailable (check socket path)
- Example server: `cd packages/agents-ui && npx tsx example/start.ts`
- Memory files: `.claude/projects/-Users-igca-Documents-Code-Goat-fluent/memory/`
- Expert feedback with detailed next steps: `memory/feedback_phase1_next_steps.md`
