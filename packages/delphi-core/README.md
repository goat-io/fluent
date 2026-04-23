<p align="center">
  <img src="./image.png" alt="delphi-core" width="100%" />
</p>

# @goatlab/delphi-core

Durable workflow engine for TypeScript. Runs step DAGs over Postgres with exactly-once external actions, human-in-the-loop, and queue-first ingestion capable of 5k+ req/s on modest hardware. No Redis required.

## What it is

A TypeScript workflow engine designed for agent orchestration. You define workflows as DAGs of steps; the engine handles scheduling, retries, step-level state, human approval gates, distributed execution, event ingestion, budgets, and lineage tracking.

Postgres is the only required infrastructure — it holds all durable state and serves as the dispatch queue via `FOR UPDATE SKIP LOCKED`. For workloads above ~5k req/s, Redis can be added with a single config line.

## Install

```bash
pnpm add @goatlab/delphi-core pg
```

Requires Postgres 14+. Redis is optional (install `@goatlab/tasks-adapter-bullmq` if needed).

## Quick start

```ts
import { Workflow, FunctionStep, step, createEngine } from '@goatlab/delphi-core'

// 1. Define steps — just input and output types
class VerifyStep extends FunctionStep<{ orderId: string }, { token: string; amount: number }> {
  stepName = 'verify' as const
  async handle(input) {
    return { output: { token: 'tok_abc', amount: 4200 } }
  }
}

class ChargeStep extends FunctionStep<{ token: string; amount: number }, { chargeId: string }> {
  stepName = 'charge' as const
  async handle(input) {
    return { output: { chargeId: `ch_${input.token}` } }
  }
}

// 2. Define a workflow — steps as classes, auto-pass wires outputs → inputs
class PaymentWorkflow extends Workflow<{ orderId: string }> {
  workflowName = 'payment' as const
  steps = [
    VerifyStep,                                   // root — gets trigger input
    step(ChargeStep, { dependsOn: [VerifyStep] }), // auto-pass — gets verify's output
  ] as const
  // TypeScript verifies: VerifyStep output { token, amount } satisfies ChargeStep input { token, amount } ✓
  // If types don't match, the compiler requires mapInput to bridge them.
}

// 3. Create the engine — one connection string
const engine = createEngine({
  database: process.env.DATABASE_URL,
  workflows: [PaymentWorkflow] as const,
  tenantId: 'default',
})

// 4. Start — fire-and-forget, returns a handle
const { runId } = await engine.payment.start({ orderId: 'ord_123' })
// Workflow runs in the background. Use runId to check status later.
```

Just Postgres, classes, and types.

### What `database` accepts

```ts
// Connection string (engine creates the pool)
createEngine({ database: 'postgresql://user:pass@localhost:5432/mydb', ... })

// Existing pg.Pool (shares your backend's pool — no duplicate connections)
createEngine({ database: existingPool, ... })
```

### Adding Redis for high throughput

```ts
createEngine({
  database: existingPool,
  redis: existingRedisConnection,  // opt-in — dispatch goes through BullMQ
  workflows: [...],
  tenantId: 'default',
})
```

### How Postgres dispatch works

The engine uses `FOR UPDATE SKIP LOCKED` to turn the `workflow_steps` table into a work queue — no external broker needed. On startup, it auto-detects whether `LISTEN/NOTIFY` is available:

```
listen() called
  ↓
Self-test: LISTEN → NOTIFY → wait 3s
  ↓
Received? → "LISTEN/NOTIFY available — low-latency dispatch (~1ms)"
            Dedicated connection listens for step-queued notifications.
  ↓
Not received? → "Proxy detected — polling dispatch (~500ms)"
                Pure FOR UPDATE SKIP LOCKED polling with adaptive backoff.
```

Zero config. If you're connecting directly to Postgres, you get instant dispatch. If PgBouncer (transaction mode) or another proxy sits in between, the self-test fails silently and the engine falls back to polling. The user doesn't need to know their infra topology.

### Tuning dispatch

```ts
createEngine({
  database: existingPool,
  dispatch: {
    pollingIntervalMs: 200,      // how often to poll for queued steps (default 500)
    maxPollingIntervalMs: 5000,  // adaptive backoff ceiling (default 30_000)
  },
  workflows: [...],
  tenantId: 'default',
})
```

Under load, the poller adapts automatically — interval increases on contention, decreases on activity, grows slowly when idle.

## Library vs service mode

**Library mode (default):** import `@goatlab/delphi-core` into your app, construct the engine once, call its methods from your handlers. No new HTTP surface, no extra process.

```ts
app.post('/api/orders/:id/checkout', requireAuth, async (req, res) => {
  const { runId } = await engine.payment_critical.startCommitted(
    { orderId: req.params.id, amountCents: req.body.amountCents },
    { idempotencyKey: `checkout-${req.params.id}` },
  )
  res.json({ runId })
})
```

