# @goatlab/delphi-core

Distributed agent workflow engine. Runs step DAGs over Postgres (source of truth) and BullMQ (execution queues) with exactly-once external actions, human-in-the-loop, and queue-first ingestion capable of 5k+ req/s on modest hardware.

## What it is

A TypeScript workflow engine designed for agent orchestration. You define workflows as DAGs of steps; the engine handles scheduling, retries, step-level state, human approval gates, distributed execution, event ingestion, budgets, and lineage tracking.

Postgres holds the durable state (runs, steps, logs, external actions, events). BullMQ routes work between the engine and its workers across four queues (`light`, `heavy`, `ai`, `sandbox`) differentiated by `stepWeight`.

## Library vs service mode

There are two ways to use the engine — pick the one that matches your deployment.

**Library mode (default — start here):** import `@goatlab/delphi-core` directly into your app, construct the engine once, and call its methods from inside your existing handlers. No new HTTP surface, no new auth surface, no extra process. Your app's auth, tenant resolution, observability, and rate limiting wrap engine calls for free.

```ts
// Inside your existing checkout handler:
app.post('/api/orders/:id/checkout', requireAuth, async (req, res) => {
  const { runId } = await ingestBuffer.enqueueCommitted({
    workflowName: 'payment_critical',
    tenantId: req.user.tenantId,
    input: req.body,
    idempotencyKey: `checkout-${req.params.id}`,
  })
  res.json({ runId })
})
```

**Service mode (for shared infrastructure):** when multiple independent client apps (web, mobile, partner APIs, other services) need to start workflows against a single shared engine. Mount the engine behind HTTP via [`@goatlab/delphi-express`](../delphi-express). The HTTP boundary becomes the contract; you must wire your own auth middleware. Choose this for the same reasons you'd put a queue or DB behind a service rather than embedding it.

| | Library mode | Service mode (`delphi-express`) |
|---|---|---|
| Single Node app, you own all callers | ✅ | overkill |
| Multiple client apps / cross-team callers | — | ✅ |
| Engine = implementation detail | ✅ | — |
| Engine = product surface | — | ✅ |
| Auth | reuse your app's | required at the service edge |
| New attack surface | none | the HTTP endpoints |

Both modes expose the same operations — see "Anything an HTTP endpoint can do" below for the library equivalent of every HTTP route.

## Install

```bash
pnpm add @goatlab/delphi-core kysely pg @goatlab/tasks-adapter-bullmq
```

Requires Postgres 14+ and Redis 6+.

## Quick start

```ts
import { WorkflowEngine, WorkflowBuilder, FunctionStepExecutor, CREATE_TABLES_SQL } from '@goatlab/delphi-core'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
const db = new Kysely({ dialect: new PostgresDialect({ pool }) })

// Create tables (idempotent)
for (const stmt of CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
  await sql.raw(stmt).execute(db)
}

const executor = new FunctionStepExecutor()
executor.register('greet', async ({ input }) => ({ output: { hi: `hello ${input.name}` } }))

const connector = new BullMQConnector({ connection: { host: 'localhost', port: 6379 } })

const wf = WorkflowBuilder.create('greet_flow')
  .step('greet', { executorType: 'function', executorConfig: { handler: 'greet' } })
  .build()

const engine = new WorkflowEngine({
  db,
  pgPool: pool,                                        // enables COPY FROM fast path
  connector,
  executors: new Map([['function', executor]]),
  workflows: new Map([['greet_flow', wf]]),
  tenantId: 'default',
})

// Workers: consume from all step queues
import { WorkflowStepTask } from '@goatlab/delphi-core'
const stepTask = new WorkflowStepTask(engine)
stepTask.setConnector(connector)
await connector.listen({
  tasks: [
    { taskName: 'workflow_step_light',   handle: (d) => stepTask.handle(d as any), concurrency: 50 },
    { taskName: 'workflow_step_heavy',   handle: (d) => stepTask.handle(d as any), concurrency: 12 },
    { taskName: 'workflow_step_ai',      handle: (d) => stepTask.handle(d as any), concurrency: 25 },
    { taskName: 'workflow_step_sandbox', handle: (d) => stepTask.handle(d as any), concurrency: 5 },
  ],
})

const { runId } = await engine.start({ workflowName: 'greet_flow', tenantId: 'default', input: { name: 'Ada' } })
```

