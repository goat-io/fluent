/**
 * SQLite-based checkpoint storage for LangGraph state persistence
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import Database from 'better-sqlite3'

// SQLite configuration for optimal performance
const SQLITE_PRAGMAS = [
  'PRAGMA journal_mode = WAL', // Write-Ahead Logging for concurrency
  'PRAGMA synchronous = NORMAL', // Balanced durability vs performance
  'PRAGMA cache_size = -131072', // 128MB cache
  'PRAGMA mmap_size = 268435456', // 256MB memory mapping
  'PRAGMA temp_store = MEMORY', // In-memory temp tables
  'PRAGMA busy_timeout = 5000', // 5 second timeout for locks
]

export class SqliteCheckpointer extends SqliteSaver {
  private _db: Database.Database | null = null

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create database instance
    const db = new Database(dbPath)

    // Initialize parent with the database instance
    super({ db } as any)

    this._db = db
    for (const pragma of SQLITE_PRAGMAS) {
      this._db.exec(pragma)
    }
  }

  async close() {
    if (this._db) {
      this._db.close()
      this._db = null
    }
  }
}

// Global checkpointer instance
let checkpointerInstance: SqliteCheckpointer | null = null

/**
 * Initialize the checkpoint storage system
 */
export async function initializeMemory(): Promise<void> {
  if (!checkpointerInstance) {
    const dbPath = process.env.SQLITE_DB_PATH || '.delphi/checkpoints.db'
    checkpointerInstance = new SqliteCheckpointer(dbPath)
  }
}

/**
 * Get the checkpointer instance
 */
export function getCheckpointer(): SqliteCheckpointer {
  if (!checkpointerInstance) {
    throw new Error(
      'Checkpointer not initialized. Call initializeMemory() first.',
    )
  }
  return checkpointerInstance
}

// Export for compatibility
export const checkpointer = {
  get() {
    return getCheckpointer()
  },
}

// Additional exports for compatibility
export async function cleanupOldCheckpoints(retentionDays = 7): Promise<void> {
  // Placeholder for checkpoint cleanup
  console.log(`Cleaning checkpoints older than ${retentionDays} days`)
}

export async function cleanupDatabase(): Promise<void> {
  // Placeholder for database cleanup
  if (checkpointerInstance) {
    // Close existing connection if needed
  }
}

export async function performMaintenance(): Promise<void> {
  // Placeholder for maintenance
  await cleanupOldCheckpoints()
}
