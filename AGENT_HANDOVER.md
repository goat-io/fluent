# Agent Handover — Goat Agents System

## Goal

Build a distributed, event-driven, multi-agent workflow execution system ("Temporal-lite for AI agents") that runs agents ephemerally in Docker containers, supports multi-step DAG workflows with durable execution, human-in-the-loop, distributed workers via BullMQ, exactly-once external side effects, and a visual dashboard.

## Current Progress — ALL GREEN

All packages build. All tests pass. Latest work on branch: `worktree-delegated-growing-puppy`.

| Package | Tests | Status |
|---------|-------|--------|
| agents-core | **257** | ✅ All pass (20 test files) |
| agents-ai | **63** | ✅ All pass (5 test files) |
| agents-langgraph | **15** | ✅ All pass |
| agents-sandbox | **30+** | ✅ All pass (unit + network isolation + Docker integration) |
| agents-ui | — | ✅ Builds, type-checks clean, metrics dashboard added |

**Total: 420+ tests passing** (257 agents-core + 63 agents-ai + 15 agents-langgraph + 30+ agents-sandbox + 12 Playwright + existing)

## What Was Completed (all sessions combined)

### Core Infrastructure (prior sessions)
1. **ExternalAction primitive** — exactly-once execution, idempotency, rate limiting, audit trail (14 stress tests)
2. **StepExecutionContext** — `externalActions` accessible to step handlers via optional context
3. **SDLC workflow wired through ExternalAction** — all 4 external steps use `context.externalActions.execute()`
4. **Definition snapshot completed** — full executorConfig, timeouts, human approval flags frozen at start

### Issue #1: Worker Specialization — RESOLVED
- `StepWeight` type (`'light' | 'heavy'`) on `StepDefinition`
- `WorkflowEngine.dispatchStep()` routes to `workflow_step_light` / `workflow_step_heavy` queues
- Workers started with different concurrency per queue (light:100, heavy:2)
- **5 tests** in `worker-specialization.spec.ts`

### Issue #2: Sandbox Network Isolation — RESOLVED
- Default `NetworkMode: 'none'` (was `'bridge'`)
- `allowedDomains` config with iptables rules inside containers
- `CAP_NET_ADMIN` auto-added when domain allowlist configured
- **4 unit tests** + **4 Docker integration tests** in `network-isolation.spec.ts`

### Issue #3: Redis-Backed Rate Limiter — RESOLVED
- `RateLimiterBackend` interface: `InMemoryRateLimiter` (default) + `RedisRateLimiter`
- Redis sorted sets for sliding window, counters for concurrency
- **Atomic Lua scripts** for rate limit check (single round-trip instead of 4)
- Keys auto-expire (10 min rate buckets, 5 min concurrency — crash recovery)
- **10 tests** in `rate-limiter.spec.ts`

### Issue #4: Observability Metrics — RESOLVED
- `WorkflowMetricsCollector` with `getRunMetrics()` and `getAggregateMetrics()`
- Step latency: queue/schedule-to-start/execution/total
- External action latency by provider
- Percentiles: p50/p95/p99
- **8 tests** in `metrics.spec.ts`

### Issue #5: ExternalAction Runtime Enforcement — RESOLVED
- `ExternalActionEnforcer` StepInterceptor (strict/warn modes)
- Configurable enforced executor types and exempt steps
- **7 tests** in `enforcement.spec.ts`

### Cost-Per-Step Tracking — RESOLVED
- Added `tokensUsed`, `costUsd`, `modelUsed` fields to `workflow_steps` table
- `StepCostTracker` interceptor extracts `_usage` from step outputs
- Pricing table fallback for cost estimation
- Supports `promptTokens + completionTokens` breakdown
- Integrated into `WorkflowMetricsCollector` (`totalTokens`, `totalCostUsd` per run)
- **7 tests** in `cost-tracking.spec.ts`

### Redis Rate Limiter Lua Scripts — RESOLVED
- `RATE_LIMIT_LUA` — atomic sliding window: clean + count + wait calculation in one call
- `RedisClient` interface extended with `eval()` for Lua script execution
- Reduced from 4 Redis round-trips to 1 for rate limit checks

