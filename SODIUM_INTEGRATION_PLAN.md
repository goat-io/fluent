# Sodium ↔ Goat Agents Engine — Full Context & Integration Plan

> **Status**: planning + handover document, ready to execute in any session.
> **Last updated**: 2026-04-15
> **Audience**: another agent or engineer with **zero prior context**. This document is self-contained — read it cold and you should be able to pick up where we left off.
>
> **What changed since 2026-04-14**: the public authoring API has been rewritten — class-based `Workflow` + `Step` subclasses replace `WorkflowBuilder`, `createEngine({ workflows: [...] as const })` returns a fully-typed engine proxy (`engine.payment_critical.startCommitted({...})`), and `@goatlab/tasks-core` `ShouldQueue` instances can be passed **directly** to `createEngine` — auto-adapted as single-step workflows. A workflow-level `durability: 'buffered' \| 'committed'` flag was added with fsync-durable commit semantics + batched COPY idempotency. See §1.5 (commits `510df67` + `71005bd`), §1.6 (new buffered-vs-committed perf table), and §2.0 decision #9 for what this means for the integration.

---

## How to read this document

Three sections, read in order:

1. **PART 1 — Context** (what exists, what we built, what we measured). Read this first or you won't understand anything in Part 2.
2. **PART 2 — The integration plan** (concrete files, code, commands, sequencing).
3. **PART 3 — Reference** (commit history, file index, knobs, gotchas, "things you'll find in the codebase that may surprise you").

If you just need to ship: skim PART 1, follow PART 2.

---

# PART 1 — CONTEXT

## 1.1 What this is about

There are **two repos** involved:

- **`fluent`** (`/Users/icabrera/Documents/Code/fluent`) — open-source monorepo, contains the agents engine and adapters we built. **You are here.**
- **`sodium`** (`/Users/icabrera/Documents/Code/sodium`) — closed-source SaaS backend that will adopt the engine. Ignacio's main product.

The goal is to integrate the agents engine into sodium's existing Express + Postgres + Redis + Prisma + BullMQ stack, ideally **replacing sodium's existing task system** (queue-based background jobs) with workflows over time.

## 1.2 What "agent engine" means here

`@goatlab/delphi-core` is a TypeScript distributed workflow engine inspired by Hatchet, Temporal, Trigger.dev. It runs DAGs of steps over Postgres (source of truth) + BullMQ (execution queues) with:

- **Class-based authoring API** — subclass `Workflow` + `FunctionStep`, compose typed step instances via `step()`, call through `createEngine({ workflows: [...] as const })` returning a typed proxy (`engine.payment_critical.startCommitted({...})`). No string handler names, no `executorConfig` blobs at the call site.
- **`ShouldQueue` auto-adaption** — pass a bare `@goatlab/tasks-core` task directly to `createEngine` and it becomes a single-step workflow with the task's `taskName`/`retries` preserved and `TInput`/`TResult`/`TName` generics threaded through to the typed proxy.
- **Workflow-level durability** — each workflow declares `durability: 'buffered' \| 'committed'`. Buffered (default) returns the runId ~1-2ms after the trigger hits the in-memory `IngestBuffer`; committed blocks until the `workflow_runs` row has been COPY-FROM'd and COMMIT'd to PG with `synchronous_commit=ON`. Batched CO PY + fsync amortized across concurrent committed callers via `BatchedJobProcessor`.
- Idempotent starts (UNIQUE constraint on `idempotencyKey`) — the committed path pre-checks existing rows per tenant + within-batch first-wins, so payment-style double-submits return the original `runId` instead of duplicating.
- Per-step retries with backoff
- Human-in-the-loop (`waitForHuman` step result → `WAITING_HUMAN` state)
- External actions with exactly-once semantics (`engine.externalActions.run(...)`)
- Event ingestion + trigger matching
- Budget enforcement (token, cost, step count)
- Lineage (`traceId` shared across runs/events/external actions)
- Cron scheduling (`SchedulerService`)
- Remote worker nodes (HTTP long-poll)

Plus the perf optimizations we built today (described in §1.5).

## 1.3 Repository tour — what's in `fluent/packages/`

You should clone or read the source. Here's the map:

### Engine + adapters (the core of what we built/extended)

| Package | What it is |
|---|---|
| **`delphi-core`** | The engine itself. Workflow DSL, state machine, queue-first ingestion, batched DB writes, all the perf tricks |
| **`delphi-express`** | Express adapter. `agentsRouter()` factory mounts every workflow endpoint via a `resolveAgents(req)` callback |
| **`delphi-bun`** | Same idea for Bun's `Bun.serve()` runtime |
| **`delphi-ai`** | Multi-provider LLM adapter (OpenAI/Anthropic/Google/Ollama) + tool-call loop + multi-agent consensus |
| **`delphi-langgraph`** | LangGraph `StateGraph` runs as engine steps, with PG checkpointing |
| **`delphi-sandbox`** | Docker-isolated step execution with network lockdown |
| **`delphi-ui`** | Vite + React + ReactFlow workflow dashboard (visual editor + run inspector + metrics + worker monitoring) |

### Queue / task primitives (sodium uses these too)

| Package | What it is |
|---|---|
| **`tasks-core`** | Generic `TaskConnector<T>` interface. Used by all queue adapters. |
| **`tasks-adapter-bullmq`** | BullMQ implementation of `TaskConnector`. **This is what sodium currently uses.** |
| **`tasks-adapter-gcp`** | GCP Cloud Tasks implementation (alternative backend) |
| **`tasks-adapter-hatchet`** | Hatchet implementation (alternative backend) |

### Other packages (mostly orthogonal to this work)

| Package | What it is |
|---|---|
| `fluent`, `fluent-firebase`, `fluent-loki`, `fluent-pouchdb`, `fluent-formio` | Database query interface (the original purpose of the monorepo, predates the agents engine) |
| `js-utils`, `node-utils` | Shared utilities (used by everything) |
| `formio-utils`, `uploads`, `node-backend`, `node-xlsx`, `node-metascraper` | Goat ecosystem helpers |
| `metabase`, `typesense` | Specific service integrations |
| `tsconfig`, `biome` | Shared dev configs |
| `docs`, `benchmarks`, `dev` | Internal tooling |

**For this work, you only need to know `delphi-core`, `delphi-express`, `tasks-core`, `tasks-adapter-bullmq`.** Everything else is irrelevant to the integration.

## 1.4 What sodium looks like (`sodium/apps/backend/`)

The relevant pieces for this integration:

| Sodium file | What it does | Why we care |
|---|---|---|
| `src/main.ts` | Express bootstrap, CORS, tenant resolution | Where agentsRouter mounts |
| `src/router_express.ts` | All Express routes mounted | Add one line: `app.use('/api/workflows', agentsResource)` |
| `src/router.ts` | tRPC router (parallel to Express) | Stays as-is; coexists |
| `src/config/_container.ts` | DI container (`withContainer(req)` → tenant context) | Engine factory uses this |
| `src/config/queue.ts` | Per-tenant `BullMQConnector` factory (`getQueueConfig(ctx)`) | Engine **reuses** this connector — no duplicate setup |
| `src/config/database/getConfiguredPrismaClient.ts` | Per-tenant Prisma + Kysely + shared `pg.Pool` | Engine **reuses** `getSharedPool()` for `pgPool` |
| `src/config/dispatch/dispatch.setup.ts` | Cross-tenant dispatch hint registry (BullMQ on platform Redis namespace) | Engine queues route through here |
| `src/config/dispatch/dispatch.resource.ts` | `POST /dispatch/worker` HTTP endpoint that processes hints | Will be upgraded in Phase 0 |
| `src/config/dispatch/platform-task-workers.ts` | Persistent BullMQ workers for long-running platform tasks (race-condition workaround) | Pattern we'll fully replace with workflows |
| `src/config/multitenant/` | Tenant resolution, custom domains, multi-tenant middleware | Engine respects this — `req.tenant.id` resolves naturally |
| `src/services/auth/better-auth.factory.ts` | LRU+TTL per-tenant `betterAuth` instance cache | **Direct model for our engine factory** — copy the shape |
| `src/api/realtime/` | SSE controller + per-tenant Redis subscriber pool + BroadcastConfigTask | Phase 2 candidate for extraction; engine event hook integrates here |
| `src/config/tasks.ts` | Task name registry for dispatch | Engine queue handlers register here |

### Sodium's current architecture in 30 seconds

- **Multi-tenant**: every tenant has its own DB (`DATABASE_URL` per tenant secret), own Redis namespace (`{tenant:${id}:bull}` key prefix), own better-auth instance
- **Express + tRPC**: HTTP API, tRPC procedures, tenant resolved by middleware before any handler
- **DI container**: `withContainer(req)` builds a per-tenant context with all services (queue, secrets, db, etc.). Cached in-process per tenant.
- **Tasks via dispatch model**: `connector.queue('foo', data)` → BullMQ enqueue → `onAfterQueue` hook posts a "hint" to a platform-tenant dispatch queue → some pod picks the hint → POSTs to `/dispatch/worker` → bootstraps tenant context → spawns ephemeral BullMQ Worker → drains 1 job → exits. **Designed to avoid persistent per-tenant workers across N tenants.**
- **Realtime/SSE**: per-tenant Redis pub/sub via `TenantSubscriberPool`, single subscriber connection per tenant fans out to N in-process SSE sessions
- **Cloud Run deployment**: 4-ish API pods, all stateless, scaled by HTTP concurrency

### The dispatch design constraint that drives everything

Sodium can NOT have N tenants × M queues × persistent BullMQ Workers per pod. With 50 active tenants × 4 queues × 4 pods = 800 workers per pod. Resource explosion (memory, Redis connections, ioredis instances). That's **why** they built the dispatch system.

**Any integration we propose must respect this constraint.** The engine in our test harness uses persistent workers (`connector.listen({ tasks: [...] })`) — fine for benchmarking, but won't scale in sodium without changes.

## 1.5 What we built today (chronological)

A summary of every commit, what it does, and why. Read this if you want to understand the engine's internals without reading the source.

### Commit 1: `6933e9d` — Queue-first ingestion (5k req/s @ p95<100ms on 2 vCPU)

**Problem**: synchronous `engine.start()` does 2 PG INSERTs + 1 BullMQ enqueue on the request thread → ~600 req/s ceiling on 2 vCPU.

**Solution**: HTTP path returns immediately with `{runId, traceId, status: 'QUEUED'}` after pushing to an in-memory buffer. A worker accumulates these and writes them to PG via `COPY FROM` in batches.

