# Agent Handover — delphi-core Cross-Tenant Dispatch + Sodium Migration

## Goal

Internalize sodium's cross-tenant dispatch pattern into `@goatlab/delphi-core` and migrate sodium backend from ShouldQueue task classes to native Workflow + FunctionStep. Published as `@goatlab/delphi-core@0.4.3`.

## Progress — Complete

### Done (this session)

**delphi-core (fluent repo):**
- `createDispatcher()` — process-level singleton for cross-tenant hint dispatch (Redis or Postgres transport)
- `PgHintTransport` — Postgres-based hint transport via LISTEN/NOTIFY + polling
- `DispatchHandler` — Express-compatible 202 handler with background drain
- `ScheduleSyncer` — cross-tenant schedule sync from workflow `schedule` properties
- `PgConnector.processIncomingDispatch()` — ephemeral batch drain for PG-only dispatch
- `PgConnector.onAfterQueue` — callback for firing hints after step insert
- `Workflow.schedule` property — declarative cron scheduling on workflow classes
- `SchedulerService.upsertSchedule()` — deterministic ID upsert for schedule sync
- `WorkflowsApi` iterates by tuple index (not union) — one `any` workflow can't poison others
- `wrapExecution` callback on dispatcher — wraps step execution in tenant DI context
- `dispatchPrefix` config — Redis key prefix for ACL scoping
- Transactional steps — atomic app writes + step completion in one PG transaction
- `engine.connector` exposed on EngineServices
- `engine.shutdown()` closes the connector (prevents connection leaks)
- 52 new tests across 9 files, all passing
- Published 0.3.0 → 0.3.1 → 0.3.2 → 0.4.0 → 0.4.1 → 0.4.3

**sodium backend:**
- Replaced `dispatch.setup.ts`, `dispatch.resource.ts`, `multiTenantScheduler.ts` with `createDispatcher()`
- Removed `task.utils.ts` (was trivial `container.context` wrapper)
- Migrated 29 ShouldQueue classes → Workflow + FunctionStep
- Renamed `*Task` → `*Workflow`, moved `tasks/` → `workflows/`
- Refactored `main.ts` from 814 → 82 lines (extracted to `src/bootstrap/`)
- Split 5 workflows into multi-step DAGs:
  - `CreateSatelliteAccounts`: 1 → 3 steps (create → friendships + reindex parallel)
  - `CrossPost`: 1 → 2 steps (prepare → publish)
  - `NotifyDispatch`: 1 → 4 steps (resolve → persist + SSE + push/email parallel)
  - `DeleteTenant`: 1 → 3 steps (data → infra → finalize sequential)
  - `SendMessage`: 1 → 2 steps (persist → notify)
- Fixed pgroll migration 0054 (separated pgroll ops from raw SQL into 0054 + 0055)
- Fixed `sodium infra:recreate` Docker pgroll hang (docker create → wait → rm pattern)
- Removed `assignDefaultAdmin` from recreate flow

## Key Decisions

1. **Two APIs, two lifecycles**: `createDispatcher()` is process singleton; `createEngine({ dispatcher })` is per-tenant. Dispatcher owns hints, engine owns work.
2. **HTTP dispatch for Cloud Run scaling**: Hints fire HTTP POST to external URL. Cloud Run autoscales on incoming requests.
3. **delphi-core never imports DI frameworks**: Consumer provides `resolveTenant` + `wrapExecution` callbacks. Sodium wires `withContainer` there.
4. **WorkflowsApi by tuple index**: `[K in keyof Ws]` not `[W in Ws[number]]`. Prevents `any` union collapse.
5. **Always publish with `pnpm publish`**: `npm publish` leaks `workspace:*` in dependencies.
6. **Workflow files must not create import circulars with `_container`**: Service files (friendship.service, etc.) import `_container`, so workflow files importing those services create: `_container → delphi.config → workflows → *.workflow → service → _container`. This widens `typeof sodiumWorkflowInstances` to `WorkflowLike[]`, losing all type inference. Currently works because `import type` for the type and static value import for runtime don't trigger the circular at the TS server level. If types break again, check for new circular paths.
7. **pgroll migrations**: 0054 = pure pgroll ops (add_column, create_table). 0055 = single raw SQL op (indexes, FKs, functions, triggers). pgroll doesn't allow mixing or multiple `sql` ops.

## Open Issues / TODOs

