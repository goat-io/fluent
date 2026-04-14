# Sodium ↔ Goat Agents Engine — Full Context & Integration Plan

> **Status**: planning + handover document, ready to execute in any session.
> **Last updated**: 2026-04-14
> **Audience**: another agent or engineer with **zero prior context**. This document is self-contained — read it cold and you should be able to pick up where we left off.

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

`@goatlab/agents-core` is a TypeScript distributed workflow engine inspired by Hatchet, Temporal, Trigger.dev. It runs DAGs of steps over Postgres (source of truth) + BullMQ (execution queues) with:

- Idempotent starts (UNIQUE constraint on `idempotencyKey`)
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
| **`agents-core`** | The engine itself. Workflow DSL, state machine, queue-first ingestion, batched DB writes, all the perf tricks |
| **`agents-express`** | Express adapter. `agentsRouter()` factory mounts every workflow endpoint via a `resolveAgents(req)` callback |
| **`agents-bun`** | Same idea for Bun's `Bun.serve()` runtime |
| **`agents-ai`** | Multi-provider LLM adapter (OpenAI/Anthropic/Google/Ollama) + tool-call loop + multi-agent consensus |
| **`agents-langgraph`** | LangGraph `StateGraph` runs as engine steps, with PG checkpointing |
| **`agents-sandbox`** | Docker-isolated step execution with network lockdown |
| **`agents-ui`** | Vite + React + ReactFlow workflow dashboard (visual editor + run inspector + metrics + worker monitoring) |

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

