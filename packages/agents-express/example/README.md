# Agents Engine — Express + Prisma example

A blank Express app that mounts the Goat agent engine via [`@goatlab/agents-express`](..). Demonstrates the recommended integration shape for any backend that already uses Express + Postgres + Redis + Prisma.

## What's in the box

```
example/
├── docker-compose.yml          # Postgres 18 + Redis 7
├── prisma/schema.prisma        # Domain model (Customer) + agent engine tables
│                                 in a separate `agents` schema
├── src/
│   ├── agents.factory.ts       # Singleton engine + worker registration
│   └── server.ts               # Express app, mounts /api/workflows/*
└── scripts/
    ├── k6-flat.js              # k6 flat-rate test (start-async)
    └── loadtest.sh             # full lifecycle: up → push → start → load → verify → down
```

## Prerequisites
- Docker (compose v2)
- pnpm
- k6 (`brew install k6`)

## Quick start

```bash
# 0. Install workspace deps (once)
cd ../../../    # repo root
pnpm install

# 1. From the example folder:
cd packages/agents-express/example

# 2. One command does it all (up → schema → server → k6 sweep → drain check → down)
pnpm loadtest
```

Output ends with the durability verdict:
```
✓  Zero data loss — every accepted workflow reached COMPLETED in PG
```

## Run pieces individually

```bash
pnpm infra:up                     # start Postgres + Redis
pnpm db:generate && pnpm db:push  # apply Prisma schema
pnpm start                         # boot Express server on :3000

# In another terminal:
curl -s -X POST http://localhost:3000/api/workflows/start-async \
  -H 'Content-Type: application/json' \
  -d '{"workflowName":"fast_single","input":{"hello":"world"}}'
# → {"runId":"...","traceId":"...","status":"QUEUED"}

curl -s -X POST http://localhost:3000/api/workflows/status \
  -H 'Content-Type: application/json' \
  -d '{"runId":"<paste runId>"}'
# → {"id":"...","status":"COMPLETED","steps":[{"stepName":"work","status":"COMPLETED",...}]}

# Tear down
pnpm infra:down
```

## Load test variants

```bash
# Default sweep: 2k, 4k, 5k req/s × 30s each
pnpm loadtest

# Custom rate + duration
RATE=5000 DUR=60s SWEEP=5000 pnpm loadtest

# Multi-rate sweep
SWEEP="1000 2000 4000 8000" DUR=20s pnpm loadtest

# Keep stack up after the test (poke around localhost:3000)
KEEP_RUNNING=1 pnpm loadtest
```

The script sanity-checks: a smoke test (start one workflow, verify COMPLETED) runs *before* the sweep. Then after the load, it polls Redis queue depth + PG row counts for up to 3 minutes and verifies:
- Every accepted workflow lands in `agents.workflow_runs`
- Every workflow reaches `status='COMPLETED'`
- Zero failed BullMQ jobs

## What this example shows

| Pattern | Where |
|---|---|
| Mount engine HTTP routes via `agentsRouter` | `src/server.ts` |
| Single-process engine + workers (cluster comes later) | `src/agents.factory.ts` |
| Schema isolation (`agents.workflow_runs`) via `WorkflowEngine.schema` | `src/agents.factory.ts:engine = new WorkflowEngine({ ..., schema: 'agents' })` |
| Prisma multi-schema for engine tables | `prisma/schema.prisma` (`schemas = ["public", "agents"]`) |
| User manages migrations (engine doesn't auto-bootstrap) | `prisma db push` runs the schema, engine assumes it exists |
| Per-workflow handlers via `FunctionStepExecutor.register()` | `src/agents.factory.ts` |
| Graceful shutdown (drain buffer + close pool/Redis) | `shutdownAgents()` in `src/agents.factory.ts` |

## Extending to multi-tenant

Replace the singleton in `agents.factory.ts` with an LRU+TTL cache keyed by `tenantId`. Mirror the `better-auth.factory.ts` pattern from your own backend if you have one. The router then resolves per request:

```ts
app.use('/api/workflows', agentsRouter({
  resolveAgents: async (req) => {
    const { engine, ingestBuffer } = await myTenantFactory(req.user.tenantId)
    return { engine, ingestBuffer, tenantId: req.user.tenantId }
  },
}))
```

## What this example does NOT do

- Authentication (wire your auth middleware before the router)
- Metrics / OTel (you can register `interceptors` on the engine)
- Real workflow definitions (the demo workflows are just `echo`-style)
- Production logging (uses `console.log` for clarity)

These are intentionally left out — the example is about wiring, not policy.
