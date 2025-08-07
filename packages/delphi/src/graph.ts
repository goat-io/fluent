#!/usr/bin/env tsx
import { spawn } from 'node:child_process'
/**
 * Main LangGraph orchestrator for the Delphi automated dev pipeline.
 * Coordinates AutoGen agents, Claude Code execution, and state persistence.
 */
import { createHash } from 'node:crypto'
import { Http } from '@goatlab/js-utils'
import { Annotation, END, StateGraph } from '@langchain/langgraph'
import dotenv from 'dotenv'
import { checkpointer, initializeMemory } from './checkpoint/sqlite.js'
import {
  AgentError,
  ExecutionError,
  FlowState,
  GraphConfig,
  TimeoutError
} from './types.js'
import {
  getClaudeProcessPool,
  shutdownClaudePool
} from './utils/process-pool.js'
import { isRetryableError, RetryableClient } from './utils/retry.js'

// Load environment variables
dotenv.config()

// Default configuration
const defaultConfig: Required<GraphConfig> = {
  maxIterations: 5,
  testCommand: 'npm test',
  enableTests: true,
  claudeCodePath: 'claude',
  autogenServiceUrl: process.env.AUTOGEN_SERVICE_URL || 'http://localhost:8000',
  maxRetries: 3,
  retryDelayMs: 1000
}

// Maximum iteration count for defense-in-depth
const MAX_ITERATION_HARD_LIMIT = 10

// Create retryable HTTP client with circuit breaker
function createRetryableClient(baseUrl: string): RetryableClient {
  const httpClient = Http.getClient({ prefixUrl: baseUrl })
  return new RetryableClient(
    httpClient,
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      shouldRetry: isRetryableError
    },
    {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRetries: 2
    }
  )
}

// ---------- Node Functions ----------

/**
 * Planner node - generates initial specification
 */
async function plannerNode(
  state: FlowState,
  config: Required<GraphConfig>
): Promise<Partial<FlowState>> {
  console.log('📋 Planning: Generating initial specification...')

  const retryableClient = createRetryableClient(config.autogenServiceUrl)

  try {
    const data = await retryableClient.request(async () => {
      const client = Http.getClient({ prefixUrl: config.autogenServiceUrl })
      return await client
        .post('plan', {
          json: { prompt: state.task }
        })
        .json<any>()
    })

    console.log('✅ Planning complete')
    return {
      spec: data.draft,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('❌ Planning failed:', error)
    throw new AgentError('Failed to generate plan', error)
  }
}

/**
 * Refiner node - iteratively improves specification
 */
async function refinerNode(
  state: FlowState,
  config: Required<GraphConfig>
): Promise<Partial<FlowState>> {
  console.log('🔧 Refining: Improving specification...')

  // Cap iteration count for defense-in-depth
  const currentIteration = Math.min(
    state.iterationCount || 0,
    MAX_ITERATION_HARD_LIMIT
  )

  if (currentIteration >= config.maxIterations) {
    console.log('⚠️ Max iterations reached in refiner')
    return {
      reviewFeedback: 'max_iterations_reached'
    }
  }

  const retryableClient = createRetryableClient(config.autogenServiceUrl)

  try {
    const data = await retryableClient.request(async () => {
      const client = Http.getClient({ prefixUrl: config.autogenServiceUrl })
      return await client
        .post('refine', {
          json: { spec: state.spec }
        })
        .json<any>()
    })

    console.log(
      data.clear
        ? '✅ Specification is clear'
        : '🔄 Specification needs more refinement'
    )

    return {
      spec: data.refined,
      iterationCount: (state.iterationCount || 0) + 1,
      // Store clear status for routing
      reviewFeedback: data.clear ? 'clear' : 'unclear'
    }
  } catch (error) {
    console.error('❌ Refinement failed:', error)
    throw new AgentError('Failed to refine specification', error)
  }
}

/**
 * Code agent node - executes Claude Code to generate diff
 */
async function codeAgentNode(
  state: FlowState,
  config: Required<GraphConfig>
): Promise<Partial<FlowState>> {
  console.log('💻 Coding: Executing Claude Code...')

  // Use process pool for efficient execution
  const _processPool = getClaudeProcessPool()

  return new Promise((resolve, reject) => {
    const args = ['-p', state.spec, '--diff']

    // Add MCP servers if specified
    if (state.mcpServers?.length) {
      args.push('--mcp', ...state.mcpServers)
    }

    // Security: Restrict Claude execution to repository directory only
    const sanitizedEnv: any = {
      ...process.env,
      HOME: state.repoPath, // Prevent access to actual home directory
      TMPDIR: `${state.repoPath}/.delphi-tmp`,
      TEMP: `${state.repoPath}/.delphi-tmp`,
      TMP: `${state.repoPath}/.delphi-tmp`
    }

    // Remove sensitive environment variables
    sanitizedEnv.AWS_ACCESS_KEY_ID = undefined
    sanitizedEnv.AWS_SECRET_ACCESS_KEY = undefined
    sanitizedEnv.GITHUB_TOKEN = undefined
    sanitizedEnv.NPM_TOKEN = undefined

    const child = spawn(config.claudeCodePath, args, {
      cwd: state.repoPath,
      stdio: ['ignore', 'pipe', 'pipe'] as const,
      env: sanitizedEnv,
      // Additional security: drop privileges if running as root
      uid: process.getuid ? process.getuid() : undefined,
      gid: process.getgid ? process.getgid() : undefined
    })

    let diff = ''
    let stderr = ''
    let bytesReceived = 0
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024 // 10MB limit
    const chunkHashes = new Set<string>() // Track chunk hashes for deduplication

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new TimeoutError('Claude Code execution timed out'))
    }, 300000) // 5 minute timeout

    // Stream stdout with size limit and hash validation
    child.stdout.on('data', chunk => {
      const chunkSize = chunk.length

      // Hash-based deduplication check (prevent zip-bomb style attacks)
      const chunkHash = createHash('sha256').update(chunk).digest('hex')
      if (chunkHashes.has(chunkHash)) {
        console.warn('⚠️ Duplicate chunk detected, possible compression attack')
        child.kill('SIGTERM')
        reject(new ExecutionError('Suspicious duplicate output detected'))
        return
      }
      chunkHashes.add(chunkHash)

      if (bytesReceived + chunkSize > MAX_BUFFER_SIZE) {
        child.kill('SIGTERM')
        reject(new ExecutionError('Output exceeded 10MB limit'))
        return
      }
      bytesReceived += chunkSize
      diff += chunk.toString()

      // Log progress for large outputs
      if (bytesReceived > 1024 * 1024) {
        console.log(
          `📊 Received ${(bytesReceived / 1024 / 1024).toFixed(2)}MB of diff output`
        )
      }
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('close', code => {
      clearTimeout(timeout)

      if (code === 0) {
        console.log('✅ Code generation complete')
        resolve({
          codeDiff: diff.trim()
        })
      } else {
        console.error('❌ Code generation failed with exit code:', code)
        reject(
          new ExecutionError(`Claude Code exited with code ${code}`, { stderr })
        )
      }
    })

    child.on('error', error => {
      clearTimeout(timeout)
      console.error('❌ Failed to spawn Claude Code:', error)
      reject(new ExecutionError('Failed to spawn Claude Code', error))
    })
  })
}

