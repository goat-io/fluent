/**
 * SQLite memory helper for LangGraph state persistence.
 * Provides crash-safe checkpointing and resume capabilities.
 */

import fs from 'node:fs'
import path from 'node:path'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import Database from 'better-sqlite3'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Get database path from environment or use default
const dbPath =
  process.env.SQLITE_DB_PATH ||
  path.join(process.cwd(), '.delphi', 'checkpoints.db')

// Create directory if it doesn't exist
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Create optimized SQLite database instance
function createOptimizedDatabase(): Database.Database {
  const db = new Database(dbPath, {
    // Use read-write mode with create if not exists
    readonly: false,
    fileMustExist: false,
    // Enable verbose mode for debugging (can be disabled in production)
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  })

  // Apply performance optimizations
  try {
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL')

    // Set page size (4KB is good for most workloads, use 16-32KB for SSDs)
    db.pragma('page_size = 4096')

    // Set cache size to 128MB (negative value = KB)
    db.pragma('cache_size = -131072')

    // Enable memory mapping for faster reads (256MB)
    db.pragma('mmap_size = 268435456')

    // Use NORMAL synchronous mode (faster than FULL, still safe with WAL)
    db.pragma('synchronous = NORMAL')

    // Store temporary tables in memory
    db.pragma('temp_store = MEMORY')

    // Increase busy timeout to handle concurrent access better
    db.pragma('busy_timeout = 5000')

    // Enable foreign keys for data integrity
    db.pragma('foreign_keys = ON')

    // Run optimize to update query planner statistics
    db.pragma('optimize')

    console.log('🚀 SQLite optimizations applied successfully')
  } catch (error) {
    console.error('⚠️ Failed to apply some SQLite optimizations:', error)
  }

  return db
}

// Create SQLite checkpointer instance with optimized database
const db = createOptimizedDatabase()
export const checkpointer = new SqliteSaver(db)

// Initialize checkpointer
export async function initializeMemory(): Promise<void> {
  try {
    // SqliteSaver initializes automatically on first use
    console.log('🧠 Memory system initialized with optimized SQLite')
    console.log(`📁 Database path: ${dbPath}`)

    // Run ANALYZE to help query planner
    try {
      db.exec('ANALYZE')
    } catch (_e) {
      // ANALYZE might fail on empty database, which is fine
    }
  } catch (error) {
    console.error('❌ Failed to initialize memory system:', error)
    throw error
  }
}

// Utility to clean up old checkpoints
export async function cleanupOldCheckpoints(
  daysToKeep: number = 7
): Promise<void> {
  try {
    // Note: This is a placeholder - would need direct SQL access to checkpoints table
    // The actual implementation would depend on the SqliteSaver schema
    console.log(
      `🧹 Cleanup of checkpoints older than ${daysToKeep} days would be performed here`
    )

    // Run VACUUM to reclaim space (should be done periodically)
    if (Math.random() < 0.1) {
      // 10% chance to run VACUUM
      console.log('🔧 Running VACUUM to reclaim space...')
      db.exec('VACUUM')
    }
  } catch (error) {
    console.error('❌ Failed to cleanup old checkpoints:', error)
  }
}

// For testing purposes - provide a way to clean up the database
export async function cleanupDatabase(): Promise<void> {
  try {
    // Close the database connection properly
    db.close()
    console.log('🧹 Database connection closed')
  } catch (error) {
    console.error('❌ Failed to cleanup database:', error)
  }
}

// Periodic maintenance function
export async function performMaintenance(): Promise<void> {
  try {
    // Checkpoint the WAL to avoid it growing too large
    db.pragma('wal_checkpoint(TRUNCATE)')

    // Update statistics
    db.exec('ANALYZE')

    // Optimize query planner
    db.pragma('optimize')

    console.log('🔧 Database maintenance completed')
  } catch (error) {
    console.error('❌ Failed to perform maintenance:', error)
  }
}

// Export database instance for advanced usage
export { db }
