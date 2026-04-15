# @goatlab/realtime-broker

Per-tenant pooled pub/sub broker. Lifted from sodium's production `TenantSubscriberPool` pattern and generalized.

**The reason this exists**: a naive Redis pub/sub implementation creates one ioredis connection per subscriber. With 1000 SSE users on one tenant, that's 1000 Redis connections. This package gives you **one Redis connection per *tenant***, fanning out to N in-process listeners — `O(tenants)` instead of `O(users)`.

## Install

```bash
pnpm add @goatlab/realtime-broker ioredis
```

## Quick start

```ts
import { RedisRealtimeBroker } from '@goatlab/realtime-broker'

const broker = new RedisRealtimeBroker({
  redis: { host: 'localhost', port: 6379, maxRetriesPerRequest: null },
})

// Subscribe (in your SSE handler, web socket handler, or wherever you fan out)
const sub = await broker.subscribe('tenant-acme', 'live-orders', (data) => {
  // data is parsed JSON (or raw string if not JSON)
  console.log('order update:', data)
})

// Publish (from anywhere — including engine event hooks)
await broker.publish('tenant-acme', 'live-orders', { id: 42, status: 'shipped' })

// Clean up when the SSE/WS client disconnects
await sub.unsubscribe()
```

## Why this matters at scale

| Subscribers per tenant | Naive impl | This broker |
|---|---|---|
| 1 user | 1 Redis conn | 1 Redis conn |
| 100 users | 100 Redis conns | **1 Redis conn** |
| 1000 users | 1000 Redis conns ⚠️ | **1 Redis conn** ✅ |
| 10 tenants × 1000 users each | 10,000 conns ❌ | **10 conns** ✅ |

A standalone Redis caps around 10k connections. Memorystore caps lower. The naive pattern hits the cap fast; this pattern doesn't.

## Channel naming

Default key format: `tenant:{tenantId}:{channel}`. Override via `channelKey`:

```ts
new RedisRealtimeBroker({
  redis: { ... },
  channelKey: (tenantId, channel) => `myapp:${tenantId}/${channel}`,
})
```

## Per-tenant Redis credentials (Redis ACL)

If each tenant uses a different Redis ACL user (defense-in-depth isolation), pass `perTenantCredentials`:

```ts
new RedisRealtimeBroker({
  redis: { host, port, maxRetriesPerRequest: null },
  perTenantCredentials: async (tenantId) => {
    const { username, password } = await fetchCredsForTenant(tenantId)
    return { username, password }
  },
})
```

Called once per tenant on first subscribe; result is reused for that tenant's lifetime.

## Wiring with the agent engine

Pair with `@goatlab/delphi-core`'s `onEngineEvent` hook:

```ts
import { WorkflowEngine, type EngineEvent } from '@goatlab/delphi-core'
import { RedisRealtimeBroker } from '@goatlab/realtime-broker'

const broker = new RedisRealtimeBroker({ redis: { host, port } })

const engine = new WorkflowEngine({
  ...,
  onEngineEvent: (evt: EngineEvent) => {
    // Engine events fire AFTER PG commit — safe to fan out immediately
    broker.publish(evt.tenantId, `engine:run:${evt.runId}`, evt)
    broker.publish(evt.tenantId, `engine:tenant`, evt)  // tenant-wide stream
  },
})

// In your SSE handler:
const sub = await broker.subscribe(tenantId, `engine:run:${runId}`, (evt) => {
  res.write(`data: ${JSON.stringify(evt)}\n\n`)
})
```

The engine emits one event per state transition (run.started, step.running, step.completed, step.failed, step.human_requested, run.completed). Subscribers see live updates without polling.

## API

### `RedisRealtimeBroker`

| Method | Purpose |
|---|---|
| `subscribe(tenantId, channel, handler)` | Returns a `RealtimeSubscription` with `.unsubscribe()` |
| `publish(tenantId, channel, data)` | Returns count of remote subscribers reached |
| `close()` | Idempotent; closes all connections |
| `subscriptionCount()` | Diagnostic — distinct (tenant, channel) pairs |
| `tenantCount()` | Diagnostic — distinct tenants with active subscribers |

### Backend swap

`RealtimeBroker` is an interface — swap `RedisRealtimeBroker` for any other implementation (in-memory for tests, NATS, etc.) without touching consumers:

```ts
import type { RealtimeBroker } from '@goatlab/realtime-broker'

function makeBroker(): RealtimeBroker {
  if (process.env.NODE_ENV === 'test') return new InMemoryBroker()
  return new RedisRealtimeBroker({ redis: { host, port } })
}
```

## Testing

Tests use a real Redis testcontainer (no mocks):

```bash
pnpm test
```

12 tests covering: per-tenant pooling, fan-out to N listeners, tenant isolation, lifecycle (auto-reaping when last handler leaves), idempotent unsubscribe, multi-channel sharing, handler error isolation, JSON vs raw string fallback, custom channelKey, close() teardown.

## What this package does NOT do

- **Authentication** — handle in your SSE/WS handler before subscribe()
- **Backpressure** — slow handlers don't block siblings, but a slow consumer can fall behind. Add an in-memory queue if needed.
- **Persistence / replay** — Redis pub/sub is fire-and-forget. For replay, use Redis Streams (separate package).

## License

MIT
