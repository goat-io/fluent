// npx vitest run ./src/scripts-isolated.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runScript } from './Scripts'

// This test file uses an isolated approach to avoid process.exit issues
describe('runScript (isolated)', () => {
  let originalExit: typeof process.exit
  let originalOn: typeof process.on
  let originalOnce: typeof process.once
  let originalRemoveAllListeners: typeof process.removeAllListeners
  let exitSpy: any
  let consoleErrorSpy: any
  let consoleLogSpy: any

  beforeEach(() => {
    // Save original methods
    originalExit = process.exit
    originalOn = process.on
    originalOnce = process.once
    originalRemoveAllListeners = process.removeAllListeners

    // Create spies
    exitSpy = vi.fn()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - suppress console output in tests
    })
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Intentionally empty - suppress console output in tests
    })

    // Mock process methods
    process.exit = exitSpy as any

    // Track event listeners
    const listeners = new Map<string, Array<(...args: any[]) => any>>()

    process.on = vi.fn((event: string, listener: (...args: any[]) => any) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(listener)
      return process
    }) as any

    process.once = vi.fn((event: string, listener: (...args: any[]) => any) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(listener)
      return process
    }) as any

    process.removeAllListeners = vi.fn(() => {
      listeners.clear()
      return process
    }) as any
  })

  afterEach(() => {
    // Restore original methods
    process.exit = originalExit
    process.on = originalOn
    process.once = originalOnce
    process.removeAllListeners = originalRemoveAllListeners

    // Restore console methods
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it('should handle successful execution', async () => {
    let resolved = false

    runScript(
      async () => {
        resolved = true
      },
      { noExit: true }
    )

    // Wait for promise to resolve
    await new Promise(r => setTimeout(r, 10))

    expect(resolved).toBe(true)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('should handle errors and call onError callback', async () => {
    let errorHandled = false
    const testError = new Error('test error')

    runScript(
      async () => {
        throw testError
      },
      {
        noExit: true,
        onError: err => {
          errorHandled = true
          expect(err).toBe(testError)
        }
      }
    )

    // Wait for promise to resolve
    await new Promise(r => setTimeout(r, 10))

    expect(errorHandled).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith('runScript error:', testError)
  })

  it('should call onExit callback with correct code', async () => {
    let exitCode: number | undefined

    runScript(
      async () => {
        // Success case
      },
      {
        noExit: true,
        onExit: code => {
          exitCode = code
        }
      }
    )

    // Wait for promise to resolve
    await new Promise(r => setTimeout(r, 10))

    expect(exitCode).toBe(0)
  })

  it('should call onExit with code 1 on error', async () => {
    let exitCode: number | undefined

    runScript(
      async () => {
        throw new Error('fail')
      },
      {
        noExit: true,
        onExit: code => {
          exitCode = code
        }
      }
    )

    // Wait for promise to resolve
    await new Promise(r => setTimeout(r, 10))

    expect(exitCode).toBe(1)
  })

  it('should register signal handlers', () => {
    runScript(
      async () => {
        // Intentionally empty - test signal handler registration
      },
      { noExit: true }
    )

    expect(process.once).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(process.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    expect(process.once).toHaveBeenCalledWith('SIGHUP', expect.any(Function))
  })
})
