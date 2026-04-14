<!-- PROJECT SHIELDS -->

[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/github_username/repo">
       <img src="https://docs.goatlab.io/logo.png" alt="Logo" width="150" height="150">
  </a>

  <h3 align="center">GOAT-FLUENT</h3>

  <p align="center">
    Fluent - Time Saving (TS) utils
    <br />
    <a href="https://docs.goatlab.io/#/0.7.x/fluent/fluent"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    ·
    <a href="https://github.com/goat-io/fluent/issues">Report Bug</a>
    ·
    <a href="https://github.com/goat-io/fluent/issues">Request Feature</a>
  </p>
</p>

# Goat - Fluent (Monorepo)

A comprehensive TypeScript ecosystem for building data-driven applications with unified query interfaces, multi-database support, and extensive utilities for Node.js and browser environments.

## 🚀 Quick Start

```bash
# Install the core package
pnpm add @goatlab/fluent

# Install specific database connectors
pnpm add @goatlab/fluent-firebase  # For Firebase/Firestore
pnpm add @goatlab/fluent-loki      # For in-memory database
pnpm add @goatlab/fluent-pouchdb   # For PouchDB

# Install utilities
pnpm add @goatlab/js-utils         # Browser/Node utilities
pnpm add @goatlab/node-utils       # Node.js specific utilities
```

## 📦 Packages

### Core Query Interface

- **[@goatlab/fluent](./packages/fluent)** - TypeScript query builder and ORM wrapper with multi-database support via TypeORM
- **[@goatlab/fluentjs](./packages/fluentjs)** - JavaScript implementation of the Fluent query interface

### Database Connectors

- **[@goatlab/fluent-firebase](./packages/fluent-firebase)** - Firebase/Firestore connector with real-time capabilities
- **[@goatlab/fluent-loki](./packages/fluent-loki)** - LokiJS in-memory database connector
- **[@goatlab/fluent-pouchdb](./packages/fluent-pouchdb)** - PouchDB connector for offline-first applications
- **[@goatlab/fluent-formio](./packages/fluent-formio)** - Form.io API connector for form-based data

### Utilities

- **[@goatlab/js-utils](./packages/js-utils)** - Comprehensive utilities for browser and Node.js (arrays, objects, HTTP, promises)
- **[@goatlab/node-utils](./packages/node-utils)** - Node.js specific utilities (JWT, encryption, streams, file operations)
- **[@goatlab/js-html](./packages/js-html)** - HTML processing with sanitization and text extraction
- **[@goatlab/node-xlsx](./packages/node-xlsx)** - Excel file streaming and processing
- **[@goatlab/formio-utils](./packages/formio-utils)** - Form.io form parsing and validation utilities

### Task Processing & Queues

- **[@goatlab/queue-core](./packages/queue-core)** - Unified interface for message brokers (Kafka, RabbitMQ) and job schedulers (Bull, Agenda)
- **[@goatlab/queue-node](./packages/queue-node)** - Node.js cron-based scheduler implementation
- **[@goatlab/tasks-core](./packages/tasks-core)** - Common interface for queueable tasks
- **[@goatlab/tasks-adapter-gcp](./packages/tasks-adapter-gcp)** - Google Cloud Tasks adapter
- **[@goatlab/tasks-adapter-hatchet](./packages/tasks-adapter-hatchet)** - Hatchet workflow engine adapter

### Cloud Services

- **[@goatlab/uploads](./packages/uploads)** - Multi-cloud file upload middleware (S3, Google Cloud, Azure)
- **[@goatlab/node-backend](./packages/node-backend)** - Flexible caching with Redis and LRU support
- **[@goatlab/node-metascraper](./packages/node-metascraper)** - Web metadata extraction

### API Integrations

- **[@goatlab/metabase](./packages/metabase)** - Comprehensive Metabase API wrapper
- **[@goatlab/typesense](./packages/typesense)** - Modern TypeScript wrapper for Typesense search engine

### Development Tools

- **[@goatlab/benchmarks](./packages/benchmarks)** - Performance benchmarking for database operations
- **[@goatlab/eslint](./packages/eslint)** - Shared ESLint configuration
- **[@goatlab/tsconfig](./packages/tsconfig)** - Shared TypeScript configuration
- **[@goatlab/ts-package-template](./packages/base_project)** - Template for new TypeScript packages
- **[@sodium/delphi](./packages/delphi)** - Multi-agent consensus system with flexible AI model configuration, session management, and production-ready agreement protocols

## 🗄️ Supported Databases

### Via TypeORM Connector (@goatlab/fluent)

- PostgreSQL
- MySQL / MariaDB
- SQLite
- Microsoft SQL Server
- Oracle
- MongoDB
- CockroachDB
- SAP Hana
- sql.js

### Native Connectors

- Firebase / Firestore
- LokiJS (in-memory)
- PouchDB (offline-first)
- Form.io (API-based)

## 🏗️ Architecture

This monorepo follows a modular architecture with:

- **Unified Query Interface**: All database connectors implement the same Fluent API
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Decorator-based Entities**: Define your models using decorators
- **Extensible Connectors**: Easy to add new database support
- **Monorepo Structure**: Managed with pnpm workspaces and Turbo

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run development mode
pnpm dev

# Lint code
pnpm lint
```

## 📝 Example Usage

```typescript
import { Fluent, TypeOrmConnector } from '@goatlab/fluent'
import { z } from 'zod'

// Define your schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
})