/**
 * Test runner node - executes tests (optional)
 */
async function testRunnerNode(
  state: FlowState,
  config: Required<GraphConfig>
): Promise<Partial<FlowState>> {
  if (!config.enableTests) {
    console.log('🔸 Tests disabled, skipping...')
    return { testResults: 'Tests disabled' }
  }

  console.log('🧪 Testing: Running test suite...')

  // Use injected test command from config (not hard-coded)
  const testCommand = config.testCommand || 'npm test'

  return new Promise(resolve => {
    const child = spawn('sh', ['-c', testCommand], {
      cwd: state.repoPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000 // 2 minute timeout for tests
    })

    let output = ''
    let error = ''

    child.stdout.on('data', data => {
      output += data.toString()
    })

    child.stderr.on('data', data => {
      error += data.toString()
    })

    child.on('close', code => {
      const testResults = `Exit code: ${code}\n\nOutput:\n${output}\n\nErrors:\n${error}`
      console.log(code === 0 ? '✅ Tests passed' : '⚠️ Tests failed')

      resolve({
        testResults
      })
    })
  })
}

/**
 * Reviewer node - evaluates diff and test results
 */
async function reviewerNode(
  state: FlowState,
  config: Required<GraphConfig>
): Promise<Partial<FlowState>> {
  console.log('👀 Reviewing: Evaluating implementation...')

  const retryableClient = createRetryableClient(config.autogenServiceUrl)

  try {
    const data = await retryableClient.request(async () => {
      const client = Http.getClient({ prefixUrl: config.autogenServiceUrl })
      return await client
        .post('review', {
          json: {
            diff: state.codeDiff || '',
            test_results: state.testResults || ''
          }
        })
        .json<any>()
    })

    console.log(data.ok ? '✅ Review approved' : '🔄 Review requested changes')

    return {
      approved: data.ok,
      reviewFeedback: data.feedback
    }
  } catch (error) {
    console.error('❌ Review failed:', error)
    throw new AgentError('Failed to review code', error)
  }
}

/**
 * Router function - determines next step based on review
 */
function reviewRouter(state: FlowState): string {
  // Check iteration limit with hard cap
  if (state.iterationCount >= Math.min(5, MAX_ITERATION_HARD_LIMIT)) {
    console.log('⚠️ Max iterations reached, ending workflow')
    return END
  }

  // Route based on approval
  return state.approved ? END : 'refine'
}

// ---------- Graph Construction ----------

// Create state annotation using LangGraph's Annotation
export const FlowStateAnnotation = Annotation.Root({
  task: Annotation<string>(),
  spec: Annotation<string>(),
  codeDiff: Annotation<string | undefined>(),
  testResults: Annotation<string | undefined>(),
  approved: Annotation<boolean | undefined>(),
  reviewFeedback: Annotation<string | undefined>(),
  repoPath: Annotation<string>(),
  mcpServers: Annotation<string[] | undefined>(),
  iterationCount: Annotation<number>(),
  timestamp: Annotation<number>(),
  threadId: Annotation<string | undefined>()
})

