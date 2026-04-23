// Shared DbClient database for all engine integration tests
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import type { DbClient } from '../../db/DbClient.js'
import { createDbClient } from '../../db/DbClient.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { wrapTestDb } from '../../db/TestQueryBuilder.js'
import { CREATE_TABLES_SQL } from '../../entities/Database.js'
import { runMigrations } from '../../migrations/runner.js'

interface GlobalTestData {
  redis: { host: string; port: number }
  postgres: {
    host: string
    port: number
    database: string
    username: string
    password: string
  }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  )
}

let sharedDb: TestDb | null = null
let initPromise: Promise<TestDb> | null = null
let refCount = 0

export async function getSharedDb(): Promise<TestDb> {
  refCount++
  if (sharedDb) {
    return sharedDb
  }

  if (!initPromise) {
    initPromise = (async () => {
      const data = getGlobalData()
      const pool = new pg.Pool({
        host: data.postgres.host,
        port: data.postgres.port,
        database: data.postgres.database,
        user: data.postgres.username,
        password: data.postgres.password,
        max: 10,
      })
      const raw = createDbClient(pool)
      const db = wrapTestDb(raw)

      // Create tables
      const statements = CREATE_TABLES_SQL.split(';')
        .map(s => s.trim())
        .filter(Boolean)
      for (const stmt of statements) {
        await db.query(stmt)
      }

      // Run migrations (indexes, FK constraints, stored functions)
      await runMigrations(db)

      sharedDb = db
      return db
    })()
  }

  return initPromise
}

export async function releaseSharedDb(): Promise<void> {
  refCount--
  if (refCount <= 0 && sharedDb) {
    await sharedDb.destroy()
    sharedDb = null
    initPromise = null
  }
}

export async function truncateAll(db: DbClient): Promise<void> {
  await db.query(
    'TRUNCATE TABLE agent_tokens, workflow_schedules, workflow_tasks, workflow_event_subscriptions, workflow_events, workflow_step_logs, workflow_signals, workflow_streams, workflow_steps, workflow_runs CASCADE',
  )
}