// Create a repository
class UserRepository extends TypeOrmConnector<User> {
  constructor() {
    super({
      entity: User,
      dataSource: myDataSource
    })
  }
}

// Use the Fluent API
const users = await userRepo
  .where({ age: { $gte: 18 } })
  .orderBy({ name: 'ASC' })
  .limit(10)
  .find()
```

## ⚙️ Agent Workflow Engine — Run, Test, and Load-Benchmark

This monorepo also ships a distributed agent workflow engine — see [`packages/agents-core/README.md`](packages/agents-core/README.md) for the full architecture. This section is the handover for **running**, **testing**, and **load-benchmarking** the engine.

### One-shot: run the full stack with Docker

```bash
# Build + start app + Postgres 18 + Redis 7 (everything, healthchecks, 2 vCPU/2 GB by default)
docker compose up -d

# App is at http://localhost:4445
curl http://localhost:4445/health
# {"ok":true,"ingestWorkers":<N>,"ingestBufferDepth":0}

# Tear everything down (including volumes)
docker compose down -v --remove-orphans
```

The compose stack uses:
- `Dockerfile` — multi-stage build (alpine runtime, ~500 MB)
- `docker-compose.yml` — PG (with `fsync=off` for benchmarking — never in prod) + Redis + app
- App image runs `packages/agents-ui/test-server/server.ts` via tsx

To bump capacity, edit `docker-compose.yml` → `deploy.resources.limits.cpus`. The app auto-detects container CPU and forks `cores - 1` cluster workers (`CLUSTER_MODE=auto`). Override with `CLUSTER_MODE=N` or `off`.

### Local dev (no Docker for the app)

```bash
# Brings up its own Postgres + Redis via testcontainers (Docker daemon needed)
cd packages/agents-ui
PORT=4445 CLUSTER_MODE=2 PG_POOL_SIZE=20 WORKER_CONCURRENCY=50 \
  npx tsx test-server/server.ts
```

When `PG_HOST` and `REDIS_HOST` env vars are set, the test server connects to those external services instead of starting testcontainers — same code, no branching.

### Workflows registered in the test server

| Name | Steps | Purpose |
|---|---|---|
| `fast_single` | 1 step (`fast_echo`, ~0ms) | Throughput benchmarking |
| `fast_chain` | 3 steps (a→b→c, ~0ms) | DAG benchmarking |
| `demo_pipeline` | 5 steps with realistic delays + a `WAITING_HUMAN` review step | Demo of HITL flows |

### HTTP endpoints to know

| Endpoint | Purpose |
|---|---|
| `POST /workflows/start` | Sync start (writes PG before responding, ~10–40 ms) |
| `POST /workflows/start-async` | **Queue-first** start (returns `{runId, traceId}` in ~2 ms — recommended for high throughput) |
| `POST /workflows/start-batch` / `start-batch-copy` | Bulk start (single COPY FROM under the hood) |
| `POST /workflows/status` | Fetch run + steps; falls back to BullMQ lookup for in-flight `QUEUED` runs |
| `POST /workflows/ingest-event` | Event ingestion |
| `GET /health` | 503 if no ingest worker registered; otherwise `{ok, ingestWorkers, ingestBufferDepth}` |

Full list in [`packages/agents-ui/README.md`](packages/agents-ui/README.md).

### Running the load tests

We use [`k6`](https://k6.io) (`brew install k6`). Two scripts ship in-tree:

#### 1. Multi-scenario benchmark (Hatchet-style)
```bash
# Requires the test server running on :4445
API_URL=http://localhost:4445 \
  k6 run packages/agents-core/loadtest/k6-workflow.js
```
Hits the **sync** `start` endpoint by default — useful for stress-testing the full DB-first path. Targets 2000 req/s, sweeps multiple scenarios in parallel (single starts, batch starts, event ingest, status polling).

#### 2. Flat sweep (used for the per-CPU benchmarks in this README)

The repo ships an ad-hoc `k6-flat.js` you can drop into `/tmp` for sweeps:

```js
// /tmp/k6-flat.js
import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const BASE = __ENV.API_URL || 'http://localhost:4445'
const RATE = parseInt(__ENV.RATE || '5000', 10)
const DUR  = __ENV.DUR || '30s'
const MODE = __ENV.MODE || 'async'   // 'async' | 'single' | 'batch'