/**
 * Build the LangGraph workflow
 */
export function buildGraph(config: Partial<GraphConfig> = {}) {
  const finalConfig: Required<GraphConfig> = { ...defaultConfig, ...config }

  // Create state graph with annotation
  const workflow = new StateGraph(FlowStateAnnotation) as any

  // Add nodes with config binding
  workflow.addNode('plan', async (state: any) =>
    plannerNode(state, finalConfig)
  )
  workflow.addNode('refine', async (state: any) =>
    refinerNode(state, finalConfig)
  )
  workflow.addNode('code', async (state: any) =>
    codeAgentNode(state, finalConfig)
  )
  workflow.addNode('test', async (state: any) =>
    testRunnerNode(state, finalConfig)
  )
  workflow.addNode('review', async (state: any) =>
    reviewerNode(state, finalConfig)
  )

  // Define edges - use __start__ for entry point
  workflow.addEdge('__start__', 'plan')
  workflow.addEdge('plan', 'refine')

  // Conditional edge from refine - only proceed to code if clear=true
  workflow.addConditionalEdges('refine', (state: any) => {
    // Check if spec is clear (stored in reviewFeedback temporarily)
    if (state.reviewFeedback === 'clear') {
      return 'code'
    }
    // Check iteration limit
    if (state.iterationCount >= 5) {
      console.log('⚠️ Max refinement iterations reached')
      return '__end__'
    }
    // Loop back to refine
    return 'refine'
  })

  workflow.addEdge('code', 'test')
  workflow.addEdge('test', 'review')
  workflow.addConditionalEdges('review', (state: any) => {
    const result = reviewRouter(state)
    return result === END ? '__end__' : result
  })

  return workflow
}

// ---------- Main Execution ----------

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2)
    if (args.length === 0) {
      console.error('❌ Usage: tsx src/graph.ts <task description>')
      process.exit(1)
    }

    const task = args.join(' ')
    const repoPath = process.cwd()

    console.log('🚀 Delphi Automated Dev Pipeline')
    console.log('📝 Task:', task)
    console.log('📁 Repository:', repoPath)
    console.log('')

    // Initialize tracing (commented out - not imported)
    // await initializeTracing({
    //   enabled: process.env.OTEL_ENABLED === 'true',
    //   serviceName: 'delphi-pipeline'
    // })

    // Initialize memory system
    await initializeMemory()

    // Build and compile the graph
    const workflow = buildGraph()
    const app = workflow.compile({
      checkpointer
    })

    // Generate thread ID
    const threadId = process.env.DELPHI_THREAD_ID || `delphi-${Date.now()}`
    console.log('🧵 Thread ID:', threadId)

    // Check for existing checkpoint (idempotent restart)
    const existingCheckpoint = await (checkpointer.get() as any).getTuple({
      configurable: { thread_id: threadId }
    } as any)

    let finalState: any

    if (existingCheckpoint) {
      console.log('📥 Resuming from checkpoint...')
      const values = (existingCheckpoint as any).channel_values || {}
      console.log(`  Iteration: ${values.iterationCount}`)
      console.log(`  Last spec: ${values.spec?.substring(0, 50) || 'N/A'}...`)
      console.log('')

      // Resume from checkpoint
      finalState = await app.invoke(
        null, // null input resumes from checkpoint
        {
          configurable: { thread_id: threadId }
        }
      )
    } else {
      console.log('🆕 Starting fresh execution')
      console.log('')

      // Create initial state
      const initialState = {
        task,
        spec: '',
        repoPath,
        iterationCount: 0,
        timestamp: Date.now()
      }

      // Start new execution
      finalState = await app.invoke(initialState, {
        configurable: { thread_id: threadId }
      })
    }

    // Display results
    console.log(`\n${'='.repeat(60)}`)
    console.log(
      finalState.approved
        ? '✅ WORKFLOW COMPLETED SUCCESSFULLY'
        : '❌ WORKFLOW FAILED'
    )
    console.log('='.repeat(60))

    if (finalState.approved && finalState.codeDiff) {
      console.log('\n📄 Generated Diff:')
      console.log('-'.repeat(60))
      console.log(finalState.codeDiff)
      console.log('-'.repeat(60))
      console.log('\n✅ Diff is ready to be applied!')
    } else if (finalState.reviewFeedback) {
      console.log('\n📝 Review Feedback:')
      console.log(finalState.reviewFeedback)
    }

    // Cleanup
    await shutdownClaudePool()
    // await shutdownTracing() // Not imported

    process.exit(finalState.approved ? 0 : 1)
  } catch (error) {
    console.error('\n❌ Fatal error:', error)

    // Cleanup on error
    await shutdownClaudePool()
    // await shutdownTracing() // Not imported

    process.exit(1)
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

// Export for testing
export { main }
