# Agent Handover — Goat Agents SDLC Workflow Platform

## Goal

Build a distributed, event-driven, multi-agent workflow execution system ("Temporal-lite for AI agents") with:
- Visual workflow editing (UI + JSON round-trip)
- Iterative execution (nextStep loops without DAG cycles)
- Typed integrations (GitHub/Linear/Slack) + reusable AI skills
- Distributed worker nodes with zero-config onboarding
- External event ingestion (webhooks, triggers, async human input)
- Exactly-once side effects, snapshot-based execution, COPY FROM bulk inserts

## Current Progress — ALL GREEN

Branch: `worktree-delegated-growing-puppy` | Last commit: `1efe4df`

| Package | Tests | Status |
|---------|-------|--------|
| agents-core | **277** vitest (22 files) | ✅ All pass |
| agents-ai | **63** vitest (5 files) | ✅ All pass |
| agents-langgraph | **15** | ✅ All pass |
| agents-sandbox | **30+** | ✅ All pass |
| agents-ui | **12** Playwright | ✅ All pass + type-checks clean |

**Total: 397+ tests + k6 load tests**

### Performance (single CPU, testcontainer Postgres 18)
- COPY FROM batch: **2,500-6,500 wf/sec** (100/batch)
- Batch INSERT: **~1,800 wf/sec** (50/batch)
- Single INSERT: **~1,000 wf/sec**
- 0% error rate on isolated scenarios

## Architecture Summary

### Engine (`agents-core/src/engine/`)
- **WorkflowEngine.ts** — Core orchestrator. DAG execution, step chaining via `onStepCompleted()`, nextStep runtime loops, 4-queue dispatch (light/heavy/ai/sandbox), per-workflow concurrency fairness.
- **ExternalActionExecutor.ts** — Exactly-once side effects. Two-phase commit (pending→completing→completed). Idempotency key includes sha256(payload). Pluggable RateLimiterBackend (InMemory or Redis with Lua scripts).
- **WorkflowMetrics.ts** — Step/action latency, p50/p95/p99, cost aggregation.
- **StepCostTracker.ts** — Interceptor extracting `_usage` from step output → persists tokensUsed/costUsd/modelUsed.
- **ExternalActionEnforcer.ts** — Interceptor warning/throwing when steps bypass ExternalAction.
- **RateLimiterBackend.ts** — InMemory + Redis (atomic Lua scripts for sliding window).

### Events (`agents-core/src/events/`)
- **EventIngestion.ts** — Idempotent event storage, dead letter queue, replay. Auto-processes triggers. Bridges `human.response` events to `submitHumanInput()`. Event ordering via entityKey+sequenceNumber (last-write-wins).
- **WebhookVerifier.ts** — HMAC-SHA256 verification (GitHub format support).

### Integrations (`agents-core/src/integrations/`)
- **IntegrationRegistry** + **createIntegrationAction()** factory wrapping ExternalAction.
- Typed: GitHub (create_pr, create_issue, add_comment, merge_pr), Linear (create_issue, update_issue, add_comment), Slack (send_message, update_message).

### Skills (`agents-core/src/skills/`)
- **SkillRegistry** with `toToolDefinitions()` (OpenAI-compatible format).
- Built-in: webSearchSkill, codeExecutionSkill.
- AIStepExecutor has tool-call loop: LLM → tool_call → skill.execute → iterate (maxTurns + maxTokenBudget).

### Workers (`agents-core/src/worker/`)
- **WorkerNode.ts** — detectResources(), getQueueSubscriptions(), start()/stop(), heartbeat, queue-depth-aware scaling.
- **cli.ts** — `node worker/cli.js start` with env-based config.
- **WorkerProvisioner.ts** — Interface + LocalWorkerProvisioner.
- **Worker onboarding UI** — "Add Worker" button generates token + copyable command (like GitHub Actions runner).

