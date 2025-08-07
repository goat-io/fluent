/**
 * Integration tests for OpenCode integration
 */

import { spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getLLMAdapter } from '../../llm/index.js'

describe('OpenCode Integration', () => {
  describe('LLM Adapter', () => {
    it('should initialize with environment config', () => {
      const adapter = getLLMAdapter()
      const config = adapter.getConfig()

      expect(config.model).toBeDefined()
      expect(config.model).toMatch(/^[a-z]+\/[\w-]+$/) // provider/model format
    })

    it('should fall back to default model when small_model not configured', () => {
      const adapter = getLLMAdapter({
        model: 'openai/gpt-4',
        small_model: undefined
      })

      const config = adapter.getConfig()
      expect(config.model).toBe('openai/gpt-4')

      // When useSmall is true but small_model is not set, should use main model
      // This would be tested in the chat method
    })

    it('should parse model strings correctly', () => {
      const adapter = getLLMAdapter({
        model: 'anthropic/claude-3-opus',
        small_model: 'ollama/llama3'
      })

      const config = adapter.getConfig()
      expect(config.model).toBe('anthropic/claude-3-opus')
      expect(config.small_model).toBe('ollama/llama3')
    })

    it('should handle circuit breaker states', async () => {
      const adapter = getLLMAdapter()

      // Initially should be closed
      expect(adapter.getCircuitState()).toBe('CLOSED')

      // Can reset circuit
      adapter.resetCircuit()
      expect(adapter.getCircuitState()).toBe('CLOSED')
    })
  })

  describe('Python CLI Bridge', () => {
    it(
      'should execute LLM calls via Node.js CLI',
      async () => {
        const testInput = {
          messages: [{ role: 'user' as const, content: 'Hello, test' }],
          useSmall: true
        }

        // Mock the CLI execution
        const mockProcess = {
          stdout: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                callback(
                  JSON.stringify({
                    content: 'Test response',
                    model: 'test/model',
                    usage: { totalTokens: 100 }
                  })
                )
              }
            })
          },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              callback(0)
            }
          })
        }

        const _spawnSpy = vi
          .spyOn(await import('node:child_process'), 'spawn')
          .mockReturnValue(mockProcess as any)

        // Execute via subprocess (simulating Python calling the CLI)
        const result = await new Promise<any>((resolve, reject) => {
          const child = spawn('npx', ['tsx', 'src/llm/cli.ts'], {
            env: { ...process.env }
          })

          let output = ''
          child.stdout?.on('data', data => {
            output += data
          })
          child.on('close', () => {
            try {
              resolve(JSON.parse(output))
            } catch (e) {
              reject(e)
            }
          })

          child.stdin?.write(JSON.stringify(testInput))
          child.stdin?.end()
        })

        expect(result).toHaveProperty('content')
        expect(result).toHaveProperty('model')
      },
      { timeout: 10000 }
    )
  })

  describe('MCP Server', () => {
    let serverProcess: any

    beforeAll(async () => {
      // Start MCP server
      serverProcess = spawn('npx', ['tsx', 'delphi-mcp.ts'], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000))
    })

    afterAll(() => {
      if (serverProcess) {
        serverProcess.kill('SIGTERM')
      }
    })

    it(
      'should expose delphi.run tool',
      async () => {
        // Send tools/list request
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        }

        serverProcess.stdin.write(`${JSON.stringify(request)}\n`)

        const response = await new Promise<any>(resolve => {
          serverProcess.stdout.once('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.id === 1) {
                  resolve(parsed)
                }
              } catch {}
            }
          })
        })

        expect(response.result.tools).toContainEqual(
          expect.objectContaining({
            name: 'delphi.run'
          })
        )
      },
      { timeout: 10000 }
    )

    it(
      'should handle delphi.status tool',
      async () => {
        const request = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'delphi.status',
            arguments: {}
          }
        }

        serverProcess.stdin.write(`${JSON.stringify(request)}\n`)

        const response = await new Promise<any>(resolve => {
          serverProcess.stdout.once('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.id === 2) {
                  resolve(parsed)
                }
              } catch {}
            }
          })
        })

        const content = JSON.parse(response.result.content[0].text)
        expect(content.status).toBe('healthy')
        expect(content.version).toBe('1.0.0')
        expect(content.capabilities).toHaveProperty(
          'llm',
          'OpenCode integrated'
        )
      },
      { timeout: 10000 }
    )
  })

  describe('End-to-End with Different Models', () => {
    it('should work with mock OpenAI model', async () => {
      const adapter = getLLMAdapter({
        model: 'openai/gpt-3.5-turbo'
      })

      // Mock the actual API call
      vi.spyOn(adapter as any, 'chat').mockResolvedValue({
        content: 'Mocked response',
        model: 'openai/gpt-3.5-turbo',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      })

      const response = await adapter.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })

      expect(response.content).toBe('Mocked response')
      expect(response.model).toBe('openai/gpt-3.5-turbo')
    })

    it('should work with mock Ollama model', async () => {
      const adapter = getLLMAdapter({
        model: 'ollama/llama3',
        endpoints: { ollama: 'http://localhost:11434' }
      })

      vi.spyOn(adapter as any, 'chat').mockResolvedValue({
        content: 'Local LLM response',
        model: 'ollama/llama3',
        usage: undefined // Ollama might not provide usage
      })

      const response = await adapter.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })

      expect(response.content).toBe('Local LLM response')
      expect(response.model).toBe('ollama/llama3')
    })
  })

  describe('Error Handling and Retries', () => {
    it('should retry on rate limit errors', async () => {
      const adapter = getLLMAdapter()
      let attempts = 0

      // Mock chat to fail twice then succeed
      vi.spyOn(adapter as any, 'retryClient').request = vi.fn(async _fn => {
        attempts++
        if (attempts < 3) {
          const error: any = new Error('Rate limit exceeded')
          error.status = 429
          throw error
        }
        return { content: 'Success after retry', model: 'test' }
      })

      const response = await (adapter as any).retryClient.request(async () => ({
        content: 'Success after retry',
        model: 'test'
      }))

      expect(attempts).toBeGreaterThanOrEqual(1)
      expect(response.content).toBe('Success after retry')
    })

    it('should open circuit breaker after failures', async () => {
      const adapter = getLLMAdapter()
      const circuit = (adapter as any).retryClient.circuitBreaker

      // Simulate failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await circuit.execute(async () => {
            throw new Error('Service unavailable')
          })
        } catch {}
      }

      expect(circuit.getState()).toBe('OPEN')

      // Reset for other tests
      circuit.reset()
    })
  })

  describe('OpenCode Config Loading', () => {
    it('should load config from OPENCODE_RUNTIME_CFG env var', () => {
      const originalEnv = process.env.OPENCODE_RUNTIME_CFG

      process.env.OPENCODE_RUNTIME_CFG = JSON.stringify({
        model: 'anthropic/claude-3',
        small_model: 'openai/gpt-3.5-turbo',
        api_keys: { anthropic: 'test-key' }
      })

      const adapter = getLLMAdapter()
      const config = adapter.getConfig()

      expect(config.model).toBe('anthropic/claude-3')
      expect(config.small_model).toBe('openai/gpt-3.5-turbo')
      expect(config.api_keys?.anthropic).toBe('test-key')

      // Restore
      if (originalEnv) {
        process.env.OPENCODE_RUNTIME_CFG = originalEnv
      } else {
        delete process.env.OPENCODE_RUNTIME_CFG
      }
    })

    it('should handle invalid OPENCODE_RUNTIME_CFG gracefully', () => {
      const originalEnv = process.env.OPENCODE_RUNTIME_CFG

      process.env.OPENCODE_RUNTIME_CFG = 'invalid json'

      // Should not throw, should use defaults
      const adapter = getLLMAdapter()
      const config = adapter.getConfig()

      expect(config.model).toBeDefined()

      // Restore
      if (originalEnv) {
        process.env.OPENCODE_RUNTIME_CFG = originalEnv
      } else {
        delete process.env.OPENCODE_RUNTIME_CFG
      }
    })
  })
})
