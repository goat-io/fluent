#!/usr/bin/env tsx
// npx tsx examples/integrated-model-config.ts

/**
 * Integrated Model Configuration Example
 * Shows how to configure models directly within agent definitions
 */

import { DiscussionBuilder } from '../src/agreement/discussion-builder'
import { ModelConfig } from '../src/agreement/model-config'
import pino from 'pino'

const logger = pino({
  name: 'integrated-model-example',
  level: process.env.LOG_LEVEL || 'info'
})

/**
 * Example 1: Simple string-based model selection
 */
async function simpleModelSelection() {
  const log = logger.child({ example: 'simple' })
  
  const discussion = new DiscussionBuilder()
    .goal('Design a REST API for a blog platform')
    
    // Simply specify the model as a string - uses preset configurations
    .withProposer({
      id: 'api-designer',
      model: 'claude-opus-4.1',  // Just use the model name
      expertise: ['api-design', 'rest'],
      personality: 'creative',
      weight: 1.0
    })
    .withReviewer({
      id: 'backend-dev',
      model: 'gpt-4o',  // Different model for different perspective
      expertise: ['backend', 'implementation'],
      personality: 'analytical',
      weight: 1.0
    })
    .withReviewer({
      id: 'frontend-dev',
      model: 'gemini-pro',  // Another model for diversity
      expertise: ['frontend', 'api-consumption'],
      personality: 'critical',
      weight: 1.0
    })
    .withArbiter({
      id: 'tech-lead',
      model: 'o3',  // Best model for final decisions
      expertise: ['architecture', 'best-practices'],
      weight: 1.5
    })
    
    .configure({
      maxTurns: 3,
      maxDurationMs: 90000,
      consensusThreshold: 0.7
    })
  
  log.info('Starting discussion with simple model selection')
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      consensusScore: result.consensus.score,
      duration: result.duration
    }, 'Discussion completed')
  }
  
  return result
}

/**
 * Example 2: Custom model configuration with parameters
 */
async function customModelConfiguration() {
  const log = logger.child({ example: 'custom' })
  
  const discussion = new DiscussionBuilder()
    .goal('Brainstorm innovative features for a fitness app')
    
    .withProposer({
      id: 'product-manager',
      // Custom model configuration with specific parameters
      model: {
        provider: 'anthropic',
        model: 'claude-opus-4-1-20250805',
        temperature: 0.9,  // Higher for creativity
        maxTokens: 4096,
        topP: 0.95
      } as ModelConfig,
      expertise: ['product', 'innovation'],
      personality: 'creative',
      weight: 1.0
    })
    .withReviewer({
      id: 'ux-designer',
      // Mix of preset and custom config
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.8,  // Balanced creativity
        maxTokens: 3000
      } as ModelConfig,
      expertise: ['user-experience', 'design'],
      personality: 'creative',
      weight: 1.0
    })
    .withReviewer({
      id: 'engineer',
      // Use a preset for technical feasibility
      model: 'gemini-pro',
      expertise: ['technical-feasibility', 'implementation'],
      personality: 'analytical',
      weight: 1.0,
      systemPrompt: 'Focus on technical feasibility and implementation complexity'
    })
    .withArbiter({
      id: 'product-director',
      // More deterministic for decision making
      model: {
        provider: 'openai',
        model: 'o3',
        temperature: 0.5,  // Lower temperature for decisions
        maxTokens: 2048
      } as ModelConfig,
      expertise: ['strategy', 'market-fit'],
      weight: 1.5
    })
    
    .configure({
      maxTurns: 4,
      maxDurationMs: 120000,
      consensusThreshold: 0.7,
      requireExplanation: true
    })
  
  log.info('Starting discussion with custom model configurations')
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      consensusScore: result.consensus.score,
      duration: result.duration,
      iterations: result.iterations
    }, 'Discussion completed')
  }
  
  return result
}

/**
 * Example 3: Mixed approach - strategy + individual overrides
 */
async function mixedApproach() {
  const log = logger.child({ example: 'mixed' })
  
  const discussion = new DiscussionBuilder()
    .goal('Review and improve authentication system')
    
    // Start with a strategy for baseline configuration
    .useStrategy('code-review')
    
    // Then add agents with specific model overrides where needed
    .withProposer({
      id: 'auth-expert',
      // Override the strategy's proposer model
      model: 'claude-opus-4.1',  // Use best model for auth expertise
      expertise: ['authentication', 'security', 'oauth2'],
      personality: 'analytical',
      weight: 1.0
    })
    .withReviewer({
      id: 'security-auditor',
      // Keep strategy's model (will use strategy mapping)
      expertise: ['security', 'vulnerabilities'],
      personality: 'critical',
      weight: 1.2,
      systemPrompt: 'Focus on security vulnerabilities and attack vectors'
    })
    .withReviewer({
      id: 'performance-reviewer',
      // Override with a faster model for performance review
      model: 'gemini-flash',  // Fast model for quick analysis
      expertise: ['performance', 'optimization'],
      personality: 'analytical',
      weight: 0.9
    })
    .withArbiter({
      id: 'security-lead',
      model: 'o3',  // Always use best for security decisions
      expertise: ['security-architecture'],
      weight: 1.5
    })
    
    .configure({
      maxTurns: 4,
      maxDurationMs: 150000,
      consensusThreshold: 0.8  // High threshold for security
    })
  
  log.info('Starting discussion with mixed approach')
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      strategy: 'code-review with overrides',
      consensusScore: result.consensus.score,
      duration: result.duration
    }, 'Discussion completed')
  }
  
  return result
}

