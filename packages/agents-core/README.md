# @goatlab/agents-core

Distributed agent workflow engine. Runs step DAGs over Postgres (source of truth) and BullMQ (execution queues) with exactly-once external actions, human-in-the-loop, and queue-first ingestion capable of 5k+ req/s on modest hardware.

## What it is

A TypeScript workflow engine designed for agent orchestration. You define workflows as DAGs of steps; the engine handles scheduling, retries, step-level state, human approval gates, distributed execution, event ingestion, budgets, and lineage tracking.

Postgres holds the durable state (runs, steps, logs, external actions, events). BullMQ routes work between the engine and its workers across four queues (`light`, `heavy`, `ai`, `sandbox`) differentiated by `stepWeight`.

## Install

```bash
pnpm add @goatlab/agents-core kysely pg @goatlab/tasks-adapter-bullmq
```

Requires Postgres 14+ and Redis 6+.

## Quick start

```ts
import { WorkflowEngine, WorkflowBuilder, FunctionStepExecutor, CREATE_TABLES_SQL } from '@goatlab/agents-core'
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
import { WorkflowStepTask } from '@goatlab/agents-core'
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
import { IngestBuffer, IngestWorker } from '@goatlab/agents-core'

const ingestWorker = new IngestWorker({ engine, flushThreshold: 200, maxConcurrentFlushes: 8 })
const ingestBuffer = new IngestBuffer({
  queue: connector.getQueue('workflow_ingest'),
  flushThreshold: 200,
  flushIntervalMs: 50,
  maxJitterMs: 20,
})

// Wire the worker-side consumer
await connector.listen({ tasks: [
  { taskName: 'workflow_ingest', handle: (d) => ingestWorker.handleJob(d as any), concurrency: 50 },
  // ... step queues
]})

// In your HTTP handler:
const { runId, traceId } = ingestBuffer.enqueue({ workflowName, tenantId, input, idempotencyKey })
return { runId, traceId, status: 'QUEUED' }  // ~1-2ms
```

`IngestBuffer` accumulates triggers in-memory, flushes to Redis via `queue.addBulk` (one LUA script call per batch). `IngestWorker` re-batches BullMQ jobs into a single `COPY FROM` transaction per ~200 workflows. End-to-end: 5k req/s on 2 vCPU, p95 < 100ms, zero data loss.

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
Beyond in-process BullMQ workers, registered `WorkerNode` instances can pull step payloads via HTTP long-poll, execute remotely (e.g., in containers), and post results back. See `packages/agents-core/src/worker-node`.

## Performance

On a 2-vCPU Cloud Run-shaped instance (tested with `CLUSTER_MODE=2`):

| SLO | Throughput per instance |
|---|---|
| p95 < 50ms | ~4000 req/s |
| p95 < 100ms | ~5000 req/s |
| p99 < 500ms, 0% errors | ~8000 req/s |

Key optimizations baked in:
- Per-workflow `definitionSnapshot` JSON cached (avoids re-stringifying)
- `SET LOCAL synchronous_commit = OFF` on ingest transactions (~45% PG TPS)
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
| `IngestBuffer`, `IngestWorker` | Queue-first ingestion accumulators |
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
