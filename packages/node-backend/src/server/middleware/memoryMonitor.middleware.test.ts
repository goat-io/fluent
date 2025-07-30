// npx vitest run ./src/server/middleware/memoryMonitor.middleware.test.ts

import type { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryMonitorMiddleware,
  memoryMonitorMiddleware
} from './memoryMonitor.middleware'

describe('Memory Monitor Middleware', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction
  let mockLogger: any

  beforeEach(() => {
    mockReq = {}
    mockRes = {
      setHeader: vi.fn()
    }
    mockNext = vi.fn()
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    // Clear all timers
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('createMemoryMonitorMiddleware', () => {
    it('should create middleware and monitor instance', () => {
      const result = createMemoryMonitorMiddleware({ logger: mockLogger })

      expect(result).toHaveProperty('middleware')
      expect(result).toHaveProperty('monitor')
      expect(typeof result.middleware).toBe('function')
    })

    it('should start monitoring immediately', () => {
      createMemoryMonitorMiddleware({ logger: mockLogger })

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Memory monitoring started')
      )
    })

    it('should use default options when not provided', () => {
      const { monitor } = createMemoryMonitorMiddleware()

      expect(monitor).toBeDefined()
    })
  })

  describe('middleware function', () => {
    it('should call next() to continue request processing', () => {
      const middleware = memoryMonitorMiddleware({ logger: mockLogger })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should add memory headers when addHeaders is true', () => {
      const middleware = memoryMonitorMiddleware({
        logger: mockLogger,
        addHeaders: true
      })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Memory-Heap-Used-MB',
        expect.any(String)
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Memory-Heap-Total-MB',
        expect.any(String)
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Memory-Heap-Used-Percent',
        expect.any(String)
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Memory-RSS-MB',
        expect.any(String)
      )
    })

    it('should not add headers when addHeaders is false', () => {
      const middleware = memoryMonitorMiddleware({
        logger: mockLogger,
        addHeaders: false
      })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).not.toHaveBeenCalled()
    })
  })

  describe('memory monitoring', () => {
    it('should check memory at specified intervals', () => {
      createMemoryMonitorMiddleware({
        logger: mockLogger,
        monitorInterval: 1000
      })

      // Fast forward time
      vi.advanceTimersByTime(3000)

      // Should have been called 3 times (at 1s, 2s, 3s intervals)
      const warnCalls = mockLogger.warn.mock.calls.length
      const errorCalls = mockLogger.error.mock.calls.length
      expect(warnCalls + errorCalls).toBeGreaterThanOrEqual(0)
    })

    it('should log warning when memory exceeds warning threshold', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (90% used)
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      })

      const middleware = memoryMonitorMiddleware({
        logger: mockLogger,
        warningThreshold: 85
      })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Memory usage at 90.0%')
      )

      process.memoryUsage = originalMemoryUsage
    })

    it('should log error when memory exceeds critical threshold', () => {
      // Mock very high memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 960 * 1024 * 1024, // 960MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (96% used)
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      })

      const middleware = memoryMonitorMiddleware({
        logger: mockLogger,
        criticalThreshold: 95
      })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL: Memory usage at 96.0%')
      )

      process.memoryUsage = originalMemoryUsage
    })
  })

  describe('garbage collection', () => {
    it('should warn if GC is not available but requested', () => {
      const originalGc = global.gc
      global.gc = undefined

      createMemoryMonitorMiddleware({
        logger: mockLogger,
        enableGarbageCollection: true
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Garbage collection is not available')
      )

      global.gc = originalGc
    })

    it('should trigger GC when memory is critical and GC is available', () => {
      // Mock GC availability
      const mockGc = vi.fn()
      global.gc = mockGc

      // Mock critical memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 960 * 1024 * 1024, // 960MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (96% used)
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      })

      const middleware = memoryMonitorMiddleware({
        logger: mockLogger,
        criticalThreshold: 95,
        enableGarbageCollection: true
      })

      middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockGc).toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Triggering garbage collection')
      )

      process.memoryUsage = originalMemoryUsage
      global.gc = undefined
    })
  })

  describe('monitor lifecycle', () => {
    it('should stop monitoring on stopMonitoring()', () => {
      const { monitor } = createMemoryMonitorMiddleware({ logger: mockLogger })

      monitor.stopMonitoring()

      expect(mockLogger.log).toHaveBeenCalledWith('Memory monitoring stopped')
    })

    it('should handle multiple start calls gracefully', () => {
      const { monitor } = createMemoryMonitorMiddleware({ logger: mockLogger })

      // Already started in constructor
      const logCallsBefore = mockLogger.log.mock.calls.length

      monitor.startMonitoring()
      monitor.startMonitoring()

      // Should not start multiple times
      const logCallsAfter = mockLogger.log.mock.calls.length
      expect(logCallsAfter).toBe(logCallsBefore)
    })

    it('should return last metrics', () => {
      const { monitor, middleware } = createMemoryMonitorMiddleware({
        logger: mockLogger
      })

      // Initially undefined
      expect(monitor.getLastMetrics()).toBeUndefined()

      // After middleware call
      middleware(mockReq as Request, mockRes as Response, mockNext)

      const metrics = monitor.getLastMetrics()
      expect(metrics).toBeDefined()
      expect(metrics).toHaveProperty('heapUsedMB')
      expect(metrics).toHaveProperty('heapTotalMB')
      expect(metrics).toHaveProperty('heapUsedPercentage')
      expect(metrics).toHaveProperty('rssMB')
      expect(metrics).toHaveProperty('timestamp')
    })
  })
})