### Dashboard Metrics UI — RESOLVED
- `WorkflowHandlers` now includes `getRunMetrics()` and `getAggregateMetrics()` endpoints
- `AgentsClient` extended with `getRunMetrics()` and `getAggregateMetrics()` methods
- New UI types: `StepLatencyMetrics`, `ExternalActionMetrics`, `WorkflowRunMetrics`, `AggregateMetrics`
- `MetricsPanel` component — aggregate stats: percentile cards + bar charts for executor/provider latency
- `StepMetricsTab` component — per-step timing + cost breakdown
- Dashboard page now shows Performance Metrics section above workflow list

### Production iptables Testing — RESOLVED
- Docker integration tests verifying:
  - `networkMode: 'none'` blocks all network access
  - `networkMode: 'bridge'` allows network access
  - `allowedDomains` restricts traffic to specified domains
  - Default `networkMode` is `'none'`
- Auto-skips when Docker daemon not available

## Key Decisions

1. **Kysely over TypeORM** — 5-8x faster
2. **Dual BullMQ queues** — `workflow_step_light` / `workflow_step_heavy`, routed via `stepWeight`
3. **Engine-driven step chaining** — `onStepCompleted()` evaluates DAG
4. **JSON as TEXT** — `toJson()`/`fromJson()` helpers
5. **Buffered log writes** — Hatchet pattern. 50ms/50 items flush
6. **SSE real-time** — 1s server-side poll → push to EventSource
7. **ExternalAction** — Consistency gate for ALL external API calls
8. **StepExecutionContext** — Optional context carrying engine services
9. **Pluggable RateLimiterBackend** — InMemory default, Redis for multi-worker
10. **Sandbox default isolation** — `NetworkMode: 'none'`, `allowedDomains` iptables for bridge
11. **Cost tracking via interceptor** — `_usage` key convention, pricing table fallback
12. **Atomic Lua scripts** — Single round-trip for Redis rate limit checks

## Key Files

```
packages/agents-core/
  src/engine/WorkflowEngine.ts              ← Core orchestrator (dual queue dispatch)
  src/engine/ExternalActionExecutor.ts      ← External call consistency layer
  src/engine/RateLimiterBackend.ts          ← InMemory + Redis (Lua scripts) rate limiters
  src/engine/WorkflowMetrics.ts             ← Observability: latency + cost metrics
  src/engine/StepCostTracker.ts             ← Token/cost tracking interceptor
  src/engine/ExternalActionEnforcer.ts      ← Runtime enforcement interceptor
  src/entities/Database.ts                  ← Kysely schema (now with cost fields)
  src/api/WorkflowHandlers.ts              ← REST API (now with metrics endpoints)
  src/__tests__/engine/
    worker-specialization.spec.ts           ← 5 tests
    metrics.spec.ts                         ← 8 tests
    rate-limiter.spec.ts                    ← 10 tests
    enforcement.spec.ts                     ← 7 tests
    cost-tracking.spec.ts                   ← 7 tests
    external-actions.spec.ts                ← 14 tests
    lifecycle.spec.ts                       ← 15 tests
    e2e.spec.ts                             ← 5 tests (BullMQ)
    temporal.spec.ts                        ← 8 tests
    api-handlers.spec.ts                    ← 6 tests
  src/__tests__/sdlc/sdlc-e2e.spec.ts      ← 17 tests
  src/__tests__/state-machine.spec.ts       ← 56 tests
  src/__tests__/workflow-builder.spec.ts    ← 24 tests

packages/agents-sandbox/
  src/container/ContainerManager.ts         ← Default NetworkMode: none + allowedDomains
  src/types/SandboxConfig.ts                ← allowedDomains config
  src/__tests__/integration/network-isolation.spec.ts  ← 4 Docker tests
  src/__tests__/unit/network-isolation.spec.ts         ← 4 unit tests

packages/agents-ui/
  src/api/types.ts                          ← Metrics types
  src/api/client.ts                         ← Metrics client methods
  src/components/metrics/MetricsPanel.tsx    ← Aggregate metrics dashboard
  src/components/metrics/StepMetricsTab.tsx  ← Per-step timing + cost
  src/pages/Dashboard.tsx                   ← Now includes MetricsPanel
```

## SDLC Platform Extension — Implementation Plan