**Code**:
- `IngestBuffer` (`packages/delphi-core/src/engine/IngestBuffer.ts`) — HTTP-side accumulator. Flushes via `connector.bulkQueue([...])` (or BullMQ's `addBulk` directly) every 200 jobs or 50ms.
- `IngestWorker` (`packages/delphi-core/src/engine/IngestWorker.ts`) — BullMQ-side accumulator. Each handler call returns a promise; the promise resolves only after the batch flushes. Calls `engine.startBatchCopy(triggers)` for the actual COPY FROM.

**Other things in this commit**:
- Cluster mode (`CLUSTER_MODE=auto|off|N`) — Node `cluster` module, primary forks N children, all bind same HTTP port (kernel SO_REUSEPORT), all consume same BullMQ queues. Mirrors what production deploys do.
- Status fallback — `/workflows/status` checks BullMQ for in-flight jobs when PG row doesn't exist yet (returns `status: 'QUEUED'` with traceId from the job payload).
- `/health` returns 503 if no ingest worker is registered (catches "silent accept and stall" failure mode).
- Schema bootstrap via `pg_advisory_lock(4242)` — multiple cluster workers race on `CREATE TYPE`, so we serialize.

### Commit 2: `1af2ae7` — READMEs for 6 agent-platform packages

delphi-core, delphi-ai, delphi-langgraph, delphi-sandbox, delphi-ui, tasks-adapter-bullmq. Each ~100-200 lines covering architecture, install, quick start, key exports.

### Commit 3: `8986ac9` — 2× drain rate via fixed batch sizing

**Problem**: under sustained load, ingest worker drained at only ~250 runs/sec to PG. Way slower than HTTP accept rate.

**Investigation**: added `INGEST_TIMING=1` env var that prints per-batch wall time:
```
[COPY] 50r begin=32ms runs=8ms steps=30ms commit=7ms
```
Found that **batches were stuck at 50 rows** (not the configured 200) because BullMQ ingest concurrency was 50 — the `IngestWorker` accumulator could never fill past concurrency cap.

**Fixes**:
- Bumped `workflow_ingest` BullMQ concurrency to 300 — batches now actually fill to 100-200
- Merged `BEGIN; SET LOCAL synchronous_commit = OFF;` into a single `client.query()` — saves one Postgres roundtrip per flush (~30ms in Docker VM)
- `escJson()` specialized escape for JSON.stringify output (one regex vs four — JSON output never contains raw `\t \n \r`)
- Cached per-engine constants (`budget`, `budgetUsed` JSON) — they're identical for every row, no point re-stringifying

**Result**: drain rate 940/s → 1930/s (2.05×). HTTP @ 4k went from p95=49ms to p95=24ms.

### Commit 4: `1f8dca8` — Dockerfile + docker-compose

Multi-stage Dockerfile that builds the workspace deps and runs the test-server via tsx. `docker-compose.yml` with PG 18 + Redis 7 + app, healthchecks, 2 vCPU/2 GB resource limit (matches Cloud Run starter).

`test-server/server.ts` now skips testcontainers when `PG_HOST` and `REDIS_HOST` are pre-set externally — same code runs locally OR in Compose OR in Cloud Run.

### Commit 5: `520404f` — Root README handover section

Added a comprehensive "Agent Workflow Engine — Run, Test, and Load-Benchmark" section to the repo README with quick-start, endpoint reference, performance reference, tuning knobs, and cross-links to per-package READMEs.

### Commit 6: `a89d4ae` — `WriteBuffer<T>` + retention + prod tuning + scheduler docs

**`WriteBuffer<T>`** (`packages/delphi-core/src/engine/WriteBuffer.ts`) — generic batched-write accumulator. The Hatchet pattern abstracted into a primitive: `flushFn`, `flushThreshold`, `flushIntervalMs`, `maxJitterMs`, `maxConcurrentFlushes`, snapshot-and-swap, re-prepend on failure.

Refactored the existing `logBuffer` in `WorkflowEngine.ts` to use it. Same behavior, cleaner code, ready for new consumers.

**`bin/retention-cleanup.ts`** — cron-friendly script that drops terminal-state runs/events older than `RETENTION_DAYS` (default 30, matching Hatchet). Active runs preserved regardless of age. Steps + logs cascade-delete via FK. Batched deletes (10k rows per batch) with yield between batches. K8s CronJob template in script header.

**Docker compose production tuning** — commented overrides per Hatchet's recommendations for installations >500GB:
- `maintenance_work_mem=2GB`
- `max_wal_size=15GB`
- `autovacuum_max_workers=10`, `autovacuum_vacuum_threshold=25`, `autovacuum_vacuum_cost_limit=1000`

**README scheduler extraction story** — when `SchedulerService` becomes the bottleneck (high cron-trigger volume), how to extract to a dedicated instance.

### Commit 7: `2502050` — Step-status batching (per Hatchet pattern)

**Problem**: every step transition (`markStepRunning`, `onStepCompleted`, `onStepFailed`) does a sync UPDATE on `workflow_steps`. Under load, that's N RTTs per second.

**Solution**: `StepStatusBuffer` (`packages/delphi-core/src/engine/StepStatusBuffer.ts`) — batches updates and flushes via a single `UPDATE … FROM unnest($1::text[], $2::text[], ...)` per ~100 transitions.

**Critical invariant**: per-step promise from `enqueue()` resolves ONLY after the UPDATE has COMMITTED. Caller (`WorkflowStepTask` via `engine.markStepRunning` / `onStepCompleted`) awaits the promise before returning, so BullMQ ack ↔ PG commit stay coupled. **A crash between BullMQ ack and PG commit is impossible by construction.**

Wired through hot paths: `markStepRunning`, `onStepCompleted` (COMPLETED + WAITING_HUMAN), `onStepFailed` terminal. Edge cases (retry transition, nextStep redirect, budget-exceeded) stay on sync UPDATE — small blast radius, low volume.

SQL shape:
```sql
UPDATE workflow_steps AS s
SET status        = v.status,
    output        = CASE WHEN v.output IS NOT NULL THEN v.output ELSE s.output END,
    error         = CASE WHEN v.error  IS NOT NULL THEN v.error  ELSE s.error  END,
    "completedAt" = CASE WHEN v.completed_at IS NOT NULL THEN v.completed_at ELSE s."completedAt" END,
    -- ...
    "updatedAt"   = NOW()
FROM (SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[],
                           $5::timestamp[], $6::timestamp[], $7::text[])
      AS t(id, status, output, error, completed_at, started_at, human_prompt)) AS v
WHERE s.id = v.id
```

**Validated**: 213,187 workflows fired → 213,188 in PG → 213,188 reached COMPLETED, 0 failures. Sustained ~770 completions/sec on 2 vCPU.

### Commit 8: `27e9b76` — Pluggable adapters (delphi-express + Prisma fragment + schema isolation)

**`@goatlab/delphi-express`** — generic Express router factory:
```ts
app.use('/api/workflows', agentsRouter({
  resolveAgents: async (req) => ({ engine, ingestBuffer, tenantId }),
}))
```
Mounts 12 endpoints. No tenant/auth assumptions. Per-route enable/disable. Custom error mapper hook. ~250 LOC.

**`WorkflowEngine.schema` config option** — `schema: 'agents'` makes engine queries use `agents.workflow_runs` instead of `public.workflow_runs`. One-line constructor wrap (`this.db = config.db.withSchema(schema)`); raw COPY FROM strings interpolate the prefix; `StepStatusBuffer` accepts schema and prefixes its UPDATE SQL too. Default behavior unchanged when `schema` is unset.

**Prisma schema fragment** (`packages/delphi-core/prisma.fragment`) — copy-paste-ready Prisma models for all 12 engine tables, with documented examples for `@@schema("agents")` + multiSchema and for `@@map()` to rename Prisma client view while keeping physical table names default. Engine **does not auto-bootstrap** when user manages schema.

### Commit 9: `1e8d83a` — Express + Prisma example with full load-test script

Full self-contained example app at `packages/delphi-express/example/`:
- `docker-compose.yml`
- `prisma/schema.prisma` (Customer + 12 engine tables in `agents` schema)
- `src/agents.factory.ts` (single-tenant cached engine factory)
- `src/server.ts` (Express app with `agentsRouter` mount)
- `scripts/k6-flat.js` (constant-arrival-rate k6 script)
- `scripts/loadtest.sh` (full lifecycle automation: up → schema push → start → smoke test → k6 sweep → drain verification → tear down)

Validated end-to-end: smoke test → COMPLETED in 2s. 2k req/s × 20s → 0% errors, p95=49ms. Drain → 39,973 fired, 39,973 in PG, 39,973 COMPLETED.

### Commit 10: `2d0ef9b` — Cluster mode in the Express example

Added Node cluster support to the example server (`CLUSTER_MODE=auto|off|N`). Without it, single-process Express tops out at 2-3k req/s; with `CLUSTER_MODE=2` it sustains 4-5k req/s.

Bug fixes in `loadtest.sh`: cleanup kills cluster primary's children (`pkill -P`) before killing the primary; passes through `PG_POOL_SIZE`, `WORKER_CONCURRENCY`, `CLUSTER_MODE` from env.

### Commit 11: `b238b0e` — Express example performance results in README

Recorded actual numbers from running the loadtest: 2k @ p95=62ms, 4k @ p95=102ms, 5k @ p95=171ms (saturating), 0% errors, 316,929 fired → 316,930 COMPLETED. Plus side-by-side comparison vs raw `node:http` showing Express adds ~20% latency overhead but doesn't slow the engine itself.

### Commit 12: `0d82940` — `@goatlab/delphi-bun` adapter + Bun + Prisma example

Mirror of the Express adapter, using `Bun.serve()`'s fetch handler API. Bun supports clustering via `reusePort: true` (no `node:cluster`); we spawn N child processes that all bind the same port.

**Findings (honest comparison vs Express, same engine, same hardware)**:
- Bun WINS on HTTP latency: p50 at 2k drops 23ms → 6ms (4× lower)
- Bun LOSES on saturation: 5k cliff at 0.86% errors vs Express's 0% at 4.5k
- Bun LOSES on drain rate: ~480/s vs ~730/s on Node (Bun's Node compat layer adds overhead to `pg` + `bullmq`)

Bun is best for latency-sensitive front-door services; Node still wins for workflow-heavy workloads until pg/ioredis run at native speed under Bun.

### Commit 13: `1e34216` — `bulkQueue` promoted to `TaskConnector` interface

**Why**: `delphi-core` was implicitly coupled to BullMQ (used `connector.getQueue(name).addBulk(...)` which is BullMQ-specific). To make delphi-core truly backend-agnostic, we promoted bulk enqueue to the `TaskConnector` interface.

**Changes**:
- `TaskConnector.bulkQueue?(jobs[])` — optional method, returns `TaskStatus[]`
- `BullMQConnector.bulkQueue` — implementation: groups jobs by `taskName`, calls `Queue.addBulk` per queue (one Lua script per queue, vs N RTTs for queue() loop), preserves `onAfterQueue` hook firing
- `IngestBuffer` config: `{ connector, taskName }` (preferred) OR `{ queue: connector.getQueue(...) }` (legacy compat)
- `WorkflowEngine.dispatchStepsBulk` — builds bulk job list once, calls `connector.bulkQueue(jobs)` if available, else parallel dispatchStep() loop

**No perf regression** — quick load test showed 2k @ p95=45ms, 4k @ p95=83ms, 0% errors. Same as before.

### Commit 14: `510df67` — Workflow durability flag (`buffered` vs `committed`) + idempotency

**Why**: the existing `/start-async` path returned 200 as soon as the trigger hit the in-memory `IngestBuffer` — fast (~1-2ms) but with a ~70ms crash window before the batch flush to PG. Payment-style flows need an honest "accepted = durable on disk" ack.

**Changes**:
- `WorkflowDefinition.durability: 'buffered' \| 'committed'` (optional; default `buffered`)
- `IngestBuffer.enqueueCommitted(trigger)` — returns `Promise<{runId, traceId}>` resolving only after `workflow_runs` row has been COPY-FROM'd and COMMIT'd. Uses a second `BatchedJobProcessor` wired directly to `engine.startBatchCopy()` from the HTTP process (bypasses BullMQ since the caller is blocked anyway).
- `WorkflowEngine.startBatchCopy(triggers, { synchronousCommit, checkIdempotency })`:
  - `synchronousCommit: true` — the COPY transaction uses `SET LOCAL synchronous_commit = ON` so COMMIT blocks until WAL fsync. Committed workflows always pass true. Fixes a correctness bug: the previous hard-coded `synchronous_commit = OFF` made `durability='committed'` a lie.
  - `checkIdempotency: true` — pre-fetches existing rows by `(tenantId, idempotencyKey)` per tenant (one SELECT per tenant per batch), dedupes both against PG and within-batch first-wins. Required so payment-style double-submits return the original `runId`. Buffered path doesn't dedupe by default (skips the extra SELECT).
- Generic HTTP adapter + `delphi-express` dispatch by `definition.durability`.
- Production-like PG settings in the test server (`fsync=on, synchronous_commit=on, full_page_writes=on`) — the prior fsync=off dev settings made the durability story dishonest under load.

**Perf** (cluster=2, prod-like PG — see §1.6 new table): buffered ~4k rps @ p95 37ms; committed ~1.6k rps @ p95 151ms; 0% errors both paths. Committed is 2.5× slower throughput and adds ~120ms p95 latency for honest on-disk durability. `BatchedJobProcessor` amortizes fsync across ~100 concurrent committed callers so per-caller fsync cost is ~0.1ms.

### Commit 15: `71005bd` — Class-based workflow API + `ShouldQueue` auto-adaption

**Why**: the `WorkflowBuilder.create('x').step('y', { executorType: 'function', executorConfig: { handler: 'z' } }).build()` shape was string-heavy — typos compile, refactors don't follow renames, step outputs lose their type through `mapInput`. Sodium-style `taskClasses` (typed class per task) is strictly better ergonomically. Also: a task is essentially a one-step workflow, so sodium's existing task catalogue should plug into delphi without rewriting.

**Changes**:
- `Step` + `FunctionStep` abstract base classes with `TInput`/`TOutput`/`TName` generics. Subclass and override `handle()`.
- `Workflow` abstract base + `step()` composition helper. Typed `dependsOn` by reference (not string), typed `mapInput` with `StepOutputs<TDeps>` mapped-type over upstream step outputs.
- `createEngine({ workflows: [...] as const })` — returns a `WorkflowEngine` subtype where each workflow is an addressable property with typed input/signal/return shapes:
  ```ts
  await engine.payment_critical.startCommitted({ orderId, amountCents, customerId })
  ```
  Auto-registers step handlers under namespaced keys (`<workflowName>.<stepName>`) and constructs the `IngestBuffer` internally. Refuses workflow names that collide with `WorkflowEngine` methods at construction time.
- `fromShouldQueue(task)` — adapts a `@goatlab/tasks-core` `ShouldQueue` as a typed `FunctionStep` instance. Preserves `TInput`/`TResult`/`TName` generics.
- `workflowFromShouldQueue(task)` — adapts as a single-step `Workflow` instance.
- **`createEngine` auto-detects `ShouldQueue` instances** in its `workflows` array via `instanceof` and wraps them on the fly. Sodium's existing `taskClasses` array plugs in directly:
  ```ts
  createEngine({ workflows: [paymentWorkflow, ...taskClasses.map(Cls => new Cls())] as const, ... })
  await engine.check_post.start({ postId })   // fully typed, no rewriting
  ```
- `WorkflowBuilder` kept as internal-only primitive (still powers the 30+ existing engine tests). Removed from public exports.
- 39 tests in `workflow.spec.ts`, 11 type-level via `expectTypeOf` + `@ts-expect-error` (verify input/output/name generics flow, wrong call-site input rejected at compile time, mixed `Workflow` + `ShouldQueue` arrays typecheck).

**Migration cost for sodium**: drops dramatically. The 28 existing `ShouldQueue` task classes in `sodium/apps/backend/src/config/tasks.ts` become usable as delphi workflows by passing the array directly to `createEngine`. No per-task rewriting required.

**No perf regression** — cluster=2 prod-PG: buffered p50 6ms / p95 37ms / p99 106ms; committed p50 72ms / p95 151ms / p99 245ms. Identical throughput to pre-refactor (4k buffered / 1.6k committed sustained, 0% errors).

## 1.6 The full performance picture

All measured on the same machine (M-series Mac, Docker Desktop with PG+Redis containers). **Cloud Run with managed PG/Redis will be faster** because (a) no Docker Desktop VM overhead, (b) PG/Redis on dedicated machines, (c) GCP VPC sub-millisecond network.

### Single-vCPU baseline (CLUSTER_MODE=off, single Node process)
- HTTP queue-first: ~2-3k req/s, p95 < 50ms
- Drain: ~400 runs/sec

### 2-vCPU cluster (CLUSTER_MODE=2, what Cloud Run starter shape gives you)

| Rate | p50 | p95 | p99 | Errors | Sustained |
|---|---|---|---|---|---|
| 2,000 req/s | 6-23ms (Bun-Express) | 50-62ms | 161-186ms | **0%** | 1,984/s ✓ |
| 4,000 req/s | 11-48ms | 72-102ms | 192-1507ms | **0%** | 3,753-3,908/s ✓ |
| 5,000 req/s | 23-80ms | 49-171ms | 824-7779ms | 0-0.86% | 4,460/s (saturating) |

Drain: ~700-770 completions/sec sustained.

### 2-vCPU cluster, buffered vs committed durability (production-like PG)

Apples-to-apples at cluster=2 with `fsync=on, synchronous_commit=on, full_page_writes=on` (production defaults). Committed path uses `synchronous_commit=ON` inside the COPY transaction so COMMIT actually fsyncs the WAL; `BatchedJobProcessor` amortizes fsync across every concurrent caller in the batch. Measured post-class-API rewrite (3 buffered + 2 committed iterations; medians shown).

| Metric | Buffered (`fast_single`) | Committed (`payment_critical`) |
|---|---|---|
| Sustained peak RPS | **4,000** | **1,600** |
| p50 | 6 ms | 72 ms |
| p95 | 37 ms | 151 ms |
| p99 | 106 ms | 245 ms |
| max | 474 ms | 543 ms |
| Error rate | 0.00% | 0.00% |

**Tradeoff**: committed costs ~2.5× throughput and ~120ms p95 for honest "row fsync'd to disk before we say 200." Trivially within payment SLOs. The gap is NOT the fsync itself — that's amortized — it's per-caller flush coordination. Horizontal scaling applies the same ~linear way as buffered.

Reproduce: `k6 run packages/delphi-core/loadtest/k6-workflow-buffered.js` then `k6 run packages/delphi-core/loadtest/k6-workflow-committed.js` against `CLUSTER_MODE=2 npx tsx packages/delphi-ui/test-server/server.ts`.

### 16-core (CLUSTER_MODE=auto → 15 workers)
- HTTP: ~17,000 req/s sustained, 0% errors, p95<100ms
- Drain: similar (~700-1000/s, PG-bound)

### 10-minute soak test (5k req/s sustained)
- 2,872,865 workflows accepted
- 0.06% transient HTTP errors (Node accept-queue overflow at peaks)
- 0 BullMQ failed jobs
- All workflows eventually drained to PG (verified row-count parity)

### Express vs Bun vs raw node:http (same engine, same hardware)

| Layer | 2k p50 | 4k p95 | 5k sustained | Drain rate |
|---|---|---|---|---|
| Raw `node:http` (test-server) | n/a | 85ms | 5,000/s | ~730/s |
| **Bun + Bun.serve** | **6ms** | **72ms** | 3,485/s ⚠ | 480/s ⚠ |
| Express | 23ms | 102ms | 4,460/s | ~730/s |

### What we learned about ceilings

- **HTTP layer**: each Node process maxes around 2-3k req/s. Cluster N processes → ~Nx HTTP throughput.
- **Drain rate**: bound by PG COPY FROM throughput + Node CPU on JSON serialization. Not improved by cluster mode (each pod adds workers, but PG is the bottleneck).
- **Docker Desktop VM**: adds ~2-5× latency overhead on macOS vs native Linux. Production Cloud Run should match raw `node:http` numbers (~5k/s @ p95<100ms on 2 vCPU).
- **Pool sizing**: PG_POOL_SIZE=20 per worker × N workers. With 2 workers = 40 connections; CloudSQL max_connections=200. Safe up to ~5 cluster workers on default Cloud SQL.

## 1.7 How we test

### k6 load testing

Install: `brew install k6`

**Test scripts**:
- `packages/delphi-core/loadtest/k6-workflow.js` — multi-scenario benchmark (start, batch, event, status). Hatchet-style sweep up to 2000 req/s.
- `packages/delphi-express/example/scripts/k6-flat.js` — simpler constant-arrival-rate flat sweep, configurable via env.

**Common invocation**:
```bash
# Run against running test-server
API_URL=http://localhost:4445 k6 run packages/delphi-core/loadtest/k6-workflow.js

# Sweep one rate against the example
cd packages/delphi-express/example
API_URL=http://localhost:3000 MODE=async RATE=5000 DUR=30s k6 run scripts/k6-flat.js

# Full lifecycle (recommended)
cd packages/delphi-express/example
SWEEP="2000 4000 5000" DUR=30s pnpm loadtest
```

### `loadtest.sh` orchestration script

Located at `packages/delphi-express/example/scripts/loadtest.sh` (and similar in `packages/delphi-bun/example/`). Does:

1. Verify prereqs (k6, docker, pnpm, [bun])
2. `docker compose up -d` (PG + Redis)
3. Wait for healthchecks
4. `prisma db push --skip-generate` (apply schema)
5. Start the example server in background, wait for `/health`
6. Smoke test: fire one workflow, verify it reaches COMPLETED
7. Run k6 sweep at configurable rates × duration
8. Verify durability: poll Redis queue depth + PG row counts for up to 3 min
9. Final report: total runs, completed, failed; **exits 0 only if every accepted workflow lands COMPLETED with 0 failures**
10. Tear down (unless `KEEP_RUNNING=1`)

Knobs: `SWEEP` (rates list), `DUR` (per-rate duration), `KEEP_RUNNING` (skip teardown), `CLUSTER_MODE`, `PG_POOL_SIZE`, `WORKER_CONCURRENCY`.

### Engine unit/integration tests

```bash
# All engine tests (224 tests, needs Docker for testcontainers)
cd packages/delphi-core && pnpm test

# Skip the long load-test file
cd packages/delphi-core && npx vitest run --exclude="**/load-test*"

# Targeted
cd packages/delphi-core && npx vitest run src/__tests__/engine/lifecycle.spec.ts
```

Each test file has a run hint at the top: `// npx vitest run src/__tests__/...`

### Manual smoke testing

```bash
# Start the test server (testcontainers spin up PG + Redis)
cd packages/delphi-ui
PORT=4445 CLUSTER_MODE=2 PG_POOL_SIZE=20 WORKER_CONCURRENCY=50 \
  npx tsx test-server/server.ts

# In another terminal
curl -s http://localhost:4445/health
# {"ok":true,"ingestWorkers":2,"ingestBufferDepth":0}

curl -s -X POST http://localhost:4445/workflows/start-async \
  -H 'Content-Type: application/json' \
  -d '{"workflowName":"fast_single","input":{"hi":"world"}}'
# {"runId":"...","traceId":"...","status":"QUEUED"}

curl -s -X POST http://localhost:4445/workflows/status \
  -H 'Content-Type: application/json' \
  -d '{"runId":"<paste>"}'
```

### Inspecting state

```bash
# Find PG container
PG=$(docker ps --format '{{.Names}}' | grep postgres | head -1)

# Count runs by status
docker exec $PG psql -U test -d agents_e2e_ui -c \
  "SELECT status, count(*) FROM workflow_runs GROUP BY status;"

# Find Redis container
REDIS=$(docker ps --format '{{.Names}}' | grep redis | head -1)

# Check ingest queue depth (BullMQ keys)
docker exec $REDIS redis-cli LLEN bull:workflow_ingest:wait
docker exec $REDIS redis-cli LLEN bull:workflow_step_light:wait
docker exec $REDIS redis-cli ZCARD bull:workflow_ingest:failed
```

### Per-flush COPY timing instrumentation

Set `INGEST_TIMING=1` env when starting the test-server. Logs each batch:
```
[COPY] 200r begin=1ms runs=15ms steps=38ms commit=3ms
```
Useful for diagnosing where wall-time goes (PG-side COPY vs client-side CPU vs commit RTT).

## 1.8 Architecture deep dive — read this if you need to debug

### Request lifecycle (sync `engine.start()`)

1. HTTP handler → `engine.start({ workflowName, tenantId, input, idempotencyKey? })`
2. Idempotency check: SELECT from `workflow_runs` where `idempotencyKey = ?`. If found, return existing `runId` (409 if conflict by workflow name).
3. INSERT into `workflow_runs` (1 row), INSERT into `workflow_steps` (N root steps marked QUEUED, others PENDING).
4. For each root step: `connector.queue({ taskName: 'workflow_step_<weight>', taskBody: stepPayload })`.
5. Return `{ runId }`.

Total: ~10-40ms (2 PG writes + N enqueues, all on request thread). Throughput: ~600 req/s on 2 vCPU.

### Request lifecycle (queue-first `/workflows/start-async`)

1. HTTP handler → `ingestBuffer.enqueue({ workflowName, tenantId, input, idempotencyKey? })`
2. Generate `runId` (nanoid 21) + `traceId` (nanoid 21 if not provided).
3. Push to in-memory buffer.
4. Return `{ runId, traceId, status: 'QUEUED' }`. **Total: ~1-2ms.**

In background:
5. Buffer flushes when threshold (200) or interval (50ms + jitter) hits → `connector.bulkQueue([...])` (BullMQ does one `addBulk` per queue, one Lua script roundtrip).
6. `IngestWorker` consumes from `workflow_ingest` BullMQ queue. Each `handleJob` returns a promise.
7. Worker accumulates jobs (200 / 20ms threshold). When threshold hits, calls `engine.startBatchCopy(triggers)`.
8. `startBatchCopy`:
   - Builds 2 sets of COPY FROM lines (one for runs, one for steps) — uses cached escaped JSON for `definitionSnapshot`, `executorConfig`, `dependsOn` (per workflow definition), `budget`/`budgetUsed` (per engine instance)
   - Acquires PG client from pool
   - `BEGIN; SET LOCAL synchronous_commit = OFF;` (one roundtrip)
   - COPY workflow_runs (one PG roundtrip + payload)
   - COPY workflow_steps (one PG roundtrip + payload)
   - COMMIT
   - Releases client
   - Calls `dispatchStepsBulk(rootSteps)` → `connector.bulkQueue(...)` for the root step jobs (one Lua script roundtrip per step queue)
9. All per-job promises resolve.

Total batch wall time: ~50-200ms for 100-200 rows. Throughput: ~5000 req/s HTTP, ~700 completions/sec drain on 2 vCPU.

### Step execution lifecycle

1. BullMQ worker on `workflow_step_<weight>` queue picks up a job → `WorkflowStepTask.handle(payload)`
2. `engine.markStepRunning(runId, stepName, tenantId)` — buffered UPDATE (status PENDING/QUEUED → RUNNING + startedAt). Returns when batch commits.
3. `interceptors.beforeExecute(payload)` — chain of user hooks
4. `executor.execute(payload, executionContext)` — runs the registered handler
5. `interceptors.afterExecute(payload, result)`
6. If `result.waitForHuman`: `engine.onStepCompleted` → buffered UPDATE to WAITING_HUMAN with `output` and `humanPrompt`. Workflow paused.
7. Else: `engine.onStepCompleted` → buffered UPDATE to COMPLETED with `output` and `completedAt`.
8. Budget enforcement (steps, tokens, costUsd from `result.output._usage`). If exceeded, fail run.
9. If `result.nextStep`: redirect target step to PENDING, dispatch ready steps. Else: `advanceWorkflow(runId)`.
10. `advanceWorkflow`: SELECT all steps for runId, derive run status, find newly-ready steps (deps satisfied), dispatch them.
11. If all terminal: UPDATE run to COMPLETED/FAILED, fire `onComplete` hook.
12. Promise from `WorkflowStepTask.handle` resolves → BullMQ ack.

Hot path is heavily optimized: 2 buffered UPDATEs (markRunning + completed) become 1 batched UPDATE per ~100 transitions. Logs are also buffered (50 entries / 50ms).

### Schema

All in `packages/delphi-core/src/entities/Database.ts` as Kysely interfaces (no decorators, no reflect-metadata). `CREATE_TABLES_SQL` exports the schema as a string for testcontainers / dev.

12 tables:
- `workflow_runs` — durable run state
- `workflow_steps` — per-step state, FK to workflow_runs (CASCADE)
- `workflow_step_logs` — per-step events (started/completed/etc.)
- `workflow_signals` — signal payloads (resume mechanism for HITL)
- `workflow_events` — ingested events for trigger matching
- `workflow_event_subscriptions` — registered triggers
- `external_actions` — exactly-once external call records
- `worker_nodes` — registered remote workers
- `workflow_definitions` — optional persisted defs (most users use code-defined)
- `workflow_tasks` — task fan-out for `taskManager`
- `workflow_schedules` — cron triggers
- `agent_tokens` — registration tokens for remote workers

JSON columns are TEXT with `toJson()`/`fromJson()` helpers (no jsonb, for portability). Engine writes JSON via Kysely (or direct COPY FROM with pre-stringified text).

### Buffers in the engine (by the numbers)

| Buffer | What | Threshold / Interval | Purpose |
|---|---|---|---|
| `IngestBuffer` (HTTP→Redis) | Triggers from `/start-async` | 200 / 50ms | Batched `addBulk` to BullMQ |
| `IngestWorker` (Redis→PG) | BullMQ jobs of triggers | 200 / 20ms | Batched `COPY FROM` of runs+steps |
| `StepStatusBuffer` (status updates) | `(stepId, status, output, error, ...)` | 100 / 20ms | Batched `UPDATE … FROM unnest(...)` |
| `logBuffer` via `WriteBuffer<T>` (step events) | Log entries | 50 / 50ms | Batched `COPY FROM` of step logs |

All four use the same pattern: snapshot-and-swap buffer, atomic per-flush transaction, re-prepend on failure, per-job promise that resolves only after PG commit (preserving BullMQ ack semantics).

### What's NOT batched yet

- Single `engine.start()` (sync path): 2 PG INSERTs per call. Used by sodium today via `connector.queue`. Will be replaced by `start-async` route.
- External actions: each `engine.externalActions.run(...)` does 2 PG writes (intent + result). Could be batched but lower priority.
- Step retry transition: stays sync (touches `attempt` column not in StepStatusBuffer). Low volume under normal load.

## 1.9 Key knobs and gotchas

### Env vars

| Env | Default | Purpose |
|---|---|---|
| `PORT` | 4444 / 4445 | HTTP port |
| `CLUSTER_MODE` | `auto` | `auto` (cores-1), `off` (single proc), or integer N |
| `PG_POOL_SIZE` | 20 | Postgres pool **per Node process**. Total = workers × this. Cap below `max_connections`. |
| `WORKER_CONCURRENCY` | 50 | BullMQ concurrency per step queue per process |
| `DISABLE_LOG_BUFFER` | false | `true` → synchronous log writes (debugging) |
| `INGEST_TIMING` | unset | `1` → log per-flush COPY wall-time (begin/runs/steps/commit) |
| `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASSWORD` | — | If set, app skips testcontainers and uses external PG |
| `REDIS_HOST`, `REDIS_PORT` | — | Same for Redis |

### Gotchas you will hit

1. **`set -euo pipefail` + grep returning empty exits 1**. Wrap pipes that might match nothing in `{ ...; } || true`. Hit this in `loadtest.sh` healthcheck. Fixed.

2. **Docker Desktop has hard total CPU limit** (default 8 vCPU on M-series Macs). Container CPU limits don't help if PG+Redis+app together exceed the VM. We saw drain rate plateau because PG was hitting 349% CPU while app was at 332% — sum > 8 vCPU available.

3. **Docker `compose ps --format '{{.Service}} {{.Health}}'` doesn't work**. Use `--format json` (one big JSON array on one line) and grep with `grep -o '"Health":"healthy"' | wc -l`.

4. **Bun's Node compat layer is slow for `pg` and `ioredis`**. Bun.serve is fast (HTTP layer), but the engine's drain rate drops ~30% under Bun vs Node because batched JS execution paths through compat.

5. **BullMQ ingest concurrency must be ≥ IngestWorker.flushThreshold**. Otherwise batches can never fill (BullMQ caps in-flight handlers at concurrency). We set ingest queue concurrency to 300 with flushThreshold 200.

6. **CREATE TYPE is not concurrency-safe even with IF NOT EXISTS**. Two cluster workers race → `pg_type_typname_nsp_index` violation. Use `pg_advisory_lock(4242)` to serialize schema bootstrap.

7. **Node cluster needs cleanup of children**. `pkill -P <primary_pid>` before killing primary. Plus a `pkill -f "tsx src/server.ts"` fallback for orphans.

8. **Engine factory must NOT call `connector.close()` on shutdown** — connector is shared with other code. Only `engine.shutdown()` (which doesn't touch the connector).

9. **`pnpm install` + `node-linker=hoisted`**: workspace deps are hoisted to root `node_modules`, not per-package. If you see "Cannot find module" after adding a workspace dep, verify it's in root `node_modules/@goatlab/`.

10. **`pnpm-workspace.yaml` extended to include `packages/*/example`** so example apps are workspace members. Without this, examples can't resolve workspace deps.

## 1.10 How sodium's task system works today (read this before Phase 0)

Critical to understand before changing anything. Detailed in `sodium/apps/backend/src/config/dispatch/`.

### Producer side
1. Some endpoint calls `connector.queue({ taskName: 'foo', taskBody: data, ... })`.
2. BullMQ enqueues to `{tenant:${id}:bull:foo:wait`.
3. `BullMQConnector.onAfterQueue` hook fires (configured in `getQueueConfig`):
   - Posts a "hint" via `getHintRegistry().queue({ dispatchHints: { tenantId, queueName, jobId, dispatchUrl } })`
   - Hint goes to platform-tenant dispatch queue: `{tenant:sodium-platform:dispatch:wait`

### Consumer side
1. Some pod's BullMQ worker on the dispatch queue picks up a hint.
2. Posts HTTP to `localhost:8086/dispatch/worker` with `{queueName, jobId}` body and `X-Tenant-ID` header.
3. `dispatch.resource.ts` `POST /dispatch/worker` handler:
   - Returns 202 immediately (so dispatch listener doesn't block on long tasks)
   - Async: `withContainer(tenantId, async ctx => { ctx.queueService.getDefault().processIncomingDispatch({...}) })`
4. `BullMQConnector.processIncomingDispatch`:
   - Spawns ephemeral `Worker` (autorun: false) on the named queue
   - `tempWorker.waitUntilReady()` (workaround for ioredis connection race)
   - **`while (Date.now() < deadline)`: `getNextJob('dispatch')` → `await handleTask(queueName, job.data)` → `moveToCompleted` → repeat**
   - On exit: `tempWorker.close()`

### Why this design
N tenants × M queues × persistent BullMQ Workers = resource explosion. Dispatch model spawns workers ephemerally per dispatch HTTP call. Tenant context bootstrapped once per call. **Lazy** — tenants with no jobs use no resources.

### The constraint this places on us
**`processIncomingDispatch` is sequential.** Each `handleTask` is awaited before the next `getNextJob`. Throughput per dispatch HTTP call: ~50 jobs/sec.

**For the engine, this is a problem.** `IngestWorker.handleJob` returns a promise that only resolves after batch flush (20ms minimum). Sequential dispatch calls = 50 inserts/sec ceiling.

**Solution**: Phase 0 below — upgrade `processIncomingDispatch` to do parallel batched processing, using the same `BatchedJobProcessor` primitive that `IngestWorker` and `StepStatusBuffer` use.

### Persistent workers exception
`platform-task-workers.ts` spawns persistent BullMQ Workers for tasks that can't go through dispatch (race condition with `processIncomingDispatch.waitUntilReady`). This is the model we'll use for engine queues short-term, but Phase 0 fixes the underlying issue so we don't need this workaround long-term.

---

# PART 2 — THE INTEGRATION PLAN

## 2.0 Architecture decisions (all made; documented for posterity)

### 1. Single Cloud Run service, not a split deployment
Originally considered separate "agent-worker pod". **Rejected** because (a) sodium's dispatch model already solves the per-tenant worker explosion problem, (b) splitting deployments adds ops complexity, (c) Phase 0's dispatch v2 makes engine queues compatible with sodium's existing infrastructure.

### 2. Postgres schema isolation (`agents.workflow_runs`)
Engine tables live in their own PG schema (`agents`), not `public`. Cleaner, no name collisions, native Prisma support via `previewFeatures = ["multiSchema"]`. Sodium owns schema migrations via pgroll. Engine does NOT auto-bootstrap.

### 3. Multi-tenant factory mirrors `better-auth.factory.ts`
Per-tenant `WorkflowEngine` instances cached in LRU map with TTL eviction. **Same pattern as `better-auth.factory.ts`** — instance cache, 30-min TTL, 50 max size. **Critical**: factory shutdown must NOT call `connector.close()`.

### 4. Dispatch v2 — parallel batched processing
Replace `processIncomingDispatch`'s sequential `while` loop with parallel batch pull + `Promise.allSettled`. Extract `BatchedJobProcessor<TJob, TResult>` from `IngestWorker`'s pattern, use it in three places (IngestWorker, StepStatusBuffer, processIncomingDispatch).

### 5. Pool sizing — PgBouncer when scaling
≤5 active tenants: defaults work. Past that: PgBouncer in transaction mode. Worth doing regardless — benefits sodium's existing Prisma load too.

### 6. Realtime/SSE — extract sodium's `TenantSubscriberPool` as a reusable package
`shared-subscriber.ts` becomes `@goatlab/realtime-broker`. Engine gets optional `onEngineEvent` hook. Sodium's existing SSE controller subscribes to engine events.

### 7. Per-tenant tables stay in tenant DB
Engine tables go in **tenant's** Prisma DB, not a shared platform DB. Same connection string, same Prisma client, same connection pool.

### 8. Sodium's task system becomes delphi workflows instantly via ShouldQueue auto-adaption
The previous plan was "migrate one task per week to a `WorkflowBuilder` definition." With `createEngine`'s `ShouldQueue` auto-detection (commit `71005bd`), sodium's existing `taskClasses` array (in `config/tasks.ts`) is passable **directly** — zero rewriting:

```ts
createEngine({
  workflows: [...taskClasses.map(Cls => new Cls())] as const,
  db, pgPool, connector, tenantId,
})
await engine.check_post.start({ postId })     // check_post was a ShouldQueue, now a typed workflow
```

Every existing task instantly becomes: DB-durable (PG `workflow_runs` row), idempotent (via `idempotencyKey`), retryable, observable (state transitions emit events), traceable (`traceId` lineage), optionally committed (via `override durability = 'committed' as const` on a companion `Workflow` class). **Migration is opt-in, not mandatory** — only promote a task to an explicit `Workflow` subclass when you want multi-step DAG composition, human-in-the-loop, signals, or `committed` durability.

### 9. Class-based authoring API is the default surface
- Public API: `Workflow` + `FunctionStep` subclasses, composed via `step()`, wired through `createEngine({ workflows: [...] as const })`.
- `WorkflowBuilder` is internal-only (still powers engine tests); not exported from `@goatlab/delphi-core`.
- Sodium's call sites use `engine.<taskName>.start(input)` — fully typed inputs, no string workflow names, no `executorConfig` blobs. Typo-proof, rename-refactor-safe.
- Workflow durability: `override durability = 'committed' as const` on the class → caller decides buffered vs committed via method choice (`startBuffered` vs `startCommitted`). Generic HTTP adapters (delphi-express) dispatch by `definition.durability`.

## 2.1 Phases

Each phase is independently shippable.

### Phase 0 — Dispatch v2 (in `fluent` repo) — ✅ DONE

**Status**: shipped in the same repo. See commit notes below.

**What was done**:
- ✅ `packages/tasks-adapter-bullmq/src/BullMQConnector.ts:processIncomingDispatch` rewritten with parallel batched processing:
  - **Parallel pull**: `batchSize` `getNextJob` calls in `Promise.all` per inner iteration (BullMQ's getNextJob is atomic — no double-delivery)
  - **Parallel handler invocation**: chunked by `concurrency` cap, `Promise.allSettled` (one failure does NOT abort the batch)
  - **Parallel ack**: `Promise.allSettled` so a failing ack doesn't take down the rest
  - All v1 invariants preserved (waitUntilReady race fix, hint queue prioritization, tempWorker.close in finally)
- ✅ `tasks-core` interface gained `batchSize` and `concurrency` optional params
- ✅ 5 new tests added (in addition to the 4 existing) — covering: real parallelism (handlers overlap), concurrency cap respected, partial failure isolation, multi-iteration drain, default backwards compat at low load. **All 9 pass.**
- ✅ Full engine test suite still green (224/224)

**What was deliberately deferred** (not blocking):
- The `BatchedJobProcessor<TJob, TResult>` extraction (refactor IngestWorker + StepStatusBuffer to share a primitive). The dispatch v2 path uses `Promise.allSettled` directly — doesn't need the per-job-promise pattern (dispatch owns the lifecycle). The IngestWorker/StepStatusBuffer keep their own internal accumulator pattern. Extraction is a code-cleanliness pass, not load-bearing.

**Defaults**:
- `batchSize: 50` (good balance — 10× throughput improvement on bursts, no harm at low load)
- `concurrency: same as batchSize` (no chunking unless explicitly set lower)

**Sodium can opt in per-queue**:
- Engine queues: pass `batchSize: 200, concurrency: 200` from the dispatch handler
- Notification-style queues: keep defaults (50/50)
- Slow / serialized work: `batchSize: 1` (legacy v1 behaviour)

### Phase 1 — Sodium boilerplate (in `sodium` repo)

| Step | File in sodium | What |
|---|---|---|
| 1 | `apps/backend/package.json` | Add `@goatlab/delphi-core` and `@goatlab/delphi-express` workspace deps |
| 2 | `apps/backend/prisma/schema.prisma` | Append the 12 engine models from `packages/delphi-core/prisma.fragment` with `@@schema("agents")`. Enable `previewFeatures = ["multiSchema"]`. |
| 3 | `apps/backend/pgroll-migrations/` | Run `pnpm db:create:migration` — generates pgroll migration creating `agents` schema + 12 tables. Apply via normal flow. |
| 4 | `apps/backend/src/config/agents/agents.config.ts` (new) | `getAgentsConfig(ctx)` factory — mirror `getQueueConfig` / `getTasksConfig`. Calls `createEngine({ workflows: [...workflowClasses.map(new), ...taskClasses.map(new)] as const, db, pgPool: getSharedPool(...), connector: ctx.queueService.getBullMQ(), tenantId, schema: 'agents', eventIngestion })`. Returns `{ engine, ingestWorker, stepTask }`. **~40 LOC** — no LRU cache needed, the DI container already caches per-tenant. |
| 5 | `apps/backend/src/config/agents/workflows/index.ts` (new) | `export const workflowClasses = [] as const` — starts empty; grows in Phase 3 as you opt tasks into multi-step / HITL / committed durability. |
| 6 | `apps/backend/src/config/_container.ts` | Wire `getAgentsConfig` into the container initializer: add to `factory` (for the Preload type), construct in Phase 2 alongside `getQueueConfig` / `getTaskTrackerConfig`, return in the context object, declare in `ContainerContext` interface. **~6 lines touched.** |
| 7 | `apps/backend/src/api/_express/agents/agents.resource.ts` (new) | One-line wrap of `agentsRouter({ resolveAgents })` — pulls `ctx.agentsService` from the container. |
| 8 | `apps/backend/src/router_express.ts` | `app.use('/api/workflows', agentsResource)` |
| 9 | `apps/backend/src/config/tasks.ts` | Register the 5 engine queue handlers in the task registry (`workflow_ingest`, `workflow_step_light/heavy/ai/sandbox`). Handlers pull from `ctx.agentsService`. |
| 10 | `apps/backend/src/config/dispatch/dispatch.setup.ts` | Optional 3-line filter to skip dispatch hint emission for engine queues if double-routing causes issues — investigate first |

**Result**: any sodium endpoint can call `ctx.agentsService.engine.<taskName>.start(input)` with full type safety. Every existing `ShouldQueue` task in sodium's `taskClasses` array is instantly addressable as a typed delphi workflow — no rewriting. Engine queues consumed via existing dispatch infrastructure. Zero impact on existing task-style callers (`connector.queue('check_post', ...)` continues to work unchanged; callers can migrate to `engine.check_post.start(...)` at their own pace to pick up durability/idempotency/traceability).

**Why no LRU+TTL cache?** Sodium's `Container` from `@goatlab/node-backend` already caches per-tenant contexts. `withContainer(req)` returns an already-initialized container for that tenant — the engine bundle constructed inside `initializeContainer` is cached for the container's lifetime. An external `getAgentsBundle(...)` cache would be redundant (and worse: two caches with different eviction policies).

### Phase 2 — Realtime broker extraction (in `fluent` repo) — partial ✅

| Step | File | What | Status |
|---|---|---|---|
| 1 | `packages/realtime-broker/` (new) | Lift `TenantSubscriberPool` from sodium. ~250 LOC. Tests against ioredis-mock. | ✅ DONE |
| 2 | `packages/delphi-core/src/engine/WorkflowEngine.ts` | Add `onEngineEvent?: (evt: EngineEvent) => void` config hook. Fires synchronously after PG commit at every state transition. | ✅ DONE |
| 3 | `packages/delphi-core/src/engine/EngineEvent.types.ts` (new) | Typed event union: `run.started`, `step.running`, `step.completed`, `step.failed`, `run.completed`, `step.human_requested` | ✅ DONE |
| 4 | Sodium's `apps/backend/src/api/realtime/shared-subscriber.ts` | Replace internals with thin wrapper around `@goatlab/realtime-broker` | TODO (sodium-side) |
| 5 | Sodium's `agents.factory.ts` | Wire `onEngineEvent` to `broker.publish(...)` | TODO (sodium-side) |
| 6 | Sodium's `realtime.controller.ts` | Add `engine:*` channel subscription | TODO (sodium-side) |

**What's done in `fluent`** (commit `<next>`):

`packages/delphi-core/src/engine/EngineEvent.types.ts` defines a 6-variant typed union:
- `run.started` (workflowName, workflowVersion)
- `run.completed` (status: COMPLETED|FAILED|CANCELLED, output?, error?)
- `step.running` (stepName, attempt)
- `step.completed` (stepName, output)
- `step.failed` (stepName, error, attempt, terminal)
- `step.human_requested` (stepName, prompt, schema?)

Every event carries `tenantId`, `runId`, `traceId`, `emittedAt`. `traceId` resolution is cached in-memory (Map<runId, traceId>, soft-capped at 5000 entries, evicted on run completion).

Engine emits at 5 critical sites — all positioned **AFTER** the corresponding PG write commits:
- `start()` after the 2 INSERTs commit → `run.started`
- `startBatch()` / `startBatchCopy()` after the COPY transaction commits → `run.started` × N
- `markStepRunning` after the buffered UPDATE commits → `step.running`
- `onStepCompleted` after the buffered UPDATE commits → `step.completed` (or `step.human_requested` for HITL)
- `onStepFailed` (terminal branch) after the buffered UPDATE commits → `step.failed`
- `advanceWorkflow` after the run UPDATE commits → `run.completed` (status COMPLETED or FAILED)

**Hook semantics tested in `engine-events.spec.ts`** (6 tests all pass):
- Happy path emits the right sequence (`run.started → step.running → step.completed → run.completed`)
- **CRITICAL no-race test**: when an event fires, an immediate PG SELECT sees the post-commit state (verified for both step.completed and run.completed)
- Failed-step path emits `step.failed (terminal=true)` then `run.completed (status='FAILED', error)`
- HITL path emits `step.human_requested`, no `run.completed` until input submitted
- Hook throwing does NOT crash the workflow (caught + logged)
- Engine works normally when `onEngineEvent` is unset (zero overhead)

**Subscriber pattern for sodium** (when wiring up):
```ts
new WorkflowEngine({
  ...,
  onEngineEvent: (evt) => {
    // Cheap fan-out — push to in-memory queue, drain on a separate flush
    eventBuffer.push(evt)
  },
})
// Separate broker drains via batched Redis publish
```

**Remaining work** (broker extraction): sodium's `TenantSubscriberPool` lifts cleanly into a new `@goatlab/realtime-broker` package. ~250 LOC. Engine integration is a 5-line wire-up: `onEngineEvent: evt => broker.publish(evt.tenantId, channel, evt)`.

### Phase 3 — Enhance tasks with workflow features (in `sodium` repo, opt-in)

With `ShouldQueue` auto-adaption (commit `71005bd`), every existing sodium task is already a delphi workflow the moment you ship Phase 1. No per-task rewriting is required to get: DB durability, idempotency, retries, observability, `traceId` lineage, status polling via `/api/workflows/status/:runId`.

**Critical framing: the old `ctx.tasks.X.queue(...)` and new `ctx.agentsService.engine.X.start(...)` paths coexist.** They run the same `ShouldQueue.handle()` method via different queues — no conflict, no duplicate execution. Migrating a call site is opt-in, not mandatory:

```
ctx.tasks.check_post.queue({ postId })                          // → BullMQ `check_post` queue → dispatch → task.handle()
ctx.agentsService.engine.check_post.start({ postId }, {         // → INSERT workflow_runs → BullMQ workflow_step_light →
  idempotencyKey: 'check-123',                                  //   WorkflowStepTask → FunctionStepExecutor → task.handle()
})                                                              // → UPDATE workflow_runs status, emit events
```

**Migrate a call site only when** you want one of: committed durability, DB-level idempotency, status polling, traceability, observability / dashboard, step-level retries, human-in-the-loop, or multi-step composition. Fire-and-forget calls ("notify user that their post was created") can stay on `ctx.tasks.X.queue(...)` forever — zero pressure, zero value lost.

Phase 3 is about **opting tasks into workflow-specific features** — only do this when a task needs something a plain `ShouldQueue` doesn't give you.

**Upgrade ladder** (in rough order of "common reason to upgrade"):

1. **Committed durability** — add a companion `Workflow` subclass with `override durability = 'committed' as const` for flows where "accepted = on disk" matters (payments, financial ops, irreversible actions). Caller switches to `engine.<name>.startCommitted(input, { idempotencyKey })`.
2. **Multi-step DAG** — promote from a single `ShouldQueue` to a `Workflow` subclass with multiple `step(...)` entries. Each step idempotent, retryable, observable independently. Fan-out via `dependsOn: [a, b]` rejoins.
3. **Human-in-the-loop** — any step returning `{ waitForHuman: { prompt, schema } }` transitions to `WAITING_HUMAN` until `engine.<name>.submitHumanInput(runId, stepName, data)`. Replaces ad-hoc "set a DB flag, poll from the UI" patterns.
4. **Cron scheduling** — `SchedulerService` owns PG-backed cron. Drops `setInterval` / platform-worker loops; multi-pod-safe via transaction-wrapped `FOR UPDATE SKIP LOCKED`.
   - ✅ **Verified multi-pod safe**: defense-in-depth via `idempotencyKey: cron:<workflowName>:<scheduledAt>` UNIQUE constraint. 4 parallel pods → exactly 1 `cron.trigger` event per due schedule.
5. **Signals** — long-running workflow receives async inputs (`engine.<name>.signal(runId, 'approved', data)`). Pairs naturally with HITL.
6. **External actions** (exactly-once) — `ctx.externalActions.run({...})` inside a step for calls to systems of record (Stripe, GitHub, etc.). Persists intent → dispatches → records result → replays safely on retry.

**Candidate tasks for each upgrade** (illustrative — pick as priorities emerge):

- **Committed durability**: any task that touches billing, a primary ledger, or external systems where retrying is expensive.
- **Multi-step**: `provision_medusa_tenant` (5+ real steps), `create_tenant` (migrate → seed → first admin → welcome email).
- **HITL**: `check_post` (if moderator review gate is ever needed), tenant-deletion workflows (require admin approval before irreversible steps).
- **Cron**: `job_alert`, `job_expiration_sweep`, digest rollups — drops `setInterval` loops.

For each upgrade:
- Define a companion `Workflow` subclass in `apps/backend/src/config/agents/workflows/` (e.g. `PaymentCriticalWorkflow.ts`). Reuse the existing `ShouldQueue` via `fromShouldQueue(task)` if one step's logic already lives there.
- Register alongside or instead of the original task in `createEngine({ workflows: [...] })`.
- Update call sites to use the new typed entry: `engine.payment_critical.startCommitted(...)` etc.
- Verify in dashboard / via `/api/workflows/status`.

**Target**: no pressure — migrate tasks only when they need something new. The default state is "task works fine as an auto-adapted workflow."

### Phase 4 — Production-readiness

| Item | Owner | Notes |
|---|---|---|
| PgBouncer in front of Cloud SQL | Ops | Required at >5 active agent-using tenants |
| Retention cron | Ops | Run `bin/retention-cleanup.ts` hourly with `RETENTION_DAYS=30` **and** `RETENTION_SCHEMA=agents` (must match `WorkflowEngine.schema`). Without the schema env, the script targets `public.workflow_runs` and silently no-ops or errors with "relation does not exist". |
| PG autovacuum tuning | Ops | Apply production overrides from `docker-compose.yml` (commented block) |
| Cloud Monitoring alerts | Ops | Ingest queue depth >10k for >30s; failed run delta >X/hour |
| Dashboard for workflow_runs | Eng | Embed `@goatlab/delphi-ui` or build custom Prisma view |
| Per-tenant rate limiting on `/api/workflows/start-async` | Eng | Prevent one tenant from filling the ingest queue |

### Phase 5 — Eventually delete legacy task system (long-tail)

When all `connector.queue(...)` callsites migrated, remove the `tasks.handleByName` registry pattern (or repurpose as engine handler entry point). `platform-task-workers.ts` becomes redundant. **Optional** — old tasks can coexist indefinitely.

## 2.2 Drop-in code

The integration lives entirely inside sodium's existing DI container — no external cache, no parallel bootstrap path. `getAgentsConfig(ctx)` mirrors `getQueueConfig` / `getTasksConfig`. The container caches the bundle per-tenant automatically.

### 1. `apps/backend/src/config/agents/workflows/index.ts` (new)

```ts
// Phase 1 starts empty. Add Workflow subclasses here as you opt tasks into
// multi-step / HITL / committed durability / etc.
// Example (Phase 3):
//   export class PaymentCriticalWorkflow extends Workflow<{ orderId, amountCents }, 'payment_critical'> {
//     workflowName = 'payment_critical' as const
//     override durability = 'committed' as const
//     steps = [step(chargeCardStep), step(sendReceiptStep, { dependsOn: [chargeCardStep] })] as const
//   }
export const workflowClasses = [] as const
```

### 2. `apps/backend/src/config/agents/agents.config.ts` (new — ~40 LOC)

Follows the same destructured-context shape as every other `getXConfig` in sodium (`getEmailConfig`, `getQueueConfig`, `getTasksConfig`). Delphi depends on `queueService` (constructed in Phase 2 parallel alongside everything else), so `getAgentsConfig` takes `ContextWithServices` plus the explicit `connector` — matching `getTasksConfig`'s "Phase 2.5" pattern where a service is built right after Phase 2's `Promise.all` completes and can reach into its results.

```ts
import { Kysely, PostgresDialect } from 'kysely'
import {
  createEngine,
  IngestWorker,
  WorkflowStepTask,
  EventIngestionService,
  type Database as AgentsDB,
  type TypedEngine,
} from '@goatlab/delphi-core'
import type { TaskConnector } from '@goatlab/tasks-core'
import { getSharedPool } from '@src/config/database/getConfiguredPrismaClient'
import { taskClasses } from '@src/config/tasks'                      // sodium's existing task catalogue
import { workflowClasses } from '@src/config/agents/workflows'       // new Workflow subclasses (may be empty at Phase 1)
import type { ContextWithServices } from '../_container'

// Instantiate both catalogues. Workflow instances first, then ShouldQueue
// tasks — createEngine rejects duplicate names across both kinds, surfaced
// as a bootstrap-time error rather than a silent overwrite.
const registeredWorkflows = [
  ...workflowClasses.map(Cls => new Cls()),
  ...taskClasses.map(Cls => new Cls()),
] as const

export type SodiumAgentsEngine = TypedEngine<typeof registeredWorkflows>

export interface SodiumAgentsService {
  engine: SodiumAgentsEngine
  ingestWorker: IngestWorker
  stepTask: WorkflowStepTask
  shutdown: () => Promise<void>
}

/**
 * Build the per-tenant delphi engine + step/ingest consumers.
 *
 * Destructured signature matches `getEmailConfig` / `getQueueConfig` etc.
 * `connector` is passed explicitly because delphi sits in Phase 2.5 — runs
 * AFTER Phase 2's `Promise.all` so `queueService.getBullMQ()` is resolved.
 */
export const getAgentsConfig = async ({
  tenantMeta: { id: tenantId },
  secretService,
  connector,
  logger,
}: ContextWithServices & {
  connector: TaskConnector<object>
  logger?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void }
}): Promise<SodiumAgentsService> => {
  const dbUrl = secretService.getSecretSync('DATABASE_URL')
  const pool = getSharedPool(dbUrl, { max: 30 })                      // bumped from sodium's default 5
  const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) })

  // createEngine auto-adapts every ShouldQueue in `registeredWorkflows`
  // into a single-step workflow via `instanceof ShouldQueue`. No manual
  // FunctionStepExecutor / IngestBuffer / workflows Map construction —
  // createEngine builds those internally.
  const engine = createEngine({
    workflows: registeredWorkflows,
    db,
    pgPool: pool,
    connector,
    tenantId,
    schema: 'agents',
    eventIngestion: new EventIngestionService({ db }),
    logger,
    // Phase 2-realtime: add onEngineEvent: evt => broker.publish(evt.tenantId, `engine:run:${evt.runId}`, evt)
  })

  // Worker-side consumer for the buffered ingest queue — drains BullMQ jobs
  // into PG via COPY FROM. Sodium's dispatch system routes jobs to these.
  const ingestWorker = new IngestWorker({
    engine,
    flushThreshold: 200,
    flushIntervalMs: 20,
    maxConcurrentFlushes: 8,
    logger,
  })

  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)

  // CRITICAL: do NOT call connector.listen() here. Engine queues route
  // through sodium's dispatch system, not persistent per-tenant workers.
  // Tasks are registered in config/tasks.ts so dispatch can route them.

  return {
    engine,
    ingestWorker,
    stepTask,
    async shutdown() {
      // NOTE: do NOT close the connector — it's shared across services.
      await engine.ingestBuffer.shutdown()
      await engine.shutdown()
    },
  }
}
```

### 3. `apps/backend/src/config/_container.ts` — wire it in (~6 lines touched)

Delphi slots in after Phase 2's `Promise.all` (same spot `getTasksConfig` uses), since it needs `queueService.getBullMQ()`:

```ts
// (existing imports)
import { getAgentsConfig } from './agents/agents.config'
import type { SodiumAgentsService } from './agents/agents.config'

const factory = {
  // ...existing entries...
  agentsService: (): SodiumAgentsService => ({} as SodiumAgentsService),  // ← add
} as const

// Inside initializeContainer — after Phase 2's Promise.all completes,
// right next to the existing getTasksConfig call:
const tasksRegistry = getTasksConfig({
  connector: queueService.getBullMQ(),
  logger,
})

const agentsService = await getAgentsConfig({                        // ← add
  ...contextWithServices,
  connector: queueService.getBullMQ(),
  logger,
})

// Return object — append:
return {
  // ...existing fields...
  tasks,
  agentsService,                                                     // ← add
}

// ContainerContext interface — append:
export interface ContainerContext {
  // ...existing fields...
  agentsService: SodiumAgentsService                                 // ← add
}
```

The container's existing LRU+TTL cache (`@goatlab/node-backend`'s `Container`) now handles per-tenant engine lifecycle. `withContainer(req)` returns the cached bundle on subsequent calls; eviction triggers the `shutdown()` callback we registered above.

### 4. Engine queue handlers as `ShouldQueue` classes

Sodium registers tasks via `TaskRegistry.fromClasses({ classes: taskClasses })` — there is no separate `tasks.register(name, fn)` surface. So the 5 engine queue handlers are authored as tiny `ShouldQueue` subclasses that delegate to `agentsService`, reading it from the tenant's container context via `getTaskServices()` (the same pattern every existing sodium task uses).

Create `apps/backend/src/config/agents/agents.tasks.ts`:

```ts
import { ShouldQueue } from '@goatlab/tasks-core'
import { getTaskServices } from '@src/config/tasks/task.utils'
import { getBackendUrl } from '@src/config/tasks/task.utils'

// 1 task per engine queue. Each is a thin adapter from BullMQ job → the
// engine's ingestWorker / stepTask, scoped to the tenant's container.
export class WorkflowIngestTask extends ShouldQueue<object, undefined, 'workflow_ingest'> {
  taskName = 'workflow_ingest' as const
  get postUrl() { return `${getBackendUrl()}/dispatch/worker` }
  async handle(data: object) {
    const { agentsService } = getTaskServices()
    await agentsService.ingestWorker.handleJob(data as any)
    return undefined
  }
}

export class WorkflowStepLightTask extends ShouldQueue<object, undefined, 'workflow_step_light'> {
  taskName = 'workflow_step_light' as const
  get postUrl() { return `${getBackendUrl()}/dispatch/worker` }
  async handle(data: object) {
    const { agentsService } = getTaskServices()
    await agentsService.stepTask.handle(data as any)
    return undefined
  }
}

// (identical for WorkflowStepHeavyTask / WorkflowStepAiTask / WorkflowStepSandboxTask —
//  just change the taskName to match each engine queue)
```

Then register them alongside sodium's existing tasks in `apps/backend/src/config/tasks.ts`:

```ts
import {
  WorkflowIngestTask,
  WorkflowStepLightTask,
  WorkflowStepHeavyTask,
  WorkflowStepAiTask,
  WorkflowStepSandboxTask,
} from './agents/agents.tasks'

export const taskClasses = [
  // ...existing sodium tasks...
  CheckPostTask,
  ProcessPostTask,
  // ...
  // ── Engine queue handlers (consumed by sodium's dispatch; NOT passed to
  //    createEngine's workflows array — those are separate engine queues) ──
  WorkflowIngestTask,
  WorkflowStepLightTask,
  WorkflowStepHeavyTask,
  WorkflowStepAiTask,
  WorkflowStepSandboxTask,
] as const
```

**Important: filter out the engine-queue classes when passing `taskClasses` to `createEngine`** — otherwise delphi would try to auto-adapt them as workflows (which would loop: the engine's own step queues would be workflow steps). In `agents.config.ts`, change the catalogue composition to:

```ts
import {
  WorkflowIngestTask,
  WorkflowStepLightTask,
  WorkflowStepHeavyTask,
  WorkflowStepAiTask,
  WorkflowStepSandboxTask,
} from './agents.tasks'

const ENGINE_QUEUE_CLASSES = new Set([
  WorkflowIngestTask, WorkflowStepLightTask,
  WorkflowStepHeavyTask, WorkflowStepAiTask, WorkflowStepSandboxTask,
])

const registeredWorkflows = [
  ...workflowClasses.map(Cls => new Cls()),
  ...taskClasses
    .filter(Cls => !ENGINE_QUEUE_CLASSES.has(Cls))   // ← skip engine-queue handlers
    .map(Cls => new Cls()),
] as const
```

### 5. Call sites — how sodium handlers use the engine

```ts
// Anywhere in sodium — fully typed, no string workflow names:
import { withContainer } from '@src/config/_container'

app.post('/api/posts/:id/check', requireAuth, async (req, res) => {
  const ctx = await withContainer(req)

  // ctx.agentsService.engine.check_post exists because CheckPostTask is
  // in taskClasses — auto-adapted by createEngine. TInput is inferred
  // from the ShouldQueue's <TInput, TResult, TName> generics.
  const { runId } = await ctx.agentsService.engine.check_post.start(
    { postId: req.params.id },
    { idempotencyKey: `check-${req.params.id}` },
  )

  res.json({ runId })
})
```

For a committed payment flow (after adding `PaymentCriticalWorkflow` to `workflowClasses`):

```ts
app.post('/api/orders/:id/checkout', requireAuth, async (req, res) => {
  const ctx = await withContainer(req)
  const { runId } = await ctx.agentsService.engine.payment_critical.startCommitted(
    { orderId: req.params.id, amountCents: req.body.amountCents, customerId: ctx.user.id },
    { idempotencyKey: `checkout-${req.params.id}` },
  )
  res.json({ runId })
})
```

### 6. `apps/backend/src/api/_express/agents/agents.resource.ts` (new)

```ts
import { agentsRouter } from '@goatlab/delphi-express'
import { withContainer } from '@src/config/_container'

export const agentsResource = agentsRouter({
  resolveAgents: async (req) => {
    const ctx = await withContainer(req)
    const { engine } = ctx.agentsService
    // delphi-express needs the ingestBuffer separately for the /start-async
    // path; the typed engine exposes it at engine.ingestBuffer.
    return { engine, ingestBuffer: engine.ingestBuffer, tenantId: ctx.tenantMeta.id }
  },
})
```

### 7. `apps/backend/src/router_express.ts`

```ts
import { agentsResource } from '@src/api/_express/agents/agents.resource'
// ...
app.use('/api/workflows', agentsResource)
```

That's the entire integration. **~100 LOC of net-new code** in sodium — 40 for `agents.config.ts`, ~6 touched in `_container.ts`, ~7 in `tasks.ts`, ~10 across the empty `workflows/index.ts` + `agents.resource.ts` + `router_express.ts` edits. Down from ~150 under the earlier plan because (a) `createEngine` subsumes the executor/IngestBuffer construction, (b) `ShouldQueue` auto-adaption eliminates per-task wrapping, and (c) the container owns per-tenant caching so no external LRU cache is needed.

## 2.3 Open questions to resolve before starting

1. **Which secret holds the per-tenant `DATABASE_URL`?** — answer determines env var name in factory.
2. **PgBouncer rollout timing** — needed at scale, maybe not for canary.
3. ~~**Workflow registry source of truth**~~ — **Resolved.** Code-defined via `workflowClasses` + `taskClasses` arrays (`config/agents/workflows/index.ts` + existing `config/tasks.ts`). Both are instantiated and passed to `createEngine({ workflows: [...] as const })`. No persisted `workflow_definitions` table in Phase 1.
4. ~~**Step handler conventions**~~ — **Resolved.** Step handlers live on class instances (`FunctionStep.handle(input, ctx)`). For Phase 1, sodium reuses its existing `ShouldQueue.handle()` methods via auto-adaption — no manual `executor.register(...)` calls. When a task is promoted to a multi-step Workflow subclass, the same class-based pattern applies to each step.
5. **SSE channel naming for engine events** — `engine:run:<runId>` (per-run), `engine:tenant:<tenantId>` (firehose), or both? Decide in Phase 2.
6. **Auth for `/api/workflows/*`** — same as `/trpc/*` middleware? Confirm before mount. (Delphi-express mounts auth-agnostic; auth middleware must run upstream of the router — see `delphi-express/README.md` §"Security model".)
7. **Workflow naming collisions with `WorkflowEngine` methods** — `createEngine` throws if a workflow's name collides with `start / cancel / shutdown / getStatus / signal / submitHumanInput / query / ingestBuffer` etc. Sodium's existing `taskClasses` names (`check_post`, `process_post`, `create_tenant`, `notify`, `realtime.broadcast`, etc.) all use nouns/dot-names — no collisions expected. Audit `taskClasses.map(Cls => new Cls().taskName)` against `Object.getOwnPropertyNames(WorkflowEngine.prototype)` before shipping.

## 2.4 Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dispatch v2 regression in sodium tasks | Low | Default behavior preserved at low load. Roll out behind feature flag if paranoid. |
| Engine factory pool exhaustion | Medium | Per-tenant max=30 × 50 tenants × N pods can OOM Cloud SQL. **PgBouncer is the answer.** |
| `definitionSnapshot` size explosion | Low | Snapshots cached per (workflow, version), not per row. Plus retention. |
| Engine bug breaks all workflows for a tenant | Medium | Per-tenant blast radius. Plus `disableStepStatusBuffering` kill switch. |
| Sodium team unfamiliar with workflows | Low | One pair-programming session + READMEs. |
| Dashboard not ready when first user-facing workflow ships | Medium | Status endpoint works without dashboard. Build view in Phase 3. |

---

# PART 3 — REFERENCE

## 3.1 Commit history of work done in `fluent`

| Commit | Title |
|---|---|
| `6933e9d` | feat: queue-first ingestion — 5k req/s @ p95<100ms on 2 vCPU |
| `1af2ae7` | docs: add READMEs for the agent platform packages |
| `8986ac9` | perf: 2× drain rate via fixed batch sizing + merged BEGIN/SET roundtrip |
| `1f8dca8` | build: Dockerfile + docker-compose for end-to-end deployment |
| `520404f` | docs: agent engine handover — how to run, test, and load-benchmark |
| `a89d4ae` | feat: WriteBuffer<T> abstraction + retention script + prod tuning docs |
| `2502050` | perf: step-status batching — single UPDATE per ~100 step transitions |
| `27e9b76` | feat: pluggable adapters — delphi-express + Prisma fragment + schema isolation |
| `1e8d83a` | feat(delphi-express): blank Express + Prisma example with full load-test script |
| `2d0ef9b` | feat(example): cluster mode — 4500 req/s on 2-worker Express + Prisma |
| `b238b0e` | docs(example): record load-test results |
| `0d82940` | feat: @goatlab/delphi-bun adapter + Bun + Prisma example |
| `1e34216` | refactor: promote bulkQueue() to TaskConnector — delphi-core no longer BullMQ-specific |
| `d24707b` | docs: full sodium integration plan + zero-context handover |
| `078bd33` | perf: dispatch v2 — parallel batched processIncomingDispatch (Phase 0 ✅) |
| `d8355a0` | feat: engine onEngineEvent hook + EngineEvent types (Phase 2 partial ✅) |
| `4aec7b5` | fix: SchedulerService multi-pod safety — transaction-wrapped FOR UPDATE + tenantId filter |
| `b486f9a` | fix: retention-cleanup.ts schema-aware via RETENTION_SCHEMA env |
| `0e5082d` | test: engine-via-dispatch integration (proves sodium-shape consumer works end-to-end) |
| `a7bb1fc` | feat: @goatlab/realtime-broker — pooled per-tenant pub/sub (Phase 2 ✅) |
| `ac441b6` | feat: @goatlab/delphi-trpc — typed tRPC adapter (sodium-friendly) |
| `8fa1aab` | example(express): wire realtime-broker + onEngineEvent → SSE endpoint |
| `118a282` | test: full-stack composition (engine + dispatch v2 + event hook + broker) |
| `4d0572f` | refactor: extract BatchedJobProcessor primitive — IngestWorker + StepStatusBuffer share it |
| `4a07214` | test: horizontal scaling loadtest — multi-instance fleet on shared infra |
| `104fd42` | rename: agents-* packages → delphi-* (umbrella name for the platform) |
| `01c5332` | fix(broker): verify agent secret on reconnect + ESM-friendly realtime-broker export |
| `510df67` | **feat(delphi-core): `workflow.durability('committed')` — fsync-durable ingest path with batched COPY + idempotency** |
| `71005bd` | **feat(delphi-core): class-based workflow API (`Workflow` + `FunctionStep` + `createEngine`) + `ShouldQueue` auto-adaption** |

## 3.2 File index — where everything lives

### Core engine files
- `packages/delphi-core/src/engine/WorkflowEngine.ts` — main engine
- `packages/delphi-core/src/engine/WorkflowEngine.types.ts` — config types
- `packages/delphi-core/src/engine/IngestBuffer.ts` — HTTP-side accumulator
- `packages/delphi-core/src/engine/IngestWorker.ts` — Redis-side accumulator
- `packages/delphi-core/src/engine/StepStatusBuffer.ts` — batched step UPDATEs
- `packages/delphi-core/src/engine/WriteBuffer.ts` — generic batched-write primitive
- `packages/delphi-core/src/engine/ExternalActionExecutor.ts` — exactly-once side effects
- `packages/delphi-core/src/engine/SchedulerService.ts` — cron triggers
- `packages/delphi-core/src/engine/TaskManager.ts` — task fan-out
- `packages/delphi-core/src/state/WorkflowStateMachine.ts` — pure-function state derivation
- `packages/delphi-core/src/tasks/WorkflowStepTask.ts` — BullMQ handler
- `packages/delphi-core/src/entities/Database.ts` — Kysely interfaces + CREATE_TABLES_SQL
- `packages/delphi-core/src/api/WorkflowHandlers.ts` — framework-agnostic handler factory
- `packages/delphi-core/prisma.fragment` — Prisma schema for engine tables
- `packages/delphi-core/bin/retention-cleanup.ts` — retention script

### Adapters
- `packages/delphi-express/src/index.ts` — Express router factory
- `packages/delphi-bun/src/index.ts` — Bun fetch handler factory

### Examples
- `packages/delphi-express/example/` — Express + Prisma example (with loadtest)
- `packages/delphi-bun/example/` — Bun + Prisma example (with loadtest)
- `packages/delphi-ui/test-server/server.ts` — internal benchmarking server (raw node:http)

### Test infrastructure
- `packages/delphi-core/loadtest/k6-workflow.js` — Hatchet-style multi-scenario benchmark
- `packages/delphi-express/example/scripts/k6-flat.js` — flat-rate sweep
- `packages/delphi-express/example/scripts/loadtest.sh` — full lifecycle automation
- `packages/delphi-core/src/__tests__/engine/` — 224 engine tests

### Top-level
- `Dockerfile` + `docker-compose.yml` — full stack for benchmarking
- `README.md` — root README with engine handover section
- `SODIUM_INTEGRATION_PLAN.md` — this document

## 3.3 Reading list (in order)

To get fully up to speed:

1. **This document** (PART 1 + 2)
2. `packages/delphi-core/README.md` — engine architecture, **class API quick start (Step + Workflow + createEngine)**, Library vs service mode, Workflow durability, Library API surface, **"Using ShouldQueue tasks as Delphi steps"**, buffered-vs-committed benchmark table
3. `packages/delphi-express/README.md` — Express adapter shape + **Security model section** (BYO-auth contract)
4. `packages/delphi-express/example/README.md` — concrete integration example with perf numbers
5. `packages/delphi-express/example/src/agents.factory.ts` — **the model factory — rewritten for the class API** (pattern to mirror in sodium's factory)
6. `packages/delphi-core/src/__tests__/workflow.spec.ts` — type-level tests (`expectTypeOf`) that spell out the class-API type contract: input/output/name generics flow, `ShouldQueue` adaption, proxy shape, `@ts-expect-error` coverage for wrong call-site inputs
7. `packages/delphi-express/example/scripts/loadtest.sh` — how we test end-to-end
8. `packages/tasks-adapter-bullmq/README.md` — BullMQ connector internals (single vs bulk)
9. Sodium: `apps/backend/src/services/auth/better-auth.factory.ts` — pattern to mirror for the LRU+TTL cache shape
10. Sodium: `apps/backend/src/config/tasks.ts` — **the `taskClasses` array that plugs straight into `createEngine`** via auto-adaption
11. Sodium: `apps/backend/src/api/posts/tasks/checkPosts.task.ts` — representative `ShouldQueue` subclass (the shape that becomes a workflow for free)
12. Sodium: `apps/backend/src/config/queue.ts` + `dispatch.setup.ts` — what we plug into
13. Sodium: `apps/backend/src/config/database/getConfiguredPrismaClient.ts` — what we reuse

## 3.4 How to start any work session

```bash
# 1. Pull latest in fluent
cd ~/Documents/Code/fluent
git pull
pnpm install

# 2. Build everything (or just the changed package)
pnpm --filter @goatlab/delphi-core build
pnpm --filter @goatlab/delphi-express build
pnpm --filter @goatlab/tasks-adapter-bullmq build

# 3. Run the full test suite (validates engine integrity)
cd packages/delphi-core
npx vitest run --exclude="**/load-test*" --reporter=dot
# Should be 224/224 passing

# 4. Optional: validate perf hasn't regressed
cd packages/delphi-express/example
SWEEP="2000 4000" DUR=20s pnpm loadtest
# Should output "Zero data loss — every accepted workflow reached COMPLETED in PG"

# 5. Now you're ready to work
```

## 3.5 Known good commands cheat sheet

```bash
# Run engine tests (skip the long load-test file)
cd packages/delphi-core && npx vitest run --exclude="**/load-test*" --reporter=dot

# Run a specific test file
cd packages/delphi-core && npx vitest run src/__tests__/engine/lifecycle.spec.ts

# Start test-server (raw node:http, internal benchmarking)
cd packages/delphi-ui && PORT=4445 CLUSTER_MODE=2 npx tsx test-server/server.ts

# Start Express example
cd packages/delphi-express/example && pnpm start

# Loadtest the Express example end-to-end
cd packages/delphi-express/example && SWEEP="2000 4000 5000" DUR=30s pnpm loadtest

# Loadtest with debug timing
cd packages/delphi-ui && INGEST_TIMING=1 CLUSTER_MODE=2 npx tsx test-server/server.ts
# (then run k6 against it)

# Clean all docker
docker ps -q | xargs -r docker kill && docker system prune -f --volumes

# Build full Dockerfile
cd ~/Documents/Code/fluent && docker compose build app

# Run the full Docker stack
cd ~/Documents/Code/fluent && docker compose up -d

# Tear down everything
cd ~/Documents/Code/fluent && docker compose down -v --remove-orphans

# Inspect PG
PG=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
docker exec $PG psql -U test -d agents_e2e_ui -c \
  "SELECT status, count(*) FROM workflow_runs GROUP BY status;"

# Inspect Redis
REDIS=$(docker ps --format '{{.Names}}' | grep redis | head -1)
docker exec $REDIS redis-cli LLEN bull:workflow_ingest:wait
```

## 3.6 What "done" looks like

After all phases:
- Every new background task in sodium is a workflow by default
- Old tasks migrated incrementally; `connector.queue(...)` callsites mostly gone
- Workflow status changes appear in users' SSE stream live (no polling)
- One observability surface: `workflow_runs` PG table + dashboard
- Idempotency, retries, traces, HITL — all free for new code
- Cloud Run service count: still 1 (no split deployment)
- Dispatch model: still in place, just throughput-capable now
- Multi-tenant isolation: preserved (per-tenant Redis prefix, per-tenant DB)
- Persistent-worker problem: solved (no per-tenant workers anywhere)

## 3.7 Why some things are the way they are (FAQ)

**Q: Why use Kysely instead of Prisma in delphi-core?**
A: Engine needs raw `pg.Pool` for COPY FROM (Prisma can't do this cleanly). Kysely is the lightest-weight TS-typed query builder that plays well with raw pg. Sodium also uses Kysely alongside Prisma already (`getConfiguredPrismaClient.ts`).

**Q: Why JSON in TEXT columns instead of jsonb?**
A: Portability + simplicity. Engine writes pre-stringified JSON via COPY FROM (no jsonb encoder needed). Reads use `fromJson()` helpers. Performance is identical in practice for our workload. Users can switch columns to jsonb in their Prisma schema if they prefer.

**Q: Why two adapters (Express AND Bun) instead of just one?**
A: Bun is meaningfully better at HTTP-only services (4× lower p50). But its Node compat layer slows the engine's pg/bullmq paths ~30%. Different tradeoffs for different use cases. Both are tiny adapters (~250 LOC each), low maintenance burden.

**Q: Why does the engine return promises that resolve only after PG commit?**
A: BullMQ ack semantics. If we resolved the per-job promise before the PG row was committed, a crash between ack and commit would silently lose the COMPLETED state. The buffer pattern preserves "BullMQ ack ↔ PG commit" coupling.

**Q: Why Hatchet's COPY FROM pattern instead of Trigger.dev's INSERT batching?**
A: Hatchet hits 92k inserts/sec on m7g.2xlarge with COPY FROM. We see 1900-3500/sec on Docker Desktop (which has heavy overhead). Production Cloud SQL should match or exceed Hatchet's numbers. INSERT batching is ~10× slower for the same row count.

**Q: Why a separate WriteBuffer + IngestBuffer + IngestWorker + StepStatusBuffer?**
A: Each has different semantics:
- `WriteBuffer<T>` — generic primitive, used by `logBuffer`. No per-job ack.
- `IngestBuffer` — HTTP→Redis. No per-job ack (HTTP returned 200 already).
- `IngestWorker` — Redis→PG. Per-job ack needed (BullMQ).
- `StepStatusBuffer` — sync UPDATE batching. Per-call ack (caller awaits).
After Phase 0's `BatchedJobProcessor` extraction, all four become thin wrappers around the same primitive.

**Q: Why Postgres schema isolation instead of per-table prefix?**
A: One config knob (`schema: 'agents'`) vs touching 250 string literals across the codebase. Schema isolation gives 95% of the benefit. Prisma's `@@map` covers the rest if users want custom Prisma client names.

**Q: Why no auto-bootstrap when user provides schema?**
A: Sodium owns its migrations via pgroll. Auto-creating tables would race their tooling. Engine's `CREATE_TABLES_SQL` is for testcontainers + dev convenience only.

**Q: Why did the migration strategy change from "rewrite one task per week" to "opt-in enhancement"?**
A: Commit `71005bd` (class-based API + `ShouldQueue` auto-adaption) lets `createEngine` detect `ShouldQueue` instances in its `workflows` array via `instanceof` and wrap each as a single-step workflow automatically. Sodium's 28 existing `ShouldQueue` tasks become delphi workflows the moment Phase 1 ships — DB durability, idempotency, retries, observability, all free. Migration to an explicit `Workflow` subclass is now opt-in: do it when a task needs multi-step composition, HITL, signals, or `committed` durability. This collapses the original Phase 3 timeline from ~28 weeks to "as needed."

**Q: Why both the class API AND `WorkflowBuilder`?**
A: `WorkflowBuilder` is now internal-only (still powers the 30+ engine test files that were written before the class API existed). Public API is the class-based surface (`Workflow`, `FunctionStep`, `step`, `createEngine`). The two compile down to the same `WorkflowDefinition` shape — no runtime difference, just authoring ergonomics.

**Q: Do I need to migrate every `ctx.tasks.X.queue(...)` call to `ctx.agentsService.engine.X.start(...)`?**
A: **No.** The two paths coexist — they run the same `ShouldQueue.handle()` method via different queues. The old path is fine to keep for fire-and-forget calls (notifications, cache invalidations, log ingestion). Only migrate a call site when you actually want one of: committed durability, DB-level idempotency, status polling, traceability, observability, step-level retries, human-in-the-loop, or multi-step composition. Everything else can stay on `ctx.tasks.X.queue(...)` indefinitely — zero value lost, zero refactor churn.

**Q: What's the difference between `engine.foo.start(input)`, `engine.foo.startBuffered(input)`, and `engine.foo.startCommitted(input)`?**
A:
- `start(input)` — synchronous INSERT + dispatch + return. Use for low-volume one-off starts where you want the simplest semantics.
- `startBuffered(input)` — returns `{ runId, traceId }` ~1-2ms after the trigger hits `IngestBuffer`. PG write happens async in `IngestWorker`. Use for high-volume non-critical flows.
- `startCommitted(input)` — blocks until PG COMMIT with `synchronous_commit=ON` and fsync to WAL. Use for payments / financial ops / anything where "accepted = durable on disk" matters. Batched across concurrent committed callers; per-caller fsync cost amortized to ~0.1ms.

The workflow's `override durability = 'committed' as const` flag is informational (for `/start-async` HTTP dispatch that decides by `definition.durability`); the actual durability is determined by which method you call at the call site.

---

*Maintained alongside `packages/delphi-core/`. Update this doc when architecture decisions change.*

*Last updated: 2026-04-15, after the class-API rewrite + `ShouldQueue` auto-adaption landed on `master` (PR #211, commit `71005bd`). Total delphi-core commits since kickoff: 22.*
