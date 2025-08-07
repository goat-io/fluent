# Agent Agreement System - Usage Guide

## Overview

The Delphi Agreement System provides a structured protocol for multi-agent consensus building. It uses a finite state machine to guide agents through a formal discussion process: `propose → critique → converge → commit`.

## Quick Start

### Basic Discussion

```typescript
import { DiscussionBuilder } from '@sodium/delphi/agreement'

// Simple code review discussion
const discussion = new DiscussionBuilder()
  .goal('Review the new authentication module for security issues')
  .expecting(
    'Security assessment report',
    'List of vulnerabilities found',
    'Recommended fixes'
  )
  .successWhen(
    'All critical vulnerabilities are identified',
    'Fixes are practical and implementable'
  )
  .withProposer({
    id: 'developer',
    expertise: ['authentication', 'nodejs']
  })
  .withReviewer({
    id: 'security-expert',
    expertise: ['security', 'owasp'],
    weight: 1.5 // Higher weight for security expert
  })
  .configure({
    maxTurns: 3,
    maxDurationMs: 60000, // 1 minute
    consensusThreshold: 0.7
  })

// Run the discussion
const result = await discussion.run()

if (result) {
  console.log('Consensus reached:', result.consensus.score)
  console.log('Final decision:', result.finalContent)
} else {
  console.log('Failed to reach consensus')
}
```

### Using Presets

```typescript
import { codeReviewDiscussion } from '@sodium/delphi/agreement/presets'

const discussion = codeReviewDiscussion()
  .goal('Review PR #123: Add user profile feature')
  .withConstraints(
    'Must maintain backwards compatibility',
    'Performance impact < 10ms',
    'Follow existing code style'
  )
  .expecting(
    'Approval or rejection decision',
    'List of required changes',
    'Performance impact assessment'
  )

const result = await discussion.run()
```

## Detailed Configuration

### 1. Discussion Context

Define what needs to be discussed and achieved:

```typescript
const discussion = new DiscussionBuilder()
  // Primary goal (required)
  .goal('Design a caching strategy for the API')
  
  // Constraints to respect (optional)
  .withConstraints(
    'Redis must be used as cache store',
    'Cache invalidation must be automatic',
    'Total memory usage < 512MB'
  )
  
  // Expected outputs (required)
  .expecting(
    'Cache key design pattern',
    'TTL strategy for different data types',
    'Invalidation triggers and rules',
    'Implementation plan'
  )
  
  // Success criteria (required)
  .successWhen(
    'Cache hit ratio > 80% is achievable',
    'Invalidation latency < 100ms',
    'No stale data scenarios identified'
  )
  
  // Additional context (optional)
  .withContext('current_load', '10K requests/second')
  .withContext('data_types', ['user_profiles', 'product_catalog', 'sessions'])
  
  // Examples to guide agents (optional)
  .withExample(
    'GET /users/123',
    'Cache key: user:123, TTL: 3600s',
    'User data changes infrequently'
  )
  
  // Domain specification
  .inDomain('architecture') // code, architecture, testing, review, design
```

### 2. Agent Configuration

Define the agents participating in the discussion:

```typescript
const discussion = new DiscussionBuilder()
  // Single proposer (required)
  .withProposer({
    id: 'solution-architect',
    expertise: ['caching', 'distributed-systems'],
    personality: 'creative', // analytical, creative, critical, supportive
    weight: 1.0,
    model: 'openai/gpt-4', // Optional: specific model
    systemPrompt: 'Custom instructions...' // Optional: override default
  })
  
  // Multiple reviewers (at least one required)
  .withReviewer({
    id: 'backend-engineer',
    expertise: ['implementation', 'redis'],
    personality: 'analytical',
    weight: 1.0
  })
  .withReviewer({
    id: 'performance-engineer',
    expertise: ['performance', 'monitoring'],
    personality: 'critical',
    weight: 1.2 // Higher weight = more influence
  })
  
  // Optional arbiter for tie-breaking
  .withArbiter({
    id: 'tech-lead',
    expertise: ['architecture', 'decision-making'],
    weight: 2.0 // Arbiter typically has higher weight
  })
  
  // Bulk reviewer creation
  .withReviewers(3, {
    expertise: ['general-development'],
    personality: 'supportive',
    weight: 0.8
  })
```

