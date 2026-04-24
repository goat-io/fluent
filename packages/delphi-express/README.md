# @goatlab/delphi-express

Express adapter for `@goatlab/delphi-core`. Mounts the workflow engine over HTTP via a single Express Router. Framework-generic — your auth, tenant resolution, and middleware ordering stay yours.

Inspired by `better-auth/express` — same shape, same plug-and-play feel.

## Install

```bash
pnpm add @goatlab/delphi-express @goatlab/delphi-core express
```

## Quick start

```ts
import express from 'express'
import { agentsRouter } from '@goatlab/delphi-express'
import { myDelphiFactory } from './my-delphi-factory'   // your code

const app = express()
app.use(express.json())

app.use('/api/workflows', agentsRouter({
  // Called per request. Resolve your engine (your factory should cache
  // by tenant — this resolver should be a Map lookup most of the time).
  resolveAgents: async (req) => {
    const engine = await myDelphiFactory(req)
    return {
      engine,
      ingestBuffer: engine.ingestBuffer,
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

## Security model (read this before deploying)

**This adapter ships with NO authentication.** Every endpoint delegates to your `resolveAgents(req)` callback — your job is to ensure `req` has already been authenticated by middleware mounted *upstream* of the router. Forgetting this exposes a multi-tenant workflow API to the world.

The contract you must uphold:

1. **Mount auth middleware before the router.** The router never inspects headers, never checks tokens, never enforces anything. If `req.user` isn't populated by the time `resolveAgents` runs, the request is unauthenticated by definition.

2. **Derive `tenantId` from the auth context, NOT from the request body.** The router intentionally spreads `req.body` first and then sets `tenantId` last — so a malicious caller cannot override the auth-derived tenant by stuffing `{"tenantId": "victim"}` in the body. But this only works if YOU pull `tenantId` from the auth context inside `resolveAgents`. Reading it from `req.body.tenantId` would defeat the protection.

3. **Don't expose admin-style endpoints unguarded.** This adapter currently mounts only user-facing endpoints (start, status, cancel, signal, etc.). If you add admin endpoints downstream (worker token issuance, definition mutation, run-replay), gate them with a separate stricter middleware — don't reuse the user resolver.

A correct setup:

```ts
import express from 'express'
import { agentsRouter } from '@goatlab/delphi-express'
import { requireAuth } from './your-auth'   // your code — populates req.user

const app = express()
app.use(express.json())

// 1. Auth middleware FIRST — fails fast if the request isn't authenticated.
app.use('/api/workflows', requireAuth)

// 2. Then mount the engine router.
app.use('/api/workflows', agentsRouter({
  resolveAgents: async (req) => {
    // 3. tenantId from req.user (auth context), NOT from req.body.
    const tenantId = req.user.tenantId
    const engine = await myDelphiFactory(tenantId)
    return { engine, ingestBuffer: engine.ingestBuffer, tenantId }
  },
}))
```

What's still on you to add upstream:

- **Rate limiting** (e.g., `express-rate-limit`) — `/start-async` accepts as fast as you can POST
- **CORS** if browsers will call directly (`cors` middleware) — the router doesn't set headers
- **Body size limits** — long workflow inputs can be abused
- **Request logging / tracing** — the router emits no access logs
- **Per-route scopes** — if your auth has scopes, gate `/cancel` and `/signal` more tightly than `/status`

If you don't need a network boundary at all (single Node app calling its own engine), prefer **library mode** — see the [delphi-core README "Library vs service mode" section](../delphi-core/README.md#library-vs-service-mode). You'd skip this package entirely and call the engine in-process, inheriting all your existing auth and middleware for free.

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
// my-delphi-factory.ts
import { Kysely, PostgresDialect } from 'kysely'
import {
  createEngine, FunctionStep, Workflow, step,
  WorkflowStepTask, IngestWorker, EventIngestionService,
  type Database as AgentsDB, type TypedEngine, type JsonObject,
} from '@goatlab/delphi-core'
import type { Request } from 'express'

// Step + Workflow classes are shared across tenants — same business logic,
// tenant isolation happens at the engine/PG-schema layer.
class GreetStep extends FunctionStep<{ name: string }, { hi: string }> {
  stepName = 'greet' as const
  async handle(input) { return { output: { hi: `hello ${input.name}` } } }
}
const greetStep = new GreetStep()

class GreetWorkflow extends Workflow<{ name: string }> {
  workflowName = 'greet_flow' as const
  steps = [step(greetStep)] as const
}

type AgentsEngine = TypedEngine<readonly [GreetWorkflow]>
const cache = new Map<string, Promise<AgentsEngine>>()

export async function myDelphiFactory(req: Request) {
  const tenantId = req.user.tenantId
  let cached = cache.get(tenantId)
  if (cached) return cached

  cached = (async () => {
    const pool = await getYourPool(tenantId)                  // your code
    const connector = await getYourBullMQConnector(tenantId)  // your code
    const db = new Kysely<AgentsDB>({ dialect: new PostgresDialect({ pool }) })

    const engine = createEngine({
      workflows: [new GreetWorkflow()] as const,
      db, pgPool: pool, connector, tenantId,
      schema: 'agents',                            // optional: PG schema isolation
      eventIngestion: new EventIngestionService({ db }),
    })

    // Worker-side: drain the buffered ingest queue + handle step jobs.
    const ingestWorker = new IngestWorker({ engine, flushThreshold: 200 })
    const stepTask = new WorkflowStepTask(engine); stepTask.setConnector(connector)
    await connector.listen({ tasks: [
      { taskName: 'workflow_ingest',     handle: d => ingestWorker.handleJob(d as any), concurrency: 300 },
      { taskName: 'workflow_step_light', handle: d => stepTask.handle(d as any),        concurrency: 50 },
      // ... heavy / ai / sandbox queues as needed
    ]})

    return engine
  })()

  cache.set(tenantId, cached)
  return cached
}
```

## Schema isolation

The engine supports `schema: '<name>'` for Postgres schema isolation — engine tables become `agents.workflow_runs` instead of `public.workflow_runs`. Pair with `previewFeatures = ["multiSchema"]` and `@@schema("agents")` in your Prisma schema (see `packages/delphi-core/prisma.fragment`).

For per-table prefix renaming (e.g., `domain_workflow_runs`), use Prisma's `@@map` directive — your Prisma client sees a custom name while the physical table stays default. The engine queries the physical name; Prisma layers the alias on top for your reads.

## Engine doesn't auto-bootstrap when you manage schema

When you provide your own schema (via Prisma migrations, pgroll, etc.), **don't** call `CREATE_TABLES_SQL`. The engine never auto-bootstraps; it assumes the tables exist. Migration ownership stays with your existing tooling.

## What the adapter does NOT do

- **Authentication / authorization** — see "Security model" above
- **Tenant resolution** — that's `resolveAgents`'s job
- **Rate limiting / CORS / body limits** — add the matching Express middleware upstream

This package is intentionally small (~200 LOC) — the heavy lifting lives in `@goatlab/delphi-core`.

## License

MIT