## Core concepts

### Workflow & step
A `WorkflowDefinition` is a DAG of `StepDefinition`s. Steps have dependencies (`dependsOn`), an executor (`function`, `taskRunner`, `claudeCode`, etc.), optional retry/timeout/heartbeat, optional `stepWeight` for queue routing, and optional `requiresHumanApproval`.

### State
Runs and steps live in Postgres. The state machine enforces valid transitions (`PENDING → QUEUED → RUNNING → COMPLETED | FAILED | WAITING_HUMAN`). `deriveWorkflowStatus` computes run status from step statuses.

### Execution
On `engine.start()`, the engine inserts the run + steps and dispatches root steps (those with no `dependsOn`) to the appropriate BullMQ queue. Step workers pick up jobs, call `engine.markStepRunning`, run the executor, and call `engine.onStepCompleted` or `engine.onStepFailed`. The engine then advances the DAG.

### Queue-first ingestion (high throughput)
For ingesting workflows at scale, use `IngestBuffer` + `IngestWorker`:

```ts
import { IngestBuffer, IngestWorker } from '@goatlab/delphi-core'

const ingestWorker = new IngestWorker({ engine, flushThreshold: 200, maxConcurrentFlushes: 8 })

const ingestBuffer = new IngestBuffer({
  // Backend-agnostic — TaskConnector.bulkQueue (BullMQ uses addBulk under the hood).
  connector,
  taskName: 'workflow_ingest',
  flushThreshold: 200,
  flushIntervalMs: 50,
  maxJitterMs: 20,
  // Required if any registered workflow uses durability('committed') —
  // enqueueCommitted() flushes directly via engine.startBatchCopy().
  engine,
  committedFlushThreshold: 100,
  committedFlushIntervalMs: 20,
  committedMaxConcurrentFlushes: 4,
})

// Wire the worker-side consumer
await connector.listen({ tasks: [
  { taskName: 'workflow_ingest', handle: (d) => ingestWorker.handleJob(d as any), concurrency: 300 },
  // ... step queues
]})

// In your HTTP handler — dispatch by workflow.durability:
const def = engine.getWorkflows().get(req.body.workflowName)
if (def?.durability === 'committed') {
  const { runId, traceId } = await ingestBuffer.enqueueCommitted({ ...req.body, tenantId })
  return { runId, traceId, status: 'COMMITTED' }   // PG fsync'd before 200
}
const { runId, traceId } = ingestBuffer.enqueue({ ...req.body, tenantId })
return { runId, traceId, status: 'QUEUED' }       // in-memory ack, ~1-2ms
```

(Or use `@goatlab/delphi-express` — its `agentsRouter()` does this dispatch automatically.)

`IngestBuffer` accumulates triggers in-memory, flushes to Redis via `queue.addBulk` (one LUA script call per batch). `IngestWorker` re-batches BullMQ jobs into a single `COPY FROM` transaction per ~200 workflows. End-to-end: 5k req/s on 2 vCPU, p95 < 100ms, zero data loss.

### Workflow durability (`buffered` vs `committed`)

Each workflow definition declares its **ingest durability guarantee** — what `/start-async` actually promises when it returns 200.

```ts
// Buffered (default) — HTTP returns ~1-2ms after the trigger hits the
// in-memory IngestBuffer. Flush to Redis + PG happens asynchronously.
// Tradeoff: a process crash inside the ~70ms flush window loses the request.
const fastWorkflow = WorkflowBuilder.create('event_ingest')
  .step('process', { executorType: 'function', executorConfig: { handler: 'doWork' } })
  .build()

// Committed — HTTP blocks until the workflow_runs row is COPY-FROM'd and
// COMMIT'd to Postgres (synchronous_commit=ON, fsync'd to WAL). Use for
// payments, financial flows, or anything where "accepted" must mean
// "durable on disk". Throughput stays high because BatchedJobProcessor
// amortizes the COPY+COMMIT across every concurrent committed caller.
const paymentWorkflow = WorkflowBuilder.create('payment_critical')
  .durability('committed')
  .step('charge', { executorType: 'function', executorConfig: { handler: 'chargeCard' } })
  .build()
```