### 3. Discussion Parameters

Configure how the discussion proceeds:

```typescript
const discussion = new DiscussionBuilder()
  .configure({
    // Maximum discussion rounds (default: 5)
    maxTurns: 4,
    
    // Maximum wall-clock time in ms (default: 90000)
    maxDurationMs: 120000, // 2 minutes
    
    // Token budget per agent per turn (default: 2000)
    tokenBudgetPerTurn: 1500,
    
    // Minimum consensus score to commit (default: 0.66)
    consensusThreshold: 0.75,
    
    // Conflict resolution strategy
    conflictResolution: 'weighted', // majority, arbiter, weighted, unanimous
    
    // Enable parallel agent execution (default: true)
    parallelExecution: true,
    
    // Require agents to explain decisions (default: true)
    requireExplanation: true,
    
    // Allow dissenting opinions in final result (default: true)
    allowDissent: true
  })
  
  // Convenience methods
  .timeLimit(180000) // 3 minutes
  .maxTurns(5)
  .requireConsensus(0.8) // 80% agreement needed
```

### 4. LLM Configuration

Use specific LLM adapters:

```typescript
import { LLMAdapter } from '@sodium/delphi/llm'

const llmAdapter = new LLMAdapter({
  model: 'openai/gpt-4',
  small_model: 'openai/gpt-3.5-turbo',
  api_keys: {
    openai: process.env.OPENAI_API_KEY
  }
})

const discussion = new DiscussionBuilder()
  .withLLM(llmAdapter)
  // ... rest of configuration
```

## Advanced Usage

### Custom Agent Implementation

```typescript
import { Agent, AgentRole } from '@sodium/delphi/agreement'

class CustomAgent implements Agent {
  id = 'custom-agent'
  role = AgentRole.REVIEWER
  weight = 1.0
  
  async execute(prompt: string, context: any) {
    // Custom logic here
    const analysis = await this.analyzeProposal(prompt)
    
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      role: this.role,
      agentId: this.id,
      step: context.step,
      payload: {
        proposalId: context.proposal?.id,
        concerns: analysis.issues,
        overallAssessment: analysis.recommendation,
        confidence: analysis.confidence
      },
      tokenUsage: {
        prompt: 100,
        completion: 200,
        total: 300
      }
    }
  }
  
  private async analyzeProposal(prompt: string) {
    // Implementation
  }
}

// Use custom agent
const discussion = new DiscussionBuilder()
  .goal('...')
  .withProposer({...})

const customAgent = new CustomAgent()
const { context, agents, config } = discussion.build()
agents.push(customAgent)

const orchestrator = new AgreementOrchestrator(config, agents)
const result = await orchestrator.runAgreement('Initial proposal')
```

### Monitoring & Observability

```typescript
import { AgreementOrchestrator } from '@sodium/delphi/agreement'

const { context, agents, config } = discussion.build()
const orchestrator = new AgreementOrchestrator(config, agents, {
  enableTracing: true,
  blackboardPath: './agreement-history.db'
})

// Listen to events
orchestrator.on('stateChange', ({ from, to, context }) => {
  console.log(`State transition: ${from} → ${to}`)
  console.log(`Turn ${context.turnCount}/${context.config.maxTurns}`)
})

orchestrator.on('message', (message) => {
  console.log(`Agent ${message.agentId}: ${message.step}`)
  console.log(`Tokens used: ${message.tokenUsage?.total}`)
})

orchestrator.on('error', (error) => {
  console.error('Agreement error:', error)
})

const result = await orchestrator.runAgreement('Proposal')
```

### Querying Discussion History