const lat = new Trend('lat', true)
const ok  = new Counter('ok')
const err = new Rate('err')
const h = { 'Content-Type': 'application/json' }

export const options = {
  scenarios: {
    flat: {
      executor: 'constant-arrival-rate',
      rate: RATE, timeUnit: '1s', duration: DUR,
      preAllocatedVUs: 200, maxVUs: 1500,
      exec: MODE,
    },
  },
}

export function async() {
  const t = Date.now()
  const r = http.post(BASE + '/workflows/start-async',
    JSON.stringify({ workflowName: 'fast_single', input: { t } }), { headers: h })
  lat.add(Date.now() - t)
  const success = check(r, { '200': x => x.status === 200 })
  if (success) ok.add(1); err.add(!success)
}
export function single() {
  const t = Date.now()
  const r = http.post(BASE + '/workflows/start',
    JSON.stringify({ workflowName: 'fast_single', input: { t } }), { headers: h })
  lat.add(Date.now() - t)
  const success = check(r, { '200': x => x.status === 200 })
  if (success) ok.add(1); err.add(!success)
}
```

Run sweeps:
```bash
# 5 k req/s, 30 s, against the queue-first path
MODE=async RATE=5000 DUR=30s k6 run --quiet /tmp/k6-flat.js

# Sustained soak
MODE=async RATE=5000 DUR=10m k6 run --quiet /tmp/k6-flat.js
```

### Verifying durability after a load test

```bash
# Find the running PG container
PG=$(docker ps --format '{{.Names}}' | grep postgres | head -1)

# Total persisted runs
docker exec $PG psql -U agents -d agents -c \
  'SELECT count(*) FROM workflow_runs;'

# Completed vs in-flight
docker exec $PG psql -U agents -d agents -c \
  "SELECT status, count(*) FROM workflow_runs GROUP BY status;"

# Check ingest queue still has backlog (drains naturally)
REDIS=$(docker ps --format '{{.Names}}' | grep redis | head -1)
docker exec $REDIS redis-cli LLEN bull:workflow_ingest:wait
docker exec $REDIS redis-cli LLEN bull:workflow_ingest:active
docker exec $REDIS redis-cli ZCARD bull:workflow_ingest:failed   # should be 0
```

### Performance reference (measured)

On a 2-vCPU cluster (Cloud Run starter shape simulated locally):

| SLO | Sustained throughput per instance |
|---|---|
| p95 < 50 ms | ~4,000 req/s |
| p95 < 100 ms | ~5,000 req/s |
| p99 < 500 ms (0% errors) | ~8,000 req/s |

10-minute soak at 5 k req/s validated:
- 2.87 M workflows accepted, 0% failed BullMQ jobs
- p95 = 74 ms, p99 = 246 ms
- 0.06% transient HTTP errors (Node accept-queue overflow at peak; recoverable)
- Zero permanent data loss (queue drains to PG after load ends)

Scaling beyond a single instance is horizontal — same code, multiple instances, shared PG + Redis. Cluster math: app vCPU × ~2,500 req/s ≈ ceiling per instance with `p95 < 100 ms`.

### Engine-package tests

```bash
# Engine + state machine + COPY FROM (277 tests, needs Docker for testcontainers)
cd packages/agents-core && pnpm test

# Skip the long load-test file
cd packages/agents-core && npx vitest run --exclude="**/load-test*"

# AI layer (63 tests, no containers)
cd packages/agents-ai && pnpm test

# Sandbox unit + integration tests
cd packages/agents-sandbox && pnpm test:unit
cd packages/agents-sandbox && pnpm test:integration

# Visual editor E2E (Playwright, 12 tests)
cd packages/agents-ui && npx playwright test e2e/workflow-editor.spec.ts
```

### Tuning knobs (env vars)

| Env | Default | Purpose |
|---|---|---|
| `PORT` | 4444 / 4445 | HTTP port |
| `CLUSTER_MODE` | `auto` | `auto` (cores-1), `off` (single proc), or integer N |
| `PG_POOL_SIZE` | 20 | Postgres pool **per Node process**. Total connections = workers × this. Cap below `max_connections`. |
| `WORKER_CONCURRENCY` | 50 | BullMQ concurrency per step queue per process |
| `DISABLE_LOG_BUFFER` | false | `true` → synchronous log writes (debugging only) |
| `INGEST_TIMING` | unset | `1` → log per-flush COPY wall-time breakdown (begin / runs / steps / commit) |
| `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASSWORD` | — | If set, app skips testcontainers and connects to external PG |
| `REDIS_HOST`, `REDIS_PORT` | — | Same idea for Redis |

### Retention (delete old runs)

Tables grow forever without a cleanup job. The repo ships a one-shot script that drops terminal-state runs older than `RETENTION_DAYS` (active runs preserved regardless of age). Steps and logs are removed via `ON DELETE CASCADE`.

```bash
# One-shot
DATABASE_URL=postgres://agents:agents@localhost:5432/agents \
RETENTION_DAYS=30 \
  npx tsx packages/agents-core/bin/retention-cleanup.ts