### Phase Dependency Graph
```
Phase 1 (nextStep) ──────────────────────────────────┐
Phase 2 (Events) ──> Phase 3 (Triggers) ─────────────┤
Phase 4 (Integrations) ──> Phase 5 (Skills) ──> Phase 6 (Worker)
                                                      │
Phase 1 + Phase 3 ────────────────────────────────────┴──> Phase 7 (Editor)
```
Phases 1, 2, and 4 can proceed in parallel.

### Phase 1: nextStep Runtime Transitions — ✅ DONE (5 tests)
Allow steps to redirect execution to any named step without structural DAG cycles.
- Add `nextStep?: string` to StepResult, `maxIterations` to StepDefinition
- Add `iterationCount`, `maxIterations` columns to workflow_steps
- Engine detects nextStep in onStepCompleted(), validates target, checks iteration limit, resets target to PENDING
- Add COMPLETED→PENDING transition in state machine
- Test file: `next-step.spec.ts`

### Phase 2: Event Ingestion System — ✅ DONE (11 tests)
Accept external webhooks, store events, deduplicate, dead letter queue.
- New: EventIngestionService, WebhookVerifier (HMAC-SHA256)
- New DB tables: workflow_events, workflow_event_subscriptions
- New API handlers: ingestEvent, listDeadLetterEvents, replayDeadLetterEvent
- Test file: `event-ingestion.spec.ts`

### Phase 3: Workflow Triggers — ✅ DONE (6 tests)
Auto-start workflows when matching events arrive. **Depends on Phase 2.**
- Add `triggers?: WorkflowTrigger[]` to WorkflowDefinition
- Builder gains `.trigger(config)` method
- EventIngestion.processEvent() scans workflows for matching triggers
- Test file: `workflow-triggers.spec.ts`

### Phase 4: Integration Layer — ✅ DONE (8 tests)
Typed integration wrappers around ExternalAction (GitHub, Linear, Slack).
- New: Integration interface, IntegrationRegistry, provider implementations
- Add `integrations` to StepExecutionContext
- Test file: `integrations.spec.ts`

### Phase 5: Skills System + Queue Expansion — ✅ DONE (15 tests)
Reusable tools for AI steps. Expand to 4 queues. **Depends on Phase 4.**
- New: Skill interface, SkillRegistry, built-in skills
- AIStepExecutor gains tool-call loop
- StepWeight expands to light/heavy/ai/sandbox
- Test files: `skills.spec.ts`, `queue-expansion.spec.ts`

### Phase 6: Worker Node + Install Script — ✅ DONE (11 tests)
Worker process with resource detection, registration, zero-config install. **Depends on Phase 5.**
- New: WorkerNode, WorkerProvisioner, install-worker.sh
- New DB table: worker_nodes
- Workers page in UI
- Test file: `worker-node.spec.ts`

### Phase 7: Visual Workflow Editor — ✅ DONE (12 Playwright tests passing)
UI for creating/editing workflow definitions. **Depends on Phases 1 + 3.**
- New: WorkflowEditor, StepPalette, StepConfigPanel, EditorToolbar, useWorkflowEditor
- New: WorkflowDesigner page, /designer route
- New DB table: workflow_definitions
- Backend: validateDefinition, saveDefinition handlers
- Test file: `workflow-editor.spec.ts`

### Verification (after each phase)
1. `cd packages/agents-core && pnpm test` — all tests pass
2. `cd packages/agents-ui && npx tsc --noEmit` — UI type-checks clean
3. AGENT_HANDOVER.md updated with new test counts

## Tips for Next Agent

- Run `cd packages/agents-core && pnpm test` (NOT from root)
- `disableLogBuffering: true` in tests
- `fileParallelism: false` — tests share Postgres
- Workers MUST listen on `workflow_step_light` AND `workflow_step_heavy`
- Cost tracking: step outputs should include `_usage: { tokens, costUsd?, model? }`
- `RedisRateLimiter` needs a client with `eval()` support (ioredis has this)
- `ExternalActionEnforcer` installed as interceptor: `interceptors: [new ExternalActionEnforcer({ db })]`
- `StepCostTracker` installed as interceptor: `interceptors: [new StepCostTracker({ db, pricing: {...} })]`
- Network isolation tests require Docker daemon (auto-skip if not available)
- `StepHandler` signature: `(payload, context?) => Promise<StepResult>` — context carries `externalActions`
