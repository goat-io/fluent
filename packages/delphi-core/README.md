# @goatlab/delphi-core

Distributed agent workflow engine. Runs step DAGs over Postgres (source of truth) and BullMQ (execution queues) with exactly-once external actions, human-in-the-loop, and queue-first ingestion capable of 5k+ req/s on modest hardware.

## What it is

A TypeScript workflow engine designed for agent orchestration. You define workflows as DAGs of steps; the engine handles scheduling, retries, step-level state, human approval gates, distributed execution, event ingestion, budgets, and lineage tracking.

Postgres holds the durable state (runs, steps, logs, external actions, events). BullMQ routes work between the engine and its workers across four queues (`light`, `heavy`, `ai`, `sandbox`) differentiated by `stepWeight`.

## Library vs service mode

There are two ways to use the engine — pick the one that matches your deployment.

**Library mode (default — start here):** import `@goatlab/delphi-core` directly into your app, construct the engine once, and call its methods from inside your existing handlers. No new HTTP surface, no new auth surface, no extra process. Your app's auth, tenant resolution, observability, and rate limiting wrap engine calls for free.

```ts
// Inside your existing checkout handler — typed, no strings:
app.post('/api/orders/:id/checkout', requireAuth, async (req, res) => {
  const { runId } = await engine.payment_critical.startCommitted(
    { orderId: req.params.id, amountCents: req.body.amountCents, customerId: req.user.id },
    { idempotencyKey: `checkout-${req.params.id}` },
  )
  res.json({ runId })
})
```

For multi-tenant apps, keep a `Map<tenantId, TypedEngine>` and construct one engine per tenant (cached, LRU). The `tenantId` is baked into the engine at `createEngine({ tenantId })` time so every proxy call is automatically tenant-scoped.

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

Workflows are authored as **typed classes** — one class per Step (the actual work), one class per Workflow (the DAG), and `createEngine({ workflows: [...] })` wires everything together into a typed engine where each workflow appears as an addressable property. No string handler names, no `executorConfig` blobs at the call site.

```ts
import {
  Workflow, FunctionStep, step, createEngine,
  WorkflowStepTask, CREATE_TABLES_SQL,
} from '@goatlab/delphi-core'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
const db = new Kysely({ dialect: new PostgresDialect({ pool }) })
for (const stmt of CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
  await sql.raw(stmt).execute(db)
}
const connector = new BullMQConnector({ connection: { host: 'localhost', port: 6379 } })

// ── 1. Define steps (the work) ───────────────────────────────
class GreetStep extends FunctionStep<
  { name: string },       // TInput
  { hi: string },         // TOutput
  'greet'                 // TName (literal)
> {
  stepName = 'greet' as const
  async handle(input) {
    return { output: { hi: `hello ${input.name}` } }
  }
}
const greetStep = new GreetStep()

// ── 2. Define workflows (DAGs over Step instances — no strings) ───
class GreetWorkflow extends Workflow<{ name: string }, 'greet_flow'> {
  workflowName = 'greet_flow' as const
  steps = [step(greetStep)] as const
}

// ── 3. Build the typed engine ───────────────────────────────
const engine = createEngine({
  workflows: [new GreetWorkflow()] as const,
  db, pgPool: pool, connector, tenantId: 'default',
})

// ── 4. Consume step queues (same as before) ─────────────────
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

// ── 5. Call it — fully typed, no string workflow names ──────
const { runId } = await engine.greet_flow.start({ name: 'Ada' })
//                        ↑ autocomplete      ↑ TS enforces { name: string }

await engine.greet_flow.cancel(runId)
await engine.greet_flow.signal(runId, 'someSignal', { data: 'payload' })
```

**Why the class API:** renaming a step renames the handler key everywhere; renaming a workflow renames the property on the engine; changing a step's input type surfaces as a TS error at every `mapInput` callsite. Nothing compiles unless the graph is consistent.

## Core concepts

### Workflow & step
A `WorkflowDefinition` is a DAG of `StepDefinition`s. Steps have dependencies (`dependsOn`), an executor (`function`, `taskRunner`, `claudeCode`, etc.), optional retry/timeout/heartbeat, optional `stepWeight` for queue routing, and optional `requiresHumanApproval`.

### State
Runs and steps live in Postgres. The state machine enforces valid transitions (`PENDING → QUEUED → RUNNING → COMPLETED | FAILED | WAITING_HUMAN`). `deriveWorkflowStatus` computes run status from step statuses.

### Execution
On `engine.start()`, the engine inserts the run + steps and dispatches root steps (those with no `dependsOn`) to the appropriate BullMQ queue. Step workers pick up jobs, call `engine.markStepRunning`, run the executor, and call `engine.onStepCompleted` or `engine.onStepFailed`. The engine then advances the DAG.

### Queue-first ingestion (high throughput)

`createEngine` wires up `IngestBuffer` internally and exposes the two fast paths on every workflow:

