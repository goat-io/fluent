# @goatlab/delphi-ui

Workflow dashboard for `@goatlab/delphi-core`. A React + React Flow + Vite app that visualizes runs, events, workers, and metrics in real time via server-sent events. Ships with a Node test server used for Playwright E2E and k6 load benchmarks.

## What it is

- **Dashboard** — lists workflows, inspects runs/steps/logs, surfaces human-approval pauses, shows worker health and queue depth
- **Visual editor** — drag-and-drop graph editor (React Flow + dagre) to author workflow templates without hand-writing DSL
- **Smart trigger form** — introspects a workflow's declared input schema and renders the right form fields
- **Test server** (`test-server/server.ts`) — a self-contained HTTP backend: Postgres + Redis testcontainers, all workflow executors registered, queue-first ingestion wired in. Used for E2E tests and load benchmarks.
- **Example** (`example/start.ts`) — long-running demo with three workflows and registered workers for local development

## Install

```bash
pnpm add @goatlab/delphi-ui
```

Dashboard components are exported from the package root; styles from `@goatlab/delphi-ui/styles.css`.

## Run locally

```bash
# Dashboard dev server (default port 5173)
pnpm dev

# Example backend (real Postgres/Redis via testcontainers, 3 demo workflows)
npx tsx example/start.ts

# Test backend (used by E2E + load tests; supports Node cluster mode)
pnpm test:server

# Playwright E2E for the visual editor (12 tests)
npx playwright test e2e/workflow-editor.spec.ts

# k6 load test (needs the test server running)
k6 run ../../packages/delphi-core/loadtest/k6-workflow.js
```

### Point the UI at a backend

```bash
VITE_API_URL=http://localhost:4444 pnpm dev
```

## Test server tuning

`test-server/server.ts` reads these env vars:

| Env | Default | Purpose |
|---|---|---|
| `PORT` | 4444 | HTTP port |
| `PG_POOL_SIZE` | 20 | Postgres pool per Node process |
| `WORKER_CONCURRENCY` | 50 | BullMQ concurrency per queue per process |
| `DISABLE_LOG_BUFFER` | false | Set `true` for synchronous log writes |
| `CLUSTER_MODE` | `auto` | `auto` (cores-1), `off` (single proc), or an integer |

On boot it detects the available CPU count, forks workers via `node:cluster`, starts containers once in the primary, and passes connection URLs to children. All workers share HTTP port 4444 (kernel round-robin) and consume the same BullMQ queues.

## HTTP endpoints

| Method + path | Purpose |
|---|---|
| `POST /workflows/start` | Sync start (writes PG, then enqueues) |
| `POST /workflows/start-async` | Queue-first ingest (returns `{runId, traceId, status: QUEUED}` in ~2ms) |
| `POST /workflows/start-batch` | Batched start (single COPY FROM under the hood) |
| `POST /workflows/start-batch-copy` | Explicit COPY FROM path |
| `POST /workflows/status` | Fetches run + steps; falls back to BullMQ lookup for in-flight `QUEUED` runs |
| `POST /workflows/cancel` | Cancel a run |
| `POST /workflows/human-input` | Resume a `WAITING_HUMAN` step |
| `POST /workflows/signal` | Send a signal to a running workflow |
| `POST /workflows/query` | List runs with filters |
| `POST /workflows/ingest-event` | Event ingestion endpoint |
| `POST /workers/generate-token`, `/workers/list`, `/workflows/heartbeat` | Remote worker registration + liveness |
| `POST /workflows/validate` | Validate a workflow definition |
| `GET  /health` | Returns `{ok, ingestWorkers, ingestBufferDepth}`; 503 if no ingest worker registered |

## Measured performance (on the test server)

Load-tested with [`k6-workflow.js`](../delphi-core/loadtest/k6-workflow.js):

| Hardware | SLO | Throughput |
|---|---|---|
| 2 vCPU (`CLUSTER_MODE=2`) | p95 < 50ms | ~4,000 req/s |
| 2 vCPU | p95 < 100ms | ~5,000 req/s |
| 16 vCPU (`CLUSTER_MODE=auto` → 15 workers) | p95 < 100ms | ~17,000 req/s (Node-bound, not PG-bound) |

Zero errors observed at any tested rate. Data loss verified at 0 across 400k+ workflow runs.

## Dashboard features

- **Workflow list**: sorted by most recent run; workflows with no runs appear last
- **Run inspector**: step DAG rendered with React Flow, per-step logs, inputs/outputs, error traces
- **Human approval UI**: inline form for steps in `WAITING_HUMAN` state, schema-validated
- **Worker monitor**: lists registered `WorkerNode`s, their heartbeats, slot utilization
- **Metrics**: queue depth, throughput, recent failures
- **SSE**: live updates without polling

## Key exports

| Export | Purpose |
|---|---|
| `<Dashboard />` | Top-level app component |
| `<WorkflowList />`, `<RunInspector />`, `<VisualEditor />` | Mix-and-match sub-components |
| `useWorkflowRun(runId)` | React hook — live run + step state via SSE |
| `useWorkflowList(filters)` | React hook — filtered list of runs |

## License

MIT