**Service mode:** when multiple client apps need to start workflows against a shared engine. Mount via [`@goatlab/delphi-express`](../delphi-express). The HTTP boundary becomes the contract; wire your own auth middleware.

| | Library mode | Service mode |
|---|---|---|
| Single Node app | use this | overkill |
| Multiple client apps | — | use this |
| Auth | reuse your app's | required at the edge |

## Core concepts

### Workflow & step
A workflow is a DAG of steps. Steps are pure — they declare their input/output types and know nothing about their DAG position. Workflows wire steps together via `dependsOn`.

```ts
// Simple: raw classes, no wiring needed (single step or linear chain with auto-pass)
steps = [FetchStep, TransformStep, SaveStep] as const

// DAG: step() wrapper only when you need dependsOn or mapInput
steps = [
  VerifyStep,                                       // root — gets trigger input
  step(ChargeStep, { dependsOn: [VerifyStep] }),     // auto-pass — gets verify's output
  step(NotifyStep, {                                // explicit mapping — field names differ
    dependsOn: [VerifyStep, ChargeStep],
    mapInput: (up) => ({ email: up.verify.email, chargeId: up.charge.chargeId }),
  }),
] as const
```

Auto-pass is type-safe: if the upstream output doesn't satisfy the downstream input, TypeScript requires `mapInput` — you get a compile error, not a runtime surprise.

### State
Runs and steps live in Postgres. The state machine enforces valid transitions (`PENDING → QUEUED → RUNNING → COMPLETED | FAILED | WAITING_HUMAN | SLEEPING`). `deriveWorkflowStatus` computes run status from step statuses.

### Execution
On `engine.start()`, the engine inserts the run + steps and dispatches root steps. In Postgres-only mode, the PgConnector polls for `QUEUED` steps via `FOR UPDATE SKIP LOCKED`, marks them `RUNNING`, and calls the handler. The engine then advances the DAG by finding the next ready steps.

### Starting workflows (fire-and-forget)

All three start methods return a `runId` handle immediately — none wait for the workflow to complete. The actual step execution happens in the background.

```ts
// start() — waits for PG INSERT (~5-20ms), then returns
const { runId } = await engine.payment.start({ amount: 42 })

// startBuffered() — returns from in-memory buffer (~0-1ms, no await needed)
const { runId } = engine.event_ingest.startBuffered({ payload: 'hi' })

// startCommitted() — waits for PG COMMIT + fsync (~20-80ms)
const { runId } = await engine.payment.startCommitted({ amount: 42 })
```

### Getting results

```ts
// Poll
const status = await engine.payment.getStatus(runId)
if (status.status === 'COMPLETED') { /* done */ }

// SSE (realtime push)
const es = new EventSource(`/api/workflows/events/${runId}`)

// Callback (on the workflow class)
class PaymentWorkflow extends Workflow<{ amount: number }> {
  workflowName = 'payment' as const
  steps = [ChargeStep] as const

  onComplete = async (ctx) => {
    // fires when all steps finish
  }
}
```

### Workflow durability (`buffered` vs `committed`)

Each workflow declares its durability guarantee — what "accepted" means when the start call returns:

```ts
// Buffered (default) — ~1-2ms response, PG write is async
class EventWorkflow extends Workflow<{ payload: string }> {
  workflowName = 'event_ingest' as const
  steps = [step(processStep)] as const
}

// Committed — response means "row is fsync'd to Postgres"
class PaymentWorkflow extends Workflow<{ amount: number }> {
  workflowName = 'payment' as const
  override durability = 'committed' as const
  steps = [step(chargeStep)] as const
}
```

### Input validation

Workflows can declare a schema (Zod-compatible) for compile-time + runtime input validation:

```ts
import { z } from 'zod'

class PaymentWorkflow extends Workflow<{ amount: number }> {
  workflowName = 'payment' as const
  override inputSchema = z.object({ amount: z.number().positive() })
  steps = [step(chargeStep)] as const
}
```

### External actions (exactly-once)
`engine.externalActions.run({...})` wraps calls to external systems (GitHub, Linear, Stripe) with idempotency dedup, rate limiting, and audit trail. Safe to retry.

### Human-in-the-loop
A step returning `{ waitForHuman: { prompt, schema } }` transitions to `WAITING_HUMAN`. Resume via `engine.submitHumanInput(...)`.

### Durable sleep
`engine.durableSleep(runId, stepName, tenantId, durationMs)` persists the wake time to Postgres. Survives process restarts — on recovery, sleeps only the remaining duration.

### Workflow forking
`engine.forkWorkflow(runId, tenantId, fromStepName)` creates a new run preserving completed step outputs up to the fork point. Enables retry-from-failure and A/B testing.

