# Agents Engine — Express + Prisma example

A blank Express app that mounts the Goat agent engine via [`@goatlab/delphi-express`](..). Demonstrates the recommended integration shape for any backend that already uses Express + Postgres + Redis + Prisma.

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
cd packages/delphi-express/example

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

## Horizontal scaling test (multi-instance)

Spawns N example instances on different ports — each is a **separate Node process** simulating a Cloud Run pod. All share the same Postgres + Redis. k6 distributes load randomly across all instances.

```bash
# 4 instances, 5k req/s total (default)
pnpm loadtest:horizontal

# 8 instances, 10k req/s, 60s
INSTANCES=8 RATE=10000 DUR=60s pnpm loadtest:horizontal

# Each instance with cluster mode (4 instances × 2 cluster workers = 8 processes)
INSTANCES=4 CLUSTER_MODE_PER_INSTANCE=2 RATE=10000 pnpm loadtest:horizontal
```

The script:
1. Brings up shared infra (PG + Redis)
2. Spawns N instances on ports 3000..3000+N
3. Smoke test: fires one workflow per instance, verifies all complete
4. Runs k6 with random per-request port distribution
5. Polls drain until completion or 5min timeout
6. Per-instance attribution check
7. Final: exits 0 only if every fired workflow reached COMPLETED with 0 FAILED runs

### What it proves
- ✅ All N instances cooperate (BullMQ distributes step jobs across them via Redis BRPOP)
- ✅ No double-execution (every workflow lands once in PG)
- ✅ Zero data loss (counts match)
- ✅ Drain rate scales with instance count (more instances = faster drain)

### Sample result (3 instances × 3k req/s × 20s)
```
Workflows OK:    59,795 (2,987 wf/s)
Error rate:      0.00%
p95:             57ms
59,798 fired → 59,798 in PG → 59,798 COMPLETED, 0 FAILED
```

### Caveats
- Each instance defaults to `CLUSTER_MODE=off` (single Node process). Saturates around 2-3k req/s per instance. Set `CLUSTER_MODE_PER_INSTANCE=auto` for production-like cluster within each instance.
- Random k6 port distribution simulates an LB; real LBs (nginx, GCP LB) do round-robin which is more uniform.
- Smoke-test PG queries hit instance 0 only; production deployments would have all instances behind one LB.

## Live event stream (SSE)

The example wires `@goatlab/realtime-broker` end-to-end. Engine state transitions fan out through Redis pub/sub to any SSE subscriber — no polling.

```bash
# Start a workflow
RESP=$(curl -s -X POST http://localhost:3000/api/workflows/start-async \
  -H 'Content-Type: application/json' \
  -d '{"workflowName":"fast_chain","input":{"hi":"sse"}}')
RUN_ID=$(echo "$RESP" | jq -r .runId)

# Subscribe to its events (in another terminal — leave running)
curl -N http://localhost:3000/api/workflows/events/$RUN_ID
```

You'll see events stream in real time:

```
: subscribed to engine:run:Mg2t7yf-jVPOk1jGKOfCi

event: run.started
data: {"type":"run.started","tenantId":"demo-tenant","runId":"Mg2t7yf...","traceId":"...","workflowName":"fast_chain","workflowVersion":"1.0.0","emittedAt":"2026-04-14T..."}

event: step.running
data: {"type":"step.running","stepName":"a", ...}

event: step.completed
data: {"type":"step.completed","stepName":"a","output":{...}, ...}

... (b, c)

event: run.completed
data: {"type":"run.completed","status":"COMPLETED", ...}
```

Each event fires AFTER its corresponding PG write commits — querying the run by `runId` immediately after receiving an event is guaranteed to see the post-commit state.

The broker uses **one Redis connection per tenant** regardless of how many SSE clients connect. 1000 concurrent SSE users on `demo-tenant` = 1 Redis connection. See [`packages/realtime-broker/README.md`](../../realtime-broker/README.md) for the pooling design.

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

All numbers from running the scripts in this folder against a fresh stack on an M-series Mac with Docker Desktop (PG + Redis + app all on the same host — real deployment with managed PG/Redis will be faster).

### 1️⃣ Single-process baseline (`CLUSTER_MODE=off`, 1 Node process)
Shows the **hardware ceiling per single Node process**. This is the per-core scaling reference.

