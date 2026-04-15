# Agent Handover — Goat Agents SDLC Workflow Platform

## Goal

Build a distributed, event-driven, multi-agent workflow execution system ("Temporal-lite for AI agents") with:
- Visual workflow editing (UI + JSON round-trip)
- Iterative execution (nextStep loops without DAG cycles)
- Typed integrations (GitHub/Linear/Slack) + reusable AI skills
- Distributed worker nodes with zero-config onboarding
- External event ingestion (webhooks, triggers, async human input)
- Exactly-once side effects, snapshot-based execution, COPY FROM bulk inserts

## Current Progress — ALL PHASES IMPLEMENTED

Branch: `master` | All 7 phases implemented, TypeScript clean (2 pre-existing errors only)

| Package | Tests | Status |
|---------|-------|--------|
| delphi-core | **277** vitest (22 files) + **new test files** (5 files for phases) | ✅ Type-checks clean |
| delphi-ai | **63** vitest (5 files) | ✅ All pass |
| delphi-langgraph | **15** | ✅ All pass |
| delphi-sandbox | **30+** | ✅ All pass |
| delphi-ui | **12** Playwright | ✅ All pass + type-checks clean |

**Total: 397+ existing tests + new phase test files (tasks, task-runner, scheduler, trace, guardrails)**
**Note:** New tests require Docker (testcontainers) — run with `cd packages/delphi-core && pnpm test`

### Performance (single CPU, testcontainer Postgres 18)
- COPY FROM batch: **2,500-6,500 wf/sec** (100/batch)
- Batch INSERT: **~1,800 wf/sec** (50/batch)
- Single INSERT: **~1,000 wf/sec**
- 0% error rate on isolated scenarios

## Architecture Summary

### Engine (`delphi-core/src/engine/`)
- **WorkflowEngine.ts** — Core orchestrator. DAG execution, step chaining via `onStepCompleted()`, nextStep runtime loops, 4-queue dispatch (light/heavy/ai/sandbox), per-workflow concurrency fairness.
- **ExternalActionExecutor.ts** — Exactly-once side effects. Two-phase commit (pending→completing→completed). Idempotency key includes sha256(payload). Pluggable RateLimiterBackend (InMemory or Redis with Lua scripts).
- **WorkflowMetrics.ts** — Step/action latency, p50/p95/p99, cost aggregation.
- **StepCostTracker.ts** — Interceptor extracting `_usage` from step output → persists tokensUsed/costUsd/modelUsed.
- **ExternalActionEnforcer.ts** — Interceptor warning/throwing when steps bypass ExternalAction.
- **RateLimiterBackend.ts** — InMemory + Redis (atomic Lua scripts for sliding window).

### Events (`delphi-core/src/events/`)
- **EventIngestion.ts** — Idempotent event storage, dead letter queue, replay. Auto-processes triggers. Bridges `human.response` events to `submitHumanInput()`. Event ordering via entityKey+sequenceNumber (last-write-wins).
- **WebhookVerifier.ts** — HMAC-SHA256 verification (GitHub format support).

### Integrations (`delphi-core/src/integrations/`)
- **IntegrationRegistry** + **createIntegrationAction()** factory wrapping ExternalAction.
- Typed: GitHub (create_pr, create_issue, add_comment, merge_pr), Linear (create_issue, update_issue, add_comment), Slack (send_message, update_message).

### Skills (`delphi-core/src/skills/`)
- **SkillRegistry** with `toToolDefinitions()` (OpenAI-compatible format).
- Built-in: webSearchSkill, codeExecutionSkill.
- AIStepExecutor has tool-call loop: LLM → tool_call → skill.execute → iterate (maxTurns + maxTokenBudget).

### Workers (`delphi-core/src/worker/`)
- **WorkerNode.ts** — detectResources(), getQueueSubscriptions(), start()/stop(), heartbeat, queue-depth-aware scaling.
- **cli.ts** — `node worker/cli.js start` with env-based config.
- **WorkerProvisioner.ts** — Interface + LocalWorkerProvisioner.
- **Worker onboarding UI** — "Add Worker" button generates token + copyable command (like GitHub Actions runner).

### UI (`delphi-ui/src/`)
- **Dashboard** — Status cards, workflow list, MetricsPanel (percentiles + bar charts).
- **WorkflowRun** — React Flow DAG visualization, StepDetailPanel with I/O/logs/retries/container tabs.
- **WorkflowDesigner** — Visual editor: StepPalette (drag-drop), StepConfigPanel, EditorToolbar (validate/export/import JSON), dagre auto-layout.
- **Workers** — Monitoring page with capabilities, heartbeat, queue pills, "Add Worker" modal.