/**
 * Example 4: Cost-optimized configuration
 */
async function costOptimizedConfiguration() {
  const log = logger.child({ example: 'cost-optimized' })
  
  const discussion = new DiscussionBuilder()
    .goal('Choose a color scheme for the new dashboard')
    
    // Use cheaper models for simple decisions
    .withProposer({
      id: 'designer',
      model: 'claude-3-haiku',  // Cheapest Claude model
      expertise: ['design', 'color-theory'],
      personality: 'creative',
      weight: 1.0
    })
    .withReviewer({
      id: 'ux-reviewer',
      model: 'gpt-3.5-turbo',  // Cheap but effective
      expertise: ['user-experience'],
      personality: 'analytical',
      weight: 1.0
    })
    .withReviewer({
      id: 'accessibility-reviewer',
      model: 'gemini-flash',  // Fast and cheap
      expertise: ['accessibility', 'wcag'],
      personality: 'critical',
      weight: 1.1,
      systemPrompt: 'Focus on color contrast and accessibility standards'
    })
    // No arbiter needed for simple decisions
    
    .configure({
      maxTurns: 2,
      maxDurationMs: 30000,
      consensusThreshold: 0.66,
      tokenBudgetPerTurn: 1000  // Limit tokens for cost
    })
  
  log.info('Starting cost-optimized discussion')
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      consensusScore: result.consensus.score,
      duration: result.duration,
      costProfile: 'budget'
    }, 'Discussion completed')
  }
  
  return result
}

/**
 * Example 5: High-stakes configuration with best models
 */
async function highStakesConfiguration() {
  const log = logger.child({ example: 'high-stakes' })
  
  const discussion = new DiscussionBuilder()
    .goal('Design security architecture for banking application')
    
    // Use the best models for critical decisions
    .withProposer({
      id: 'security-architect',
      model: {
        provider: 'anthropic',
        model: 'claude-opus-4-1-20250805',
        temperature: 0.3,  // Low temperature for precision
        maxTokens: 8192   // Allow detailed proposals
      } as ModelConfig,
      expertise: ['security-architecture', 'banking', 'compliance'],
      personality: 'analytical',
      weight: 1.2,
      systemPrompt: 'Design with zero-trust principles and regulatory compliance in mind'
    })
    .withReviewer({
      id: 'penetration-tester',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 4096
      } as ModelConfig,
      expertise: ['penetration-testing', 'vulnerabilities'],
      personality: 'critical',
      weight: 1.3,
      systemPrompt: 'Think like an attacker. Find every possible vulnerability.'
    })
    .withReviewer({
      id: 'compliance-officer',
      model: 'gemini-ultra',  // Good at regulatory analysis
      expertise: ['pci-dss', 'gdpr', 'sox'],
      personality: 'critical',
      weight: 1.2,
      systemPrompt: 'Ensure compliance with PCI-DSS, GDPR, SOX, and banking regulations'
    })
    .withReviewer({
      id: 'cryptography-expert',
      model: 'claude-opus-4.1',
      expertise: ['cryptography', 'key-management', 'encryption'],
      personality: 'analytical',
      weight: 1.1
    })
    .withArbiter({
      id: 'ciso',
      model: {
        provider: 'openai',
        model: 'o3',
        temperature: 0.2,  // Very low for critical decisions
        maxTokens: 4096
      } as ModelConfig,
      expertise: ['risk-management', 'security-strategy'],
      weight: 2.0  // Heavy weight for final decision
    })
    
    .configure({
      maxTurns: 5,
      maxDurationMs: 300000,  // 5 minutes for thorough analysis
      consensusThreshold: 0.9,  // Very high threshold
      requireExplanation: true,
      tokenBudgetPerTurn: 5000  // Allow detailed analysis
    })
  
  log.info('Starting high-stakes security discussion')
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      consensusScore: result.consensus.score,
      duration: result.duration,
      iterations: result.iterations,
      profile: 'high-stakes'
    }, 'Discussion completed')
  }
  
  return result
}

// Main execution
async function main() {
  const log = logger.child({ function: 'main' })
  
  log.info('Starting integrated model configuration examples')
  
  try {
    const example = process.argv[2] || 'simple'
    
    switch (example) {
      case 'simple':
        await simpleModelSelection()
        break
      case 'custom':
        await customModelConfiguration()
        break
      case 'mixed':
        await mixedApproach()
        break
      case 'cost':
        await costOptimizedConfiguration()
        break
      case 'highstakes':
        await highStakesConfiguration()
        break
      default:
        log.info('Available examples: simple, custom, mixed, cost, highstakes')
        log.info('Usage: npx tsx examples/integrated-model-config.ts [example]')
    }
  } catch (error) {
    log.error({ error }, 'Example failed')
    process.exit(1)
  }
}

// Run if main module
if (require.main === module) {
  main().catch(console.error)
}