### Workflow streaming
`engine.writeStream(runId, key, value)` appends to a durable, offset-based stream. Consumers read via `engine.readStream(runId, key, fromOffset)`. Close with `engine.closeStream(runId, key)`.

### Delayed execution
Start workflows in the future: `engine.start({ ..., delaySeconds: 60 })`. The run enters `DELAYED` status and auto-transitions to `RUNNING` when the delay expires.

### Cron scheduling
Schedule recurring workflows directly from the typed engine proxy. Multi-pod safe — uses `FOR UPDATE SKIP LOCKED` so only one instance fires each schedule.

```ts
// Schedule a workflow to run every day at 9am, with default input
await engine.daily_report.schedule('0 9 * * *', { region: 'us-east' })

// List active schedules
const schedules = await engine.daily_report.listSchedules()

// Remove a schedule
await engine.daily_report.unschedule(scheduleId)

// Start the scheduler polling loop (call once at app startup)
engine.scheduler.start()
```

### Signals & events
- `engine.signal(runId, signalName, data)` — signal a running workflow
- `EventIngestionService` — idempotent event ingest with ordering, trigger matching, stale-event skipping

### Budgets
Per-run limits on tokens, cost, step count, and task executions. Enforced atomically on every step completion.

### Lineage
Every run carries a `traceId`. `engine.getTrace(traceId)` returns the full set of runs, events, and external actions sharing that trace.

### Timeout enforcement
`engine.sweepTimedOutSteps()` and `engine.sweepTimedOutWorkflows()` find and fail steps/runs that exceed their configured timeouts.

### Worker nodes
Registered `WorkerNode` instances can pull step payloads via HTTP long-poll, execute remotely, and post results back. Label-based routing (`requiresLabels`) ensures steps land on capable workers.

## API surface

### Typed proxy (compile-time safe)

```ts
// Start (fire-and-forget — returns runId, not completion)
const { runId } = await engine.payment.start(input, { idempotencyKey })
const { runId } = engine.event_ingest.startBuffered(input)          // no await
const { runId } = await engine.payment.startCommitted(input)        // waits for PG fsync

// Check status / interact with running workflows
await engine.payment.getStatus(runId)
await engine.payment.cancel(runId)
await engine.payment.signal(runId, 'approved', { reviewer: 'alice' })
await engine.payment.submitHumanInput(runId, 'review', { approved: true })
```

### String-based handlers (for HTTP adapters)

```ts
import { createWorkflowHandlers } from '@goatlab/delphi-core'
const handlers = createWorkflowHandlers(engine)

await handlers.start({ workflowName, tenantId, input })
await handlers.getStatus({ runId, tenantId })
await handlers.cancel({ runId, tenantId })
await handlers.signal({ runId, tenantId, signalName, data })
await handlers.listWorkflows({ tenantId })
```

## Performance

All numbers from `test-server/server.ts` against a fresh stack (Docker Desktop, M-series Mac, PG + Redis colocated, `CLUSTER_MODE=2`). Production with managed PG will be faster.

### Postgres-only vs Redis dispatch

delphi-core defaults to **Postgres-only** dispatch (no Redis required). Redis can be added via `redis` option for workloads above ~5k req/s.

#### Buffered durability (CLUSTER_MODE=2)

| Metric | PG-only | Redis | Notes |
|---|---|---|---|
| Avg RPS | **1,965/s** | **1,975/s** | identical |
| p50 | 1ms | 1ms | identical |
| p95 | 38ms | 63ms | PG-only lower tail |
| p99 | 134ms | 216ms | PG-only lower tail |
| Errors | 0% | 0% | |

#### Committed durability (CLUSTER_MODE=2)

| Metric | PG-only | Redis | Notes |
|---|---|---|---|
| Avg RPS | **741/s** | **631/s** | PG-only 17% faster |
| p50 | 27ms | 74ms | PG-only 2.7x faster |
| p95 | 273ms | 1,310ms | PG-only 4.8x faster |
| Errors | 0% | 0% | |

#### Breakpoint — where does Redis start winning?

| Target | Redis (sustained) | PG-only (sustained) | Winner |
|---|---|---|---|
| 1k | 2,063/s | 4,240/s | PG-only |
| 3k | 2,791/s | 2,841/s | tie |
| **5k** | **4,821/s** | **4,818/s** | **crossover** |
| 8k | 6,976/s | 4,118/s | Redis +69% |
| 10k | 7,806/s | 5,319/s | Redis +47% |

#### When to use what

| Scale | Recommendation | Why |
|---|---|---|
| < 5,000 req/s | **Postgres-only** (default) | Same performance, one less dependency |
| 5,000 - 10,000 req/s | Either | Redis starts showing marginal benefit |
| > 10,000 req/s | Add Redis (`redis` option) | PG pool becomes the bottleneck |

