// Shared Kysely database for all engine integration tests
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import type { Database } from '../../entities/Database.js'
import { CREATE_TABLES_SQL } from '../../entities/Database.js'

interface GlobalTestData {
  redis: { host: string; port: number }
  postgres: { host: string; port: number; database: string; username: string; password: string }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'))
}

let sharedDb: Kysely<Database> | null = null
let initPromise: Promise<Kysely<Database>> | null = null
let refCount = 0

export async function getSharedDb(): Promise<Kysely<Database>> {
  refCount++
  if (sharedDb) return sharedDb

  if (!initPromise) {
    initPromise = (async () => {
      const data = getGlobalData()
      const db = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({
            host: data.postgres.host,
            port: data.postgres.port,
            database: data.postgres.database,
            user: data.postgres.username,
            password: data.postgres.password,
            max: 10,
          }),
        }),
      })

      // Create tables
      const statements = CREATE_TABLES_SQL.split(';').map(s => s.trim()).filter(Boolean)
      for (const stmt of statements) {
        await sql.raw(stmt).execute(db)
      }

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

export async function truncateAll(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE workflow_event_subscriptions, workflow_events, workflow_step_logs, workflow_signals, workflow_steps, workflow_runs CASCADE`.execute(db)
}
