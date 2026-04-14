# @goatlab/agents-express

Express adapter for `@goatlab/agents-core`. Mounts the workflow engine over HTTP via a single Express Router. Framework-generic — your auth, tenant resolution, and middleware ordering stay yours.

Inspired by `better-auth/express` — same shape, same plug-and-play feel.

## Install

```bash
pnpm add @goatlab/agents-express @goatlab/agents-core express
```

## Quick start

```ts
import express from 'express'
import { agentsRouter } from '@goatlab/agents-express'
import { myAgentsFactory } from './my-agents-factory'   // your code

const app = express()
app.use(express.json())

app.use('/api/workflows', agentsRouter({
  // Called per request. Resolve your engine (your factory should cache
  // by tenant — this resolver should be a Map lookup most of the time).
  resolveAgents: async (req) => {
    const { engine, ingestBuffer } = await myAgentsFactory(req)
    return {
      engine,
      ingestBuffer,
      tenantId: req.user.tenantId,   // however you get it
    }
  },
}))

app.listen(3000)
```

That's it. Your app now exposes:

| Method + path | Purpose |
|---|---|
| `POST /api/workflows/start-async` | Queue-first start (~2ms response) |
| `POST /api/workflows/start` | Sync start |
| `POST /api/workflows/start-batch` | Batched start |
| `POST /api/workflows/start-batch-copy` | Explicit COPY-FROM batch |
| `POST /api/workflows/status` | Run status (with `QUEUED` fallback for in-flight) |
| `POST /api/workflows/cancel` | Cancel a run |
| `POST /api/workflows/human-input` | Resume a `WAITING_HUMAN` step |
| `POST /api/workflows/signal` | Send a signal to a running workflow |
| `POST /api/workflows/query` | List runs with filters |
| `POST /api/workflows/ingest-event` | Event ingestion |
| `GET /api/workflows/` | List registered workflow definitions |
| `GET /api/workflows/health` | Router health probe (always 200) |

## Selective routes

Mount only the routes you want:

```ts
app.use('/api/workflows', agentsRouter({
  resolveAgents,
  routes: {
    startAsync: true,
    status: true,
    humanInput: true,
    // everything else off
    start: false, startBatch: false, startBatchCopy: false,
    cancel: false, signal: false, query: false, ingestEvent: false,
  },
}))
```

## Custom error mapping

```ts
app.use('/api/workflows', agentsRouter({
  resolveAgents,
  mapError: (err) => {
    const e = err as { code?: string; message?: string }
    if (e.code === 'WORKFLOW_RUN_NOT_FOUND') return { status: 404, body: { error: 'not found' } }
    if (e.code === 'IDEMPOTENCY_CONFLICT')   return { status: 409, body: { error: 'duplicate', original: e } }
    return { status: 500, body: { error: 'oops' } }
  },
}))
```

## Multi-tenant pattern (recommended)

The adapter doesn't dictate how you build the engine — that's deliberate. For a multi-tenant app, write a factory that caches engines per tenant (LRU + TTL eviction is the better-auth pattern):

```ts
// my-agents-factory.ts
import { Kysely, PostgresDialect } from 'kysely'
import {
  WorkflowEngine, WorkflowStepTask, FunctionStepExecutor,
  IngestBuffer, IngestWorker, EventIngestionService,
} from '@goatlab/agents-core'
import type { Database as AgentsDB } from '@goatlab/agents-core'
import type { Request } from 'express'

const cache = new Map<string, Promise<{ engine: WorkflowEngine; ingestBuffer: IngestBuffer }>>()

export async function myAgentsFactory(req: Request) {
  const tenantId = req.user.tenantId
  let cached = cache.get(tenantId)
  if (cached) return cached

  cached = (async () => {
    const pool = await getYourPool(tenantId)         // your code
    const connector = await getYourBullMQConnector(tenantId)  // your code
    const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) })

    const executor = new FunctionStepExecutor()
    executor.register('greet', async ({ input }) => ({ output: { hi: input.name } }))

    const engine = new WorkflowEngine({
      db, pgPool: pool, connector,
      executors: new Map([['function', executor]]),
      workflows: new Map(/* your defs */),
      tenantId,
      schema: 'agents',                            // optional: PG schema isolation
      eventIngestion: new EventIngestionService({ db }),
    })

    const ingestWorker = new IngestWorker({ engine, flushThreshold: 200 })
    const ingestBuffer = new IngestBuffer({
      queue: connector.getQueue('workflow_ingest'),
      flushThreshold: 200, flushIntervalMs: 50,
    })

    const stepTask = new WorkflowStepTask(engine); stepTask.setConnector(connector)
    await connector.listen({ tasks: [
      { taskName: 'workflow_ingest',     handle: d => ingestWorker.handleJob(d as any), concurrency: 300 },
      { taskName: 'workflow_step_light', handle: d => stepTask.handle(d as any),        concurrency: 50 },
      // ... heavy / ai / sandbox queues as needed
    ]})

    return { engine, ingestBuffer }
  })()

  cache.set(tenantId, cached)
  return cached
}
```

## Schema isolation

The engine supports `schema: '<name>'` for Postgres schema isolation — engine tables become `agents.workflow_runs` instead of `public.workflow_runs`. Pair with `previewFeatures = ["multiSchema"]` and `@@schema("agents")` in your Prisma schema (see `packages/agents-core/prisma.fragment`).

For per-table prefix renaming (e.g., `domain_workflow_runs`), use Prisma's `@@map` directive — your Prisma client sees a custom name while the physical table stays default. The engine queries the physical name; Prisma layers the alias on top for your reads.

## Engine doesn't auto-bootstrap when you manage schema

When you provide your own schema (via Prisma migrations, pgroll, etc.), **don't** call `CREATE_TABLES_SQL`. The engine never auto-bootstraps; it assumes the tables exist. Migration ownership stays with your existing tooling.

## What the adapter does NOT do

- **Authentication**: wire your auth middleware before the router
- **Tenant resolution**: that's `resolveAgents`'s job
- **Rate limiting**: add `express-rate-limit` upstream if needed
- **CORS**: add `cors` upstream if needed

This package is intentionally small (~200 LOC) — the heavy lifting lives in `@goatlab/agents-core`.

## License

MIT
