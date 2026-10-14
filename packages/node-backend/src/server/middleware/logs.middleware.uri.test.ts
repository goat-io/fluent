// pnpm exec vitest run --config vitest.logging.config.ts
import { EventEmitter } from 'node:events'
import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { expressRequestLogger } from './logs.middleware'

describe('request logging URI safety', () => {
  it.each([
    [400, '/trpc/posts.homeFeed?input=%ZZ', 'warn'],
    [500, '/trpc/posts.homeFeed?input=%E0%A4%A', 'error'],
    [404, '/api/broken%', 'warn'],
    [200, '/api/test?value=%ZZ', 'log'],
  ] as const)(
    'logs %s malformed URI without throwing from finish',
    (statusCode, originalUrl, level) => {
      const request = { method: 'GET', originalUrl } as Request
      const response = Object.assign(new EventEmitter(), {
        statusCode,
        statusMessage: 'fixture',
      }) as unknown as Response
      const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const next = vi.fn()
      const shouldLogSuccess = vi.fn(() => statusCode < 400)
      expressRequestLogger(request, response, next, logger, undefined, {
        shouldLogSuccess,
        sampleSlowSuccesses: true,
      })
      expect(() => response.emit('finish')).not.toThrow()
      expect(next).toHaveBeenCalledOnce()
      expect(logger[level]).toHaveBeenCalledOnce()
      expect(logger[level]).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          httpStatus: statusCode,
          httpMethod: 'GET',
        }),
      )
      if (statusCode >= 400) {
        expect(shouldLogSuccess).not.toHaveBeenCalled()
      }
    },
  )
})