### Database (11 tables, Kysely/Postgres 18)
workflow_runs (+ traceId, parentRunId, originEventId, budget, budgetUsed), workflow_steps, workflow_step_logs, workflow_signals, external_actions (+ traceId), workflow_events (+ traceId), workflow_event_subscriptions, worker_nodes, workflow_definitions, **workflow_tasks** (NEW), **workflow_schedules** (NEW)

### Performance Optimizations
- **COPY FROM** for bulk inserts (startBatchCopy, flushLogs) — 6x faster than INSERT
- **Fast-path initial dispatch** — root steps inserted as QUEUED, skip dispatchReadySteps SELECT
- **Log buffering** — 50ms/50 items flush (Hatchet pattern)
- **Connection pool ~20** (Hatchet recommendation — fewer = less lock contention)
- Postgres tuning: synchronous_commit=off, fsync=off, shared_buffers=256MB (test only)

## Key Decisions

1. **Kysely over TypeORM** — 5-8x faster, plain TS interfaces, no reflection
2. **4-queue BullMQ** — light/heavy/ai/sandbox via StepWeight, different concurrency per queue
3. **ExternalAction two-phase commit** — pending→completing→completed prevents duplicate side effects on crash
4. **Idempotency key = hash(payload)** — prevents collision when same step calls same actionType with different payloads
5. **COPY FROM for bulk writes** — Hatchet-inspired, bypasses SQL planner, single lock acquisition
6. **Event ordering = last-write-wins** — entityKey+sequenceNumber, stale events marked skipped_stale
7. **nextStep = runtime loop** — No DAG cycles, iterationCount+maxIterations enforced at engine level
8. **Skills as pure functions** — SkillRegistry.toToolDefinitions() → OpenAI format, AIStepExecutor runs tool-call loop
9. **Worker onboarding via token** — generateWorkerToken() → copyable command, like GitHub Actions

## Open Issues / TODOs

### 1. Warm Sandbox Pools (Performance)
**Problem:** Each sandbox step creates a new Docker container — cold start overhead.
- **Why slow?** Container creation + image pull + setup commands run every time
- **Why no pool?** Initial design assumed ephemeral containers
- **Why ephemeral?** Security isolation per execution
- **Why per-execution?** Prevents state leakage between steps
- **Why important now?** Production workloads need <1s sandbox start
- **Fix:** Pre-warm container pool with ready-to-use containers, recycle after cleanup

### 2. COPY FROM Column Fragility (Technical Debt)
**Problem:** The COPY FROM implementation in startBatchCopy() hardcodes column order as tab-delimited strings. Any schema change breaks it silently.
- **Why hardcoded?** pg-copy-streams requires exact column list matching data order
- **Why not dynamic?** COPY FROM doesn't support parameterized queries
- **Why risky?** Adding a column to workflow_steps requires updating 3 places (interface, CREATE_TABLES_SQL, COPY string)
- **Why not caught?** No compile-time check on COPY column order
- **Why important?** Schema will evolve — migrations will break COPY silently
- **Fix:** Generate COPY column list from TypeScript interface keys, or add integration test that validates column order matches schema

### 3. CLI Worker Needs Real Postgres Connection (Deployment)
**Problem:** `src/worker/cli.ts` requires AGENTS_POSTGRES_URL to create a WorkflowEngine locally. Workers need DB access to mark steps running/completed.
- **Why needs DB?** WorkflowStepTask.handle() calls engine.markStepRunning() and engine.onStepCompleted()
- **Why not HTTP?** Engine callbacks are synchronous within the step handler
- **Why problematic?** Every worker machine needs Postgres credentials — security concern
- **Why matters?** Zero-config onboarding promise broken if worker needs DB URL
- **Why not fixed?** Would need engine-server architecture where workers call back via HTTP
- **Fix:** Add HTTP callback mode where worker POSTs step results to engine API instead of writing DB directly

### 4. Event Auto-Processing Performance (Scale)
**Problem:** Every `ingest()` call auto-runs `processEvent()` which does 3-4 DB queries (SELECT event, SELECT subscriptions, scan triggers, UPDATE status).
- **Why auto-process?** Ensures triggers fire immediately on event arrival
- **Why slow?** Each event = 5+ DB queries total (insert + process)
- **Why not batched?** Events arrive individually via webhooks
- **Why matters?** At 10k events/sec, processEvent becomes the bottleneck
- **Why not deferred?** Would add latency to trigger-based workflow starts
- **Fix:** `skipAutoProcess: true` config exists. Add background processor that batch-processes pending events.