| Rate | Actual | p50 | p95 | p99 | Errors | Verdict |
|---|---|---|---|---|---|---|
| 500 req/s | 500 | 8ms | 26ms | 40ms | 0% | trivial |
| 1,000 | 997 | 9ms | 29ms | 80ms | 0% | clean |
| **2,000** | **1,996** | **25ms** | **54ms** | **79ms** | **0%** | **healthy ceiling** |
| 3,000 | 1,933 | 71ms | 7,009ms | 8,851ms | 4.29% | 🚨 cliff |
| 4,000 | 2,487 | 78ms | 134ms | 20,053ms | 1.96% | overload |
| 5,000 | 2,158 | 82ms | 7,772ms | 7,777ms | 5.00% | overload |
| 6,000 | 1,617 | 82ms | 172ms | 18,751ms | 3.17% | deep overload, throughput **degrading** |

**Takeaway: ~2,000 req/s is the safe ceiling for a single Node process.**

### 2️⃣ 2-CPU cluster (`CLUSTER_MODE=2`, 2 Node processes)
Simulates a 2-vCPU Cloud Run instance — the recommended starter shape.

| Rate | p50 | p95 | p99 | Errors | Sustained |
|---|---|---|---|---|---|
| 2,000 req/s | 23ms | 62ms | 161ms | **0%** | 1,984/s ✓ |
| 4,000 req/s | 48ms | 102ms | 192ms | **0%** | 3,908/s ✓ |
| **5,000 req/s** | **80ms** | **171ms** | **824ms** | **0%** | **4,460/s** (healthy ceiling) |

### 3️⃣ Horizontal — 4 instances × 2 workers (breaking-point sweep)
4 separate Node processes + cluster mode each = 8 effective workers sharing PG/Redis.

| Target | Actual | p50 | p95 | p99 | Errors | Verdict |
|---|---|---|---|---|---|---|
| 2k req/s | 1,999 | 2ms | 19ms | 60ms | 0% | ✅ trivial |
| **5k** | **4,864** | **14ms** | **156ms** | **463ms** | **0%** | **✅ healthy** |
| 10k | 5,540 | 42ms | 1,314ms | 4,733ms | 0.02% | ⚠ **first cliff** — accept doubles, completion plateaus |
| 15k | 5,828 | 69ms | 969ms | 5,492ms | 0.07% | ⚠ accept ahead of drain |
| 20k | 5,510 | 72ms | 546ms | 6,079ms | 0.09% | ⚠ throughput plateau |
| 25k | 3,016 | 92ms | 3,005ms | 7,636ms | 0.06% | ⚠ system degrading |
| 30k | 2,292 | 94ms | 4,383ms | 8,141ms | 0.08% | ⚠ deep overload |
| 40k | 4,309 | 98ms | 1,874ms | 3,674ms | 0.74% | ⚠ HTTP errors climbing |

**The overload curve is graceful** — above the cliff, throughput plateaus (and at 25-30k actually regresses) but **correctness holds**: 0 FAILED workflow runs across the entire sweep. Redis absorbs the burst; drain catches up afterward.

### 4️⃣ Durability check (post-load drain, 5k req/s run)
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

### Scaling math (validated by the runs above)

| Setup | Healthy ceiling (p95<200ms, 0% err) |
|---|---|
| 1 instance, 1 Node process (`CLUSTER_MODE=off`) | **~2,000 req/s** |
| 1 instance, 2 Node processes (`CLUSTER_MODE=2`) | **~5,000 req/s** |
| 4 instances × 2 processes each (shared infra) | **~5,000 req/s** — Mac host CPU saturates |

Rule of thumb: **budget ~2,000 req/s per Node process**, scale processes via cluster mode within a pod AND horizontal pods. Production with managed PG (Cloud SQL) + managed Redis (Memorystore) removes the host-CPU bottleneck; per-pod numbers should match or exceed these.

### What this means for production
On a 2-vCPU Cloud Run instance:
- **~4,000 req/s @ p95<100ms** is the comfortable sustained ceiling per instance
- **~5,000 req/s** is achievable but tail latency widens
- Drain rate (~730 completions/sec per instance) is workload-bound, not framework-bound — Express vs raw `node:http` doesn't matter once a job is on the queue
- To exceed 5k req/s, scale horizontally: 2 Cloud Run instances ≈ 8k req/s, 4 ≈ 16k, etc.

### Graceful degradation — data never lost
Across every overload scenario tested (up to 40k req/s offered against a 5k healthy ceiling):
- **0 FAILED workflow runs** in PG
- **<1% transient HTTP errors** (Node accept-queue overflow during burst peaks)
- **System remains responsive** — no cascading failures
- **All accepted work drains** — BullMQ retries cover any transient worker-side failures

The queue-first design (HTTP → Redis → worker) means that once a request returns 200, the work is durable. Under overload, latency grows but correctness holds — the right trade-off for a workflow engine.

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
