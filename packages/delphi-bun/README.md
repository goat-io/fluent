# @goatlab/delphi-bun

[Bun](https://bun.sh) adapter for `@goatlab/delphi-core`. Returns a single `fetch(req)` handler that mounts every workflow endpoint behind `Bun.serve()`.

Bun is much faster than Node for raw HTTP — typically 2-3× the request/sec ceiling on the same hardware. Use this adapter when you want to maximize per-instance throughput.

## Install

```bash
bun add @goatlab/delphi-bun @goatlab/delphi-core
```

## Quick start

```ts
import { agentsBunHandler } from '@goatlab/delphi-bun'
import { myDelphiFactory } from './my-delphi-factory'

const handler = agentsBunHandler({
  resolveAgents: async (req) => {
    const { engine, ingestBuffer } = await myDelphiFactory(req)
    return { engine, ingestBuffer, tenantId: req.headers.get('x-tenant') ?? 'default' }
  },
})

Bun.serve({
  port: 3000,
  fetch: handler,   // matches /start-async, /status, etc. directly
})
```

Or under a path prefix, with Bun's `routes:` API (Bun ≥1.1.30):

```ts
const handler = agentsBunHandler({
  resolveAgents,
  prefix: '/api/workflows',
})

Bun.serve({
  port: 3000,
  routes: {
    '/api/workflows/*': handler,
    '/health': () => Response.json({ ok: true }),
    '/api/me':  () => Response.json({ user: 'demo' }),
  },
})
```

## Endpoints mounted

Same set as the Express adapter:

| Method + path | Purpose |
|---|---|
| `POST /start-async` | Queue-first start (~1ms response on Bun) |
| `POST /start` | Sync start |
| `POST /start-batch` | Batched start |
| `POST /start-batch-copy` | Explicit COPY-FROM batch |
| `POST /status` | Run status (with QUEUED fallback for in-flight) |
| `POST /cancel` | Cancel a run |
| `POST /human-input` | Resume a `WAITING_HUMAN` step |
| `POST /signal` | Send a signal |
| `POST /query` | List runs with filters |
| `POST /ingest-event` | Event ingestion |
| `GET /` | List registered workflow definitions |
| `GET /health` | Always 200 |

## Why Bun for this?

- **Raw HTTP performance**: Bun's `fetch` runtime is built on Zig and uses uWebSockets — typically 2-3× the req/sec of Node `http.createServer` on the same hardware
- **Native TypeScript**: no `tsx` / `ts-node` overhead, no build step in dev
- **Built-in workspace support**: respects pnpm workspaces out of the box
- **Same Postgres + Redis story**: the engine doesn't care which runtime is acceping HTTP — `pg` and `bullmq` work identically under Bun

## Selective routes

```ts
agentsBunHandler({
  resolveAgents,
  routes: {
    startAsync: true,
    status: true,
    // everything else off
    start: false, startBatch: false, cancel: false,
    humanInput: false, signal: false, query: false,
    ingestEvent: false, listWorkflows: false,
  },
})
```

## Custom error mapping

```ts
agentsBunHandler({
  resolveAgents,
  mapError: (err) => {
    const e = err as { code?: string; message?: string }
    if (e.code === 'WORKFLOW_RUN_NOT_FOUND') return { status: 404, body: { error: 'not found' } }
    if (e.code === 'IDEMPOTENCY_CONFLICT')   return { status: 409, body: { error: 'duplicate' } }
    return { status: 500, body: { error: 'oops' } }
  },
})
```

## What this adapter does NOT do

- **Authentication**: handle it in your own routing or middleware before delegating to this handler
- **CORS**: Bun.serve has built-in `headers` config — set there
- **Rate limiting**: see `bun-rate-limiter` or your own middleware

This package is intentionally tiny (~200 LOC) — the heavy lifting lives in `@goatlab/delphi-core`.

## License

MIT