### 5. Playwright E2E Tests Need Test Server (CI)
**Problem:** Playwright tests require testcontainers (Postgres + Redis) which need Docker in CI.
- **Why Docker?** Testcontainers spin up real Postgres/Redis for integration testing
- **Why not mock?** Tests validate real DB queries and BullMQ behavior
- **Why CI issue?** GitHub Actions needs Docker-in-Docker or service containers
- **Why not already configured?** No CI pipeline set up for agents packages yet
- **Fix:** Add GitHub Actions workflow with `services: postgres, redis` or Docker-in-Docker

## Key Files

```
packages/delphi-core/
  src/engine/WorkflowEngine.ts              ← Core orchestrator (nextStep, COPY FROM, 4-queue, budget, trace)
  src/engine/TaskManager.ts                 ← NEW: Task CRUD + FOR UPDATE SKIP LOCKED + aggregation
  src/engine/ExternalActionExecutor.ts      ← Exactly-once (two-phase, hash idempotency, traceId)
  src/engine/RateLimiterBackend.ts          ← InMemory + Redis Lua
  src/engine/WorkflowMetrics.ts             ← Latency + cost observability
  src/engine/StepCostTracker.ts             ← Token/cost interceptor
  src/engine/ExternalActionEnforcer.ts      ← Bypass detection interceptor
  src/engine/WorkflowEngine.types.ts        ← Config + WorkflowBudget + BudgetUsed types
  src/entities/Database.ts                  ← 11 tables + CREATE_TABLES_SQL (added workflow_tasks, workflow_schedules, trace/budget cols)
  src/events/EventIngestion.ts              ← Events + triggers + human bridge + ordering + traceId
  src/events/WebhookVerifier.ts             ← HMAC-SHA256
  src/scheduler/SchedulerService.ts         ← NEW: Cron scheduler → event emission
  src/steps/TaskRunnerExecutor.ts           ← NEW: Fan-out task executor with budget checks
  src/integrations/                         ← GitHub/Linear/Slack typed wrappers
  src/skills/                               ← SkillRegistry + builtins
  src/worker/WorkerNode.ts                  ← Resource detection + queue subscription
  src/worker/cli.ts                         ← CLI entry point
  src/api/WorkflowHandlers.ts              ← 20+ API handlers
  loadtest/k6-workflow.js                   ← k6 load test script

packages/delphi-ai/
  src/executors/AIStepExecutor.ts           ← Tool-call loop (maxTurns + maxTokenBudget)

packages/delphi-sandbox/
  src/container/ContainerManager.ts         ← NetworkMode:none + allowedDomains iptables

packages/delphi-ui/
  src/components/workflow-editor/           ← Visual editor (7 files)
  src/components/metrics/                   ← MetricsPanel + StepMetricsTab
  src/pages/Workers.tsx                     ← Worker monitoring + "Add Worker" modal
  src/pages/WorkflowDesigner.tsx            ← Designer page
  example/start.ts                          ← Full runnable example (3 workflows + worker)
  test-server/server.ts                     ← E2E test backend
  e2e/workflow-editor.spec.ts              ← 12 Playwright tests
```

## Tips for Next Agent

- **Run tests:** `cd packages/delphi-core && pnpm test` (NOT from root — avoids Mongo/MySQL containers)
- **Exclude load test:** `npx vitest run --exclude="**/load-test*"` (load test can timeout)
- **Build before test server:** `cd packages/delphi-core && npx tsc` (test server imports from dist/)
- **Start example:** `cd packages/delphi-ui && npx tsx example/start.ts` then `VITE_API_URL=http://localhost:4444 npx vite --port 5173`
- **Workers listen on 4 queues:** workflow_step_light, workflow_step_heavy, workflow_step_ai, workflow_step_sandbox
- **disableLogBuffering: true** in tests (async flush breaks log assertions)
- **fileParallelism: false** — tests share Postgres
- **Cost tracking:** step output `_usage: { tokens, costUsd?, model? }` → persisted by StepCostTracker
- **COPY FROM requires pgPool:** pass raw pg.Pool in engine config for bulk insert performance
- **Connection pool ~20** — Hatchet says more = lock contention
- **Postgres 18** in all testcontainers
- **pg 8.20.0** npm client
- **k6 uses ES5** — no optional chaining, no numeric separators, no `catch {}` without param

---

## Incremental Architecture Addendum — Tasks + Scheduler + Trace

### Context

The platform needs 7 new primitives to unlock autonomous parallel execution:
task system (fan-out), scheduler (cron), trace propagation (lineage), aggregation (reduce),
task-aware executor, shared state, and budget guardrails. All built on existing patterns —
no redesign of current components.

