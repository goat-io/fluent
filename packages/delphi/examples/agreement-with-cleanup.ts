#!/usr/bin/env npx tsx
// npx tsx examples/agreement-with-cleanup.ts

/**
 * Example showing how to use session cleanup configuration
 * to prevent memory leaks in long-running processes
 */

import { v4 as uuidv4 } from 'uuid'
import { AgreementOrchestrator, Agent } from '../src/agreement/orchestrator'
import { SessionCleanupConfig } from '../src/agreement/blackboard'
import { AgreementSessionConfig } from '../src/agreement/protocol'
import pino from 'pino'

const logger = pino({
  name: 'agreement-cleanup-example',
  level: process.env.LOG_LEVEL || 'info'
})

// Mock agent for demonstration
function createMockAgent(id: string, role: 'proposer' | 'critic' | 'arbiter'): Agent {
  return {
    id,
    role,
    weight: 1.0,
    execute: async (prompt: string, context: any) => {
      // Simulate agent thinking
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const responses = {
        proposer: {
          type: 'proposal' as const,
          agentId: id,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
          payload: {
            proposal: `Here's my proposal for ${context.goal}`,
            confidence: 0.85,
            rationale: 'Based on analysis'
          }
        },
        critic: {
          type: 'vote' as const,
          agentId: id,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
          payload: {
            vote: 'approve' as const,
            confidence: 0.9,
            rationale: 'Looks good to me'
          }
        },
        arbiter: {
          type: 'commit' as const,
          agentId: id,
          sessionId: context.sessionId,
          timestamp: new Date().toISOString(),
          payload: {
            decision: 'approved',
            finalRationale: 'Consensus reached',
            dissent: []
          }
        }
      }
      
      return responses[role]
    }
  }
}

async function runWithCleanup() {
  const log = logger.child({ example: 'cleanup' })
  
  // Configure session cleanup
  const cleanupConfig: SessionCleanupConfig = {
    enabled: true,
    retentionDays: 7,  // Keep sessions for 7 days
    autoCleanupInterval: 1000 * 60 * 60  // Run cleanup every hour
  }
  
  // Session configuration
  const sessionConfig: AgreementSessionConfig = {
    sessionId: uuidv4(),
    maxTurns: 5,
    consensusThreshold: 0.66,
    timeoutMs: 30000,
    enableLogging: true
  }
  
  // Create agents
  const agents = [
    createMockAgent('proposer-1', 'proposer'),
    createMockAgent('critic-1', 'critic'),
    createMockAgent('arbiter-1', 'arbiter')
  ]
  
  // Create orchestrator with cleanup configuration
  const orchestrator = new AgreementOrchestrator(
    sessionConfig,
    agents,
    {
      blackboardPath: '.delphi/example-blackboard.db',
      sessionCleanupConfig: cleanupConfig,
      enableTracing: true
    }
  )
  
  try {
    log.info('Starting agreement session with cleanup enabled')
    
    // Run agreement
    const goal = 'Implement user authentication with OAuth2, JWT tokens, and Role-based access'
    const result = await orchestrator.runAgreement(goal)
    
    log.info({ result }, 'Agreement completed')
    
    // Get blackboard stats before cleanup
    const blackboard = (orchestrator as any).blackboard
    const statsBefore = await blackboard.getStats()
    log.info({ stats: statsBefore }, 'Blackboard stats before cleanup')
    
    // Simulate old sessions by manually creating them
    log.info('Creating old test sessions...')
    for (let i = 0; i < 3; i++) {
      const oldSessionId = uuidv4()
      await blackboard.appendFact({
        sessionId: oldSessionId,
        agentId: 'test-agent',
        type: 'proposal',
        content: { test: true },
        references: []
      })
    }
    
    // Manually mark them as old (for demonstration)
    const db = (blackboard as any).db
    db.prepare(`
      UPDATE facts 
      SET timestamp = datetime('now', '-10 days') 
      WHERE content LIKE '%"test":true%'
    `).run()
    
    // Get active sessions (within 7 days)
    const activeSessions = await blackboard.getActiveSessions(7)
    log.info({ 
      activeCount: activeSessions.length,
      sessions: activeSessions 
    }, 'Active sessions within retention period')
    
    // Manually trigger cleanup
    log.info('Triggering manual cleanup...')
    const cleanupResult = await blackboard.cleanupOldSessions()
    log.info({ 
      deletedSessions: cleanupResult.deletedSessions,
      deletedFacts: cleanupResult.deletedFacts,
      deletedDecisions: cleanupResult.deletedDecisions
    }, 'Cleanup completed')
    
    // Get stats after cleanup
    const statsAfter = await blackboard.getStats()
    log.info({ stats: statsAfter }, 'Blackboard stats after cleanup')
    
    // Clean up specific session example
    if (activeSessions.length > 0) {
      const sessionToClean = activeSessions[0].sessionId
      log.info({ sessionId: sessionToClean }, 'Cleaning up specific session')
      
      const specificCleanup = await blackboard.cleanupSession(sessionToClean)
      log.info({ 
        deletedFacts: specificCleanup.deletedFacts,
        deletedDecisions: specificCleanup.deletedDecisions
      }, 'Specific session cleaned up')
    }
    
  } catch (error) {
    log.error({ error }, 'Agreement failed')
    throw error
  } finally {
    // Always close the orchestrator to clean up resources
    await orchestrator.close()
    log.info('Orchestrator closed and resources cleaned up')
  }
}

// Run the example
if (require.main === module) {
  runWithCleanup().catch(console.error)
}