```ts
// ~1-2ms in-memory ack; PG write happens downstream in IngestWorker.
const { runId } = engine.event_ingest.startBuffered({ payload: 'hi' })

// Blocks until PG COMMIT (synchronous_commit=ON); batched across callers.
const { runId } = await engine.payment_critical.startCommitted({ /* ... */ })
```

On the worker side (may be the same process or a separate one), wire the `workflow_ingest` queue to an `IngestWorker` so buffered triggers drain to PG via `COPY FROM`:

```ts
import { IngestWorker } from '@goatlab/delphi-core'

const ingestWorker = new IngestWorker({ engine, flushThreshold: 200, maxConcurrentFlushes: 8 })
await connector.listen({ tasks: [
  { taskName: 'workflow_ingest', handle: (d) => ingestWorker.handleJob(d as any), concurrency: 300 },
  // ... step queues (workflow_step_light/heavy/ai/sandbox)
]})
```

Tune `createEngine`'s ingest knobs via the `ingest` option if the defaults don't fit your profile:

```ts
const engine = createEngine({
  workflows: [...] as const,
  db, pgPool, connector, tenantId,
  ingest: {
    flushThreshold: 200,
    flushIntervalMs: 50,
    committedFlushThreshold: 100,
    committedFlushIntervalMs: 20,
    committedMaxConcurrentFlushes: 4,
  },
})
```

Under the hood: `IngestBuffer` accumulates triggers in-memory, flushes to Redis via `queue.addBulk` (one LUA script per batch). `IngestWorker` re-batches BullMQ jobs into a single `COPY FROM` transaction per ~200 workflows. End-to-end: 5k req/s on 2 vCPU, p95 < 100ms, zero data loss.

### Workflow durability (`buffered` vs `committed`)