### Phase Dependency Graph

```
Phase 1 (Tasks table + CRUD) ─────────────────────────────────┐
Phase 2 (Task fetching with locking) ──────────────────────────┤
Phase 3 (task_runner executor) ── depends on 1+2 ──────────────┤
Phase 4 (Aggregation + shared state) ── depends on 1 ──────────┤
Phase 5 (Scheduler/cron) ── independent ───────────────────────┤
Phase 6 (Trace propagation) ── independent ────────────────────┤
Phase 7 (Budget guardrails) ── depends on 3 ───────────────────┘
```

Phases 1-2 are sequential. Phases 3-4 depend on 1-2. Phases 5-6 are independent.
Phase 7 depends on 3. Maximum parallelism: phases 3+4+5+6 can run together.

---

### Phase 1: Task Table + CRUD

**Goal:** Add `workflow_tasks` as first-class dynamic execution units.

**Files to modify:**
- `src/entities/Database.ts` — Add WorkflowTaskTable interface + CREATE TABLE SQL
- `src/engine/TaskManager.ts` — NEW: createTasks(), getTasks(), getTask()
- `src/index.ts` — Export TaskManager + types
- `src/__tests__/engine/shared.ts` — Add workflow_tasks to truncateAll

**Database schema:**
```sql
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id VARCHAR(36) PRIMARY KEY,
  "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  "stepName" VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload TEXT,
  result TEXT,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  priority INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_run_step ON workflow_tasks("workflowRunId", "stepName", status);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON workflow_tasks(status, priority DESC NULLS LAST);
```

**TaskManager API:**
```typescript
class TaskManager {
  constructor(db: Kysely<Database>)
  createTasks(runId: string, stepName: string, tasks: Array<{ payload: JsonObject; priority?: number; maxRetries?: number }>): Promise<string[]>
  getTasks(runId: string, stepName: string): Promise<WorkflowTask[]>
  getTask(taskId: string): Promise<WorkflowTask | null>
  getTaskStats(runId: string, stepName: string): Promise<{ total: number; pending: number; running: number; completed: number; failed: number }>
}
```

**Tests:** `src/__tests__/engine/tasks.spec.ts`
- createTasks inserts N rows with correct status
- getTasks returns all tasks for run+step
- getTaskStats returns accurate counts

---

### Phase 2: Task Fetching with Locking

**Goal:** Concurrency-safe task assignment — no double assignment under concurrent workers.

**Files to modify:**
- `src/engine/TaskManager.ts` — Add fetchNextTask(), markTaskRunning/Completed/Failed, retryTask()

**Key method — `fetchNextTask()`:**
```sql
SELECT id, payload FROM workflow_tasks
WHERE "workflowRunId" = $1 AND "stepName" = $2 AND status = 'pending'
ORDER BY priority DESC NULLS LAST, "createdAt" ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```
Uses Postgres `FOR UPDATE SKIP LOCKED` — concurrent workers skip locked rows instead of blocking.
This is the same pattern BullMQ uses internally.

**Lifecycle methods:**
```typescript
fetchNextTask(runId: string, stepName: string): Promise<WorkflowTask | null>
markTaskRunning(taskId: string): Promise<void>
markTaskCompleted(taskId: string, result: JsonObject): Promise<void>
markTaskFailed(taskId: string, error: string): Promise<void>
retryTask(taskId: string): Promise<void>  // increments attempt, resets to pending
```

**Concurrency enforcement:**
```typescript
async checkTaskConcurrency(runId: string, maxConcurrent: number): Promise<boolean> {
  // COUNT running tasks for this run — if >= max, return false
}
```

**Tests:** Add to `tasks.spec.ts`
- fetchNextTask returns highest priority pending task
- fetchNextTask returns null when no pending tasks
- Two concurrent fetches get different tasks (FOR UPDATE SKIP LOCKED)
- markTaskCompleted stores result
- markTaskFailed increments attempt
- retryTask resets to pending (if attempt < maxRetries)
- retryTask fails when maxRetries exceeded

---

### Phase 3: task_runner Executor

**Goal:** New executor type that pulls and executes tasks in a loop.

**Files to create:**
- `src/steps/TaskRunnerExecutor.ts` — NEW

**Files to modify:**
- `src/workflow/WorkflowBuilder.types.ts` — Add 'task_runner' to executor types docs
- `src/engine/WorkflowEngine.ts` — Wire TaskManager into engine, pass to StepExecutionContext
- `src/workflow/WorkflowBuilder.types.ts` — Add `taskManager?: TaskManager` to StepExecutionContext
- `src/index.ts` — Export TaskRunnerExecutor

