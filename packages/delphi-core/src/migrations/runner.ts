// npx vitest run src/__tests__/engine/dbos-parity.spec.ts
//
// Lightweight migration runner for delphi-core schema evolution.
//

import type { DbClient } from '../db/DbClient.js'
import { PG_NOTIFY_SQL } from '../engine/PgNotifier.js'

export interface Migration {
  version: number
  description: string
  sql: string[]
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description:
      'Add missing indexes (traceId, createdAt, tenantId+workflowName, active steps)',
    sql: [
      `CREATE INDEX IF NOT EXISTS idx_runs_trace_id ON workflow_runs("traceId")`,
      `CREATE INDEX IF NOT EXISTS idx_runs_created_at ON workflow_runs("createdAt")`,
      `CREATE INDEX IF NOT EXISTS idx_runs_tenant_name ON workflow_runs("tenantId", "workflowName")`,
      `CREATE INDEX IF NOT EXISTS idx_steps_active ON workflow_steps("workflowRunId", status)
        WHERE status IN ('PENDING', 'QUEUED', 'RUNNING', 'WAITING_HUMAN')`,
    ],
  },
  {
    version: 2,
    description: 'Add FK CASCADE on workflow_step_logs for retention cleanup',
    sql: [
      `ALTER TABLE workflow_step_logs
        ADD COLUMN IF NOT EXISTS "workflowRunId" VARCHAR(36)`,
      `UPDATE workflow_step_logs SET "workflowRunId" = ws."workflowRunId"
        FROM workflow_steps ws WHERE workflow_step_logs."stepId" = ws.id
        AND workflow_step_logs."workflowRunId" IS NULL`,
      `DO $$ BEGIN
        ALTER TABLE workflow_step_logs
          ADD CONSTRAINT fk_step_logs_run
          FOREIGN KEY ("workflowRunId") REFERENCES workflow_runs(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
    ],
  },
  {
    version: 3,
    description: 'Add enqueue_workflow() stored function',
    sql: [
      `CREATE OR REPLACE FUNCTION delphi_enqueue_workflow(
        p_workflow_name TEXT,
        p_tenant_id TEXT,
        p_input JSON DEFAULT '{}'::JSON,
        p_idempotency_key TEXT DEFAULT NULL,
        p_trace_id TEXT DEFAULT NULL,
        p_parent_run_id TEXT DEFAULT NULL
      ) RETURNS TEXT AS $$
      DECLARE
        v_run_id TEXT;
        v_existing_id TEXT;
      BEGIN
        IF p_idempotency_key IS NOT NULL THEN
          SELECT id INTO v_existing_id FROM workflow_runs
            WHERE "tenantId" = p_tenant_id AND "idempotencyKey" = p_idempotency_key;
          IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
          END IF;
        END IF;

        v_run_id := gen_random_uuid()::TEXT;

        INSERT INTO workflow_runs (
          id, "tenantId", "workflowName", "workflowVersion", status,
          "triggerInput", "idempotencyKey", "traceId", "parentRunId",
          "startedAt", "createdAt", "updatedAt"
        ) VALUES (
          v_run_id, p_tenant_id, p_workflow_name, '1.0', 'PENDING',
          p_input::TEXT, p_idempotency_key,
          COALESCE(p_trace_id, gen_random_uuid()::TEXT),
          p_parent_run_id,
          NOW(), NOW(), NOW()
        ) ON CONFLICT ("tenantId", "idempotencyKey") DO NOTHING;

        IF NOT FOUND THEN
          SELECT id INTO v_run_id FROM workflow_runs
            WHERE "tenantId" = p_tenant_id AND "idempotencyKey" = p_idempotency_key;
        END IF;

        RETURN v_run_id;
      END;
      $$ LANGUAGE plpgsql`,
    ],
  },
  {
    version: 4,
    description: 'Add LISTEN/NOTIFY triggers for low-latency event dispatch',
    sql: PG_NOTIFY_SQL,
  },
  {
    version: 5,
    description:
      'DBOS-parity v2: durable sleep, timeout, forking, streaming, versioning, delayed, partitioning',
    sql: [
      `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS "deadlineEpochMs" BIGINT`,
      `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS "timeoutMs" BIGINT`,
      `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS "forkedFromRunId" VARCHAR(36)`,
      `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS "applicationVersion" VARCHAR(100)`,
      `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS "delayUntilEpochMs" BIGINT`,
      `ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS "deadlineEpochMs" BIGINT`,
      `ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS "queuePartitionKey" VARCHAR(255)`,
      `CREATE TABLE IF NOT EXISTS workflow_streams (
        id VARCHAR(36) PRIMARY KEY,
        "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        "offset" INTEGER NOT NULL,
        value TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_streams_run_key ON workflow_streams("workflowRunId", key, "offset")`,
      `CREATE INDEX IF NOT EXISTS idx_runs_delayed ON workflow_runs(status, "delayUntilEpochMs") WHERE status = 'DELAYED'`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_partition ON workflow_tasks("queuePartitionKey", status) WHERE "queuePartitionKey" IS NOT NULL`,
    ],
  },
  {
    version: 6,
    description:
      'Add input column to workflow_schedules for scheduled workflow input',
    sql: [`ALTER TABLE workflow_schedules ADD COLUMN IF NOT EXISTS input TEXT`],
  },
  {
    version: 7,
    description:
      'Widen workflow_schedules.id to VARCHAR(255) for deterministic upsert IDs',
    sql: [`ALTER TABLE workflow_schedules ALTER COLUMN id TYPE VARCHAR(255)`],
  },
  {
    version: 8,
    description:
      'Migrate workflow_schedules from TIMESTAMP to epoch ms (BIGINT) to avoid timezone issues',
    sql: [
      // Add new epoch columns (idempotent)
      `ALTER TABLE workflow_schedules ADD COLUMN IF NOT EXISTS "nextRunAtEpochMs" BIGINT`,
      `ALTER TABLE workflow_schedules ADD COLUMN IF NOT EXISTS "lastRunAtEpochMs" BIGINT`,
      // Migrate existing data: TIMESTAMP -> epoch ms (only if old columns still exist)
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_schedules' AND column_name = 'nextRunAt') THEN
          UPDATE workflow_schedules SET "nextRunAtEpochMs" = EXTRACT(EPOCH FROM "nextRunAt") * 1000 WHERE "nextRunAtEpochMs" IS NULL AND "nextRunAt" IS NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_schedules' AND column_name = 'lastRunAt') THEN
          UPDATE workflow_schedules SET "lastRunAtEpochMs" = EXTRACT(EPOCH FROM "lastRunAt") * 1000 WHERE "lastRunAtEpochMs" IS NULL AND "lastRunAt" IS NOT NULL;
        END IF;
      END $$`,
      // Default any remaining NULLs (fresh tables have no data to migrate)
      `UPDATE workflow_schedules SET "nextRunAtEpochMs" = 0 WHERE "nextRunAtEpochMs" IS NULL`,
      // Make nextRunAtEpochMs NOT NULL
      `ALTER TABLE workflow_schedules ALTER COLUMN "nextRunAtEpochMs" SET NOT NULL`,
      // Drop old columns
      `ALTER TABLE workflow_schedules DROP COLUMN IF EXISTS "nextRunAt"`,
      `ALTER TABLE workflow_schedules DROP COLUMN IF EXISTS "lastRunAt"`,
      // Drop old index, create new one
      `DROP INDEX IF EXISTS idx_schedules_next`,
      `CREATE INDEX IF NOT EXISTS idx_schedules_next_epoch ON workflow_schedules(active, "nextRunAtEpochMs")`,
    ],
  },
]

/**
 * Run all pending migrations. Idempotent — safe to call on every startup.
 */
export async function runMigrations(db: DbClient): Promise<number> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS delphi_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  )

  const { rows } = await db.query<{ version: number }>(
    `SELECT COALESCE(MAX(version), 0) as version FROM delphi_migrations`,
  )
  const currentVersion = rows[0]?.version ?? 0

  let applied = 0
  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue
    }

    for (const statement of migration.sql) {
      try {
        await db.query(statement)
      } catch (err: any) {
        if (
          err.code === '42P07' ||
          err.code === '42710' ||
          err.code === '42701' ||
          err.code === '42P06'
        ) {
          continue
        }
        throw err
      }
    }

    await db.query(
      `INSERT INTO delphi_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
      [migration.version, migration.description],
    )

    applied++
  }

  return applied
}
