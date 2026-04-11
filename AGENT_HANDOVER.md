# Agent Handover — Goat Agents System

## Goal

Build a distributed, event-driven, multi-agent workflow execution system ("Temporal-lite for AI agents") that runs agents ephemerally in Docker containers, supports multi-step DAG workflows with durable execution, human-in-the-loop, distributed workers via BullMQ, exactly-once external side effects, and a visual dashboard.

## Current Progress

### Built (5 packages, ~15K lines, 232+ tests, all committed and pushed to master)

| Package | Tests | Description |
|---------|-------|-------------|
| `agents-core` | 131 | Workflow engine: DAG chaining, Kysely/Postgres, BullMQ, heartbeat, signals, HITL, ExternalAction, buffered logs |
| `agents-ai` | 56 | Multi-provider LLM adapter (OpenAI/Anthropic/Google/Ollama), agreement protocol |
| `agents-langgraph` | 15 | LangGraph StateGraph executor with Postgres checkpointing |
| `agents-sandbox` | 43 | Docker sandboxed execution with tools (bash/file/git), DinD support |
| `agents-ui` | — | Vite+React+Tailwind+ReactFlow dashboard with SSE real-time updates |

### Commits
- `bf886f7` — Full 5-package system (116 files, 14K lines)
- `fcbe68f` — ExternalAction primitive + definition snapshot versioning

---

## Key Decisions

1. **Kysely over TypeORM** — 5-8x faster. `src/entities/Database.ts` has plain TS interfaces + `CREATE_TABLES_SQL`
2. **Single BullMQ queue** — All steps via `workflow_step`, executor routing via payload
3. **Engine-driven step chaining** — `onStepCompleted()` evaluates DAG, dispatches next steps
4. **JSON as TEXT columns** — `toJson()`/`fromJson()` helpers. Works Postgres + SQLite
5. **Buffered log writes** — Hatchet-inspired. Flush every 50ms/50 items. Disable in tests with `disableLogBuffering: true`
6. **SSE real-time** — 1s server-side polling → push to EventSource clients
7. **ExternalAction** — ALL external API calls must go through `engine.externalActions.execute()`

## Assumptions
- Docker daemon available for sandbox tests (skip gracefully if not)
- Postgres+Redis via testcontainers for integration tests
- `WorkflowStepTask.handle()` calls `engine.markStepRunning()` before executing

## Hacks / Shortcuts
- SSE uses 1s poll loop, not Redis Pub/Sub (fine for dev)
- Rate limiter is in-memory (needs Redis for multi-worker)
- Definition snapshot doesn't freeze executor config yet (model names, etc)

---

## Open Issues (with 5-Why)

### 1. ExternalAction is bypassable
Steps CAN still call external APIs directly → duplicates on retry.
- Why? Steps have direct access to any API client
- Why? No enforcement at executor level
- Why? StepPayload doesn't include externalActions ref
- Why? Executor pattern predates ExternalAction
- **Fix**: Pass externalActions via StepPayload or StepContext

### 2. ExternalAction tests not written
- Why? Context ran out after implementation
- **Fix**: Write `src/__tests__/engine/external-actions.spec.ts`. Test: race conditions (10 parallel same key), crash recovery, rate limiter exhaustion

### 3. SDLC workflow bypasses ExternalAction
Mock adapters in `src/__tests__/sdlc/workflow.ts` call directly, not through `engine.externalActions.execute()`.
- **Fix**: Refactor `createSDLCExecutor()` to use ExternalAction for all Linear/GitHub calls

### 4. Definition snapshot incomplete
Currently freezes step names/deps/executorType but NOT executor config (model, temperature).
- **Fix**: Include fully resolved config in `definitionSnapshot`

### 5. No worker specialization
Single queue — Docker steps (4GB) compete with function steps (100MB).
- **Fix**: Split into `workflow_step:light` and `workflow_step:heavy`

---

## Key Files

```
packages/agents-core/src/engine/WorkflowEngine.ts         — Core orchestrator
packages/agents-core/src/engine/ExternalActionExecutor.ts  — External call consistency layer
packages/agents-core/src/entities/Database.ts              — Kysely schema + SQL
packages/agents-core/src/state/WorkflowStateMachine.ts     — Pure state functions
packages/agents-core/src/tasks/WorkflowStepTask.ts         — BullMQ bridge
packages/agents-core/src/api/WorkflowHandlers.ts           — REST handlers
packages/agents-core/src/__tests__/sdlc/                   — Full SDLC E2E test suite
packages/agents-sandbox/src/SandboxStepExecutor.ts         — Docker executor
packages/agents-ui/example/start.ts                        — Full runnable example
```

## Next Focus Points (priority order)
1. ExternalAction stress tests (race + crash)
2. Enforce no-bypass rule for external calls
3. Wire SDLC workflow to ExternalAction
4. Freeze full executor config in snapshot
5. Light/heavy worker split
6. Sandbox network allowlists (zero-trust)
7. Observability (latency, cost per step)

## Tips
- Run `npx tsc` in agents-core BEFORE tests — downstream imports from `dist/`
- Always use `disableLogBuffering: true` in tests
- `fileParallelism: false` in agents-core vitest config — tests share Postgres
- `engine.markStepRunning()` in WorkflowStepTask is critical — without it steps stuck in QUEUED
- Example server: `cd packages/agents-ui && npx tsx example/start.ts`
- Memory files: `.claude/projects/-Users-igca-Documents-Code-Goat-fluent/memory/`