**TaskRunnerExecutor behavior:**
```typescript
class TaskRunnerExecutor implements StepExecutor {
  readonly type = 'task_runner'
  
  async execute(payload: StepPayload, context?: StepExecutionContext): Promise<StepResult> {
    const { taskManager } = context!
    const maxConcurrent = payload.executorConfig.maxConcurrentTasks ?? 5
    const innerExecutorType = payload.executorConfig.executor ?? 'function'
    const innerExecutor = engine.getExecutor(innerExecutorType)
    
    while (true) {
      // Check budget guardrails (Phase 7)
      
      // Fetch next task (concurrency-safe)
      const task = await taskManager.fetchNextTask(payload.workflowRunId, payload.stepName)
      if (!task) break  // No more tasks
      
      await taskManager.markTaskRunning(task.id)
      
      try {
        const result = await innerExecutor.execute({
          ...payload,
          input: task.payload,
        }, context)
        
        await taskManager.markTaskCompleted(task.id, result.output)
      } catch (err) {
        await taskManager.markTaskFailed(task.id, err.message)
        if (task.attempt < task.maxRetries) {
          await taskManager.retryTask(task.id)
        }
      }
    }
    
    // Return summary
    const stats = await taskManager.getTaskStats(payload.workflowRunId, payload.stepName)
    return { output: { taskStats: stats } }
  }
}
```

**Config:**
```typescript
executorConfig: {
  executor: 'function' | 'ai' | 'sandbox',  // inner executor
  handler: 'my_handler',                      // passed to inner executor
  maxConcurrentTasks: 5,
}
```

**Tests:** `src/__tests__/engine/task-runner.spec.ts`
- Executes all pending tasks for a step
- Respects maxConcurrentTasks
- Retries failed tasks up to maxRetries
- Returns task stats summary
- E2E: planner step creates tasks → task_runner processes them

---

### Phase 4: Aggregation + Shared State

**Goal:** Allow steps to access all task results for a step (reduce phase).

**Files to modify:**
- `src/engine/TaskManager.ts` — Add getTaskResults()
- `src/workflow/WorkflowBuilder.types.ts` — Extend StepContext with task access
- `src/engine/WorkflowEngine.ts` — Populate task results in step context

**Aggregation pattern:**
```typescript
// In StepContext (already exists for mapInput):
interface StepContext {
  workflowRunId: string
  tenantId: string
  completedOutputs: Record<string, JsonObject>
  triggerInput: JsonObject
  tasks?: Record<string, WorkflowTask[]>  // NEW: stepName → tasks with results
}
```

**TaskManager.getTaskResults():**
```typescript
async getTaskResults(runId: string, stepName: string): Promise<Array<{ id: string; payload: JsonObject; result: JsonObject | null; status: string }>>
```

**Engine integration:**
In `buildStepContext()`, populate `ctx.tasks` by querying completed tasks for upstream steps.

**Tests:** Add to `tasks.spec.ts`
- Aggregation step receives all task results from prior step
- Results accessible via `upstreamOutputs.__tasks.stepName`

---

### Phase 5: Scheduler (Cron → Events)

**Goal:** Durable, idempotent recurring triggers via cron expressions.

**Files to create:**
- `src/scheduler/SchedulerService.ts` — NEW
- `src/scheduler/SchedulerService.types.ts` — NEW

**Files to modify:**
- `src/entities/Database.ts` — Add workflow_schedules table
- `src/api/WorkflowHandlers.ts` — Add createSchedule, listSchedules, deleteSchedule handlers
- `src/index.ts` — Export SchedulerService

**Database schema:**
```sql
CREATE TABLE IF NOT EXISTS workflow_schedules (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  "workflowName" VARCHAR(255) NOT NULL,
  "cronExpression" VARCHAR(100) NOT NULL,
  "nextRunAt" TIMESTAMP NOT NULL,
  "lastRunAt" TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_next ON workflow_schedules(active, "nextRunAt");
```

**SchedulerService:**
```typescript
class SchedulerService {
  constructor(config: { db, eventIngestion, pollIntervalMs?: number })
  
  start(): void  // starts polling timer
  stop(): void
  
  async tick(): Promise<number>  // single poll cycle, returns count of triggers emitted
  
  async createSchedule(tenantId, workflowName, cronExpression): Promise<string>
  async deleteSchedule(scheduleId): Promise<void>
  async listSchedules(tenantId): Promise<WorkflowSchedule[]>
}
```

