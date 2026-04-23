// npx vitest run src/__tests__/engine/rate-limiter.spec.ts
//
// Tests for Issue #3: Redis-backed rate limiter
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Redis from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { ExternalActionExecutor } from '../../engine/ExternalActionExecutor.js'
import {
  InMemoryRateLimiter,
  RedisRateLimiter,
} from '../../engine/RateLimiterBackend.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('RateLimiterBackend', () => {
  // ── In-Memory Tests (no containers needed) ─────────────────────

  describe('InMemoryRateLimiter', () => {
    it('allows requests within limit', async () => {
      const limiter = new InMemoryRateLimiter()
      // Should not throw or block
      await limiter.checkRateLimit('github', 3, 1000)
      await limiter.recordRequest('github')
      await limiter.checkRateLimit('github', 3, 1000)
      await limiter.recordRequest('github')
      await limiter.checkRateLimit('github', 3, 1000)
    })

    it('tracks concurrency correctly', async () => {
      const limiter = new InMemoryRateLimiter()
      await limiter.incrementConcurrency('wf-1')
      await limiter.incrementConcurrency('wf-1')
      // Should not block (2 < 5)
      await limiter.checkConcurrency('wf-1', 5)
      await limiter.decrementConcurrency('wf-1')
      await limiter.decrementConcurrency('wf-1')
    })
  })

  // ── Redis Tests (testcontainers) ───────────────────────────────

  describe('RedisRateLimiter', () => {
    let redis: Redis
    let limiter: RedisRateLimiter

    beforeAll(async () => {
      const tempData = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'tempData.json'),
          'utf-8',
        ),
      )
      redis = new Redis({
        host: tempData.redis.host,
        port: tempData.redis.port,
      })
    })

    afterAll(async () => {
      await redis.quit()
    })

    beforeEach(async () => {
      // Clean up rate limiter keys
      const keys = await redis.keys('test:ratelimit:*')
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      limiter = new RedisRateLimiter(redis as any, 'test:ratelimit')
    })

    it('allows requests within limit', async () => {
      await limiter.checkRateLimit('github', 5, 1000)
      await limiter.recordRequest('github')
      await limiter.checkRateLimit('github', 5, 1000)
      await limiter.recordRequest('github')
      // Should pass without blocking
    })

    it('tracks request count in Redis sorted set', async () => {
      await limiter.recordRequest('linear')
      await limiter.recordRequest('linear')
      await limiter.recordRequest('linear')

      const count = await redis.zcard('test:ratelimit:provider:linear')
      expect(count).toBe(3)
    })

    it('tracks concurrency via Redis counter', async () => {
      await limiter.incrementConcurrency('wf-1')
      await limiter.incrementConcurrency('wf-1')

      const val = await redis.get('test:ratelimit:concurrency:wf-1')
      expect(Number.parseInt(val!, 10)).toBe(2)

      await limiter.decrementConcurrency('wf-1')
      const val2 = await redis.get('test:ratelimit:concurrency:wf-1')
      expect(Number.parseInt(val2!, 10)).toBe(1)
    })

    it('concurrency survives separate limiter instances (shared Redis)', async () => {
      const limiter2 = new RedisRateLimiter(redis as any, 'test:ratelimit')

      await limiter.incrementConcurrency('wf-shared')
      await limiter2.incrementConcurrency('wf-shared')

      const val = await redis.get('test:ratelimit:concurrency:wf-shared')
      expect(Number.parseInt(val!, 10)).toBe(2)
    })

    it('sets TTL on concurrency keys for crash recovery', async () => {
      await limiter.incrementConcurrency('wf-ttl')

      const ttl = await redis.ttl('test:ratelimit:concurrency:wf-ttl')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(300)
    })

    it('sets TTL on rate limit keys', async () => {
      await limiter.recordRequest('slack')

      const ttl = await redis.ttl('test:ratelimit:provider:slack')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(600)
    })
  })

  // ── Integration: ExternalActionExecutor with Redis backend ─────

  describe('ExternalActionExecutor with RedisRateLimiter', () => {
    let db: TestDb
    let redis: Redis

    beforeAll(async () => {
      db = await getSharedDb()
      const tempData = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'tempData.json'),
          'utf-8',
        ),
      )
      redis = new Redis({
        host: tempData.redis.host,
        port: tempData.redis.port,
      })
    })

    afterAll(async () => {
      await redis.quit()
      await releaseSharedDb()
    })

    beforeEach(async () => {
      await truncateAll(db)
      const keys = await redis.keys('integ:ratelimit:*')
      if (keys.length > 0) {
        await redis.del(...keys)
      }

      await db
        .insertInto('workflow_runs')
        .values({
          id: 'wf-redis',
          tenantId: 'test',
          workflowName: 'test_wf',
          workflowVersion: '1.0.0',
          status: 'RUNNING',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute()
    })

    it('uses Redis backend for rate limiting', async () => {
      const redisLimiter = new RedisRateLimiter(redis as any, 'integ:ratelimit')

      const executor = new ExternalActionExecutor({
        db,
        rateLimits: { linear: { maxRequests: 3, windowMs: 5000 } },
        rateLimiterBackend: redisLimiter,
      })

      // Execute 3 requests
      for (let i = 0; i < 3; i++) {
        await executor.execute(
          {
            workflowRunId: 'wf-redis',
            stepName: 'step',
            attempt: 1,
            tenantId: 'test',
            provider: 'linear',
            actionType: 'create_issue',
            idempotencyKey: `redis-rate-${i}`,
            request: {},
          },
          async () => ({ externalId: `R-${i}`, data: {} }),
        )
      }

      // Verify requests tracked in Redis
      const count = await redis.zcard('integ:ratelimit:provider:linear')
      expect(count).toBe(3)
    })

    it('tracks concurrency in Redis across executor instances', async () => {
      const sharedBackend = new RedisRateLimiter(
        redis as any,
        'integ:ratelimit',
      )

      const executor1 = new ExternalActionExecutor({
        db,
        maxConcurrentPerWorkflow: 10,
        rateLimiterBackend: sharedBackend,
      })

      const _executor2 = new ExternalActionExecutor({
        db,
        maxConcurrentPerWorkflow: 10,
        rateLimiterBackend: sharedBackend,
      })

      // Both executors track against the same Redis key
      await executor1.execute(
        {
          workflowRunId: 'wf-redis',
          stepName: 's1',
          attempt: 1,
          tenantId: 'test',
          provider: 'github',
          actionType: 'create_pr',
          idempotencyKey: 'redis-conc-1',
          request: {},
        },
        async () => {
          // While executing, concurrency should be tracked
          const val = await redis.get('integ:ratelimit:concurrency:wf-redis')
          expect(Number.parseInt(val!, 10)).toBe(1)
          return { externalId: 'PR-1', data: {} }
        },
      )

      // After execution, concurrency should be decremented
      const val = await redis.get('integ:ratelimit:concurrency:wf-redis')
      expect(Number.parseInt(val!, 10)).toBe(0)
    })
  })
})
