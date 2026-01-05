// npx vitest run ./src/scripts/runScript.spec.ts

import type { CommonLogger } from '@goatlab/js-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { formatDuration, runScript } from './runScript'

describe('runScript', () => {
  let mockLogger: CommonLogger
  let originalExit: typeof process.exit
  let processListeners: Map<string, Array<(...args: any[]) => any>>
  let exitSpy: any

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    }

    // Mock process.exit
    originalExit = process.exit
    exitSpy = vi.fn()
    process.exit = exitSpy as any

    // Track process listeners
    processListeners = new Map()
    const originalOn = process.on.bind(process)
    const originalOnce = process.once.bind(process)
    const originalRemoveAllListeners = process.removeAllListeners.bind(process)

    vi.spyOn(process, 'on').mockImplementation(
      (event: string | symbol, listener: any) => {
        const eventKey = String(event)
        if (!processListeners.has(eventKey)) {
          processListeners.set(eventKey, [])
        }
        processListeners.get(eventKey)!.push(listener)
        return originalOn(event, listener) as any
      }
    )

    vi.spyOn(process, 'once').mockImplementation(
      (event: string | symbol, listener: any) => {
        const eventKey = String(event)
        if (!processListeners.has(eventKey)) {
          processListeners.set(eventKey, [])
        }
        processListeners.get(eventKey)!.push(listener)
        return originalOnce(event, listener) as any
      }
    )

    vi.spyOn(process, 'removeAllListeners').mockImplementation(
      (event?: string | symbol) => {
        if (event) {
          processListeners.delete(String(event))
        } else {
          processListeners.clear()
        }
        return originalRemoveAllListeners(event) as any
      }
    )
  })

  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit

    // Clean up listeners - use the real removeAllListeners
    const realRemoveAllListeners = process.removeAllListeners.bind(process)
    vi.mocked(process.removeAllListeners).mockRestore()

    // Remove all listeners that were added during tests
    realRemoveAllListeners('uncaughtException')
    realRemoveAllListeners('unhandledRejection')
    realRemoveAllListeners('SIGINT')
    realRemoveAllListeners('SIGTERM')
    realRemoveAllListeners('SIGHUP')

    processListeners.clear()
    vi.clearAllMocks()
  })

  describe('normal execution', () => {
    test('should execute async function successfully', async () => {
      let executed = false
      const fn = async () => {
        executed = true
        return 'success'
      }

      runScript(fn, { logger: mockLogger })

      // Wait for promise to resolve
      await new Promise(resolve => setImmediate(resolve))

      expect(executed).toBe(true)
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should work with default console logger', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - suppress console output in tests
      })

      runScript(async () => {
        // Simple function
      })

      await new Promise(resolve => setImmediate(resolve))

      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    test('should not exit when noExit option is true', async () => {
      const fn = async () => {
        return 'completed'
      }

      runScript(fn, { noExit: true, logger: mockLogger })

      await new Promise(resolve => setImmediate(resolve))

      expect(exitSpy).not.toHaveBeenCalled()
    })

    test('should handle synchronous errors thrown before async', () => {
      const error = new Error('Sync error')
      const fn = () => {
        throw error
      }

      // This will throw synchronously, so we need to catch it
      expect(() => runScript(fn as any, { logger: mockLogger })).toThrow(
        'Sync error'
      )
    })
  })

  describe('error handling', () => {
    test('should handle promise rejection', async () => {
      const error = new Error('Async error')
      const fn = async () => {
        throw error
      }

      runScript(fn, { logger: mockLogger })

      await new Promise(resolve => setImmediate(resolve))

      expect(mockLogger.error).toHaveBeenCalledWith('runScript error:', error)
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should handle uncaught exceptions', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        },
        { logger: mockLogger }
      )

      // Wait for setup
      await new Promise(resolve => setImmediate(resolve))

      // Simulate uncaught exception
      const uncaughtListeners = processListeners.get('uncaughtException') || []
      expect(uncaughtListeners.length).toBeGreaterThan(0)

      const testError = new Error('Uncaught error')
      uncaughtListeners[0](testError)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'uncaughtException:',
        testError
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should handle unhandled rejections', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        },
        { logger: mockLogger }
      )

      // Wait for setup
      await new Promise(resolve => setImmediate(resolve))

      // Simulate unhandled rejection
      const unhandledListeners =
        processListeners.get('unhandledRejection') || []
      expect(unhandledListeners.length).toBeGreaterThan(0)

      const testError = new Error('Unhandled rejection')
      unhandledListeners[0](testError)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'unhandledRejection:',
        testError
      )
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should call onError callback on promise rejection', async () => {
      const error = new Error('Test error')
      const onError = vi.fn()

      runScript(
        async () => {
          throw error
        },
        { logger: mockLogger, onError }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(onError).toHaveBeenCalledWith(error)
      expect(mockLogger.error).toHaveBeenCalledWith('runScript error:', error)
    })

    test('should call onError callback on uncaught exception', async () => {
      const onError = vi.fn()

      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        },
        { logger: mockLogger, onError }
      )

      await new Promise(resolve => setImmediate(resolve))

      const uncaughtListeners = processListeners.get('uncaughtException') || []
      const testError = new Error('Uncaught')
      uncaughtListeners[0](testError)

      expect(onError).toHaveBeenCalledWith(testError)
    })
  })

  describe('signal handling', () => {
    test('should handle SIGINT signal', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      // Simulate SIGINT
      const sigintListeners = processListeners.get('SIGINT') || []
      expect(sigintListeners.length).toBeGreaterThan(0)
      sigintListeners[0]()

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Received SIGINT, shutting down…'
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should handle SIGTERM signal', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      const sigtermListeners = processListeners.get('SIGTERM') || []
      sigtermListeners[0]()

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Received SIGTERM, shutting down…'
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should handle SIGHUP signal', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      const sighupListeners = processListeners.get('SIGHUP') || []
      sighupListeners[0]()

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Received SIGHUP, shutting down…'
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should not exit on signal when noExit is true', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger, noExit: true }
      )

      await new Promise(resolve => setImmediate(resolve))

      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Received SIGINT, shutting down…'
      )
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('process cleanup', () => {
    test('should remove all listeners on successful completion', async () => {
      runScript(
        async () => {
          // Quick completion
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(process.removeAllListeners).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should remove all listeners on error', async () => {
      runScript(
        async () => {
          throw new Error('Test error')
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(process.removeAllListeners).toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should prevent multiple exits', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      // Trigger multiple exit conditions
      const sigintListeners = processListeners.get('SIGINT') || []
      const sigtermListeners = processListeners.get('SIGTERM') || []

      sigintListeners[0]()
      sigtermListeners[0]()

      // Should only exit once
      expect(exitSpy).toHaveBeenCalledTimes(1)
      expect(exitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('onExit callback', () => {
    test('should call onExit with code 0 on success', async () => {
      const onExit = vi.fn()

      runScript(
        async () => {
          return 'done'
        },
        { logger: mockLogger, onExit }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(onExit).toHaveBeenCalledWith(0)
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should call onExit with code 1 on error', async () => {
      const onExit = vi.fn()

      runScript(
        async () => {
          throw new Error('Failed')
        },
        { logger: mockLogger, onExit }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(onExit).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('should call onExit on signal', async () => {
      const onExit = vi.fn()

      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger, onExit }
      )

      await new Promise(resolve => setImmediate(resolve))

      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()

      expect(onExit).toHaveBeenCalledWith(0)
    })
  })

  describe('edge cases', () => {
    test('should handle function that returns non-promise', async () => {
      const fn = (() => Promise.resolve('not a real async function')) as any

      runScript(fn, { logger: mockLogger })

      await new Promise(resolve => setImmediate(resolve))

      // Should complete successfully
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should handle empty options object', async () => {
      runScript(async () => {
        return 'done'
      }, {})

      await new Promise(resolve => setImmediate(resolve))

      // Should use console as default logger
      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should handle no options', async () => {
      runScript(async () => {
        return 'done'
      })

      await new Promise(resolve => setImmediate(resolve))

      expect(exitSpy).toHaveBeenCalledWith(0)
    })

    test('should register signal handlers only once per signal', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      // Check that we used 'once' for signal handlers
      expect(process.once).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(process.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(process.once).toHaveBeenCalledWith('SIGHUP', expect.any(Function))
    })
  })

  describe('execution duration logging', () => {
    test('should log duration on successful completion', async () => {
      runScript(
        async () => {
          return 'done'
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^Script completed in \d+ms$/)
      )
    })

    test('should log duration on error', async () => {
      runScript(
        async () => {
          throw new Error('Failed')
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^Script failed in \d+ms$/)
      )
    })

    test('should log duration on signal', async () => {
      runScript(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1000))
        },
        { logger: mockLogger }
      )

      await new Promise(resolve => setImmediate(resolve))

      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringMatching(/^Script completed in \d+ms$/)
      )
    })
  })
})

describe('formatDuration', () => {
  test('should format milliseconds only', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(1)).toBe('1ms')
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  test('should format seconds and milliseconds', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(1001)).toBe('1s 1ms')
    expect(formatDuration(1500)).toBe('1s 500ms')
    expect(formatDuration(59999)).toBe('59s 999ms')
  })

  test('should format minutes, seconds, and milliseconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(60001)).toBe('1m 0s 1ms')
    expect(formatDuration(61000)).toBe('1m 1s')
    expect(formatDuration(61500)).toBe('1m 1s 500ms')
    expect(formatDuration(3599999)).toBe('59m 59s 999ms')
  })

  test('should format hours, minutes, seconds, and milliseconds', () => {
    expect(formatDuration(3600000)).toBe('1h 0m 0s')
    expect(formatDuration(3600001)).toBe('1h 0m 0s 1ms')
    expect(formatDuration(3661000)).toBe('1h 1m 1s')
    expect(formatDuration(3661500)).toBe('1h 1m 1s 500ms')
    expect(formatDuration(7323300)).toBe('2h 2m 3s 300ms')
  })

  test('should handle exact boundaries', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(3600000)).toBe('1h 0m 0s')
  })

  test('should handle large durations', () => {
    // 25 hours, 30 minutes, 45 seconds, 123ms
    const duration = 25 * 3600000 + 30 * 60000 + 45 * 1000 + 123
    expect(formatDuration(duration)).toBe('25h 30m 45s 123ms')
  })
})