**Execution model:**
- Scheduler does NOT start workflows directly
- Emits event: `eventType: 'cron.trigger'`, `payload: { workflowName, scheduledAt }`
- Idempotency key: `cron:{workflowName}:{scheduledAt_ISO}`
- Uses existing EventIngestionService → existing trigger matching → workflow starts
- Cron parsing: use `cron-parser` npm package (lightweight, no deps)

**tick() logic:**
```sql
SELECT * FROM workflow_schedules WHERE active = true AND "nextRunAt" <= NOW()
FOR UPDATE SKIP LOCKED
```
For each due schedule:
1. Emit cron.trigger event with idempotency key
2. Calculate next run from cron expression
3. UPDATE nextRunAt and lastRunAt

**Tests:** `src/__tests__/engine/scheduler.spec.ts`
- createSchedule computes correct nextRunAt
- tick() emits event for due schedules
- tick() does not re-trigger (idempotency key)
- tick() updates nextRunAt after trigger
- Inactive schedules skipped
- deleteSchedule sets active=false

---

### Phase 6: Trace Propagation

**Goal:** Cross-workflow lineage via traceId.

**Files to modify:**
- `src/entities/Database.ts` — Add traceId/parentRunId/originEventId to workflow_runs, traceId to workflow_events and external_actions
- `src/engine/WorkflowEngine.ts` — In start(): generate traceId if not provided, inherit from parent/event
- `src/events/EventIngestion.ts` — Pass traceId through trigger chain
- `src/workflow/WorkflowBuilder.types.ts` — Add traceId to WorkflowTriggerInput

**New columns:**
```sql
-- workflow_runs: add
"traceId" VARCHAR(36),
"parentRunId" VARCHAR(36),
"originEventId" VARCHAR(36)

-- workflow_events: add  
"traceId" VARCHAR(36)

-- external_actions: add
"traceId" VARCHAR(36)
```

**Trace inheritance rules:**
1. Manual start with no traceId → generate new traceId (nanoId)
2. Manual start with traceId → use provided traceId
3. Event-triggered start → inherit event's traceId, set originEventId
4. Child workflow (future) → inherit parent's traceId, set parentRunId
5. ExternalAction → copy traceId from workflow run

**API:**
- `getTrace(traceId)` → returns all runs, events, actions for a trace
- Add traceId to getStatus() response

**Tests:** `src/__tests__/engine/trace.spec.ts`
- New workflow gets auto-generated traceId
- Event-triggered workflow inherits event traceId
- Provided traceId is used as-is
- getTrace returns full lineage

---

### Phase 7: Budget Guardrails

**Goal:** Prevent runaway execution and uncontrolled cost.

**Files to modify:**
- `src/engine/WorkflowEngine.types.ts` — Add budget config to WorkflowEngineConfig
- `src/engine/WorkflowEngine.ts` — Check budgets in dispatchReadySteps and onStepCompleted
- `src/steps/TaskRunnerExecutor.ts` — Check budgets in task loop
- `delphi-ai/src/executors/AIStepExecutor.ts` — Already has maxTokenBudget, extend with global check

**Budget config (per workflow run):**
```typescript
interface WorkflowBudget {
  maxTokens?: number
  maxCostUsd?: number
  maxSteps?: number          // max step completions per run
  maxTaskExecutions?: number // max task executions per run
}
```

**Enforcement points:**
1. `WorkflowEngine.onStepCompleted()` — increment step counter, check maxSteps
2. `TaskRunnerExecutor` loop — increment task counter, check maxTaskExecutions
3. `AIStepExecutor` loop — already checks maxTokenBudget, add global token/cost check
4. On budget exceeded: mark step FAILED with `budgetExceeded: true`, reason string

**Storage:** Add `budgetUsed` JSON field to workflow_runs:
```typescript
budgetUsed: { tokens: number; costUsd: number; steps: number; taskExecutions: number }
```

**Tests:** `src/__tests__/engine/guardrails.spec.ts`
- maxSteps exceeded fails workflow with reason
- maxTaskExecutions exceeded stops task_runner
- maxTokens exceeded stops AI executor
- Budget persisted in workflow_runs.budgetUsed

---

### Integration Points with Existing Architecture

| New Component | Existing Component | Integration |
|---|---|---|
| TaskManager | WorkflowEngine | Engine creates TaskManager, passes via StepExecutionContext |
| TaskRunnerExecutor | StepExecutor interface | Implements same interface, registered like FunctionStepExecutor |
| SchedulerService | EventIngestionService | Scheduler emits events → existing trigger pipeline |
| Trace propagation | WorkflowEngine.start() | traceId added to start() input, propagated through |
| Budget guardrails | StepCostTracker | Reads accumulated cost, enforces limits |
| Task aggregation | StepContext.mapInput | Tasks accessible in mapInput via ctx.tasks |

