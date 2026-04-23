// Thin typed wrapper around pg.Pool that replaces Kysely<Database>.
// npx vitest run src/__tests__/engine/lifecycle.spec.ts

import type { Pool, PoolClient, QueryResult } from 'pg'

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>
  /** Get the underlying pg.Pool for COPY FROM, LISTEN, etc. */
  getPool(): Pool
  /** Wrap multiple operations in a transaction */
  transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>
  /** Shutdown the pool */
  destroy(): Promise<void>
}

export function createDbClient(pool: Pool): DbClient {
  return {
    query: <T = any>(text: string, params?: any[]) =>
      pool.query<T>(text, params),
    getPool: () => pool,
    transaction: async <T>(
      fn: (client: PoolClient) => Promise<T>,
    ): Promise<T> => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(client)
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },
    destroy: () => pool.end(),
  }
}

/**
 * Accept a connection string or config object to create a pg.Pool.
 * Lazy-requires 'pg' so the module stays dependency-free at import time.
 */
export function createPool(
  config:
    | string
    | {
        host: string
        port: number
        database: string
        user: string
        password: string
        max?: number
      },
): Pool {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pg = require('pg')
  if (typeof config === 'string') {
    return new pg.Pool({ connectionString: config, max: 10 })
  }
  return new pg.Pool({ ...config, max: config.max ?? 10 })
}