To enable the committed path, pass `engine` to `IngestBuffer` so it can call `engine.startBatchCopy(triggers, { synchronousCommit: true })` directly from the HTTP process:

```ts
const ingestBuffer = new IngestBuffer({
  connector,
  taskName: 'workflow_ingest',
  flushThreshold: 200,
  flushIntervalMs: 50,
  // Required for durability='committed' — otherwise enqueueCommitted() throws:
  engine,
  committedFlushThreshold: 100,
  committedFlushIntervalMs: 20,
  committedMaxConcurrentFlushes: 4,
})
```

Your HTTP handler dispatches by definition:

```ts
const trigger = { ...req.body, tenantId }
const def = engine.getWorkflows().get(trigger.workflowName)
if (def?.durability === 'committed') {
  const { runId, traceId } = await ingestBuffer.enqueueCommitted(trigger)
  return res.json({ runId, traceId, status: 'COMMITTED' })
}
const { runId, traceId } = ingestBuffer.enqueue(trigger)
return res.json({ runId, traceId, status: 'QUEUED' })
```

The `@goatlab/delphi-express` router does this dispatch automatically — just expose `engine` and `ingestBuffer` from your `resolveAgents` callback.

#### Idempotency

The committed path passes `checkIdempotency: true` to `engine.startBatchCopy`, so a duplicate POST with the same `idempotencyKey` returns the original `runId` instead of creating a second row — both against PG (cross-flush) and within the same in-flight batch (first-wins). Required for payment-style flows where double-submit must not double-charge. The buffered path doesn't dedupe by default (skips the extra SELECT) — call `engine.start()` directly if you need idempotency on a non-committed workflow.

#### PG pool sizing

The HTTP process holds connections concurrently across several subsystems. Size your pool with this floor:

```
pool ≥ committedMaxConcurrentFlushes      // committed COPY transactions
     + ingestMaxConcurrentFlushes         // buffered IngestWorker COPY transactions
     + ~5                                 // status reads, log buffer flushes, ad-hoc queries
```

For the test server (`PG_POOL_SIZE=20`) with `committedMaxConcurrentFlushes=5` and `ingestMaxConcurrentFlushes=10`, that's `5 + 10 + 5 = 20` — just enough headroom. If you raise either knob to push committed/buffered throughput, raise `pool` proportionally or you'll starve status reads under sustained load.

### External actions (exactly-once)
Use `engine.externalActions.run({...})` to call systems of record (GitHub, Linear, Stripe). The engine persists intent → dispatches → records result → replays safely on retry. See `ExternalActionExecutor`.

### Human-in-the-loop
A step returning `{ waitForHuman: { prompt, schema } }` transitions the step to `WAITING_HUMAN`. Resume via `engine.submitHumanInput({ runId, stepName, response })`.

### Signals
`engine.signal(runId, signalName, data)` persists a signal and runs any registered handler. Combined with HITL for pause/resume flows.

### Events & triggers
`EventIngestionService` accepts events (with `idempotencyKey`, `entityKey`, `sequenceNumber`) and matches them against workflow triggers. Supports stale-event skipping.

### Budgets
Per-run limits on tokens, cost, step count, and task executions. Enforced on every step completion. See `WorkflowBudget` / `BudgetUsed`.

### Lineage
Every run carries a `traceId`. `engine.getTrace(traceId)` returns the full set of runs, events, and external actions sharing that trace.

### Worker nodes (remote executors)
Beyond in-process BullMQ workers, registered `WorkerNode` instances can pull step payloads via HTTP long-poll, execute remotely (e.g., in containers), and post results back. See `packages/delphi-core/src/worker-node`.

## Library API surface (anything an HTTP endpoint can do)

`createWorkflowHandlers(engine)` returns a plain object of async functions — no HTTP awareness. `delphi-express` is just `req.body → handlers.X(...) → res.json(result)`, so library mode exposes the same surface without needing the network boundary:

