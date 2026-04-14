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

## Measured performance (this exact example)

Validated end-to-end on a fresh stack: this Express + Prisma example, `CLUSTER_MODE=2`, host CPU limit ≈ 2 vCPU equivalent, Postgres + Redis as Docker containers on the same machine.

### HTTP throughput sweep (`./scripts/loadtest.sh`)

| Rate | p50 | p95 | p99 | Errors | Sustained |
|---|---|---|---|---|---|
| 2,000 req/s | 23ms | 62ms | 161ms | **0%** | 1,984/s ✓ |
| 4,000 req/s | 48ms | 102ms | 192ms | **0%** | 3,908/s ✓ |
| 5,000 req/s | 80ms | 171ms | 824ms | **0%** | 4,460/s (saturating) |

### Durability check (post-load drain)
- **316,929 workflows fired → 316,930 in `agents.workflow_runs` → 316,930 COMPLETED** (1 from smoke test)
- **0 BullMQ failed jobs**
- Sustained ~730 completions/sec — same as raw `node:http` test rig (Express overhead doesn't reach the engine)
- Step queue fully drained ~3.5 min after load ended

### Express overhead vs raw `node:http`
| | Raw `node:http` benchmark | This Express example | Δ |
|---|---|---|---|
| 2k p95 | 24ms | 62ms | +160% |
| 4k p95 | 85ms | 102ms | +20% |
| 5k p95 | 145ms | 171ms | +18% |
| 5k sustained | 5,000/s | 4,460/s | -11% |

### What this means for production
On a 2-vCPU Cloud Run instance:
- **~4,000 req/s @ p95<100ms** is the comfortable sustained ceiling per instance
- **~5,000 req/s** is achievable but tail latency widens
- Drain rate (~730 completions/sec per instance) is workload-bound, not framework-bound — Express vs raw `node:http` doesn't matter once a job is on the queue
- To exceed 5k req/s, scale horizontally: 2 Cloud Run instances ≈ 8k req/s, 4 ≈ 16k, etc.

### Reproduce
```bash
# Default (2k → 4k → 5k × 30s, cluster=2)
pnpm loadtest

# Sustained single-rate
SWEEP=4000 DUR=5m pnpm loadtest

# Tweak cluster size
CLUSTER_MODE=4 SWEEP="5000 8000" DUR=30s pnpm loadtest

# Compare against single-process Express
CLUSTER_MODE=off SWEEP="2000 3000" pnpm loadtest
```

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