```typescript
import { Blackboard } from '@sodium/delphi/agreement'

const blackboard = new Blackboard('./agreement-history.db')

// Get all facts from a session
const facts = await blackboard.getSessionFacts('session-id')

// Query specific facts
const proposals = await blackboard.queryFacts({
  type: 'proposal',
  agentId: 'solution-architect',
  since: new Date('2024-01-01')
})

// Get decision details
const decision = await blackboard.getDecision('decision-id')
console.log('Consensus method:', decision.consensusMethod)
console.log('Score:', decision.consensusScore)
console.log('Rationale:', decision.rationale)

// Get statistics
const stats = await blackboard.getStats('session-id')
console.log('Total facts:', stats.totalFacts)
console.log('Facts by type:', stats.factsByType)
```

## Common Patterns

### 1. Multi-Stage Discussion

```typescript
// Stage 1: High-level design
const designDiscussion = architectureDecisionDiscussion()
  .goal('Choose between microservices vs monolith')
  .expecting('Architecture decision', 'Justification')

const designResult = await designDiscussion.run()

// Stage 2: Implementation details
const implDiscussion = new DiscussionBuilder()
  .goal('Plan implementation based on chosen architecture')
  .withContext('architecture_decision', designResult)
  .expecting('Implementation plan', 'Timeline', 'Resource requirements')

const implResult = await implDiscussion.run()
```

### 2. Conditional Agents

```typescript
const discussion = new DiscussionBuilder()
  .goal('Review database changes')
  .withProposer({ id: 'developer' })
  .withReviewer({ id: 'dba' })

// Add security reviewer only if needed
if (involvesUserData) {
  discussion.withReviewer({
    id: 'security-reviewer',
    expertise: ['data-privacy', 'encryption'],
    weight: 1.5
  })
}
```

### 3. Dynamic Consensus Threshold

```typescript
const discussion = new DiscussionBuilder()
  .goal('Deploy to production')
  
// Higher threshold for production changes
const threshold = isProduction ? 0.9 : 0.66
discussion.requireConsensus(threshold)

// Shorter timeout for hotfixes
if (isHotfix) {
  discussion.timeLimit(30000) // 30 seconds
}
```

## Error Handling

```typescript
try {
  const result = await discussion.run()
  
  if (result) {
    // Success
    console.log('Consensus reached')
  } else {
    // Agreement aborted (timeout or max turns)
    console.log('Could not reach consensus')
    
    // Fallback to single agent or manual review
    const fallbackResult = await runFallbackAgent()
  }
} catch (error) {
  if (error.message.includes('Token budget exceeded')) {
    // Reduce complexity and retry
  } else if (error.message.includes('Circuit breaker')) {
    // Agent failure - wait and retry
  } else {
    // Other error
    console.error('Discussion failed:', error)
  }
}
```

## Best Practices

1. **Start with presets**: Use predefined configurations and customize as needed
2. **Set realistic timeouts**: Balance thoroughness with practical time constraints
3. **Weight experts appropriately**: Give domain experts higher weights
4. **Monitor token usage**: Track costs and adjust budgets accordingly
5. **Use examples**: Provide concrete examples to guide agent behavior
6. **Enable dissent**: Allow minority opinions to be recorded
7. **Implement fallbacks**: Have backup strategies when consensus fails
8. **Archive decisions**: Keep audit trail for compliance and learning
9. **Test with mocks**: Use mock agents for testing discussion flows
10. **Profile performance**: Monitor and optimize slow discussions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Consensus never reached | Lower threshold or increase max turns |
| Timeout too frequently | Increase time limit or reduce agent count |
| Token budget exceeded | Reduce prompt complexity or increase budget |
| Cyclical arguments | Check cycle detection threshold, add arbiter |
| Circuit breaker triggered | Check agent health, implement fallback |
| Poor quality decisions | Improve agent prompts, add examples |
| Inconsistent results | Use lower temperature, increase weight variance |