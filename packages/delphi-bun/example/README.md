# Agents Engine — Bun + Prisma example

A blank Bun app that mounts the Goat agent engine via [`@goatlab/delphi-bun`](..). Mirror of the [Express example](../../delphi-express/example) — same Prisma schema, same engine factory pattern, same load-test script — so you can A/B compare runtimes apples-to-apples.

## What's in the box

```
example/
├── docker-compose.yml          # Postgres 18 + Redis 7
├── prisma/schema.prisma        # Domain Customer model + 12 engine tables
│                                 in the `agents` schema (multiSchema)
├── src/
│   ├── agents.factory.ts       # Singleton engine + worker registration
│   └── server.ts               # Bun.serve, mounts /api/workflows/* via reusePort cluster
└── scripts/
    ├── k6-flat.js              # k6 flat-rate test
    └── loadtest.sh             # full lifecycle: up → push → start → load → verify → down
```

## Prerequisites
- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Docker (compose v2)
- pnpm (for installing workspace deps; Bun doesn't replace it here)
- k6 (`brew install k6`)

## Quick start

```bash
# 0. Install workspace deps (once, from repo root)
pnpm install

# 1. From this folder:
cd packages/delphi-bun/example

# 2. One command does it all
pnpm loadtest
```

## Cluster mode
Bun has no `node:cluster`, but **`reusePort: true`** on `Bun.serve()` lets multiple Bun processes bind the same TCP port — kernel SO_REUSEPORT distributes incoming connections. The example spawns N child processes and each one calls `Bun.serve({ port, reusePort: true })`.

```bash
CLUSTER_MODE=auto pnpm start    # default — forks cores-1 workers
CLUSTER_MODE=2    pnpm start    # exactly 2 workers
CLUSTER_MODE=off  pnpm start    # single process
```

## Measured performance (real run, 2 cluster workers)

| Rate | p50 | p95 | p99 | Errors | Sustained |
|---|---|---|---|---|---|
| 2,000 req/s | **6ms** | 50ms | 186ms | 0% | 1,984/s ✓ |
| 4,000 req/s | 11ms | 72ms | 1,507ms | 0% | 3,753/s ✓ |
| 5,000 req/s | 23ms | 49ms | 7,779ms | 0.86% | 3,485/s (saturating) |

**Persistence: 172,166 fired → 172,166 in PG → 172,166 COMPLETED, 0 failures.** Same correctness guarantees as the Express example.

## Bun vs Express vs raw `node:http` (same engine, same hardware)

| Layer | 2k p50 | 4k p95 | 5k sustained | Drain rate |
|---|---|---|---|---|
| Raw `node:http` (test-server) | n/a | 85ms | 5,000/s | ~730/s |
| **Bun + Bun.serve (this)** | **6ms** | **72ms** | 3,485/s ⚠ | ~480/s ⚠ |
| Express (sibling example) | 23ms | 102ms | 4,460/s | ~730/s |

### Where Bun wins
- **HTTP latency**: `Bun.serve` is built on Zig + uWebSockets — p50 at 2k drops from 23ms (Express/Node) to **6ms**. Best-in-class request-acceptance throughput.
- **Boot time**: Bun starts the server ~3× faster than `tsx + Node`.
- **Native TypeScript**: no `tsx` shim, no compile step in dev.

### Where Bun loses (today)
- **Engine throughput**: the engine's hot path uses `pg` (PostgreSQL driver) and `bullmq` (which uses `ioredis`). Both run via Bun's Node compat layer and pay an overhead vs running natively under Node. Drain rate observed: **~480/s on Bun vs ~730/s on Node**.
- **HTTP saturation cliff**: Bun's accept queue under sustained 5k req/s starts dropping connections (0.86% errors) sooner than Express's 0%-error 4500 req/s. Likely tunable via `Bun.serve` socket options, but Express was more graceful out of the box.

### When to choose Bun
- **Latency-sensitive APIs** where p50 matters more than peak throughput
- **Front-door services** that proxy to other workers (HTTP-bound, not workflow-bound)
- **Dev experience** — `bun --watch src/server.ts` is the fastest reload story

### When to stick with Node
- **Workflow-heavy workloads** where the engine's drain rate matters as much as HTTP throughput
- **Production-tested `pg` + `bullmq`** behaviour — until Bun's Node compat is fully stable for these libs

### Likely future
Bun's Node compat layer keeps improving. Once `pg` and `ioredis` run at native speed under Bun (or get drop-in Bun-native replacements like `bun-pg`), Bun should match or beat Node on the engine side too. As of Bun 1.3.x (April 2026), Node still wins the engine side.

## Reproduce
```bash
# Default sweep (2k → 4k → 5k × 30s)
pnpm loadtest

# Sustained single-rate
SWEEP=4000 DUR=5m pnpm loadtest

# Single-process baseline
CLUSTER_MODE=off SWEEP="2000 3000" pnpm loadtest

# More workers
CLUSTER_MODE=4 SWEEP="5000 8000" pnpm loadtest
```

## Files
- [`src/server.ts`](src/server.ts) — `Bun.serve` + `reusePort` cluster + agentsBunHandler mount
- [`src/agents.factory.ts`](src/agents.factory.ts) — engine + workers (identical to Express example except no tsx)
- [`prisma/schema.prisma`](prisma/schema.prisma) — Prisma multi-schema; engine tables in `agents`

## License

MIT