**For this work, you only need to know `agents-core`, `agents-express`, `tasks-core`, `tasks-adapter-bullmq`.** Everything else is irrelevant to the integration.

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
- `IngestBuffer` (`packages/agents-core/src/engine/IngestBuffer.ts`) — HTTP-side accumulator. Flushes via `connector.bulkQueue([...])` (or BullMQ's `addBulk` directly) every 200 jobs or 50ms.
- `IngestWorker` (`packages/agents-core/src/engine/IngestWorker.ts`) — BullMQ-side accumulator. Each handler call returns a promise; the promise resolves only after the batch flushes. Calls `engine.startBatchCopy(triggers)` for the actual COPY FROM.

**Other things in this commit**:
- Cluster mode (`CLUSTER_MODE=auto|off|N`) — Node `cluster` module, primary forks N children, all bind same HTTP port (kernel SO_REUSEPORT), all consume same BullMQ queues. Mirrors what production deploys do.
- Status fallback — `/workflows/status` checks BullMQ for in-flight jobs when PG row doesn't exist yet (returns `status: 'QUEUED'` with traceId from the job payload).
- `/health` returns 503 if no ingest worker is registered (catches "silent accept and stall" failure mode).
- Schema bootstrap via `pg_advisory_lock(4242)` — multiple cluster workers race on `CREATE TYPE`, so we serialize.

### Commit 2: `1af2ae7` — READMEs for 6 agent-platform packages

agents-core, agents-ai, agents-langgraph, agents-sandbox, agents-ui, tasks-adapter-bullmq. Each ~100-200 lines covering architecture, install, quick start, key exports.

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

**`WriteBuffer<T>`** (`packages/agents-core/src/engine/WriteBuffer.ts`) — generic batched-write accumulator. The Hatchet pattern abstracted into a primitive: `flushFn`, `flushThreshold`, `flushIntervalMs`, `maxJitterMs`, `maxConcurrentFlushes`, snapshot-and-swap, re-prepend on failure.

Refactored the existing `logBuffer` in `WorkflowEngine.ts` to use it. Same behavior, cleaner code, ready for new consumers.

**`bin/retention-cleanup.ts`** — cron-friendly script that drops terminal-state runs/events older than `RETENTION_DAYS` (default 30, matching Hatchet). Active runs preserved regardless of age. Steps + logs cascade-delete via FK. Batched deletes (10k rows per batch) with yield between batches. K8s CronJob template in script header.

**Docker compose production tuning** — commented overrides per Hatchet's recommendations for installations >500GB:
- `maintenance_work_mem=2GB`
- `max_wal_size=15GB`
- `autovacuum_max_workers=10`, `autovacuum_vacuum_threshold=25`, `autovacuum_vacuum_cost_limit=1000`

**README scheduler extraction story** — when `SchedulerService` becomes the bottleneck (high cron-trigger volume), how to extract to a dedicated instance.

### Commit 7: `2502050` — Step-status batching (per Hatchet pattern)

**Problem**: every step transition (`markStepRunning`, `onStepCompleted`, `onStepFailed`) does a sync UPDATE on `workflow_steps`. Under load, that's N RTTs per second.

**Solution**: `StepStatusBuffer` (`packages/agents-core/src/engine/StepStatusBuffer.ts`) — batches updates and flushes via a single `UPDATE … FROM unnest($1::text[], $2::text[], ...)` per ~100 transitions.

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

### Commit 8: `27e9b76` — Pluggable adapters (agents-express + Prisma fragment + schema isolation)

**`@goatlab/agents-express`** — generic Express router factory:
```ts
app.use('/api/workflows', agentsRouter({
  resolveAgents: async (req) => ({ engine, ingestBuffer, tenantId }),
}))
```
Mounts 12 endpoints. No tenant/auth assumptions. Per-route enable/disable. Custom error mapper hook. ~250 LOC.

**`WorkflowEngine.schema` config option** — `schema: 'agents'` makes engine queries use `agents.workflow_runs` instead of `public.workflow_runs`. One-line constructor wrap (`this.db = config.db.withSchema(schema)`); raw COPY FROM strings interpolate the prefix; `StepStatusBuffer` accepts schema and prefixes its UPDATE SQL too. Default behavior unchanged when `schema` is unset.

**Prisma schema fragment** (`packages/agents-core/prisma.fragment`) — copy-paste-ready Prisma models for all 12 engine tables, with documented examples for `@@schema("agents")` + multiSchema and for `@@map()` to rename Prisma client view while keeping physical table names default. Engine **does not auto-bootstrap** when user manages schema.

### Commit 9: `1e8d83a` — Express + Prisma example with full load-test script

Full self-contained example app at `packages/agents-express/example/`:
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

### Commit 12: `0d82940` — `@goatlab/agents-bun` adapter + Bun + Prisma example

Mirror of the Express adapter, using `Bun.serve()`'s fetch handler API. Bun supports clustering via `reusePort: true` (no `node:cluster`); we spawn N child processes that all bind the same port.

**Findings (honest comparison vs Express, same engine, same hardware)**:
- Bun WINS on HTTP latency: p50 at 2k drops 23ms → 6ms (4× lower)
- Bun LOSES on saturation: 5k cliff at 0.86% errors vs Express's 0% at 4.5k
- Bun LOSES on drain rate: ~480/s vs ~730/s on Node (Bun's Node compat layer adds overhead to `pg` + `bullmq`)

Bun is best for latency-sensitive front-door services; Node still wins for workflow-heavy workloads until pg/ioredis run at native speed under Bun.

### Commit 13: `1e34216` — `bulkQueue` promoted to `TaskConnector` interface

**Why**: `agents-core` was implicitly coupled to BullMQ (used `connector.getQueue(name).addBulk(...)` which is BullMQ-specific). To make agents-core truly backend-agnostic, we promoted bulk enqueue to the `TaskConnector` interface.

**Changes**:
- `TaskConnector.bulkQueue?(jobs[])` — optional method, returns `TaskStatus[]`
- `BullMQConnector.bulkQueue` — implementation: groups jobs by `taskName`, calls `Queue.addBulk` per queue (one Lua script per queue, vs N RTTs for queue() loop), preserves `onAfterQueue` hook firing
- `IngestBuffer` config: `{ connector, taskName }` (preferred) OR `{ queue: connector.getQueue(...) }` (legacy compat)
- `WorkflowEngine.dispatchStepsBulk` — builds bulk job list once, calls `connector.bulkQueue(jobs)` if available, else parallel dispatchStep() loop

**No perf regression** — quick load test showed 2k @ p95=45ms, 4k @ p95=83ms, 0% errors. Same as before.

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
- `packages/agents-core/loadtest/k6-workflow.js` — multi-scenario benchmark (start, batch, event, status). Hatchet-style sweep up to 2000 req/s.
- `packages/agents-express/example/scripts/k6-flat.js` — simpler constant-arrival-rate flat sweep, configurable via env.

**Common invocation**:
```bash
# Run against running test-server
API_URL=http://localhost:4445 k6 run packages/agents-core/loadtest/k6-workflow.js

# Sweep one rate against the example
cd packages/agents-express/example
API_URL=http://localhost:3000 MODE=async RATE=5000 DUR=30s k6 run scripts/k6-flat.js

# Full lifecycle (recommended)
cd packages/agents-express/example
SWEEP="2000 4000 5000" DUR=30s pnpm loadtest
```

### `loadtest.sh` orchestration script

Located at `packages/agents-express/example/scripts/loadtest.sh` (and similar in `packages/agents-bun/example/`). Does:

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
cd packages/agents-core && pnpm test

# Skip the long load-test file
cd packages/agents-core && npx vitest run --exclude="**/load-test*"

# Targeted
cd packages/agents-core && npx vitest run src/__tests__/engine/lifecycle.spec.ts
```

Each test file has a run hint at the top: `// npx vitest run src/__tests__/...`

### Manual smoke testing

```bash
# Start the test server (testcontainers spin up PG + Redis)
cd packages/agents-ui
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

All in `packages/agents-core/src/entities/Database.ts` as Kysely interfaces (no decorators, no reflect-metadata). `CREATE_TABLES_SQL` exports the schema as a string for testcontainers / dev.

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

### 8. Replace sodium's task system with workflows over time
Every existing task (notifications, tenant provisioning, realtime broadcast) becomes a 1-step (or N-step) workflow. Every new task is a workflow by default.

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
| 1 | `apps/backend/package.json` | Add `@goatlab/agents-core` and `@goatlab/agents-express` workspace deps |
| 2 | `apps/backend/prisma/schema.prisma` | Append the 12 engine models from `packages/agents-core/prisma.fragment` with `@@schema("agents")`. Enable `previewFeatures = ["multiSchema"]`. |
| 3 | `apps/backend/pgroll-migrations/` | Run `pnpm db:create:migration` — generates pgroll migration creating `agents` schema + 12 tables. Apply via normal flow. |
| 4 | `apps/backend/src/config/agents/agents.factory.ts` (new) | LRU+TTL cached engine factory. Mirror `better-auth.factory.ts`. |
| 5 | `apps/backend/src/api/_express/agents/agents.resource.ts` (new) | One-line wrap of `agentsRouter({ resolveAgents })` |
| 6 | `apps/backend/src/router_express.ts` | `app.use('/api/workflows', agentsResource)` |
| 7 | `apps/backend/src/config/tasks.ts` | Register engine queue handlers in task registry: `tasks.register('workflow_ingest', ...)`, etc. |
| 8 | `apps/backend/src/config/dispatch/dispatch.setup.ts` | Optional 3-line filter to skip dispatch hint emission for engine queues if double-routing causes issues — investigate first |

**Result**: any sodium endpoint can do `engine.start({...})`. Engine queues consumed via existing dispatch infrastructure. Zero impact on existing tasks.

### Phase 2 — Realtime broker extraction (in `fluent` repo) — partial ✅

| Step | File | What | Status |
|---|---|---|---|
| 1 | `packages/realtime-broker/` (new) | Lift `TenantSubscriberPool` from sodium. ~250 LOC. Tests against ioredis-mock. | ✅ DONE |
| 2 | `packages/agents-core/src/engine/WorkflowEngine.ts` | Add `onEngineEvent?: (evt: EngineEvent) => void` config hook. Fires synchronously after PG commit at every state transition. | ✅ DONE |
| 3 | `packages/agents-core/src/engine/EngineEvent.types.ts` (new) | Typed event union: `run.started`, `step.running`, `step.completed`, `step.failed`, `run.completed`, `step.human_requested` | ✅ DONE |
| 4 | Sodium's `apps/backend/src/api/realtime/shared-subscriber.ts` | Replace internals with thin wrapper around `@goatlab/realtime-broker` | TODO (sodium-side) |
| 5 | Sodium's `agents.factory.ts` | Wire `onEngineEvent` to `broker.publish(...)` | TODO (sodium-side) |
| 6 | Sodium's `realtime.controller.ts` | Add `engine:*` channel subscription | TODO (sodium-side) |

**What's done in `fluent`** (commit `<next>`):

`packages/agents-core/src/engine/EngineEvent.types.ts` defines a 6-variant typed union:
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

### Phase 3 — Migrate easy tasks (in `sodium` repo, ongoing)

Migration order (easiest → hardest):
1. **Cron-style**: `job_alert_check`, `job_expiration_sweep` → 1-step workflow + `SchedulerService` cron entry. **Drops `setInterval` from your codebase.** PG-backed scheduling means no duplicate firing across pods.
   - ✅ **Verified multi-pod safe in `fluent`** (commit `<next>`): `SchedulerService.tick()` now wraps in a transaction so `FOR UPDATE SKIP LOCKED` actually holds; adds `WHERE tenantId = $1` filter for per-tenant isolation; defense-in-depth via `idempotencyKey: cron:<workflowName>:<scheduledAt>` UNIQUE constraint. New test proves 4 parallel pods → exactly 1 cron.trigger event per due schedule.
2. **Tenant provisioning**: `provision_medusa_tenant`, `create_tenant`, `migrate_tenant` → multi-step DAG. Each step idempotent, retryable, observable.
3. **Notifications**: `notify`, `notify.deferred-email`, `notify.digest-flush` → 1-step workflows with `idempotencyKey: notify-${userId}-${eventId}`.
4. **Realtime broadcast**: `realtime.broadcast` → 1-step workflow with `idempotencyKey: broadcast-${tenantId}-${1secBucket}`.

For each migration:
- Define `WorkflowBuilder.create('task_name')` in `apps/backend/src/config/agents/workflows/`
- Update producer call sites: `connector.queue('task_name', data)` → `engine.start({ workflowName: 'task_name', input: data, idempotencyKey })`
- Remove the old task handler from sodium's task registry
- Verify in dashboard / via `/api/workflows/status`

Target: **one task per week**.

### Phase 4 — Production-readiness

| Item | Owner | Notes |
|---|---|---|
| PgBouncer in front of Cloud SQL | Ops | Required at >5 active agent-using tenants |
| Retention cron | Ops | Run `bin/retention-cleanup.ts` hourly with `RETENTION_DAYS=30` **and** `RETENTION_SCHEMA=agents` (must match `WorkflowEngine.schema`). Without the schema env, the script targets `public.workflow_runs` and silently no-ops or errors with "relation does not exist". |
| PG autovacuum tuning | Ops | Apply production overrides from `docker-compose.yml` (commented block) |
| Cloud Monitoring alerts | Ops | Ingest queue depth >10k for >30s; failed run delta >X/hour |
| Dashboard for workflow_runs | Eng | Embed `@goatlab/agents-ui` or build custom Prisma view |
| Per-tenant rate limiting on `/api/workflows/start-async` | Eng | Prevent one tenant from filling the ingest queue |

### Phase 5 — Eventually delete legacy task system (long-tail)

When all `connector.queue(...)` callsites migrated, remove the `tasks.handleByName` registry pattern (or repurpose as engine handler entry point). `platform-task-workers.ts` becomes redundant. **Optional** — old tasks can coexist indefinitely.

## 2.2 Drop-in code

### `apps/backend/src/config/agents/agents.factory.ts`

```ts
import { Kysely, PostgresDialect } from 'kysely'
import {
  WorkflowEngine, WorkflowStepTask, FunctionStepExecutor,
  IngestBuffer, IngestWorker, EventIngestionService,
} from '@goatlab/agents-core'
import type { Database as AgentsDB } from '@goatlab/agents-core'
import { getSharedPool } from '@src/config/database/getConfiguredPrismaClient'
import { logger } from '@src/services/logger/logger.service'
import type { ContextWithServices } from '../_container'

interface Bundle {
  engine: WorkflowEngine
  ingestBuffer: IngestBuffer
  ingestWorker: IngestWorker
  stepTask: WorkflowStepTask
  pool: import('pg').Pool
  lastAccessed: number
}

const cache = new Map<string, Bundle>()
const MAX_INSTANCES = 50
const TTL_MS = 30 * 60 * 1000

async function evict() {
  const now = Date.now()
  for (const [k, v] of cache.entries()) {
    if (now - v.lastAccessed > TTL_MS) {
      logger.info(`[Agents] Evicting stale engine for ${k}`)
      // CRITICAL: do NOT call connector.close() — connector is shared
      await v.engine.shutdown()
      cache.delete(k)
    }
  }
  if (cache.size > MAX_INSTANCES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    for (const [k, v] of oldest.slice(0, cache.size - MAX_INSTANCES)) {
      await v.engine.shutdown()
      cache.delete(k)
    }
  }
}

export async function getAgentsBundle(ctx: ContextWithServices): Promise<Bundle> {
  const tenantId = ctx.tenantMeta.id
  const dbUrl = ctx.secretService.getSecretSync('DATABASE_URL')
  const key = `${tenantId}|${dbUrl}`

  let bundle = cache.get(key)
  if (bundle) {
    bundle.lastAccessed = Date.now()
    return bundle
  }

  const pool = getSharedPool(dbUrl, { max: 30 })  // bumped from sodium's default 5
  const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) })
  const { connector } = ctx.services.queue

  const executor = new FunctionStepExecutor()
  // TODO: register tenant-aware step handlers
  // executor.register('sendEmail', sendEmailHandler)

  const engine = new WorkflowEngine({
    db,
    pgPool: pool,
    connector,
    executors: new Map([['function', executor]]),
    workflows: new Map(/* loaded from your workflow registry */),
    tenantId,
    schema: 'agents',
    eventIngestion: new EventIngestionService({ db }),
    // Phase 2: add onEngineEvent for SSE broadcast
  })

  const ingestWorker = new IngestWorker({
    engine,
    flushThreshold: 200,
    flushIntervalMs: 20,
    maxConcurrentFlushes: 8,
  })
  const ingestBuffer = new IngestBuffer({
    connector,
    taskName: 'workflow_ingest',
    flushThreshold: 200,
    flushIntervalMs: 50,
    maxJitterMs: 20,
  })

  const stepTask = new WorkflowStepTask(engine)
  stepTask.setConnector(connector)

  // CRITICAL: do NOT call connector.listen() here. After dispatch v2,
  // engine queues route through sodium's dispatch system, not persistent
  // per-tenant workers. Just register the queue handlers in the task
  // registry below so dispatch can route them.

  bundle = {
    engine, ingestBuffer, ingestWorker, stepTask, pool,
    lastAccessed: Date.now(),
  }
  cache.set(key, bundle)
  evict().catch(() => {})
  return bundle
}
```

### `apps/backend/src/config/tasks.ts` — register engine handlers

```ts
// Existing sodium task registry, now with engine queues:
tasks.register('workflow_ingest', async (data, ctx) => {
  const { ingestWorker } = await getAgentsBundle(ctx)
  return ingestWorker.handleJob(data as any)
})
tasks.register('workflow_step_light', async (data, ctx) => {
  const { stepTask } = await getAgentsBundle(ctx)
  return stepTask.handle(data as any)
})
// Same for workflow_step_heavy, workflow_step_ai, workflow_step_sandbox
```

### `apps/backend/src/api/_express/agents/agents.resource.ts`

```ts
import { agentsRouter } from '@goatlab/agents-express'
import { withContainer } from '@src/config/_container'
import { getAgentsBundle } from '@src/config/agents/agents.factory'