### 1. ~~Test files reference old `*Task` names~~ ✅ NOT AN ISSUE
Investigation revealed `taskName` and `postUrl` are **correct interface properties**, not old ShouldQueue remnants:
- `taskName` is part of `TaskConnector.queue()` contract — used by all 4 connector implementations (PG, BullMQ, Hatchet, GCP) for queue routing. Mock connectors in tests correctly implement this interface.
- `postUrl` is in the interface but unused by all implementations (dead param, could be deprecated but not urgent).
- `fromShouldQueue` tests correctly use `taskName`/`postUrl` as ShouldQueue properties to test the adapter bridge.
- All 571 tests pass. No renames needed.

### 2. ~~`delphi.integration.test.ts` uses two-generic Workflow~~ ✅ FIXED
Fixed 8 two-generic `Workflow<Input, Name>` declarations across delphi-ui/test-server, delphi-express/example, delphi-bun/example. Removed the spurious second generic that silently collapsed to `any`.

### 3. Model files still in old `tasks/` directories
These files (`postTasks.model.ts`, `accountTasks.model.ts`, etc.) are in the sodium repo, not in this fluent monorepo. Only `WorkflowStepTask.ts` exists in `tasks/` here, but that's a bridge class and its location is correct.
- **Status**: N/A for this repo.

### 4. ~~Retry backoff not implemented~~ ✅ IMPLEMENTED
Added exponential and fixed retry backoff with jitter to delphi-core:
- `BackoffConfig` type: `{ type: 'exponential' | 'fixed', delayMs?, maxDelayMs?, multiplier? }`
- `backoff` property on `Step` class and `StepDefinition` interface
- `computeRetryDelay()` — calculates epoch-ms timestamp with jitter (±25%)
- `retryAfterMs` BIGINT column on `workflow_steps` (DB schema + ALTER for existing installs)
- `PgConnector.claimSteps()` filters by `retryAfterMs <= now` — no new polling loop needed
- `WorkflowEngine.onStepFailed()` sets `retryAfterMs` on retry when backoff configured; skips immediate `dispatchStep()`
- 8 new tests (6 unit + 2 integration) in `retry-backoff.spec.ts`, all passing
- Usage: `readonly backoff = { type: 'exponential', delayMs: 1000, maxDelayMs: 60000 }` on any Step subclass

### 5. Fan-out/fan-in — TaskManager already exists, needs documentation
`TaskManager` + `TaskRunnerExecutor` already provide fan-out/fan-in within a step: `createTasks()` fans out, the executor processes items with concurrency control + budget checks, then returns aggregated results.
- **Pattern**: Planner step → `ctx.taskManager.createTasks(runId, 'execute', items)` → TaskRunner step processes in parallel → Summarizer step.
- **What's missing**: Documentation in README, and sodium's CrossPost/NotifyDispatch aren't using it yet.
- **Status**: Infrastructure exists. Needs docs + migration of sodium workflows.

### 6. ~~No compensation/saga pattern~~ ✅ IMPLEMENTED
Saga-style rollback via `rollback()` method on Step class:
- `rollback(input, output, ctx)` — optional method called when workflow fails terminally
- Runs on all COMPLETED steps with `rollback` defined, in reverse topological order
- **Append-only history**: step status stays COMPLETED; rollback logged as `rollback_started/completed/failed` events
- Best-effort: if one rollback throws, remaining continue
- `rollbackHandlers` map registered by `createEngine` from step instances
- `onRollbackFailed` callback on workflow for alerting/escalation when a rollback throws
- 5 new tests in `saga-rollback.spec.ts` (structural, failure chain, no-op, realistic e-commerce, alerting)

### 7. ~~Workflow versioning is a no-op~~ ✅ FIXED
`getDefinitionForRun()` now deserializes the stored `definitionSnapshot` instead of reading from the live registry. In-flight workflows keep their original step topology/retries/config across deployments.
- **Merge strategy**: Snapshot provides frozen structure (steps, retries, backoff, executorConfig). Live registry provides non-serializable callbacks (`condition`, `mapInput`, `onComplete`, `onFail`, `signals`, `queries`). If workflow removed from registry, snapshot alone is used (callbacks are undefined — steps still run).
- **Cache**: Deserialized definitions cached per runId, evicted on run completion/failure.
- **Snapshot now includes**: `backoff`, `transactional`, `requiresLabels`, `durability` (were missing before).
- **Legacy fallback**: Runs with NULL `definitionSnapshot` (pre-snapshot era) fall back to live registry.
- **`forkWorkflow`** also fixed — uses `getDefinitionForRun()` instead of live registry.
- 4 new tests in `workflow-versioning.spec.ts`, all passing.

## Key Files

### delphi-core (fluent repo)

