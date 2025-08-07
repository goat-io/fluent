/**
 * SQLite-based checkpoint storage for LangGraph state persistence
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { SqliteCheckpointer as LangGraphSqliteCheckpointer } from '@langchain/langgraph-checkpoint-sqlite'
import Database from 'better-sqlite3'

// SQLite configuration for optimal performance
const SQLITE_PRAGMAS = [
  'PRAGMA journal_mode = WAL', // Write-Ahead Logging for concurrency
  'PRAGMA synchronous = NORMAL', // Balanced durability vs performance
  'PRAGMA cache_size = -131072', // 128MB cache
  'PRAGMA mmap_size = 268435456', // 256MB memory mapping
  'PRAGMA temp_store = MEMORY', // In-memory temp tables
  'PRAGMA busy_timeout = 5000' // 5 second timeout for locks
]

export class SqliteCheckpointer extends LangGraphSqliteCheckpointer {
  private db: Database.Database | null = null

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Initialize parent with the database path
    super({ dbPath })

    // Apply pragmas for performance
    this.db = new Database(dbPath)
    for (const pragma of SQLITE_PRAGMAS) {
      this.db.exec(pragma)
    }
  }

  async close() {
    if (this.db) {
      this.db.close()
      this.db = null
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
      'Checkpointer not initialized. Call initializeMemory() first.'
    )
  }
  return checkpointerInstance
}

// Export for compatibility
export const checkpointer = {
  get() {
    return getCheckpointer()
  }
}
