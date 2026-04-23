# Agent Handover — delphi-core Postgres-only Architecture

## Goal

Refactor `@goatlab/delphi-core` from Redis-dependent to Postgres-only-by-default, inspired by DBOS. Redis opt-in for >5k req/s. Minimal consumer boilerplate.

## Progress — ~90% complete

### Done
- PgConnector: `FOR UPDATE SKIP LOCKED` + auto-detected LISTEN/NOTIFY
- Removed Kysely, js-utils, tslib — replaced with `DbClient`, local `nanoId`
- 20 DBOS-parity features (see README Performance section)
- Clean API: `createEngine({ database, workflows, tenantId })`
- No `new`: classes everywhere — `workflows: [PaymentWorkflow]`, `step(ChargeStep)`
- Single-generic: `Workflow<TInput>`, `FunctionStep<TInput, TOutput>`
- Type-safe auto-pass: compiler requires `mapInput` when output doesn't satisfy input
- Integrated scheduler: `engine.workflow.schedule('cron', input)`
- Internalized services: `engine.ingestWorker`, `engine.stepTask`, `engine.agents`, `engine.shutdown()`
- k6 benchmarks: PG-only ≈ Redis up to ~5k req/s
- Published `@goatlab/delphi-core@0.2.6`
- Sodium: `delphi.config.ts` 228→62 lines, pgroll migration 0054 generated (21 ops)

## Immediate Blockers

### 1. `connector` type missing from published dist
Source is correct (`connector` NOT in Omit). Published dist is stale.
**Fix**: `cd packages/delphi-core && rm -rf dist && npx tsc -p tsconfig.build.json` then publish 0.2.7

### 2. pgroll migration fails locally
Columns already exist from prior `runMigrations(db)` call (now removed).
**Fix**: Recreate local DB, then `sodium db:sync`

## Next Major Feature: Internalize Cross-Tenant Dispatch

Sodium's pattern (1 backend, N tenant DBs, O(1) Redis connections):
- `queue.ts`: BullMQConnector with tenant-prefixed keys + `onAfterQueue` hint dispatch
- `dispatch.resource.ts`: hint listener → lazy-load tenant → route to handler
- ~200 lines of boilerplate every multi-tenant consumer would need

This should be `createEngine({ database, tenantId, multiTenant: true })`.

Key files: `sodium/apps/backend/src/config/queue.ts`, `sodium/apps/backend/src/config/dispatch/`

## Key Files

| File | Purpose |
|---|---|
| `packages/delphi-core/src/workflow/createEngine.ts` | Main factory — all services |
| `packages/delphi-core/src/engine/PgConnector.ts` | PG-only dispatch |
| `packages/delphi-core/src/engine/WorkflowEngine.ts` | Core engine (raw SQL) |
| `packages/delphi-core/src/workflow/Workflow.ts` | Base class, `step()`, auto-pass types |
| `packages/delphi-core/src/db/DbClient.ts` | pg.Pool wrapper |
| `packages/delphi-core/loadtest/k6-breakpoint.js` | PG vs Redis crossover test |

## Tips
- `npx tsc -p tsconfig.build.json` for clean build (excludes tests). `pnpm build` runs lint which has 40 unused var warnings.
- Tests need Docker (testcontainers). `workflow.spec.ts` works without Docker.
- `LiteralOnly<T>` in WorkflowsApi prevents ShouldQueue wide `string` index signatures from swallowing engine service properties.
- When publishing: ALWAYS `rm -rf dist` first. Default `tsc` includes tests.