| File | Purpose |
|---|---|
| `src/workflow/createEngine.ts` | Main factory — typed proxy, connector wiring, dispatcher integration |
| `src/dispatcher/createDispatcher.ts` | Cross-tenant dispatcher factory (Redis or PG mode) |
| `src/dispatcher/DispatchHandler.ts` | Express 202 handler — resolveTenant → processIncomingDispatch |
| `src/dispatcher/PgHintTransport.ts` | Postgres hint transport (LISTEN/NOTIFY + polling) |
| `src/dispatcher/ScheduleSyncer.ts` | Cross-tenant schedule sync from workflow declarations |
| `src/dispatcher/dispatcher.types.ts` | Config, Dispatcher interface, callback types |
| `src/engine/PgConnector.ts` | PG-only dispatch + processIncomingDispatch + onAfterQueue |
| `src/engine/WorkflowEngine.ts` | Core engine — transactional steps, DAG advancement |
| `src/tasks/WorkflowStepTask.ts` | Step execution bridge (default + transactional paths) |
| `src/workflow/Workflow.ts` | Base class — schedule property, transactional flag |
| `src/scheduler/SchedulerService.ts` | Cron triggers + upsertSchedule |
| `src/__tests__/dispatcher/type-safety.spec.ts` | Type-level tests for `any` isolation |
| `src/__tests__/engine/retry-backoff.spec.ts` | Retry backoff unit + integration tests (8 tests) |
| `src/__tests__/engine/workflow-versioning.spec.ts` | Workflow versioning tests (4 tests) |
| `src/__tests__/engine/saga-rollback.spec.ts` | Saga rollback tests (3 tests) |

### sodium backend

| File | Purpose |
|---|---|
| `src/bootstrap/dispatcher.ts` | createDispatcher setup (wrapExecution, dispatchPrefix) |
| `src/bootstrap/warmup.ts` | Tenant warmup, OAuth, platform init |
| `src/bootstrap/express.ts` | Express config builder |
| `src/bootstrap/watchdog.ts` | Provisioning watchdog (delayed 15s) |
| `src/config/delphi/delphi.config.ts` | Per-tenant engine factory |
| `src/config/delphi/workflows.ts` | Workflow instance registry (29 workflows) |
| `src/config/dispatch/dispatcher.singleton.ts` | Global dispatcher ref for containers |
| `src/main.ts` | 82-line boot sequence |
| `pgroll-migrations/shared/0054_*.json` | Pure pgroll schema ops |
| `pgroll-migrations/shared/0055_*.json` | Pure SQL (indexes, functions, triggers) |
| `packages/sodium-cli/src/commands/infra/recreate.ts` | Docker pgroll fix (create → wait → rm) |

## Tips

- **Publishing**: ALWAYS use `pnpm publish --no-git-checks`. Never `npm publish` — leaks `workspace:*`.
- **Type debugging**: If workflow types break (input is `any`), check for: (1) missing `as const` on `workflowName`, (2) two-generic `Workflow<Input, Name>`, (3) broken relative imports after file moves, (4) circular imports through service files.
- **IsAny pattern**: `type IsAny<T> = 0 extends 1 & T ? true : false` — use to detect `any` at type level. `tsc` won't catch `any` assignments.
- **pgroll rules**: One `sql` op per migration. Don't mix pgroll ops with `sql` ops. No `"up"` on nullable `add_column` (triggers slow expand/contract).
- **Docker pgroll hang**: macOS Docker Desktop `docker run --rm` hangs after container exits. Use `docker create` → `docker start` → `docker wait` → `docker rm` instead.
- **Tests**: 52 dispatcher tests in `src/__tests__/dispatcher/`. Type safety tests use `expectTypeOf().not.toBeAny()`.
- **vitest config**: `fileParallelism: false` in delphi-core. Don't change to `pool: 'forks'` — causes OOM with BullMQ.

## Possible Next Focus Points

1. ~~**Retry backoff**~~ ✅ Done — `backoff` property on Step class with exponential/fixed strategies.
2. **Fan-out/fan-in** — First-class `step.forEach()` pattern. Dynamic child step creation per item. CrossPost and NotifyDispatch would benefit immediately.
3. ~~**Compensation/saga**~~ ✅ Done — `rollback()` method on Step class. Append-only history, reverse topological order.
4. **Testing utilities** — `testWorkflow(MyWorkflow, input)` in-memory executor. Currently requires real PG + testcontainers.
5. **Observability** — Auto-emit OpenTelemetry spans per step. Step duration, queue depth, failure rate metrics.
6. ~~**Workflow versioning**~~ ✅ Done — `getDefinitionForRun()` uses stored snapshot. In-flight workflows frozen to original definition.
7. **Dead letter / replay** — DLQ for failed-after-max-retries steps. "Retry from step X" API.