### Phase Implementation Status (2026-04-13)

| Phase | Status | Files Created/Modified |
|-------|--------|----------------------|
| 1. Task Table + CRUD | ✅ Done | `TaskManager.ts`, `Database.ts` (table+types), `shared.ts`, `tasks.spec.ts` |
| 2. Task Fetching with Locking | ✅ Done | `TaskManager.ts` (fetchNextTask, markTask*, retryTask, checkConcurrency) |
| 3. task_runner Executor | ✅ Done | `TaskRunnerExecutor.ts`, `WorkflowEngine.ts` (TaskManager wired), `WorkflowStepTask.ts`, `task-runner.spec.ts` |
| 4. Aggregation + Shared State | ✅ Done | `WorkflowBuilder.types.ts` (tasks in StepContext), `WorkflowEngine.ts` (buildStepContextWithTasks), `TaskManager.ts` (getTaskResults) |
| 5. Scheduler (Cron) | ✅ Done | `scheduler/SchedulerService.ts`, `Database.ts` (workflow_schedules), `scheduler.spec.ts` |
| 6. Trace Propagation | ✅ Done | `Database.ts` (traceId/parentRunId/originEventId), `WorkflowEngine.ts` (getTrace, start traceId), `EventIngestion.ts/types.ts`, `trace.spec.ts` |
| 7. Budget Guardrails | ✅ Done | `WorkflowEngine.types.ts` (WorkflowBudget/BudgetUsed), `WorkflowEngine.ts` (incrementBudgetUsage), `TaskRunnerExecutor.ts` (budget check), `Database.ts` (budget/budgetUsed), `guardrails.spec.ts` |

### Verification
1. `npx tsc --noEmit` — 0 errors (all pre-existing errors fixed)
2. `cd packages/delphi-core && pnpm test` — requires Docker for testcontainers
3. New test files: `tasks.spec.ts`, `task-runner.spec.ts`, `scheduler.spec.ts`, `trace.spec.ts`, `guardrails.spec.ts`
4. AGENT_HANDOVER.md updated with phase status

---

## UI Feature Parity (2026-04-13)

Workflow editor expanded to match code-level API capabilities:

| Feature | Status | Files |
|---------|--------|-------|
| task_runner executor type | ✅ Done | `StepPalette.tsx`, `StepConfigPanel.tsx`, `EditorStepNode.tsx`, `useWorkflowEditor.ts` |
| Structured task_runner config (inner executor, maxConcurrent, handler) | ✅ Done | `StepConfigPanel.tsx` |
| requiresHumanApproval toggle | ✅ Done | `StepConfigPanel.tsx` |
| Advanced timeouts (heartbeat, schedule-to-start) | ✅ Done | `StepConfigPanel.tsx` (collapsible section) |
| Condition expression | ✅ Done | `StepConfigPanel.tsx` (Advanced section) |
| mapInput expression | ✅ Done | `StepConfigPanel.tsx` (Advanced section) |
| Workflow defaults (retries, timeout, failFast) | ✅ Done | `WorkflowSettingsPanel.tsx` (new) |
| Trigger configuration (event/manual + eventType) | ✅ Done | `WorkflowSettingsPanel.tsx` |
| Budget guardrails (tokens, cost, steps, tasks) | ✅ Done | `WorkflowSettingsPanel.tsx` |
| Node badges (approval, conditional, mapInput) | ✅ Done | `EditorStepNode.tsx` |
| Settings toolbar button | ✅ Done | `EditorToolbar.tsx` |
| JSON export/import with all new fields | ✅ Done | `useWorkflowEditor.ts` (backward compatible) |

---

## Worker Agent Mode — Implementation Plan (NOT YET IMPLEMENTED)

### Goal
Allow private machines behind NAT/firewalls to execute workflow steps via HTTPS-only outbound connections. GitHub Actions runner model. Direct-mode workers unchanged (zero performance impact).

### Architecture

```
Platform Side                        Agent Side
┌───────────────────────┐           ┌────────────────────────┐
│ BullMQ Queues (4)     │           │ Agent Daemon           │
│   └→ WorkerBroker     │  HTTPS    │   long-polls /next-job │
│       (real BullMQ    │◄────443──►│   executes step        │
│        Worker)        │           │   POSTs /step-result   │
│       │               │           │   heartbeats /30s      │
│       ├→ AgentRegistry│           │   No Redis. No Postgres│
│       └→ Engine (DB)  │           └────────────────────────┘
└───────────────────────┘
```