```ts
import { createWorkflowHandlers, WorkflowEngine, IngestBuffer } from '@goatlab/delphi-core'

const engine = new WorkflowEngine({ ... })
const ingestBuffer = new IngestBuffer({ engine, ... })
const handlers = createWorkflowHandlers(engine)

// Equivalent of every HTTP endpoint, callable in-process:
await handlers.start({ workflowName, tenantId, input })
await handlers.startBatch({ workflows: [...] })
await handlers.startBatchCopy({ workflows: [...] })
await handlers.getStatus({ runId, tenantId })
await handlers.cancel({ runId, tenantId })
await handlers.signal({ runId, tenantId, signalName, data })
await handlers.submitHumanInput({ runId, stepName, tenantId, data })
await handlers.query({ runId, tenantId, queryName })
await handlers.ingestEvent({ eventType, source, payload, tenantId })
await handlers.listWorkflows({ tenantId })
await handlers.getDefinition({ workflowName })   // adds input-field inference

// Plus the ingestion helpers (no HTTP equivalent needed — call directly):
ingestBuffer.enqueue({ ... })                    // buffered fast path
await ingestBuffer.enqueueCommitted({ ... })     // committed durable path
```

Prefer `handlers` over raw `engine.X` calls in library mode — handlers add small conveniences (e.g., input-field inference in `getDefinition`) that the HTTP layer relies on. `engine.X` instance methods (`engine.start`, `engine.cancel`, `engine.signal`, etc.) are also available if you want zero indirection.

## Performance

All numbers from running `packages/delphi-express/example` against a fresh stack (Docker Desktop, M-series Mac, PG + Redis + app colocated). Production with managed PG/Redis will be faster.

### Per-process ceiling (1 Node process, `CLUSTER_MODE=off`)

| Rate | p50 | p95 | p99 | Errors | Verdict |
|---|---|---|---|---|---|
| 1,000 req/s | 9ms | 29ms | 80ms | 0% | clean |
| **2,000** | **25ms** | **54ms** | **79ms** | **0%** | **safe ceiling** |
| 3,000 | 71ms | 7,009ms | 8,851ms | 4.29% | 🚨 cliff |
| 6,000 | 82ms | 172ms | 18,751ms | 3.17% | throughput degrades |

**~2,000 req/s per Node process** is the safe sustainable rate.

### Cluster mode (1 instance × 2 processes = 2 vCPU)

| Rate | p50 | p95 | p99 | Errors | Sustained |
|---|---|---|---|---|---|
| 2,000 | 23ms | 62ms | 161ms | 0% | 1,984/s ✓ |
| 4,000 | 48ms | 102ms | 192ms | 0% | 3,908/s ✓ |
| **5,000** | **80ms** | **171ms** | **824ms** | **0%** | **4,460/s** (healthy) |

### Buffered vs committed durability (cluster mode = 2, production-like PG)

Apples-to-apples: same 2-process cluster, same ramp profile, **`fsync=on, synchronous_commit=on, full_page_writes=on`** (production defaults). The committed path's COPY transaction uses `synchronous_commit=ON` so COMMIT actually fsyncs the WAL — `BatchedJobProcessor` amortizes that fsync across every concurrent caller in the batch.

| Metric | Buffered (`fast_single`) | Committed (`payment_critical`) | Ratio |
|---|---|---|---|
| Sustained peak RPS | **4,000** | **1,600** | committed ≈ 2.5× slower |
| p50 latency | 6 ms | 88 ms | committed ≈ 14.7× |
| p95 latency | 46 ms | 166 ms | committed ≈ 3.6× |
| p99 latency | 133 ms | 287 ms | committed ≈ 2.2× |
| Error rate | 0.00% | 0.003% (2 / 74,872) | — |

**Reading this:** the committed path costs you ~2.5× throughput and adds ~120 ms p95 latency in exchange for an honest "the row is fsync'd to disk before we say 200." That's a perfectly reasonable tax for payment / financial flows; trivially within any real-world payment SLO. Buffered remains the right default for high-volume event ingestion where the ~70ms crash window is acceptable.