### UI (`agents-ui/src/`)
- **Dashboard** — Status cards, workflow list, MetricsPanel (percentiles + bar charts).
- **WorkflowRun** — React Flow DAG visualization, StepDetailPanel with I/O/logs/retries/container tabs.
- **WorkflowDesigner** — Visual editor: StepPalette (drag-drop), StepConfigPanel, EditorToolbar (validate/export/import JSON), dagre auto-layout.
- **Workers** — Monitoring page with capabilities, heartbeat, queue pills, "Add Worker" modal.

### Database (9 tables, Kysely/Postgres 18)
workflow_runs, workflow_steps, workflow_step_logs, workflow_signals, external_actions, workflow_events, workflow_event_subscriptions, worker_nodes, workflow_definitions

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
packages/agents-core/
  src/engine/WorkflowEngine.ts              ← Core orchestrator (nextStep, COPY FROM, 4-queue)
  src/engine/ExternalActionExecutor.ts      ← Exactly-once (two-phase, hash idempotency)
  src/engine/RateLimiterBackend.ts          ← InMemory + Redis Lua
  src/engine/WorkflowMetrics.ts             ← Latency + cost observability
  src/engine/StepCostTracker.ts             ← Token/cost interceptor
  src/engine/ExternalActionEnforcer.ts      ← Bypass detection interceptor
  src/entities/Database.ts                  ← 9 tables + CREATE_TABLES_SQL
  src/events/EventIngestion.ts              ← Events + triggers + human bridge + ordering
  src/events/WebhookVerifier.ts             ← HMAC-SHA256
  src/integrations/                         ← GitHub/Linear/Slack typed wrappers
  src/skills/                               ← SkillRegistry + builtins
  src/worker/WorkerNode.ts                  ← Resource detection + queue subscription
  src/worker/cli.ts                         ← CLI entry point
  src/api/WorkflowHandlers.ts              ← 20+ API handlers
  loadtest/k6-workflow.js                   ← k6 load test script

packages/agents-ai/
  src/executors/AIStepExecutor.ts           ← Tool-call loop (maxTurns + maxTokenBudget)

packages/agents-sandbox/
  src/container/ContainerManager.ts         ← NetworkMode:none + allowedDomains iptables

packages/agents-ui/
  src/components/workflow-editor/           ← Visual editor (7 files)
  src/components/metrics/                   ← MetricsPanel + StepMetricsTab
  src/pages/Workers.tsx                     ← Worker monitoring + "Add Worker" modal
  src/pages/WorkflowDesigner.tsx            ← Designer page
  example/start.ts                          ← Full runnable example (3 workflows + worker)
  test-server/server.ts                     ← E2E test backend
  e2e/workflow-editor.spec.ts              ← 12 Playwright tests
```

## Tips for Next Agent

- **Run tests:** `cd packages/agents-core && pnpm test` (NOT from root — avoids Mongo/MySQL containers)
- **Exclude load test:** `npx vitest run --exclude="**/load-test*"` (load test can timeout)
- **Build before test server:** `cd packages/agents-core && npx tsc` (test server imports from dist/)
- **Start example:** `cd packages/agents-ui && npx tsx example/start.ts` then `VITE_API_URL=http://localhost:4444 npx vite --port 5173`
- **Workers listen on 4 queues:** workflow_step_light, workflow_step_heavy, workflow_step_ai, workflow_step_sandbox
- **disableLogBuffering: true** in tests (async flush breaks log assertions)
- **fileParallelism: false** — tests share Postgres
- **Cost tracking:** step output `_usage: { tokens, costUsd?, model? }` → persisted by StepCostTracker
- **COPY FROM requires pgPool:** pass raw pg.Pool in engine config for bulk insert performance
- **Connection pool ~20** — Hatchet says more = lock contention
- **Postgres 18** in all testcontainers
- **pg 8.20.0** npm client
- **k6 uses ES5** — no optional chaining, no numeric separators, no `catch {}` without param