Each workflow declares its **ingest durability guarantee** — what `start-async` (or the typed proxy's `startBuffered` / `startCommitted`) actually promises when it returns. Declared on the workflow class via an `override durability = '...' as const` field.

```ts
// Buffered (default) — caller returns ~1-2ms after the trigger hits the
// in-memory IngestBuffer. Flush to Redis + PG happens asynchronously.
// Tradeoff: a process crash inside the ~70ms flush window loses the request.
class EventIngestWorkflow extends Workflow<{ payload: string }, 'event_ingest'> {
  workflowName = 'event_ingest' as const
  steps = [step(processEventStep)] as const
  // no `durability` → defaults to buffered
}

// Committed — caller blocks until the workflow_runs row is COPY-FROM'd and
// COMMIT'd to Postgres (synchronous_commit=ON, fsync'd to WAL). Use for
// payments, financial flows, or anything where "accepted" must mean
// "durable on disk". Throughput stays high because BatchedJobProcessor
// amortizes the COPY+COMMIT across every concurrent committed caller.
class PaymentCriticalWorkflow extends Workflow<
  { orderId: string; amountCents: number; customerId: string },
  'payment_critical'
> {
  workflowName = 'payment_critical' as const
  override durability = 'committed' as const
  steps = [step(chargeCardStep), step(sendReceiptStep, { dependsOn: [chargeCardStep] })] as const
}
```

`createEngine` wires up the committed path automatically (it constructs `IngestBuffer` internally). At the call site you pick which durability promise to make per call:

```ts
// Buffered → ~1-2ms, in-memory ack
engine.event_ingest.startBuffered({ payload: 'hello' })

// Committed → blocks until PG COMMIT with synchronous_commit=ON
await engine.payment_critical.startCommitted({
  orderId: 'ord_123',
  amountCents: 4200,
  customerId: 'cust_42',
}, { idempotencyKey: 'payment-ord_123' })
```

The `override durability = 'committed'` on the class is informational — it flags intent for readers/lint rules. The actual durability is determined by **which method you call** at the start site (`startBuffered` vs `startCommitted`). A committed-flagged workflow can still be started via `startBuffered` (unusual) and vice versa. For `/start-async` HTTP adapters that dispatch by definition, the flag is authoritative — see the generic dispatch pattern in `test-server.ts`.

If you prefer the HTTP adapter shape (dispatch by `definition.durability`), the `@goatlab/delphi-express` `agentsRouter()` does that automatically.

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

### Using `@goatlab/tasks-core` `ShouldQueue` tasks as Delphi steps

Already have a catalogue of Sodium-style `ShouldQueue` tasks? Don't rewrite them. A task is a typed unit of work with an input, an output, and a `handle(body)` method — the same shape as a Delphi `FunctionStep`. **Pass the task instance directly to `createEngine`** — it's auto-wrapped as a single-step workflow:

```ts
import { createEngine } from '@goatlab/delphi-core'
import { checkPostTask } from '@/api/posts/tasks/checkPosts.task'      // a ShouldQueue singleton
import { paymentWorkflow } from '@/workflows/payment/payment.workflow' // a Workflow instance

// Mix ShouldQueue tasks and Workflow instances freely in the same array:
const engine = createEngine({
  workflows: [paymentWorkflow, checkPostTask] as const,
  db, pgPool, connector, tenantId: 'default',
})

// Typed call site — `TInput` comes straight from each entry's generics:
await engine.payment_critical.startCommitted({ orderId, amountCents, customerId })
await engine.check_post.start({ postId: 'p_123' })            // from the ShouldQueue
```

That's it. No wrapping call, no extra import. `createEngine` checks `instanceof ShouldQueue` at construction and adapts on the fly — a task is literally just a one-step workflow.

If you want to compose a `ShouldQueue` task into a **multi-step DAG** (as one step among several), adapt it explicitly:

```ts
import { fromShouldQueue, Workflow, step } from '@goatlab/delphi-core'

const checkPostStep = fromShouldQueue(checkPostTask)
class PostPipeline extends Workflow<{ postId: string }, 'post_pipeline'> {
  workflowName = 'post_pipeline' as const
  steps = [
    step(checkPostStep),                                      // the task as a step
    step(indexPostStep, { dependsOn: [checkPostStep] }),
  ] as const
}
```

What carries over automatically:
- `task.taskName` → `workflow.workflowName` (literal type preserved)
- `task.retries` → `workflow.defaultRetries`
- `task.handle(body)` runs inline on the workflow worker — Delphi owns retries, timeouts, observability, and durability
- `TInput` / `TResult` generics flow through to `engine.<taskName>.start(input)`

What's left out: the task's own `connector` / `tracker`. If you want the task's *queueing* semantics (HTTP dispatch, separate worker pool, GCP Cloud Tasks), enqueue from a step via `connector.queue(...)` instead — the adapter only wraps the task's logic, not its transport.

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

In library mode the **typed engine proxy** from `createEngine` is the primary API — every workflow is an addressable property, fully typed, no strings:

```ts
// Start (three durability flavors):
await engine.payment_critical.start(input, { idempotencyKey })             // sync INSERT, returns runId
      engine.event_ingest.startBuffered(input)                             // in-memory ack, ~1-2ms
await engine.payment_critical.startCommitted(input, { idempotencyKey })    // PG fsync'd before return

// Lifecycle (runId is a string — no workflow name needed, path is typed):
await engine.payment_critical.getStatus(runId)
await engine.payment_critical.cancel(runId)
await engine.payment_critical.signal(runId, 'approved', { reviewer: 'alice' })
await engine.payment_critical.submitHumanInput(runId, 'review', { approved: true })
```

For HTTP-adapter shapes (string-based `workflowName` coming off `req.body`), `createWorkflowHandlers(engine)` returns a plain object of async functions — the same surface `delphi-express` mounts over HTTP, callable in-process:

```ts
import { createWorkflowHandlers } from '@goatlab/delphi-core'
const handlers = createWorkflowHandlers(engine)

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

// The underlying IngestBuffer is also exposed for shutdown + depth probes:
engine.ingestBuffer.currentDepth()
await engine.ingestBuffer.shutdown()
```

**Rule of thumb:** use the typed proxy (`engine.payment_critical.start(...)`) when the caller is your own code and knows the workflow at compile time. Use `handlers` when the caller receives a string `workflowName` at runtime (HTTP handler, message consumer, CLI). The two APIs coexist — both operate on the same engine state.

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
| `Step`, `FunctionStep` | Base classes for typed steps — subclass and override `handle()` |
| `Workflow`, `step` | Base class for typed workflows + composition helper |
| `createEngine` | Factory: returns engine with typed per-workflow proxy properties |
| `fromShouldQueue`, `workflowFromShouldQueue` | Adapters: reuse `@goatlab/tasks-core` `ShouldQueue` tasks as Steps / single-step Workflows |
| `TypedStepResult`, `StepEntry`, `StepOutputs`, `WorkflowOps`, `TypedEngine` | Type helpers used by the class API |
| `WorkflowEngine` | Core engine (constructed by `createEngine`; usable directly for advanced cases) |
| `WorkflowStepTask` | BullMQ handler that bridges jobs → `engine.onStepCompleted`/Failed |
| `IngestBuffer`, `IngestWorker` | Queue-first ingestion accumulators (buffered + committed paths) |
| `WorkflowDurability` | `'buffered' \| 'committed'` — set per-workflow via `override durability = ... as const` |
| `FunctionStepExecutor`, `TaskRunnerExecutor`, `ClaudeCodeExecutor` | Built-in executors (auto-registered by `createEngine` for class steps) |
| `ExternalActionExecutor` | Exactly-once external side effects |
| `EventIngestionService` | Event ingest + trigger matching |
| `WorkerNode` | Remote worker runtime |
| `CREATE_TABLES_SQL` | Schema bootstrap |
| `canStepTransition`, `deriveWorkflowStatus`, `getReadySteps`, `topologicalSort` | Pure state-machine helpers |

## Schema

Plain Kysely interfaces in `src/entities/Database.ts`. No decorators, no `reflect-metadata`. JSON columns are stored as `TEXT` with `toJson()` / `fromJson()` helpers. Always rebuild (`pnpm build`) before running downstream packages against a schema change.

## License

MIT
