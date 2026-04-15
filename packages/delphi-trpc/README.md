# @goatlab/delphi-trpc

tRPC adapter for `@goatlab/delphi-core`. Mounts the engine as a tRPC router so your client can call `client.workflows.startAsync.mutate({...})` with full type safety.

Compatible with **tRPC v10 and v11**.

## Install

```bash
pnpm add @goatlab/delphi-trpc @goatlab/delphi-core @trpc/server zod
```

## Quick start

```ts
import { initTRPC } from '@trpc/server'
import { createAgentsTrpcRouter } from '@goatlab/delphi-trpc'
import { myFactory } from './my-delphi-factory'

interface Ctx { tenantId: string; userId?: string }
const t = initTRPC.context<Ctx>().create()

// Your authed procedure (whatever middleware you use)
const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new Error('not authed')
  return next({ ctx })
})

// Build the workflows sub-router
const workflowsRouter = createAgentsTrpcRouter({
  t,
  procedure: authedProcedure,
  resolveAgents: async ({ ctx }) => {
    const { engine, ingestBuffer } = await myFactory(ctx.tenantId)
    return { engine, ingestBuffer, tenantId: ctx.tenantId }
  },
})

// Mount in your app router
export const appRouter = t.router({
  workflows: workflowsRouter,
  // ... your other routers
})

// Client side:
//   await client.workflows.startAsync.mutate({
//     workflowName: 'sendEmail',
//     input: { to: 'a@b.com' },
//   })
//   const status = await client.workflows.status.query({ runId })
```

## Procedures provided

| Procedure | Type | Input | Purpose |
|---|---|---|---|
| `startAsync` | mutation | `{ workflowName, input?, idempotencyKey?, ... }` | Queue-first start, returns `{runId, traceId}` in ~1ms |
| `start` | mutation | same | Sync start (writes PG before responding) |
| `startBatch` | mutation | `{ workflows: [...] }` | Bulk start |
| `startBatchCopy` | mutation | same | Bulk start via COPY FROM |
| `status` | **query** | `{ runId }` | Run status with QUEUED fallback for in-flight |
| `cancel` | mutation | `{ runId }` | Cancel a run |
| `humanInput` | mutation | `{ workflowRunId, stepName, data, respondedBy? }` | Resume HITL step |
| `signal` | mutation | `{ runId, signalName, data }` | Send signal to running workflow |
| `query` | query | `{ status?, workflowName?, limit?, offset? }` | List runs |
| `ingestEvent` | mutation | `{ eventType, source, payload, ... }` | Event ingestion |
| `list` | query | — | List registered workflow definitions |
| `health` | query | — | Always `{ ok: true }` |

All inputs are zod-validated. Error codes (`WORKFLOW_RUN_NOT_FOUND`, `IDEMPOTENCY_CONFLICT`) are propagated as standard tRPC errors.

## Selective procedures

Mount only some of them:

```ts
createAgentsTrpcRouter({
  t,
  procedure: authedProcedure,
  resolveAgents,
  procedures: {
    startAsync: true,
    status: true,
    humanInput: true,
    // everything else off
  },
})
```

## Why a factory + injected procedure?

Every tRPC app has its own middleware, error formatter, and context shape. Shipping a fixed router would force callers to bend to ours. Instead:

- You pass `t` (your `initTRPC.create()` instance) — we use its `.router()` builder so the result fits naturally into your app router
- You pass `procedure` (your `t.procedure.use(authMiddleware)`) — every engine handler chains off this, so your auth/middleware/logging story is preserved
- You pass `resolveAgents({ ctx })` — pure callback that returns `{ engine, ingestBuffer, tenantId }`. Your tenant resolution stays yours.

## Multi-tenant pattern

```ts
// my-delphi-factory.ts
import { Kysely, PostgresDialect } from 'kysely'
import { WorkflowEngine, IngestBuffer, IngestWorker } from '@goatlab/delphi-core'

const cache = new Map<string, Promise<{ engine: WorkflowEngine; ingestBuffer: IngestBuffer }>>()

export async function myFactory(tenantId: string) {
  let cached = cache.get(tenantId)
  if (cached) return cached
  cached = (async () => {
    const pool = await getPoolForTenant(tenantId)
    const connector = await getConnectorForTenant(tenantId)
    const db = new Kysely({ dialect: new PostgresDialect({ pool }) })

    const engine = new WorkflowEngine({
      db, pgPool: pool, connector,
      executors: new Map([['function', myExecutors()]]),
      workflows: new Map(myWorkflows()),
      tenantId,
      schema: 'agents',
    })
    const ingestWorker = new IngestWorker({ engine, flushThreshold: 200 })
    const ingestBuffer = new IngestBuffer({
      connector, taskName: 'workflow_ingest',
      flushThreshold: 200, flushIntervalMs: 50,
    })
    return { engine, ingestBuffer }
  })()
  cache.set(tenantId, cached)
  return cached
}
```

(Add LRU+TTL eviction for production; see the `delphi-express/example` README for the full pattern.)

## OpenAPI / REST exposure

If you use [trpc-to-openapi](https://github.com/jlalmes/trpc-to-openapi) (sodium does), the procedures from this adapter integrate naturally — annotate them with `meta({ openapi: { method: 'POST', path: '/...' } })` in a wrapping router if you want REST endpoints alongside the tRPC ones.

## What this adapter does NOT do

- Authentication (your `procedure.use(authMid)` handles it)
- Tenant resolution (your `resolveAgents` callback)
- CORS (handled by your tRPC HTTP transport upstream)
- Subscriptions (engine events should flow through `@goatlab/realtime-broker`, not tRPC subscriptions, for scale reasons)

## License

MIT