The gap stays at ~2.5× (not 50×) because `BatchedJobProcessor` shares one COPY+COMMIT across ~100 concurrent committed callers — per-caller fsync cost is ~0.1 ms. The bottleneck is per-process flush coordination, not Postgres.

Reproduce: `k6 run packages/delphi-core/loadtest/k6-workflow-buffered.js` then `k6 run packages/delphi-core/loadtest/k6-workflow-committed.js` against `CLUSTER_MODE=2 npx tsx packages/delphi-ui/test-server/server.ts`.

### Horizontal (4 instances × 2 processes, shared PG/Redis)

| Target | Actual | p95 | p99 | Errors | Verdict |
|---|---|---|---|---|---|
| 2k | 1,999 | 19ms | 60ms | 0% | ✅ |
| **5k** | **4,864** | **156ms** | **463ms** | **0%** | **✅ healthy** |
| 10k | 5,540 | 1,314ms | 4,733ms | 0.02% | ⚠ first cliff (host CPU saturates) |
| 20k | 5,510 | 546ms | 6,079ms | 0.09% | ⚠ plateau |
| 40k | 4,309 | 1,874ms | 3,674ms | 0.74% | ⚠ deep overload |

**Durability holds throughout overload**: 0 FAILED runs across the entire sweep. Redis absorbs the burst; drain catches up.

### Durability check (5k sustained, 60s)
- **316,929 fired → 316,930 in `agents.workflow_runs` → 316,930 COMPLETED** (1 from smoke)
- **0 BullMQ failed jobs** · **0 FAILED runs**
- Step drain rate: ~730 completions/sec/instance

### Scaling rule of thumb
**Budget ~2,000 req/s per Node process.** Scale via (a) cluster mode within a pod, (b) horizontal pods. 4 pods × 2 workers = ~5k ingestion (host CPU bound in dev; production linearizes with managed PG/Redis).

### Key optimizations baked in
- Per-workflow `definitionSnapshot` JSON cached (avoids re-stringifying)
- `SET LOCAL synchronous_commit = OFF` on **buffered** ingest transactions (~45% PG TPS); committed workflows opt back into `synchronous_commit = ON` so COMMIT fsyncs the WAL
- `addBulk` for step dispatch (1 Redis roundtrip per queue per batch)
- `COPY FROM` for run+step inserts (Hatchet-style)
- Bounded concurrent flushes (default 8) to preserve PG pool headroom
- Log buffering (50-entry / 50ms flush threshold)

## Testing

```bash
pnpm test                                        # 277 engine tests (needs Docker for testcontainers)
npx vitest run --exclude="**/load-test*"         # skip 2-min load test
npx vitest run src/__tests__/engine/lifecycle.spec.ts   # targeted
```

Most test files carry a run hint at the top (e.g. `// npx vitest run src/__tests__/engine/lifecycle.spec.ts`).

## Key exports

| Export | Purpose |
|---|---|
| `WorkflowEngine` | Core engine |
| `WorkflowBuilder` | Fluent API for workflow definitions |
| `WorkflowStepTask` | BullMQ handler that bridges jobs → `engine.onStepCompleted`/Failed |
| `IngestBuffer`, `IngestWorker` | Queue-first ingestion accumulators (buffered + committed paths) |
| `WorkflowDurability` | `'buffered' \| 'committed'` — set per-workflow via `WorkflowBuilder.durability(...)` |
| `FunctionStepExecutor`, `TaskRunnerExecutor`, `ClaudeCodeExecutor` | Built-in executors |
| `ExternalActionExecutor` | Exactly-once external side effects |
| `EventIngestionService` | Event ingest + trigger matching |
| `WorkerNode` | Remote worker runtime |
| `CREATE_TABLES_SQL` | Schema bootstrap |
| `canStepTransition`, `deriveWorkflowStatus`, `getReadySteps`, `topologicalSort` | Pure state-machine helpers |

## Schema

Plain Kysely interfaces in `src/entities/Database.ts`. No decorators, no `reflect-metadata`. JSON columns are stored as `TEXT` with `toJson()` / `fromJson()` helpers. Always rebuild (`pnpm build`) before running downstream packages against a schema change.

## License

MIT