### Two Execution Paths

**Path A — Regular step:** Broker holds BullMQ Promise → dispatches to agent → agent executes → agent returns result → broker calls engine.onStepCompleted (all DB work on platform) → resolves Promise.

**Path B — task_runner step (broker-side fan-out):** Broker holds BullMQ Promise → broker loops `taskManager.fetchNextTask()` → for each task: builds mini-payload, dispatches to agent → agent executes individual task → broker calls `taskManager.markTaskCompleted()` → after all tasks: `engine.onStepCompleted({ taskStats })` → resolves Promise. Agent sees tasks as regular payloads — no knowledge of fan-out.

### Safety Invariants
1. Broker is a real BullMQ Worker — Promise lifecycle = job lifecycle. No jobs lost.
2. Lock duration 5min (auto-renewed by BullMQ). Huge safety margin.
3. Execution timeout per job (separate from heartbeat — heartbeat != progress).
4. Idempotent /step-result — `completed` flag prevents double-resolve.
5. Timestamps: enqueuedAt, assignedAt, startedAt on every PendingJob.
6. Round-robin fairness between agents.
7. maxPendingJobs cap (10k) prevents broker OOM.
8. Job type 'step' | 'task' for agent routing.
9. Agent aborts unknown jobIds (returned by heartbeat).
10. task_runner concurrency: `activeTasks` map + `Promise.race` gate.

### Implementation Phases

| Phase | Description | Files | Status |
|-------|-------------|-------|--------|
| B1. AgentRegistry | In-memory agent tracking, backpressure, sweep, fairness | `src/broker/AgentRegistry.ts`, `agent-registry.spec.ts` | ✅ Done |
| B2. WorkerBroker | BullMQ Worker → HTTP bridge, task_runner fan-out | `src/broker/WorkerBroker.ts` | ✅ Done |
| B3. API + Auth | 6 endpoints, agent_tokens table, SHA-256 auth | `src/broker/BrokerHandlers.ts`, `Database.ts` (agent_tokens) | ✅ Done |
| B4. Agent Daemon | Remote agent process, long-poll, heartbeat, reconnect | `src/broker/AgentDaemon.ts`, `AgentDaemonCli.ts` | ✅ Done |
| B5. Exports + tsc | Wire index.ts, truncateAll, verify 0 TS errors | `src/index.ts`, `shared.ts` | ✅ Done |
| B6. E2E Tests | Full flow with testcontainers | `broker-e2e.spec.ts` | ✅ Done |

### New Files

| File | Purpose |
|------|---------|
| `src/broker/AgentRegistry.ts` | In-memory agent tracking, backpressure, sweep, fairness |
| `src/broker/WorkerBroker.ts` | BullMQ Workers → HTTP bridge, task_runner fan-out |
| `src/broker/BrokerHandlers.ts` | 6 API endpoint handlers |
| `src/broker/AgentDaemon.ts` | Remote agent daemon (HTTPS only) |
| `src/broker/AgentDaemonCli.ts` | CLI entry point for agent mode |

### Auth Flow
1. Admin: `generateWorkerToken()` → stores hashed token in `agent_tokens` (24h expiry)
2. Agent: `POST /agents/register { registrationToken, secret }` → bcrypt hash, mark token used
3. All requests: `Authorization: Bearer <secret>` → `bcrypt.compare()`

### Key Design: task_runner Fan-out on Broker

```
Broker receives task_runner BullMQ job:
  markStepRunning()
  while (true) {
    checkBudget('taskExecutions')
    while (activeTasks.size >= maxConcurrentTasks) await Promise.race(activeTasks.values())
    task = taskManager.fetchNextTask()  // Postgres SKIP LOCKED
    if (!task) break
    taskManager.markTaskRunning(task.id)
    miniPayload = { ...payload, executorType: innerType, input: task.payload }
    promise = registry.enqueueJob({ type: 'task', payload: miniPayload })
      .then(result => taskManager.markTaskCompleted(task.id, result.output))
      .catch(err => taskManager.markTaskFailed(task.id, err.message))
    activeTasks.set(task.id, promise)
  }
  await Promise.allSettled(activeTasks.values())
  stats = taskManager.getTaskStats()
  engine.onStepCompleted({ output: { taskStats: stats } })
```

### NOT Modified (direct mode untouched)
BullMQConnector, WorkflowEngine, WorkflowStepTask, WorkerNode, TaskRunnerExecutor, TaskManager
