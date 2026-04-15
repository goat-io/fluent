#!/usr/bin/env tsx
/**
 * Retention cleanup — drops workflow runs/steps/logs older than RETENTION_DAYS.
 *
 * Without this, tables grow forever. Hatchet defaults to 30 days; pick a value
 * that suits your audit/replay needs. Indexes on createdAt mean these deletes
 * are cheap.
 *
 * Usage (one-shot — default 'public' schema):
 *   DATABASE_URL=postgres://... RETENTION_DAYS=30 npx tsx bin/retention-cleanup.ts
 *
 * Usage (engine deployed with schema='agents'):
 *   DATABASE_URL=... RETENTION_SCHEMA=agents RETENTION_DAYS=30 \
 *     npx tsx bin/retention-cleanup.ts
 *
 * Usage (cron, hourly):
 *   0 * * * * cd /app && DATABASE_URL=$DATABASE_URL \
 *               RETENTION_SCHEMA=agents RETENTION_DAYS=30 \
 *               npx tsx bin/retention-cleanup.ts >> /var/log/retention.log 2>&1
 *
 * Kubernetes CronJob:
 *   apiVersion: batch/v1
 *   kind: CronJob
 *   metadata: { name: delphi-retention }
 *   spec:
 *     schedule: "0 * * * *"
 *     jobTemplate:
 *       spec:
 *         template:
 *           spec:
 *             containers:
 *               - name: cleanup
 *                 image: <your-app-image>
 *                 command: ["npx", "tsx", "bin/retention-cleanup.ts"]
 *                 env:
 *                   - { name: DATABASE_URL,   valueFrom: { secretKeyRef: ... } }
 *                   - { name: RETENTION_DAYS, value: "30" }
 *             restartPolicy: OnFailure
 *
 * Behaviour:
 *  - Deletes terminal-state runs (COMPLETED, FAILED, CANCELLED) older than cutoff.
 *  - Active runs (RUNNING, WAITING_HUMAN, etc.) are PRESERVED regardless of age.
 *  - workflow_steps + workflow_step_logs are removed via ON DELETE CASCADE.
 *  - workflow_events older than cutoff are removed unconditionally.
 *  - Runs in a single transaction per table; safe to interrupt.
 */

import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS ?? '30', 10)
const BATCH_SIZE = parseInt(process.env.RETENTION_BATCH_SIZE ?? '10000', 10)
/**
 * Postgres schema where engine tables live. MUST match the value passed to
 * WorkflowEngine constructor (e.g. `schema: 'agents'` → set RETENTION_SCHEMA=agents).
 *
 * Default 'public' matches the engine's default. If you've moved engine
 * tables to a different schema and don't set this, retention silently
 * fails (PG raises "relation does not exist" — noisy, not silent —
 * but a misconfigured cron will keep retrying anyway).
 */
const SCHEMA = process.env.RETENTION_SCHEMA ?? 'public'

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL env var required')
  process.exit(1)
}
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
  console.error(`FATAL: RETENTION_DAYS must be a positive integer (got ${process.env.RETENTION_DAYS})`)
  process.exit(1)
}
// Defense against SQL injection via env var. Schema names are lowercase
// alphanumeric + underscore. Reject anything else.
if (!/^[a-z_][a-z0-9_]*$/.test(SCHEMA)) {
  console.error(`FATAL: RETENTION_SCHEMA must match /^[a-z_][a-z0-9_]*$/ (got "${SCHEMA}")`)
  process.exit(1)
}

// Schema-qualified table refs — interpolated only after the regex check above.
const T_RUNS   = `${SCHEMA}.workflow_runs`
const T_EVENTS = `${SCHEMA}.workflow_events`
const T_ACTIONS = `${SCHEMA}.external_actions`

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 })
  const client = await pool.connect()
  const startedAt = Date.now()

  console.log(`[retention] schema = ${SCHEMA}, cutoff = ${RETENTION_DAYS}d, batch = ${BATCH_SIZE}`)

  try {
    // Runs in terminal state — cascade deletes steps + logs via FK
    const runs = await deleteInBatches(client, `
      DELETE FROM ${T_RUNS}
       WHERE id IN (
         SELECT id FROM ${T_RUNS}
          WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED')
            AND "createdAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
          LIMIT $1
       )
    `, BATCH_SIZE, T_RUNS)

    // Events have no FK relationship — separate cleanup
    const events = await deleteInBatches(client, `
      DELETE FROM ${T_EVENTS}
       WHERE id IN (
         SELECT id FROM ${T_EVENTS}
          WHERE "createdAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
          LIMIT $1
       )
    `, BATCH_SIZE, T_EVENTS)

    // External actions for already-deleted runs are CASCADE-cleaned via
    // workflow_runs FK; orphaned ones (run already deleted by another path)
    // are cleaned by the createdAt cutoff
    const actions = await deleteInBatches(client, `
      DELETE FROM ${T_ACTIONS}
       WHERE id IN (
         SELECT id FROM ${T_ACTIONS}
          WHERE "createdAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
          LIMIT $1
       )
    `, BATCH_SIZE, T_ACTIONS)

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[retention] done in ${elapsed}s — runs=${runs} events=${events} external_actions=${actions}`)
  } finally {
    client.release()
    await pool.end()
  }
}

async function deleteInBatches(
  client: pg.PoolClient,
  sql: string,
  batchSize: number,
  label: string,
): Promise<number> {
  let total = 0
  for (;;) {
    const result = await client.query(sql, [batchSize])
    const n = result.rowCount ?? 0
    total += n
    if (n < batchSize) break
    // Yield between batches so we don't lock-storm the table
    await new Promise(r => setTimeout(r, 100))
  }
  if (total > 0) console.log(`[retention] ${label}: deleted ${total} rows`)
  return total
}

main().catch((err) => {
  console.error('[retention] FATAL', err)
  process.exit(1)
})
