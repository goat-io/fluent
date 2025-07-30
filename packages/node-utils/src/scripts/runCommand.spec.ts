// npx vitest run ./src/scripts/runCommand.spec.ts
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn, execSync } from 'child_process'
import { runCommand } from './runCommand'
import { EventEmitter } from 'events'
import { Readable } from 'stream'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn()
}))

describe('runCommand', () => {
  let mockChildProcess: any
  let originalPlatform: PropertyDescriptor | undefined
  let processListeners: Map<string, Function[]>

  beforeEach(() => {
    // Store original platform
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    
    // Track process listeners
    processListeners = new Map()
    const originalOn = process.on.bind(process)
    const originalRemoveAllListeners = process.removeAllListeners.bind(process)
    
    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, listener: any) => {
      const eventKey = String(event)
      if (!processListeners.has(eventKey)) {
        processListeners.set(eventKey, [])
      }
      processListeners.get(eventKey)!.push(listener)
      return originalOn(event, listener) as any
    })
    
    vi.spyOn(process, 'removeAllListeners').mockImplementation((event?: string | symbol) => {
      if (event) {
        processListeners.delete(String(event))
      } else {
        processListeners.clear()
      }
      return originalRemoveAllListeners(event) as any
    })
    
    // Mock process.kill
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    // Create mock child process
    mockChildProcess = new EventEmitter()
    mockChildProcess.pid = 12345
    mockChildProcess.killed = false
    mockChildProcess.kill = vi.fn().mockImplementation(() => {
      mockChildProcess.killed = true
      return true
    })
    mockChildProcess.stdout = new Readable({
      read() {}
    })
    mockChildProcess.stderr = new Readable({
      read() {}
    })
    
    // Reset mocks
    vi.mocked(spawn).mockReturnValue(mockChildProcess as any)
    vi.mocked(execSync).mockImplementation(() => Buffer.from(''))
  })

  afterEach(() => {
    // Restore platform
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
    // Clean up any lingering listeners
    processListeners.forEach((_, event) => {
      process.removeAllListeners(event)
    })
    vi.clearAllMocks()
  })

  describe('normal execution', () => {
    test('should run command successfully', async () => {
      const commandPromise = runCommand('echo hello')
      
      // Simulate successful completion
      setImmediate(() => {
        mockChildProcess.emit('close', 0)
      })
      
      await expect(commandPromise).resolves.toBeUndefined()
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['echo hello']),
        expect.objectContaining({
          cwd: process.cwd(),
          stdio: 'inherit',
          env: process.env
        })
      )
    })

    test('should use correct shell based on platform', async () => {
      // Test Unix
      const unixPromise = runCommand('ls')
      setImmediate(() => mockChildProcess.emit('close', 0))
      await unixPromise
      
      expect(spawn).toHaveBeenCalledWith(
        'sh',
        ['-c', 'ls'],
        expect.any(Object)
      )
      
      // Test Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true
      })
      
      const winPromise = runCommand('dir')
      setImmediate(() => mockChildProcess.emit('close', 0))
      await winPromise
      
      expect(spawn).toHaveBeenCalledWith(
        'cmd',
        ['/c', 'dir'],
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    test('should reject when command exits with non-zero code', async () => {
      const commandPromise = runCommand('exit 1')
      
      setImmediate(() => {
        mockChildProcess.emit('close', 1)
      })
      
      await expect(commandPromise).rejects.toThrow('Process exited with code 1')
    })

    test('should reject when command exits with null code (killed)', async () => {
      const commandPromise = runCommand('sleep 10')
      
      setImmediate(() => {
        mockChildProcess.emit('close', null)
      })
      
      await expect(commandPromise).rejects.toThrow('Process terminated')
    })

    test('should reject on spawn error', async () => {
      const commandPromise = runCommand('some-command')
      const spawnError = new Error('spawn ENOENT')
      
      setImmediate(() => {
        mockChildProcess.emit('error', spawnError)
      })
      
      await expect(commandPromise).rejects.toThrow('spawn ENOENT')
    })

    test('should include stderr in error message when captureOutput is true', async () => {
      const commandPromise = runCommand('failing-command', { captureOutput: true })
      
      // Emit stderr data
      setImmediate(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('Error: Command failed'))
        mockChildProcess.emit('close', 1)
      })
      
      await expect(commandPromise).rejects.toThrow('Process exited with code 1: Error: Command failed')
    })
  })

  describe('signal handling', () => {
    test('should handle SIGINT gracefully', async () => {
      const commandPromise = runCommand('long-running-command')
      
      // Wait for listeners to be set up
      await new Promise(resolve => setImmediate(resolve))
      
      // Simulate SIGINT
      const sigintListeners = processListeners.get('SIGINT') || []
      expect(sigintListeners.length).toBeGreaterThan(0)
      
      // Mock console.log to verify message
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Trigger SIGINT
      sigintListeners[0]()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '\n\nReceived interrupt signal, shutting down gracefully...'
      )
      
      // Verify child process was killed (Unix)
      expect(process.kill).toHaveBeenCalledWith(-mockChildProcess.pid, 'SIGTERM')
      
      consoleSpy.mockRestore()
      
      // Clean up
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })

    test('should handle SIGTERM gracefully', async () => {
      const commandPromise = runCommand('long-running-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      const sigtermListeners = processListeners.get('SIGTERM') || []
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      sigtermListeners[0]()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '\nReceived SIGTERM, shutting down gracefully...'
      )
      
      consoleSpy.mockRestore()
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })

    test('should handle SIGHUP gracefully', async () => {
      const commandPromise = runCommand('long-running-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      const sighupListeners = processListeners.get('SIGHUP') || []
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      sighupListeners[0]()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '\nReceived SIGHUP, shutting down gracefully...'
      )
      
      consoleSpy.mockRestore()
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })

    test('should handle signal on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true
      })
      
      const commandPromise = runCommand('long-running-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()
      
      // Verify taskkill was called on Windows
      expect(execSync).toHaveBeenCalledWith(
        `taskkill /pid ${mockChildProcess.pid} /T /F`,
        { stdio: 'ignore' }
      )
      
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })

    test('should fallback to child.kill if process group kill fails', async () => {
      const commandPromise = runCommand('long-running-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      // Mock process.kill to throw
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('Kill failed')
      })
      
      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()
      
      // Verify fallback to child.kill
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')
      
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })

    test('should not kill process twice', async () => {
      const commandPromise = runCommand('long-running-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      mockChildProcess.killed = true
      
      const sigintListeners = processListeners.get('SIGINT') || []
      sigintListeners[0]()
      
      // Should not attempt to kill an already killed process
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      mockChildProcess.emit('close', null)
      await expect(commandPromise).rejects.toThrow()
    })
  })

  describe('process cleanup', () => {
    test('should remove all signal listeners on successful completion', async () => {
      const commandPromise = runCommand('echo test')
      
      await new Promise(resolve => setImmediate(resolve))
      
      // Verify listeners are registered
      expect(processListeners.get('SIGINT')).toBeDefined()
      expect(processListeners.get('SIGTERM')).toBeDefined()
      expect(processListeners.get('SIGHUP')).toBeDefined()
      
      mockChildProcess.emit('close', 0)
      await commandPromise
      
      // Verify removeAllListeners was called for each signal
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGINT')
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGTERM')
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGHUP')
    })

    test('should remove all signal listeners on error', async () => {
      const commandPromise = runCommand('failing-command')
      
      await new Promise(resolve => setImmediate(resolve))
      
      const error = new Error('Command failed')
      mockChildProcess.emit('error', error)
      
      await expect(commandPromise).rejects.toThrow('Command failed')
      
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGINT')
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGTERM')
      expect(process.removeAllListeners).toHaveBeenCalledWith('SIGHUP')
    })
  })

  describe('options', () => {
    test('should use cwd option', async () => {
      const customCwd = '/custom/path'
      const commandPromise = runCommand('pwd', { cwd: customCwd })
      
      setImmediate(() => mockChildProcess.emit('close', 0))
      await commandPromise
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: customCwd })
      )
    })

    test('should use workingDirectory option as alias for cwd', async () => {
      const customDir = '/working/directory'
      const commandPromise = runCommand('pwd', { workingDirectory: customDir })
      
      setImmediate(() => mockChildProcess.emit('close', 0))
      await commandPromise
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: customDir })
      )
    })

    test('should prefer cwd over workingDirectory if both provided', async () => {
      const commandPromise = runCommand('pwd', { 
        cwd: '/cwd/path',
        workingDirectory: '/working/directory'
      })
      
      setImmediate(() => mockChildProcess.emit('close', 0))
      await commandPromise
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: '/cwd/path' })
      )
    })

    test('should run silently when silent option is true', async () => {
      const commandPromise = runCommand('echo hello', { silent: true })
      
      setImmediate(() => mockChildProcess.emit('close', 0))
      await commandPromise
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ stdio: 'pipe' })
      )
    })

    test('should capture output when captureOutput is true', async () => {
      const commandPromise = runCommand('echo hello world', { captureOutput: true })
      
      setImmediate(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('hello world\n'))
        mockChildProcess.emit('close', 0)
      })
      
      const result = await commandPromise
      expect(result).toBe('hello world')
      
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ stdio: ['inherit', 'pipe', 'pipe'] })
      )
    })

    test('should capture stderr when captureOutput is true', async () => {
      const commandPromise = runCommand('command-with-stderr', { captureOutput: true })
      
      setImmediate(() => {
        mockChildProcess.stderr.emit('data', Buffer.from('error output'))
        mockChildProcess.stdout.emit('data', Buffer.from('normal output'))
        mockChildProcess.emit('close', 1)
      })
      
      await expect(commandPromise).rejects.toThrow('Process exited with code 1: error output')
    })

    test('should handle multiple data chunks when capturing output', async () => {
      const commandPromise = runCommand('echo multiline', { captureOutput: true })
      
      setImmediate(() => {
        mockChildProcess.stdout.emit('data', Buffer.from('line1\n'))
        mockChildProcess.stdout.emit('data', Buffer.from('line2\n'))
        mockChildProcess.stdout.emit('data', Buffer.from('line3'))
        mockChildProcess.emit('close', 0)
      })
      
      const result = await commandPromise
      expect(result).toBe('line1\nline2\nline3')
    })
  })

  describe('timeout behavior', () => {
    test('should allow long-running commands without timeout', async () => {
      const commandPromise = runCommand('sleep 5')
      
      // Simulate delayed completion
      setTimeout(() => {
        mockChildProcess.emit('close', 0)
      }, 100)
      
      await expect(commandPromise).resolves.toBeUndefined()
    })
  })
})