export const agentsResource = agentsRouter({
  resolveAgents: async (req) => {
    const ctx = await withContainer(req)
    const { engine, ingestBuffer } = await getAgentsBundle(ctx)
    return { engine, ingestBuffer, tenantId: ctx.tenantMeta.id }
  },
})
```

### `apps/backend/src/router_express.ts`

```ts
import { agentsResource } from '@src/api/_express/agents/agents.resource'
// ...
app.use('/api/workflows', agentsResource)
```

That's the entire integration. ~150 LOC of net-new code in sodium.

## 2.3 Open questions to resolve before starting

1. **Which secret holds the per-tenant `DATABASE_URL`?** — answer determines env var name in factory.
2. **PgBouncer rollout timing** — needed at scale, maybe not for canary.
3. **Workflow registry source of truth** — code-defined `WorkflowBuilder` definitions or persisted in `workflow_definitions` table? Phase 1: code-defined.
4. **Step handler conventions** — convention for registering business handlers. Phase 1: just `executor.register(...)` calls.
5. **SSE channel naming for engine events** — `engine:run:<runId>` (per-run), `engine:tenant:<tenantId>` (firehose), or both? Decide in Phase 2.
6. **Auth for `/api/workflows/*`** — same as `/trpc/*` middleware? Confirm before mount.

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
| `27e9b76` | feat: pluggable adapters — agents-express + Prisma fragment + schema isolation |
| `1e8d83a` | feat(agents-express): blank Express + Prisma example with full load-test script |
| `2d0ef9b` | feat(example): cluster mode — 4500 req/s on 2-worker Express + Prisma |
| `b238b0e` | docs(example): record load-test results |
| `0d82940` | feat: @goatlab/agents-bun adapter + Bun + Prisma example |
| `1e34216` | refactor: promote bulkQueue() to TaskConnector — agents-core no longer BullMQ-specific |
| `d24707b` | docs: full sodium integration plan + zero-context handover |
| `078bd33` | perf: dispatch v2 — parallel batched processIncomingDispatch (Phase 0 ✅) |
| `d8355a0` | feat: engine onEngineEvent hook + EngineEvent types (Phase 2 partial ✅) |
| `4aec7b5` | fix: SchedulerService multi-pod safety — transaction-wrapped FOR UPDATE + tenantId filter |
| `b486f9a` | fix: retention-cleanup.ts schema-aware via RETENTION_SCHEMA env |
| `0e5082d` | test: engine-via-dispatch integration (proves sodium-shape consumer works end-to-end) |
| `a7bb1fc` | feat: @goatlab/realtime-broker — pooled per-tenant pub/sub (Phase 2 ✅) |
| `ac441b6` | feat: @goatlab/agents-trpc — typed tRPC adapter (sodium-friendly) |
| `8fa1aab` | example(express): wire realtime-broker + onEngineEvent → SSE endpoint |
| **(next)** | **test: full-stack composition (engine + dispatch v2 + event hook + broker)** |

## 3.2 File index — where everything lives

### Core engine files
- `packages/agents-core/src/engine/WorkflowEngine.ts` — main engine
- `packages/agents-core/src/engine/WorkflowEngine.types.ts` — config types
- `packages/agents-core/src/engine/IngestBuffer.ts` — HTTP-side accumulator
- `packages/agents-core/src/engine/IngestWorker.ts` — Redis-side accumulator
- `packages/agents-core/src/engine/StepStatusBuffer.ts` — batched step UPDATEs
- `packages/agents-core/src/engine/WriteBuffer.ts` — generic batched-write primitive
- `packages/agents-core/src/engine/ExternalActionExecutor.ts` — exactly-once side effects
- `packages/agents-core/src/engine/SchedulerService.ts` — cron triggers
- `packages/agents-core/src/engine/TaskManager.ts` — task fan-out
- `packages/agents-core/src/state/WorkflowStateMachine.ts` — pure-function state derivation
- `packages/agents-core/src/tasks/WorkflowStepTask.ts` — BullMQ handler
- `packages/agents-core/src/entities/Database.ts` — Kysely interfaces + CREATE_TABLES_SQL
- `packages/agents-core/src/api/WorkflowHandlers.ts` — framework-agnostic handler factory
- `packages/agents-core/prisma.fragment` — Prisma schema for engine tables
- `packages/agents-core/bin/retention-cleanup.ts` — retention script

### Adapters
- `packages/agents-express/src/index.ts` — Express router factory
- `packages/agents-bun/src/index.ts` — Bun fetch handler factory

### Examples
- `packages/agents-express/example/` — Express + Prisma example (with loadtest)
- `packages/agents-bun/example/` — Bun + Prisma example (with loadtest)
- `packages/agents-ui/test-server/server.ts` — internal benchmarking server (raw node:http)

### Test infrastructure
- `packages/agents-core/loadtest/k6-workflow.js` — Hatchet-style multi-scenario benchmark
- `packages/agents-express/example/scripts/k6-flat.js` — flat-rate sweep
- `packages/agents-express/example/scripts/loadtest.sh` — full lifecycle automation
- `packages/agents-core/src/__tests__/engine/` — 224 engine tests

### Top-level
- `Dockerfile` + `docker-compose.yml` — full stack for benchmarking
- `README.md` — root README with engine handover section
- `SODIUM_INTEGRATION_PLAN.md` — this document

## 3.3 Reading list (in order)

To get fully up to speed:

1. **This document** (PART 1 + 2)
2. `packages/agents-core/README.md` — engine architecture + queue-first ingestion
3. `packages/agents-express/README.md` — Express adapter shape
4. `packages/agents-express/example/README.md` — concrete integration example with perf numbers
5. `packages/agents-express/example/src/agents.factory.ts` — the model factory
6. `packages/agents-express/example/scripts/loadtest.sh` — how we test end-to-end
7. `packages/tasks-adapter-bullmq/README.md` — BullMQ connector internals (single vs bulk)
8. Sodium: `apps/backend/src/services/auth/better-auth.factory.ts` — pattern to mirror
9. Sodium: `apps/backend/src/config/queue.ts` + `dispatch.setup.ts` — what we plug into
10. Sodium: `apps/backend/src/config/database/getConfiguredPrismaClient.ts` — what we reuse

## 3.4 How to start any work session

```bash
# 1. Pull latest in fluent
cd ~/Documents/Code/fluent
git pull
pnpm install

# 2. Build everything (or just the changed package)
pnpm --filter @goatlab/agents-core build
pnpm --filter @goatlab/agents-express build
pnpm --filter @goatlab/tasks-adapter-bullmq build

# 3. Run the full test suite (validates engine integrity)
cd packages/agents-core
npx vitest run --exclude="**/load-test*" --reporter=dot
# Should be 224/224 passing

