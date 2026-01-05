/**
 * Blackboard Storage for Shared Facts
 * Append-only immutable storage for agent collaboration
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

// Fact schema
export const FactSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(() => uuidv4()),
  sessionId: z.string().uuid(),
  agentId: z.string(),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  type: z.enum(['proposal', 'concern', 'evidence', 'decision', 'metric']),
  content: z.unknown(),
  references: z.array(z.string().uuid()).default([]),
  immutable: z.literal(true).default(true),
  hash: z.string().optional(),
})

export type Fact = z.infer<typeof FactSchema>

export interface BlackboardQuery {
  sessionId?: string
  agentId?: string
  type?: Fact['type']
  since?: Date
  limit?: number
}

export interface SessionCleanupConfig {
  enabled: boolean
  retentionDays: number
  autoCleanupInterval?: number // in milliseconds
}

export class Blackboard {
  private db: Database.Database
  private cleanupTimer?: NodeJS.Timeout
  private cleanupConfig?: SessionCleanupConfig
  private statements: {
    insertFact: Database.Statement
    getFact: Database.Statement
    queryFacts: Database.Statement
    getSession: Database.Statement
    cleanupOldSessions?: Database.Statement
    getSessionCount?: Database.Statement
  }

  constructor(
    dbPath: string = '.delphi/blackboard.db',
    cleanupConfig?: SessionCleanupConfig,
  ) {
    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.cleanupConfig = cleanupConfig
    this.initializeDatabase()
    this.prepareStatements()

    // Setup auto-cleanup if configured
    if (cleanupConfig?.enabled && cleanupConfig.autoCleanupInterval) {
      this.setupAutoCleanup(cleanupConfig.autoCleanupInterval)
    }
  }

  private initializeDatabase() {
    // Create facts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        fact_references TEXT NOT NULL,
        hash TEXT NOT NULL,
        UNIQUE(hash)
      )
    `)

    // Create indices
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_facts_session ON facts(session_id);
      CREATE INDEX IF NOT EXISTS idx_facts_agent ON facts(agent_id);
      CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(type);
      CREATE INDEX IF NOT EXISTS idx_facts_timestamp ON facts(timestamp);
    `)

    // Create decisions table for audit trail
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        decision_id TEXT NOT NULL UNIQUE,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        rationale TEXT NOT NULL,
        consensus_method TEXT NOT NULL,
        consensus_score REAL NOT NULL,
        fact_ids TEXT NOT NULL
      )
    `)

    // Apply performance pragmas
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
      PRAGMA busy_timeout = 5000;
    `)
  }

  private prepareStatements() {
    this.statements = {
      insertFact: this.db.prepare(`
        INSERT INTO facts (id, session_id, agent_id, timestamp, type, content, fact_references, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getFact: this.db.prepare(`
        SELECT * FROM facts WHERE id = ?
      `),

      queryFacts: this.db.prepare(`
        SELECT * FROM facts 
        WHERE 1=1
          AND (? IS NULL OR session_id = ?)
          AND (? IS NULL OR agent_id = ?)
          AND (? IS NULL OR type = ?)
          AND (? IS NULL OR timestamp >= ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `),

      getSession: this.db.prepare(`
        SELECT * FROM facts 
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `),
    }

    // Add cleanup statements if cleanup is enabled
    if (this.cleanupConfig?.enabled) {
      this.statements.cleanupOldSessions = this.db.prepare(`
        DELETE FROM facts 
        WHERE session_id IN (
          SELECT DISTINCT session_id 
          FROM facts 
          WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
        )
      `)

      this.statements.getSessionCount = this.db.prepare(`
        SELECT COUNT(DISTINCT session_id) as count FROM facts
      `)
    }
  }

  /**
   * Append a fact to the blackboard (immutable)
   */
  async appendFact(
    fact: Omit<Fact, 'id' | 'timestamp' | 'hash' | 'immutable'>,
  ): Promise<Fact> {
    const validatedFact = FactSchema.parse({
      ...fact,
      immutable: true,
    })

    // Calculate content hash for deduplication
    const contentStr = JSON.stringify({
      sessionId: validatedFact.sessionId,
      agentId: validatedFact.agentId,
      type: validatedFact.type,
      content: validatedFact.content,
    })

    const hash = await this.calculateHash(contentStr)
    validatedFact.hash = hash

    try {
      this.statements.insertFact.run(
        validatedFact.id,
        validatedFact.sessionId,
        validatedFact.agentId,
        validatedFact.timestamp,
        validatedFact.type,
        JSON.stringify(validatedFact.content),
        JSON.stringify(validatedFact.references),
        hash,
      )

      return validatedFact
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Fact already exists (same hash), return existing
        const existing = this.db
          .prepare('SELECT * FROM facts WHERE hash = ?')
          .get(hash) as any
        return this.deserializeFact(existing)
      }
      throw error
    }
  }

  /**
   * Query facts from the blackboard
   */
  async queryFacts(query: BlackboardQuery = {}): Promise<Fact[]> {
    const sessionId = query.sessionId || null
    const agentId = query.agentId || null
    const type = query.type || null
    const since = query.since?.toISOString() || null
    const limit = query.limit || 100

    const results = this.statements.queryFacts.all(
      sessionId,
      sessionId, // Pass twice for NULL check and comparison
      agentId,
      agentId,
      type,
      type,
      since,
      since,
      limit,
    ) as any[]

    return results.map(row => this.deserializeFact(row))
  }

  /**
   * Get all facts for a session
   */
  async getSessionFacts(sessionId: string): Promise<Fact[]> {
    const results = this.statements.getSession.all(sessionId) as any[]
    return results.map(row => this.deserializeFact(row))
  }

  /**
   * Record a decision with audit trail
   */
  async recordDecision(
    sessionId: string,
    decision: {
      content: unknown
      rationale: string
      consensusMethod: string
      consensusScore: number
      factIds: string[]
    },
  ): Promise<string> {
    const decisionId = uuidv4()

    this.db
      .prepare(`
      INSERT INTO decisions (id, session_id, decision_id, timestamp, content, rationale, consensus_method, consensus_score, fact_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        uuidv4(),
        sessionId,
        decisionId,
        new Date().toISOString(),
        JSON.stringify(decision.content),
        decision.rationale,
        decision.consensusMethod,
        decision.consensusScore,
        JSON.stringify(decision.factIds),
      )

    return decisionId
  }

  /**
   * Get decision by ID
   */
  async getDecision(decisionId: string): Promise<any> {
    const row = this.db
      .prepare('SELECT * FROM decisions WHERE decision_id = ?')
      .get(decisionId) as any

    if (!row) {
      return null
    }

    return {
      id: row.decision_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      content: JSON.parse(row.content),
      rationale: row.rationale,
      consensusMethod: row.consensus_method,
      consensusScore: row.consensus_score,
      factIds: JSON.parse(row.fact_ids),
    }
  }

  private deserializeFact(row: any): Fact {
    return {
      id: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      timestamp: row.timestamp,
      type: row.type,
      content: JSON.parse(row.content),
      references: JSON.parse(row.fact_references),
      immutable: true,
      hash: row.hash,
    }
  }

  private async calculateHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(sessionId?: string): Promise<{
    totalFacts: number
    factsByType: Record<string, number>
    factsByAgent: Record<string, number>
    decisionsCount: number
  }> {
    const baseQuery = sessionId
      ? 'FROM facts WHERE session_id = ?'
      : 'FROM facts'

    const totalFacts = this.db
      .prepare(`SELECT COUNT(*) as count ${baseQuery}`)
      .get(sessionId) as any

    const factsByType = this.db
      .prepare(`
      SELECT type, COUNT(*) as count 
      ${baseQuery}
      GROUP BY type
    `)
      .all(sessionId) as any[]

    const factsByAgent = this.db
      .prepare(`
      SELECT agent_id, COUNT(*) as count 
      ${baseQuery}
      GROUP BY agent_id
    `)
      .all(sessionId) as any[]

    const decisionsCount = this.db
      .prepare(
        sessionId
          ? 'SELECT COUNT(*) as count FROM decisions WHERE session_id = ?'
          : 'SELECT COUNT(*) as count FROM decisions',
      )
      .get(sessionId) as any

    return {
      totalFacts: totalFacts.count,
      factsByType: Object.fromEntries(factsByType.map(r => [r.type, r.count])),
      factsByAgent: Object.fromEntries(
        factsByAgent.map(r => [r.agent_id, r.count]),
      ),
      decisionsCount: decisionsCount.count,
    }
  }

  /**
   * Setup automatic cleanup interval
   */
  private setupAutoCleanup(intervalMs: number) {
    this.cleanupTimer = setInterval(async () => {
      try {
        const result = await this.cleanupOldSessions()
        if (result.deletedSessions > 0) {
          console.log(
            `[Blackboard] Auto-cleanup: Removed ${result.deletedSessions} old sessions`,
          )
        }
      } catch (error) {
        console.error('[Blackboard] Auto-cleanup error:', error)
      }
    }, intervalMs)
  }

  /**
   * Clean up old sessions based on retention policy
   */
  async cleanupOldSessions(retentionDays?: number): Promise<{
    deletedSessions: number
    deletedFacts: number
    deletedDecisions: number
  }> {
    if (!this.cleanupConfig?.enabled && !retentionDays) {
      throw new Error(
        'Cleanup is not enabled. Enable it in constructor or provide retentionDays parameter.',
      )
    }

    const days = retentionDays || this.cleanupConfig?.retentionDays || 7

    // Get count of sessions before cleanup
    const beforeCount = this.db
      .prepare(`
      SELECT COUNT(DISTINCT session_id) as count 
      FROM facts 
      WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
    `)
      .get(days) as any

    // Get count of facts before cleanup
    const beforeFactsCount = this.db
      .prepare(`
      SELECT COUNT(*) as count 
      FROM facts 
      WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
    `)
      .get(days) as any

    // Get count of decisions before cleanup
    const beforeDecisionsCount = this.db
      .prepare(`
      SELECT COUNT(*) as count 
      FROM decisions 
      WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
    `)
      .get(days) as any

    // Run cleanup in a transaction
    const transaction = this.db.transaction(() => {
      // Delete old facts
      this.db
        .prepare(`
        DELETE FROM facts 
        WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
      `)
        .run(days)

      // Delete old decisions
      this.db
        .prepare(`
        DELETE FROM decisions 
        WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
      `)
        .run(days)
    })

    transaction()

    // Run VACUUM to reclaim space (optional, can be slow)
    // this.db.exec('VACUUM')

    return {
      deletedSessions: beforeCount.count || 0,
      deletedFacts: beforeFactsCount.count || 0,
      deletedDecisions: beforeDecisionsCount.count || 0,
    }
  }

  /**
   * Get active sessions within retention period
   */
  async getActiveSessions(withinDays: number = 7): Promise<
    {
      sessionId: string
      lastActivity: string
      factCount: number
    }[]
  > {
    const sessions = this.db
      .prepare(`
      SELECT 
        session_id,
        MAX(timestamp) as last_activity,
        COUNT(*) as fact_count
      FROM facts
      WHERE datetime(timestamp) >= datetime('now', '-' || ? || ' days')
      GROUP BY session_id
      ORDER BY last_activity DESC
    `)
      .all(withinDays) as any[]

    return sessions.map(s => ({
      sessionId: s.session_id,
      lastActivity: s.last_activity,
      factCount: s.fact_count,
    }))
  }

  /**
   * Clean up a specific session
   */
  async cleanupSession(sessionId: string): Promise<{
    deletedFacts: number
    deletedDecisions: number
  }> {
    const transaction = this.db.transaction(() => {
      const factsResult = this.db
        .prepare('DELETE FROM facts WHERE session_id = ?')
        .run(sessionId)
      const decisionsResult = this.db
        .prepare('DELETE FROM decisions WHERE session_id = ?')
        .run(sessionId)

      return {
        deletedFacts: factsResult.changes,
        deletedDecisions: decisionsResult.changes,
      }
    })

    return transaction()
  }

  close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.db.close()
  }
}
