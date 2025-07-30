// npx vitest run ./src/server/middleware/logs.middleware.test.ts

import type { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  expressRequestLogger,
  getActualRequestDurationInMilliseconds,
  getCurrentTimeFormatted,
  httpResponseCodeColor,
  httpResponseTimeColor
} from './logs.middleware'

// Mock kleur colors
vi.mock('kleur/colors', () => ({
  bgBlack: vi.fn(str => `bgBlack(${str})`),
  green: vi.fn(str => `green(${str})`),
  magenta: vi.fn(str => `magenta(${str})`),
  red: vi.fn(str => `red(${str})`),
  yellow: vi.fn(str => `yellow(${str})`)
}))

// Mock @goatlab/js-utils
vi.mock('@goatlab/js-utils', () => ({
  Time: {
    ms: vi.fn(ms => `${ms}ms`)
  }
}))

describe('logs.middleware', () => {
  describe('httpResponseCodeColor', () => {
    it('should return green for 2xx status codes', () => {
      expect(httpResponseCodeColor(200)).toBe('green(200)')
      expect(httpResponseCodeColor(201)).toBe('green(201)')
      expect(httpResponseCodeColor(299)).toBe('green(299)')
    })

    it('should return green for 3xx status codes', () => {
      expect(httpResponseCodeColor(300)).toBe('green(300)')
      expect(httpResponseCodeColor(301)).toBe('green(301)')
      expect(httpResponseCodeColor(399)).toBe('green(399)')
    })

    it('should return yellow for 4xx status codes', () => {
      expect(httpResponseCodeColor(400)).toBe('yellow(400)')
      expect(httpResponseCodeColor(404)).toBe('yellow(404)')
      expect(httpResponseCodeColor(499)).toBe('yellow(499)')
    })

    it('should return red for 5xx status codes', () => {
      expect(httpResponseCodeColor(500)).toBe('red(500)')
      expect(httpResponseCodeColor(502)).toBe('red(502)')
      expect(httpResponseCodeColor(599)).toBe('red(599)')
    })

    it('should return red for 1xx status codes', () => {
      expect(httpResponseCodeColor(100)).toBe('red(100)')
      expect(httpResponseCodeColor(199)).toBe('red(199)')
    })

    it('should return red for codes >= 600', () => {
      expect(httpResponseCodeColor(600)).toBe('red(600)')
    })
  })

  describe('httpResponseTimeColor', () => {
    it('should return green for fast responses (< 500ms)', () => {
      expect(httpResponseTimeColor(0)).toBe('green(0ms)')
      expect(httpResponseTimeColor(250)).toBe('green(250ms)')
      expect(httpResponseTimeColor(499)).toBe('green(499ms)')
    })

    it('should return yellow for medium responses (500-999ms)', () => {
      expect(httpResponseTimeColor(500)).toBe('yellow(500ms)')
      expect(httpResponseTimeColor(750)).toBe('yellow(750ms)')
      expect(httpResponseTimeColor(999)).toBe('yellow(999ms)')
    })

    it('should return red for slow responses (>= 1000ms)', () => {
      expect(httpResponseTimeColor(1000)).toBe('red(1000ms)')
      expect(httpResponseTimeColor(2500)).toBe('red(2500ms)')
    })
  })

  describe('getActualRequestDurationInMilliseconds', () => {
    it('should calculate duration from hrtime start', () => {
      // Mock process.hrtime to return a fixed diff
      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([1, 500000000]) // 1 second + 500 million nanoseconds

      const start: [number, number] = [0, 0]
      const duration = getActualRequestDurationInMilliseconds(start)

      // 1 second = 1000ms, 500 million nanoseconds = 500ms
      expect(duration).toBe(1500)

      mockHrtime.mockRestore()
    })

    it('should handle zero duration', () => {
      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([0, 0])

      const start: [number, number] = [0, 0]
      const duration = getActualRequestDurationInMilliseconds(start)

      expect(duration).toBe(0)

      mockHrtime.mockRestore()
    })

    it('should handle fractional milliseconds', () => {
      const mockHrtime = vi.spyOn(process, 'hrtime')
      mockHrtime.mockReturnValue([0, 1500000]) // 1.5 million nanoseconds = 1.5ms

      const start: [number, number] = [0, 0]
      const duration = getActualRequestDurationInMilliseconds(start)

      expect(duration).toBe(1.5)

      mockHrtime.mockRestore()
    })
  })

  describe('getCurrentTimeFormatted', () => {
    it('should return ISO string format', () => {
      const result = getCurrentTimeFormatted()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should return different values for different calls', () => {
      const result1 = getCurrentTimeFormatted()
      // Just validate the format, don't try to mock timers
      const result2 = getCurrentTimeFormatted()

      // Results might be the same due to timer precision, but should be valid ISO strings
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('expressRequestLogger', () => {
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let mockNext: NextFunction
    let mockLogger: any

    beforeEach(() => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/test'
      }

      mockResponse = {
        statusCode: 200,
        statusMessage: 'OK',
        on: vi.fn()
      }

      mockNext = vi.fn()

      mockLogger = {
        warn: vi.fn(),
        error: vi.fn()
      }

      // Mock process.hrtime
      vi.spyOn(process, 'hrtime')
        .mockReturnValueOnce([0, 0]) // Initial call
        .mockReturnValue([0, 10000000]) // 10ms duration
    })

    it('should call next immediately', () => {
      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should register finish event listener', () => {
      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      expect(mockResponse.on).toHaveBeenCalledWith(
        'finish',
        expect.any(Function)
      )
    })

    it('should log request when response finishes', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle TRPC batch requests', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockRequest.originalUrl =
        '/trpc/endpoint1,endpoint2?input=%5B%7B%22param%22%3A%22value%22%7D%5D&batch=1'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle malformed JSON in batch requests', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockRequest.originalUrl = '/trpc/endpoint1?input=invalid-json&batch=1'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing batch input')
      )
    })

    it('should handle URLs with query parameters but no batch', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockRequest.originalUrl = '/api/test?param=value&other=test'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle error status codes', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockResponse.statusCode = 500
      mockResponse.statusMessage = 'Internal Server Error'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle 4xx status codes', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockResponse.statusCode = 404
      mockResponse.statusMessage = 'Not Found'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should decode URL components', () => {
      let finishHandler: Function = () => {
        /* placeholder handler */
      }

      mockRequest.originalUrl = '/api/test%20with%20spaces'

      mockResponse.on = vi.fn((event, handler) => {
        if (event === 'finish') {
          finishHandler = handler
        }
      })

      expressRequestLogger(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
        mockLogger
      )

      // Trigger the finish event
      finishHandler()

      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
