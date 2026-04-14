# @goatlab/tasks-adapter-bullmq

BullMQ adapter implementing the `TaskConnector` interface from `@goatlab/tasks-core`. The production queue backend for `@goatlab/agents-core`. Supports single-job enqueue, bulk enqueue (`addBulk`), worker listen loops with per-queue concurrency, graceful shutdown, and multi-tenant key prefixing.

## What it is

A thin, production-hardened BullMQ wrapper that:

- Implements `TaskConnector` so the same calling code works with the GCP Tasks and Hatchet adapters
- Exposes BullMQ-native features (`getQueue`, `addJob`, `addBulk`, `getJob`, `getWorkers`, `getJobCounts`) for callers that want raw access (e.g., `IngestBuffer` in `@goatlab/agents-core`)
- Shares one `ioredis` connection across all queues and workers to avoid connection storms
- Prefixes all Redis keys with a tenant prefix when `_tenantId` is set

## Install

```bash
pnpm add @goatlab/tasks-adapter-bullmq @goatlab/tasks-core bullmq ioredis
```

Requires Redis 6+.

## Quick start

```ts
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'

const connector = new BullMQConnector({
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    maxRetriesPerRequest: null, // required by BullMQ workers
  },
})

// Enqueue a single job (TaskConnector interface)
await connector.queue({
  uniqueTaskName: 'send-email-user123',
  taskName: 'email',
  postUrl: '/noop',
  taskBody: { to: 'a@b.com', subject: 'Hi' },
  handle: async () => {},
})

// Bulk enqueue (BullMQ-native, fastest path)
const queue = connector.getQueue('email')
await queue.addBulk([
  { name: 'email', data: { to: 'a@b.com' }, opts: { jobId: 'unique-1' } },
  { name: 'email', data: { to: 'c@d.com' }, opts: { jobId: 'unique-2' } },
])

// Start workers
const handle = await connector.listen({
  tasks: [
    { taskName: 'email',  handle: async (data) => { /* send */ }, concurrency: 20 },
    { taskName: 'render', handle: async (data) => { /* render */ }, concurrency: 5 },
  ],
})

// Graceful shutdown
await handle.stop()
await connector.close()
```

## Key behaviour

- **Job IDs**: pass your own `jobId` for deduplication. BullMQ will reject duplicates silently — perfect for idempotent producers.
- **`onAfterQueue` hook**: optional callback fired after a job is successfully enqueued; used by `@goatlab/agents-core` to log dispatches or update auxiliary state.
- **Default job options**: `removeOnComplete: true` and `removeOnFail: 100` by default — avoids Redis memory growth. Override per-queue or per-job via opts.
- **Per-queue concurrency**: `listen({ tasks: [{ taskName, concurrency }] })` creates one BullMQ `Worker` per task name. Concurrency is applied per worker instance.
- **Shared connection**: a single ioredis connection is shared across all queues and workers, exposed via `getSharedConnection()` for advanced use.
- **Tenant prefixing**: set `connector.setTenantId('acme-corp')` and all subsequent Redis keys become `acme-corp:bull:<queue>:<state>` — allowing safe multi-tenant use on shared Redis.

## Why bulk matters

`addBulk(N jobs)` executes one Lua script against Redis for N jobs — typically ~0.5–2ms. Calling `queue.add()` N times is ~N Redis roundtrips. For high-throughput ingestion paths this is a 10–50× difference. `@goatlab/agents-core`'s `IngestBuffer` exploits this: HTTP handlers push triggers into an in-memory accumulator, which flushes via `addBulk` every 50ms (or 200 entries).

Keep bulk sizes ≤1000 — BullMQ's Lua script latency starts to dominate above that. See [BullMQ issue #1670](https://github.com/taskforcesh/bullmq/issues/1670).

## Worker semantics

- `listen()` returns a handle with `.stop()` that drains in-flight jobs before resolving
- Job handlers run inside BullMQ's own try/catch; throwing = job moves to `failed` (with retry if configured)
- Job payloads are JSON-serialized to Redis; keep them small (<100KB) and put heavy data in Postgres if needed
- `prefetchCount` defaults to 1; set to ~2× concurrency for small jobs to hide Redis BRPOP latency

## Testing

```bash
pnpm test   # requires Docker (Redis testcontainer)
```

## Key exports

| Export | Purpose |
|---|---|
| `BullMQConnector` | The main class |
| `BullMQConnector.prototype.queue` | Single-job enqueue (TaskConnector interface) |
| `BullMQConnector.prototype.addJob` | Single-job enqueue with custom BullMQ options |
| `BullMQConnector.prototype.getQueue` | Returns a raw BullMQ `Queue` (use for `addBulk`, custom ops) |
| `BullMQConnector.prototype.listen` | Start N workers |
| `BullMQConnector.prototype.close` | Close queues + shared Redis connection |

## License

MIT