Most agent/workflow workloads are well under 5k req/s (each AI step takes 2-30s). Postgres-only is the right default.

#### Reproduce

```bash
# PG-only
DISPATCH_MODE=pg CLUSTER_MODE=2 npx tsx test-server/server.ts
k6 run packages/delphi-core/loadtest/k6-workflow-pgonly.js
k6 run packages/delphi-core/loadtest/k6-workflow-pgonly-committed.js

# Redis
DISPATCH_MODE=redis CLUSTER_MODE=2 npx tsx test-server/server.ts
k6 run packages/delphi-core/loadtest/k6-workflow-buffered.js
k6 run packages/delphi-core/loadtest/k6-workflow-committed.js

# Breakpoint (find the ceiling)
k6 run packages/delphi-core/loadtest/k6-breakpoint.js
```

### Key optimizations
- `FOR UPDATE SKIP LOCKED` polling with auto-detected LISTEN/NOTIFY wakeup
- `COPY FROM` for bulk inserts (Hatchet-style, 60-90k writes/sec)
- Debounced NOTIFY under load (coalesces into 1 per 10ms)
- `SET LOCAL synchronous_commit = OFF` on buffered ingest (~45% PG TPS gain)
- Per-workflow definition snapshot cached (avoids re-stringifying)
- Bounded concurrent flushes to preserve PG pool headroom
- Log buffering (50-entry / 50ms flush threshold)
- Atomic budget updates via `jsonb_set` (no SELECT+UPDATE race)
- N+1-free `listWorkflows` via aggregate JOIN

## Testing

```bash
pnpm test                                                    # full suite (needs Docker)
npx vitest run src/__tests__/engine/lifecycle.spec.ts        # targeted
npx vitest run src/__tests__/engine/pg-dispatcher.spec.ts    # PG-only dispatch
npx vitest run src/__tests__/engine/dbos-parity.spec.ts      # DBOS-parity features
```

## Key exports

| Export | Purpose |
|---|---|
| `createEngine` | Factory: typed engine with per-workflow proxy properties |
| `Workflow`, `Step`, `FunctionStep`, `step` | Class-based workflow/step authoring |
| `createDbClient`, `createPool` | Database connection helpers |
| `PgConnector` | Postgres-only dispatch (default, used internally) |
| `WorkflowStepTask` | Step handler that bridges dispatch → engine |
| `IngestBuffer`, `IngestWorker` | Queue-first ingestion (buffered + committed) |
| `ExternalActionExecutor` | Exactly-once external side effects |
| `EventIngestionService` | Event ingest + trigger matching |
| `SchedulerService` | Cron-based recurring workflow triggers (multi-pod safe) |
| `PgNotifier` | LISTEN/NOTIFY with auto-detection |
| `dbRetry` | Connection-resilient retry decorator |
| `runMigrations` | Schema migration runner |
| `AdaptivePoller` | Dynamic polling interval with backoff |
| `CREATE_TABLES_SQL` | Schema bootstrap |

## Schema

Plain TypeScript interfaces in `src/entities/Database.ts`. No ORM, no decorators, no `reflect-metadata`. All queries are parameterized SQL via `pg.Pool`. JSON columns stored as `TEXT` with `toJson()` / `fromJson()` helpers.

## Inspiration

delphi-core stands on the shoulders of several excellent projects:

| Project | What we learned |
|---|---|
| [DBOS](https://github.com/dbos-inc/dbos-transact-ts) | Postgres-only architecture. `FOR UPDATE SKIP LOCKED` as a work queue. LISTEN/NOTIFY with self-test fallback. Durable sleep. Workflow forking. Schema designed by Mike Stonebraker's team. |
| [Hatchet](https://github.com/hatchet-dev/hatchet) | `COPY FROM` bulk inserts for high-throughput ingestion. Buffered vs committed durability. Worker-side fan-out pattern. |
| [Temporal](https://temporal.io) | DAG-based workflow definitions. Step-level retry/timeout. Human-in-the-loop approval gates. Signals and queries. Workflows as code, not YAML. |
| [Inngest](https://github.com/inngest/inngest) | Event-driven workflow triggers. Idempotent event ingestion with sequence ordering. Step functions as the programming model. |

### How delphi-core differs

- **Postgres-only by default** — no Redis, no external orchestrator, no message broker. One peer dependency: `pg`.
- **Typed class API** — compile-time safety on inputs, outputs, and dependencies. No string handler keys.
- **Multi-tenant** — `tenantId` on every table, scoped queries, per-tenant isolation.
- **AI-native** — budget guardrails, label-based worker routing, Claude Code executor, skill registry.
- **Flexible dispatch** — Postgres handles ~5k req/s. Add Redis with one config line for more.

## License

MIT
