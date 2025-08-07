#!/usr/bin/env tsx
/**
 * MCP Server wrapper for Delphi pipeline
 * Exposes Delphi as an MCP tool for OpenCode integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { buildGraph, FlowStateAnnotation } from './src/graph.js'
import { initializeMemory, checkpointer } from './src/checkpoint/sqlite.js'
import { initializeTracing, shutdownTracing } from './src/utils/tracing.js'
import { shutdownClaudePool } from './src/utils/process-pool.js'
import type { FlowState } from './src/types.js'

// Tool parameter schemas
const RunToolSchema = z.object({
  goal: z.string().describe('The development goal or task to accomplish'),
  repoPath: z.string().optional().describe('Repository path (defaults to current directory)'),
  enableTests: z.boolean().optional().describe('Whether to run tests'),
  maxIterations: z.number().optional().describe('Maximum refinement iterations')
})

// Response schema
const RunResponseSchema = z.object({
  diff: z.string().describe('Generated git diff'),
  approved: z.boolean().describe('Whether the implementation was approved'),
  feedback: z.string().optional().describe('Review feedback if not approved'),
  iterations: z.number().describe('Number of refinement iterations'),
  duration: z.number().describe('Execution time in milliseconds')
})

type RunToolParams = z.infer<typeof RunToolSchema>
type RunResponse = z.infer<typeof RunResponseSchema>

/**
 * Run the Delphi pipeline
 */
async function runDelphi(params: RunToolParams): Promise<RunResponse> {
  const startTime = Date.now()
  
  try {
    // Initialize systems
    await initializeTracing({
      enabled: process.env.OTEL_ENABLED === 'true',
      serviceName: 'delphi-mcp'
    })
    await initializeMemory()
    
    // Build and compile the graph
    const workflow = buildGraph({
      maxIterations: params.maxIterations || 5,
      enableTests: params.enableTests ?? true
    })
    
    const app = workflow.compile({ checkpointer })
    
    // Prepare initial state
    const initialState: FlowState = {
      task: params.goal,
      spec: '',
      repoPath: params.repoPath || process.cwd(),
      iterationCount: 0,
      timestamp: Date.now()
    }
    
    // Generate thread ID for checkpointing
    const threadId = `delphi-mcp-${Date.now()}`
    
    // Execute pipeline
    console.error(`[Delphi] Starting pipeline for: ${params.goal}`)
    
    const finalState = await app.invoke(initialState, {
      configurable: { thread_id: threadId }
    })
    
    const duration = Date.now() - startTime
    
    console.error(`[Delphi] Pipeline completed in ${duration}ms`)
    
    // Return results
    return {
      diff: finalState.codeDiff || '',
      approved: finalState.approved || false,
      feedback: finalState.reviewFeedback,
      iterations: finalState.iterationCount || 0,
      duration
    }
    
  } catch (error) {
    console.error('[Delphi] Pipeline error:', error)
    throw error
  } finally {
    // Cleanup
    await shutdownClaudePool()
    await shutdownTracing()
  }
}

/**
 * Stream large diffs in chunks
 */
async function* streamDiff(diff: string, chunkSize: number = 1024 * 1024): AsyncGenerator<string> {
  for (let i = 0; i < diff.length; i += chunkSize) {
    yield diff.slice(i, i + chunkSize)
  }
}

/**
 * Main MCP server
 */
async function main() {
  console.error('[Delphi MCP] Starting server...')
  
  // Create server
  const server = new Server({
    name: 'delphi',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  })
  
  // Register tools
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'delphi.run',
        description: 'Run Delphi automated development pipeline to generate code changes',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The development goal or task to accomplish'
            },
            repoPath: {
              type: 'string',
              description: 'Repository path (defaults to current directory)'
            },
            enableTests: {
              type: 'boolean',
              description: 'Whether to run tests'
            },
            maxIterations: {
              type: 'number',
              description: 'Maximum refinement iterations'
            }
          },
          required: ['goal']
        }
      },
      {
        name: 'delphi.status',
        description: 'Check Delphi service status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }))
  
  // Handle tool calls
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params
    
    switch (name) {
      case 'delphi.run': {
        try {
          // Validate parameters
          const params = RunToolSchema.parse(args)
          
          // Run pipeline
          const result = await runDelphi(params)
          
          // Check diff size
          if (result.diff.length > 10 * 1024 * 1024) {
            // Stream large diffs
            console.error('[Delphi] Diff exceeds 10MB, streaming...')
            
            const chunks: string[] = []
            for await (const chunk of streamDiff(result.diff)) {
              chunks.push(chunk)
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    ...result,
                    diff: '[Streamed in chunks]',
                    chunks: chunks.length
                  })
                }
              ]
            }
          }
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        } catch (error) {
          console.error('[Delphi] Tool error:', error)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error)
                })
              }
            ],
            isError: true
          }
        }
      }
      
      case 'delphi.status': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'healthy',
                version: '1.0.0',
                capabilities: {
                  llm: 'OpenCode integrated',
                  agents: ['planner', 'refiner', 'reviewer'],
                  checkpointing: 'SQLite',
                  tracing: process.env.OTEL_ENABLED === 'true'
                }
              }, null, 2)
            }
          ]
        }
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  })
  
  // Create transport
  const transport = new StdioServerTransport()
  
  // Start server
  await server.connect(transport)
  console.error('[Delphi MCP] Server started successfully')
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('[Delphi MCP] Shutting down...')
    await server.close()
    process.exit(0)
  })
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[Delphi MCP] Fatal error:', error)
    process.exit(1)
  })
}