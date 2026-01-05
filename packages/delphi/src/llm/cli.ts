#!/usr/bin/env tsx

/**
 * CLI bridge for Python agents to use Node.js LLM adapter
 * Usage: node llm/cli.js '{"messages":[...], "useSmall":true}'
 */

import type { Message } from './index.js'
import { getLLMAdapter } from './index.js'

// Input schema
interface CLIInput {
  messages: Message[]
  useSmall?: boolean
  maxTokens?: number
  temperature?: number
}

// Output schema
interface CLIOutput {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  error?: string
}

async function main() {
  let input: CLIInput

  try {
    // Read input from stdin or first argument
    const inputStr = process.argv[2] || (await readStdin())

    if (!inputStr) {
      throw new Error(
        'No input provided. Usage: node cli.js \'{"messages":[...]}\'',
      )
    }

    // Parse input
    input = JSON.parse(inputStr)

    // Validate input
    if (!input.messages || !Array.isArray(input.messages)) {
      throw new Error('Invalid input: messages array is required')
    }

    // Get LLM adapter
    const adapter = getLLMAdapter()

    // Execute chat
    const response = await adapter.chat({
      messages: input.messages,
      useSmall: input.useSmall,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      stream: false, // CLI doesn't support streaming
    })

    // Output success response
    const output: CLIOutput = {
      content: response.content,
      model: response.model,
      usage: response.usage,
    }

    console.log(JSON.stringify(output))
    process.exit(0)
  } catch (error) {
    // Output error response
    const output: CLIOutput = {
      content: '',
      model: '',
      error: error instanceof Error ? error.message : String(error),
    }

    console.error(JSON.stringify(output))
    process.exit(1)
  }
}

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise(resolve => {
    let data = ''

    process.stdin.setEncoding('utf8')

    process.stdin.on('data', chunk => {
      data += chunk
    })

    process.stdin.on('end', () => {
      resolve(data.trim())
    })

    // Set timeout to prevent hanging
    setTimeout(() => {
      resolve(data.trim())
    }, 5000)
  })
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
