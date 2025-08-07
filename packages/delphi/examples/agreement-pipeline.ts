#!/usr/bin/env tsx
/**
 * Production-Ready Agreement System Integration
 * Demonstrates proper type safety, resource management, and error handling
 */

import { createGraph, Annotation } from '@langchain/langgraph'
import { 
  AgentRole, 
  AgreementOrchestrator,
  createLLMAgent,
  runAgreementNode
} from '../src/agreement'
import {
  codeReviewDiscussion,
  refactoringDiscussion
} from '../src/agreement/presets'
import { DiscussionBuilder } from '../src/agreement/discussion-builder'
import { ConsensusResult, parseConsensusResult, AgreementState } from '../src/agreement/types'
import { resourceManager } from '../src/agreement/resource-manager'
import { Logger } from 'pino'
import pino from 'pino'
import { Command } from 'commander'

// Initialize structured logger
const logger: Logger = pino({
  name: 'agreement-demo',
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

// Enhanced state type with agreement fields
interface PipelineState extends AgreementState {
  task: string
  spec: string
  codeDiff?: string
  testResults?: string
  approved: boolean
  reviewFeedback?: string
  repoPath: string
  iterationCount: number
}

// State annotation for LangGraph
const PipelineStateAnnotation = Annotation.Root({
  task: Annotation<string>(),
  spec: Annotation<string>(),
  codeDiff: Annotation<string>(),
  testResults: Annotation<string>(),
  approved: Annotation<boolean>(),
  reviewFeedback: Annotation<string>(),
  repoPath: Annotation<string>(),
  iterationCount: Annotation<number>(),
  agreementSessionId: Annotation<string>(),
  agreementResult: Annotation<ConsensusResult | null>(),
  consensusScore: Annotation<number>(),
  agreementDuration: Annotation<number>()
})

/**
 * Type-safe code review with proper resource management
 */
async function runCodeReviewExample(goal?: string): Promise<ConsensusResult | null> {
  const traceId = crypto.randomUUID()
  const log = logger.child({ traceId, operation: 'code-review' })
  
  log.info('Starting code review discussion')
  
  try {
    const discussion = codeReviewDiscussion()
      .goal(goal || 'Review the new user authentication module')
      .withConstraints(
        'Must follow OWASP security guidelines',
        'Maintain backwards compatibility with v1 API',
        'Response time must be < 200ms'
      )
      .expecting(
        'Security vulnerability assessment',
        'Performance impact analysis',
        'Code quality evaluation',
        'Final approval decision'
      )
      .successWhen(
        'No critical security vulnerabilities found',
        'Performance requirements met',
        'Code follows team standards'
      )
      .withTimeout(120000) // 2 minute hard timeout
      .configure({
        maxTurns: 5,
        maxDurationMs: 100000, // Allow time for 5 turns
        tokenBudgetPerTurn: 1500
      })
    
    const result = await discussion.run()
    
    if (result) {
      log.info({
        consensusScore: result.consensus.score,
        method: result.consensus.method,
        duration: result.duration,
        iterations: result.iterations
      }, 'Review completed successfully')
      
      // Parse and validate the final content
      try {
        const decision = JSON.parse(result.finalContent)
        log.debug({ decision }, 'Parsed decision')
      } catch (error) {
        log.warn({ error }, 'Failed to parse final content as JSON')
      }
      
      return result
    } else {
      log.warn('Failed to reach consensus')
      return null
    }
  } catch (error) {
    log.error({ error }, 'Code review failed')
    throw error
  }
}

/**
 * Architecture decision with reusable agents
 */
async function runArchitectureExample(goal?: string): Promise<ConsensusResult | null> {
  const traceId = crypto.randomUUID()
  const log = logger.child({ traceId, operation: 'architecture' })
  
  log.info('Starting architecture discussion')
  
  try {
    // Get cached LLM adapter
    const llmAdapter = resourceManager.getLLMAdapter()
    
    // Create or reuse agents
    const agents = [
      resourceManager.getOrCreateAgent('cloud-architect', () =>
        createLLMAgent('cloud-architect', AgentRole.PROPOSER, llmAdapter, 1.2)
      ),
      resourceManager.getOrCreateAgent('security-architect', () =>
        createLLMAgent('security-architect', AgentRole.REVIEWER, llmAdapter, 1.5)
      ),
      resourceManager.getOrCreateAgent('cost-optimizer', () =>
        createLLMAgent('cost-optimizer', AgentRole.REVIEWER, llmAdapter, 1.0)
      ),
      resourceManager.getOrCreateAgent('cto', () =>
        createLLMAgent('cto', AgentRole.ARBITER, llmAdapter, 2.0)
      )
    ]
    
    const discussion = new DiscussionBuilder<ConsensusResult>()
      .goal(goal || 'Choose cloud provider and architecture for new SaaS platform')
      .withConstraints(
        'Budget: $10K/month maximum',
        'Must support 100K concurrent users',
        'GDPR and SOC2 compliance required'
      )
      .expecting(
        'Cloud provider recommendation',
        'Architecture diagram',
        'Cost breakdown'
      )
      .withTimeout(180000) // 3 minute timeout
      .configure({
        maxTurns: 4,
        consensusThreshold: 0.75,
        conflictResolution: 'arbiter'
      })
    
    const { context, config } = discussion.build()
    const orchestrator = new AgreementOrchestrator(config, agents)
    
    // Monitor progress
    orchestrator.on('stateChange', ({ from, to, context }) => {
      log.info({
        from,
        to,
        turn: context.turnCount,
        maxTurns: context.config.maxTurns
      }, 'State transition')
    })
    
    const result = await orchestrator.runAgreement(JSON.stringify(context))
    
    if (result) {
      const consensusResult: ConsensusResult = {
        proposalId: result.proposalId,
        finalContent: result.finalContent,
        consensus: result.consensus,
        auditTrail: result.auditTrail,
        sessionId: config.sessionId,
        duration: Date.now() - orchestrator.getStartTime(),
        iterations: orchestrator.getIterationCount()
      }
      
      log.info({
        consensusScore: consensusResult.consensus.score,
        iterations: consensusResult.iterations,
        duration: consensusResult.duration
      }, 'Architecture decision made')
      
      return consensusResult
    }
    
    return null
  } catch (error) {
    log.error({ error }, 'Architecture discussion failed')
    throw error
  }
}

/**
 * Integrated pipeline with proper state management
 */
async function runIntegratedPipeline(goal: string, repoPath: string): Promise<PipelineState> {
  const traceId = crypto.randomUUID()
  const log = logger.child({ traceId, operation: 'integrated-pipeline' })
  
  log.info({ goal, repoPath }, 'Starting integrated pipeline')
  
  // Create graph with proper typing
  const graph = createGraph<PipelineState>(PipelineStateAnnotation)
  
  // Reusable agents for the pipeline
  const specAgents = [
    resourceManager.getOrCreateAgent('spec-proposer', () =>
      createLLMAgent('spec-proposer', AgentRole.PROPOSER, resourceManager.getLLMAdapter())
    ),
    resourceManager.getOrCreateAgent('spec-reviewer-1', () =>
      createLLMAgent('spec-reviewer-1', AgentRole.REVIEWER, resourceManager.getLLMAdapter())
    ),
    resourceManager.getOrCreateAgent('spec-reviewer-2', () =>
      createLLMAgent('spec-reviewer-2', AgentRole.REVIEWER, resourceManager.getLLMAdapter())
    )
  ]
  
  // Planning node
  graph.addNode('planner', async (state: PipelineState) => {
    log.info('Planning phase')
    return {
      ...state,
      spec: `Specification for: ${state.task}`
    }
  })
  
  // Spec agreement node
  graph.addNode('spec_agreement', async (state: PipelineState) => {
    log.info('Spec agreement phase')
    
    const result = await runAgreementNode(state, specAgents, {
      maxTurns: 3,
      maxDurationMs: 60000,
      minConsensusScore: 0.7
    })
    
    return {
      ...state,
      ...result,
      consensusScore: result.consensusScore || 0
    }
  })
  
  // Code generation node
  graph.addNode('coder', async (state: PipelineState) => {
    log.info('Code generation phase')
    return {
      ...state,
      codeDiff: `diff --git a/example.js b/example.js
+// Implementation based on spec: ${state.spec?.slice(0, 50)}...
+console.log("Hello World");`
    }
  })
  
  // Code review agreement node
  graph.addNode('code_review', async (state: PipelineState) => {
    log.info('Code review phase')
    
    const discussion = codeReviewDiscussion()
      .goal(`Review generated code diff`)
      .withContext('diff', state.codeDiff)
      .withTimeout(90000)
    
    const result = await discussion.run()
    
    return {
      ...state,
      approved: result ? result.consensus.score >= 0.7 : false,
      reviewFeedback: result?.finalContent || 'No consensus',
      agreementResult: result,
      consensusScore: result?.consensus.score || 0
    }
  })
  
  // Define edges
  graph.addEdge('planner', 'spec_agreement')
  graph.addEdge('spec_agreement', 'coder')
  graph.addEdge('coder', 'code_review')
  
  // Conditional edge for retry logic
  graph.addConditionalEdges('code_review', (state: PipelineState) => {
    if (state.approved) {
      return 'end'
    } else if (state.iterationCount < 3) {
      return 'spec_agreement'
    } else {
      return 'end'
    }
  })
  
  graph.setEntryPoint('planner')
  
  // Compile and run
  const app = graph.compile()
  
  const initialState: PipelineState = {
    task: goal,
    spec: '',
    approved: false,
    repoPath,
    iterationCount: 0,
    agreementSessionId: crypto.randomUUID(),
    agreementResult: null,
    consensusScore: 0,
    agreementDuration: 0
  }
  
  const result = await app.invoke(initialState)
  
  log.info({
    approved: result.approved,
    consensusScore: result.consensusScore,
    iterations: result.iterationCount
  }, 'Pipeline completed')
  
  return result
}

/**
 * Refactoring example with proper code annotation
 */
async function runRefactoringExample(): Promise<ConsensusResult | null> {
  const log = logger.child({ operation: 'refactoring' })
  
  /* language=javascript */
  const codeToRefactor = `
// Legacy code with issues
function processUserData(userData) {
  var result = {};
  for (var i = 0; i < userData.length; i++) {
    if (userData[i].age > 18 && userData[i].status == "active") {
      result[userData[i].id] = {
        name: userData[i].firstName + " " + userData[i].lastName,
        email: userData[i].emailAddress,
        isAdult: true
      };
    }
  }
  return result;
}
  `
  
  const discussion = refactoringDiscussion()
    .goal('Refactor legacy user processing function')
    .withContext('current_code', codeToRefactor)
    .withConstraints(
      'Maintain exact same functionality',
      'Use modern ES6+ syntax',
      'Improve readability and testability'
    )
    .expecting(
      'Refactored code',
      'List of improvements made',
      'Test cases'
    )
    .withTimeout(120000)
    .configure({
      maxTurns: 3,
      maxDurationMs: 90000,
      tokenBudgetPerTurn: 2000
    })
  
  const result = await discussion.run()
  
  if (result) {
    log.info({
      consensusScore: result.consensus.score,
      duration: result.duration
    }, 'Refactoring plan approved')
    
    // Safe parsing with validation
    const parsed = parseConsensusResult(result)
    if (parsed) {
      log.debug({ parsed }, 'Validated consensus result')
    }
  }
  
  return result
}

/**
 * CLI with proper argument parsing
 */
const program = new Command()
  .name('agreement-demo')
  .description('Delphi Agreement System Demo')
  .version('1.0.0')

program
  .command('review')
  .description('Run code review discussion')
  .option('-g, --goal <goal>', 'Review goal')
  .action(async (options) => {
    try {
      await runCodeReviewExample(options.goal)
    } catch (error) {
      logger.error({ error }, 'Code review failed')
      process.exit(1)
    } finally {
      await resourceManager.closeAll()
    }
  })

program
  .command('architecture')
  .description('Run architecture decision')
  .option('-g, --goal <goal>', 'Architecture goal')
  .action(async (options) => {
    try {
      await runArchitectureExample(options.goal)
    } catch (error) {
      logger.error({ error }, 'Architecture discussion failed')
      process.exit(1)
    } finally {
      await resourceManager.closeAll()
    }
  })

program
  .command('pipeline')
  .description('Run integrated pipeline')
  .option('-g, --goal <goal>', 'Pipeline goal', 'Add new feature')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .action(async (options) => {
    try {
      await runIntegratedPipeline(options.goal, options.repo)
    } catch (error) {
      logger.error({ error }, 'Pipeline failed')
      process.exit(1)
    } finally {
      await resourceManager.closeAll()
    }
  })

program
  .command('refactor')
  .description('Run refactoring discussion')
  .action(async () => {
    try {
      await runRefactoringExample()
    } catch (error) {
      logger.error({ error }, 'Refactoring failed')
      process.exit(1)
    } finally {
      await resourceManager.closeAll()
    }
  })

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled rejection')
  resourceManager.closeAll().then(() => process.exit(1))
})

process.on('SIGINT', () => {
  logger.info('Shutting down gracefully')
  resourceManager.closeAll().then(() => process.exit(0))
})

// Parse CLI arguments
if (require.main === module) {
  program.parse()
}

export {
  runCodeReviewExample,
  runArchitectureExample,
  runIntegratedPipeline,
  runRefactoringExample
}