# 4. Optional: validate perf hasn't regressed
cd packages/agents-express/example
SWEEP="2000 4000" DUR=20s pnpm loadtest
# Should output "Zero data loss — every accepted workflow reached COMPLETED in PG"

# 5. Now you're ready to work
```

## 3.5 Known good commands cheat sheet

```bash
# Run engine tests (skip the long load-test file)
cd packages/agents-core && npx vitest run --exclude="**/load-test*" --reporter=dot

# Run a specific test file
cd packages/agents-core && npx vitest run src/__tests__/engine/lifecycle.spec.ts

# Start test-server (raw node:http, internal benchmarking)
cd packages/agents-ui && PORT=4445 CLUSTER_MODE=2 npx tsx test-server/server.ts

# Start Express example
cd packages/agents-express/example && pnpm start

# Loadtest the Express example end-to-end
cd packages/agents-express/example && SWEEP="2000 4000 5000" DUR=30s pnpm loadtest

# Loadtest with debug timing
cd packages/agents-ui && INGEST_TIMING=1 CLUSTER_MODE=2 npx tsx test-server/server.ts
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

**Q: Why use Kysely instead of Prisma in agents-core?**
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

---

*Maintained alongside `packages/agents-core/`. Update this doc when architecture decisions change.*

*Last updated: 2026-04-14, after 13 commits, 1 working day of integration design + perf engineering.*
