// npx vitest run tests/blackboard-cleanup.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Blackboard, SessionCleanupConfig } from '../src/agreement/blackboard'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'

describe('Blackboard Session Cleanup', () => {
  const testDbPath = '.test-delphi/test-blackboard.db'
  let blackboard: Blackboard
  
  beforeEach(() => {
    // Clean up any existing test database
    const dir = path.dirname(testDbPath)
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })
  
  afterEach(() => {
    if (blackboard) {
      blackboard.close()
    }
    // Clean up test database
    const dir = path.dirname(testDbPath)
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })
  
  it('should initialize with cleanup configuration', () => {
    const cleanupConfig: SessionCleanupConfig = {
      enabled: true,
      retentionDays: 7,
      autoCleanupInterval: 60000 // 1 minute
    }
    
    blackboard = new Blackboard(testDbPath, cleanupConfig)
    expect(blackboard).toBeDefined()
  })
  
  it('should clean up old sessions', async () => {
    const cleanupConfig: SessionCleanupConfig = {
      enabled: true,
      retentionDays: 7
    }
    
    blackboard = new Blackboard(testDbPath, cleanupConfig)
    
    // Create some facts with different timestamps
    const oldSessionId = uuidv4()
    const newSessionId = uuidv4()
    
    // Add old fact (manually setting timestamp to 10 days ago)
    const oldFact = await blackboard.appendFact({
      sessionId: oldSessionId,
      agentId: 'test-agent-1',
      type: 'proposal',
      content: { text: 'Old proposal' },
      references: []
    })
    
    // Add new fact
    const newFact = await blackboard.appendFact({
      sessionId: newSessionId,
      agentId: 'test-agent-2',
      type: 'proposal',
      content: { text: 'New proposal' },
      references: []
    })
    
    // Manually update the old fact timestamp to 10 days ago
    // Note: This is a workaround for testing purposes
    const db = (blackboard as any).db
    db.prepare(`
      UPDATE facts 
      SET timestamp = datetime('now', '-10 days') 
      WHERE session_id = ?
    `).run(oldSessionId)
    
    // Verify both facts exist
    const beforeCleanup = await blackboard.queryFacts()
    expect(beforeCleanup.length).toBe(2)
    
    // Run cleanup with 7 days retention
    const result = await blackboard.cleanupOldSessions(7)
    
    expect(result.deletedFacts).toBe(1)
    expect(result.deletedSessions).toBe(1)
    
    // Verify only new fact remains
    const afterCleanup = await blackboard.queryFacts()
    expect(afterCleanup.length).toBe(1)
    expect(afterCleanup[0].sessionId).toBe(newSessionId)
  })
  
  it('should get active sessions within retention period', async () => {
    const cleanupConfig: SessionCleanupConfig = {
      enabled: true,
      retentionDays: 7
    }
    
    blackboard = new Blackboard(testDbPath, cleanupConfig)
    
    // Create multiple sessions
    const session1 = uuidv4()
    const session2 = uuidv4()
    const session3 = uuidv4()
    
    // Add facts to different sessions
    await blackboard.appendFact({
      sessionId: session1,
      agentId: 'agent-1',
      type: 'proposal',
      content: { text: 'Proposal 1' },
      references: []
    })
    
    await blackboard.appendFact({
      sessionId: session2,
      agentId: 'agent-2',
      type: 'evidence',
      content: { text: 'Evidence 1' },
      references: []
    })
    
    await blackboard.appendFact({
      sessionId: session2,
      agentId: 'agent-2',
      type: 'decision',
      content: { text: 'Decision 1' },
      references: []
    })
    
    await blackboard.appendFact({
      sessionId: session3,
      agentId: 'agent-3',
      type: 'concern',
      content: { text: 'Concern 1' },
      references: []
    })
    
    // Get active sessions
    const activeSessions = await blackboard.getActiveSessions(7)
    
    expect(activeSessions.length).toBe(3)
    
    // Find session2 which should have 2 facts
    const session2Info = activeSessions.find(s => s.sessionId === session2)
    expect(session2Info?.factCount).toBe(2)
  })
  
  it('should clean up specific session', async () => {
    const cleanupConfig: SessionCleanupConfig = {
      enabled: true,
      retentionDays: 7
    }
    
    blackboard = new Blackboard(testDbPath, cleanupConfig)
    
    const session1 = uuidv4()
    const session2 = uuidv4()
    
    // Add facts to both sessions
    await blackboard.appendFact({
      sessionId: session1,
      agentId: 'agent-1',
      type: 'proposal',
      content: { text: 'Proposal 1' },
      references: []
    })
    
    await blackboard.appendFact({
      sessionId: session2,
      agentId: 'agent-2',
      type: 'proposal',
      content: { text: 'Proposal 2' },
      references: []
    })
    
    // Add a decision for session1
    await blackboard.recordDecision(session1, {
      content: { approved: true },
      rationale: 'Test decision',
      consensusMethod: 'majority',
      consensusScore: 0.8,
      factIds: []
    })
    
    // Clean up only session1
    const result = await blackboard.cleanupSession(session1)
    
    expect(result.deletedFacts).toBe(1)
    expect(result.deletedDecisions).toBe(1)
    
    // Verify session2 still exists
    const remainingFacts = await blackboard.queryFacts()
    expect(remainingFacts.length).toBe(1)
    expect(remainingFacts[0].sessionId).toBe(session2)
  })
  
  it('should throw error when cleanup is not enabled', async () => {
    blackboard = new Blackboard(testDbPath) // No cleanup config
    
    await expect(blackboard.cleanupOldSessions()).rejects.toThrow(
      'Cleanup is not enabled. Enable it in constructor or provide retentionDays parameter.'
    )
  })
  
  it('should allow manual cleanup even when auto-cleanup is disabled', async () => {
    blackboard = new Blackboard(testDbPath) // No cleanup config
    
    const sessionId = uuidv4()
    
    await blackboard.appendFact({
      sessionId,
      agentId: 'agent-1',
      type: 'proposal',
      content: { text: 'Test proposal' },
      references: []
    })
    
    // Manually update timestamp to make it old
    const db = (blackboard as any).db
    db.prepare(`
      UPDATE facts 
      SET timestamp = datetime('now', '-10 days') 
      WHERE session_id = ?
    `).run(sessionId)
    
    // Manual cleanup with explicit retention days
    const result = await blackboard.cleanupOldSessions(7)
    
    expect(result.deletedFacts).toBe(1)
    expect(result.deletedSessions).toBe(1)
  })
  
  it('should handle auto-cleanup interval', async () => {
    const cleanupConfig: SessionCleanupConfig = {
      enabled: true,
      retentionDays: 7,
      autoCleanupInterval: 100 // 100ms for testing
    }
    
    blackboard = new Blackboard(testDbPath, cleanupConfig)
    
    // Create an old session
    const oldSessionId = uuidv4()
    await blackboard.appendFact({
      sessionId: oldSessionId,
      agentId: 'test-agent',
      type: 'proposal',
      content: { text: 'Old proposal' },
      references: []
    })
    
    // Manually make it old
    const db = (blackboard as any).db
    db.prepare(`
      UPDATE facts 
      SET timestamp = datetime('now', '-10 days') 
      WHERE session_id = ?
    `).run(oldSessionId)
    
    // Wait for auto-cleanup to trigger
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Verify the old session was cleaned up
    const facts = await blackboard.queryFacts()
    expect(facts.length).toBe(0)
  })
})