# Crontab — hourly
0 * * * * cd /app && DATABASE_URL=$DATABASE_URL RETENTION_DAYS=30 \
  npx tsx packages/agents-core/bin/retention-cleanup.ts >> /var/log/retention.log 2>&1
```

A Kubernetes `CronJob` template is in the script's header comment. For installations >500GB, also enable the autovacuum overrides shown commented in `docker-compose.yml` — without aggressive vacuum, table bloat compounds even with retention enabled.

### When the scheduler becomes the bottleneck

`SchedulerService` (cron triggers + delayed runs) currently runs in-process inside every cluster worker. That's fine for hundreds of triggers/min. If you find scheduler tick latency or trigger-fire warnings dominating the engine logs (per Hatchet's note: "If you observe a large number of warnings, consider isolating the scheduler"), extract it:

1. Disable scheduler in regular workers (env: `DISABLE_SCHEDULER=true`)
2. Run a dedicated single-instance container with `RUN_SCHEDULER_ONLY=true`
3. Same Postgres + Redis as the rest — coordination is via PG row locks

This is an explicit follow-up; the env-var flags don't exist yet, but the `SchedulerService` is already a separate class — extracting requires only a CLI flag and is a ~1 hour change when needed.

### Internal write buffers

The engine uses the `WriteBuffer<T>` primitive (`packages/agents-core/src/engine/WriteBuffer.ts`) to batch writes Hatchet-style. Currently wired up:

| Buffer | Threshold / Interval | Purpose |
|---|---|---|
| **IngestBuffer** (HTTP→Redis) | 200 / 50ms | accumulate `start-async` triggers, flush via `addBulk` |
| **IngestWorker** (Redis→PG) | 200 / 20ms | accumulate BullMQ jobs, flush via `COPY FROM` |
| **logBuffer** (step events→PG) | 50 / 50ms | batch `workflow_step_logs` writes via `COPY FROM` |

**Planned next**: a `StepStatusBuffer` for `markStepRunning` / `onStepCompleted` UPDATEs (1.5–2× completion throughput per Hatchet's pattern). Designed but not yet implemented — requires changes to BullMQ ack semantics so the per-job promise only resolves after the batched UPDATE commits. See the design comment in `WorkflowEngine.ts` (search for `DESIGN: Step-status batching`).

### Where to dig deeper
- Architecture, queue-first ingestion, key exports → [`packages/agents-core/README.md`](packages/agents-core/README.md)
- Dashboard + test server + endpoint reference → [`packages/agents-ui/README.md`](packages/agents-ui/README.md)
- BullMQ adapter (single vs bulk enqueue, why `addBulk` matters) → [`packages/tasks-adapter-bullmq/README.md`](packages/tasks-adapter-bullmq/README.md)
- LLM adapter, multi-agent consensus → [`packages/agents-ai/README.md`](packages/agents-ai/README.md)
- LangGraph integration → [`packages/agents-langgraph/README.md`](packages/agents-langgraph/README.md)
- Sandboxed step execution → [`packages/agents-sandbox/README.md`](packages/agents-sandbox/README.md)

## 🚢 Release Process

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Build and publish
pnpm changeset publish
```

Release dependency chain: `js-utils` → `node-utils` → `fluent` → other packages

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

Ignacio Cabrera - [@twitter_handle](https://twitter.com/cabrerabywaters) - <ignacio.cabrera@goatlab.io>

<!-- ACKNOWLEDGEMENTS -->

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

This library is based on the work of other Authors and Open Source Libraries. Have a look at them and give them a well deserved Star ⭐!

- [sindresorhus - p-map](https://github.com/sindresorhus/p-map)
- [sindresorhus - p-props](https://github.com/sindresorhus/p-props)
- [Natural Cycles - NodeJS](https://github.com/NaturalCycles/nodejs-lib)
- [Natural Cycles - JS-Lib](https://github.com/NaturalCycles/js-lib)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[stars-shield]: https://img.shields.io/github/stars/goat-io/fluent?style=flat-square
[stars-url]: https://github.com/goat-io/fluent/stargazers
[issues-shield]: https://img.shields.io/github/issues/goat-io/fluent?style=flat-square
[issues-url]: https://github.com/goat-io/fluent/issues
[license-shield]: https://img.shields.io/github/license/goat-io/fluent?style=flat-square
[license-url]: https://github.com/goat-io/fluent/blob/master/LICENSE.txt
