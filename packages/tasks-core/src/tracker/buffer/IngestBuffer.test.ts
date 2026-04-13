import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestBuffer } from './IngestBuffer'

describe('IngestBuffer', () => {
  describe('basic operations (with fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should add items to buffer', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 1000,
        strategy: 'STATIC',
      })

      await buffer.add('item1')
      expect(buffer.size).toBe(1)
      expect(flushFn).not.toHaveBeenCalled()
    })

    it('should add multiple items via addBatch', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 1000,
        strategy: 'STATIC',
      })

      await buffer.addBatch(['item1', 'item2', 'item3'])
      expect(buffer.size).toBe(3)
    })

    it('should flush when threshold is reached', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 3,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      await buffer.add('item1')
      await buffer.add('item2')
      expect(flushFn).not.toHaveBeenCalled()

      await buffer.add('item3')
      expect(flushFn).toHaveBeenCalledTimes(1)
      expect(flushFn).toHaveBeenCalledWith(['item1', 'item2', 'item3'])
      expect(buffer.size).toBe(0)
    })

    it('should flush after interval', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 50,
        strategy: 'STATIC',
      })

      await buffer.add('item1')
      expect(flushFn).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60)

      expect(flushFn).toHaveBeenCalledTimes(1)
      expect(flushFn).toHaveBeenCalledWith(['item1'])
    })

    it('should return correct size and pendingFlushes', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 1000,
        strategy: 'STATIC',
      })

      expect(buffer.size).toBe(0)
      expect(buffer.pendingFlushes).toBe(0)
      expect(buffer.isClosed).toBe(false)

      await buffer.add('item1')
      expect(buffer.size).toBe(1)
    })

    it('should not schedule flush after close', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 50,
        strategy: 'STATIC',
      })

      await buffer.add('item1')
      await buffer.drain()

      await vi.advanceTimersByTimeAsync(100)

      expect(flushFn).toHaveBeenCalledTimes(1)
    })

    it('should cancel scheduled flush timer on drain', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 50,
        strategy: 'STATIC',
      })

      await buffer.add('item1')
      await buffer.drain()

      expect(flushFn).toHaveBeenCalledTimes(1)
    })

    it('should handle empty buffer on drain', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 1000,
        strategy: 'STATIC',
      })

      await buffer.drain()

      expect(flushFn).not.toHaveBeenCalled()
      expect(buffer.isClosed).toBe(true)
    })
  })

  describe('STATIC strategy', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should always flush at exact threshold', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 5,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      for (let i = 0; i < 4; i++) {
        await buffer.add(`item${i}`)
      }
      expect(flushFn).not.toHaveBeenCalled()

      await buffer.add('item4')
      expect(flushFn).toHaveBeenCalledTimes(1)
      expect(flushFn).toHaveBeenCalledWith([
        'item0',
        'item1',
        'item2',
        'item3',
        'item4',
      ])
    })
  })

  describe('DYNAMIC strategy with Fibonacci sizing', () => {
    it('should calculate Fibonacci correctly', () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        strategy: 'DYNAMIC',
        flushIntervalMs: 10000,
      })

      const privateFib = (buffer as any).fibonacci.bind(buffer)

      // Test Fibonacci sequence: F(1)=1, F(2)=1, F(3)=2, F(4)=3, F(5)=5...
      expect(privateFib(1)).toBe(1)
      expect(privateFib(2)).toBe(1)
      expect(privateFib(3)).toBe(2)
      expect(privateFib(4)).toBe(3)
      expect(privateFib(5)).toBe(5)
      expect(privateFib(6)).toBe(8)
      expect(privateFib(7)).toBe(13)
      expect(privateFib(8)).toBe(21)
      expect(privateFib(9)).toBe(34)
      expect(privateFib(10)).toBe(55)
    })

    it('should use dynamic trigger size based on concurrent flushes', () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        strategy: 'DYNAMIC',
        flushIntervalMs: 10000,
        maxConcurrent: 50,
      })

      const getTriggerSize = (buffer as any).getTriggerSize.bind(buffer)

      // With 0 concurrent flushes: Fib(0+1) = Fib(1) = 1
      expect(getTriggerSize()).toBe(1)
    })

    it('should cap trigger size at flushThreshold', () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 5,
        strategy: 'DYNAMIC',
        flushIntervalMs: 10000,
        maxConcurrent: 50,
      })

      ;(buffer as any).concurrentFlushes = 10
      const getTriggerSize = (buffer as any).getTriggerSize.bind(buffer)

      expect(getTriggerSize()).toBeLessThanOrEqual(5)
    })
  })

  describe('concurrency control (with real timers)', () => {
    it('should respect maxConcurrent limit', async () => {
      let activeFlushes = 0
      let maxActiveFlushes = 0

      const flushFn = vi.fn().mockImplementation(async () => {
        activeFlushes++
        maxActiveFlushes = Math.max(maxActiveFlushes, activeFlushes)
        await new Promise(resolve => setTimeout(resolve, 50))
        activeFlushes--
      })

      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 2,
        maxConcurrent: 2,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      await buffer.add('item1')
      await buffer.add('item2')

      await buffer.add('item3')
      await buffer.add('item4')

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(maxActiveFlushes).toBeLessThanOrEqual(2)
    })

    it('should track pending flush count', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)

      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 2,
        maxConcurrent: 5,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      // Before any flushes
      expect(buffer.pendingFlushes).toBe(0)

      // Trigger a flush
      await buffer.add('item1')
      await buffer.add('item2')

      // After sync flush completes
      expect(buffer.pendingFlushes).toBe(0)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return items to buffer on flush error', async () => {
      const flushFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Flush failed'))
        .mockResolvedValueOnce(undefined)

      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 2,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await buffer.add('item1')
      await buffer.add('item2')

      expect(buffer.size).toBe(2)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[IngestBuffer] Flush failed'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('should throw when adding to closed buffer', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 1000,
        strategy: 'STATIC',
      })

      await buffer.drain()

      await expect(buffer.add('item')).rejects.toThrow('Buffer is closed')
      await expect(buffer.addBatch(['item'])).rejects.toThrow(
        'Buffer is closed',
      )
    })
  })

  describe('drain (with real timers)', () => {
    it('should flush all remaining items on drain', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 100,
        flushIntervalMs: 10000,
        strategy: 'STATIC',
      })

      await buffer.add('item1')
      await buffer.add('item2')
      await buffer.add('item3')
      expect(buffer.size).toBe(3)

      await buffer.drain()

      expect(flushFn).toHaveBeenCalledWith(['item1', 'item2', 'item3'])
      expect(buffer.size).toBe(0)
      expect(buffer.isClosed).toBe(true)
    })

    it('should wait for pending flushes before final drain', async () => {
      let _flushCallCount = 0
      const flushFn = vi.fn().mockImplementation(async () => {
        _flushCallCount++
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 2,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      // Trigger a flush
      await buffer.add('item1')
      await buffer.add('item2')

      // Add more items
      await buffer.add('item3')

      // Drain should wait for pending flush and then flush remaining
      await buffer.drain()

      expect(buffer.isClosed).toBe(true)
      expect(buffer.size).toBe(0)
    })
  })

  describe('batch operations (with real timers)', () => {
    it('should flush when batch exceeds threshold', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 5,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      await buffer.addBatch(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

      expect(flushFn).toHaveBeenCalled()
    })

    it('should handle sequential flushes during large batch', async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined)
      const buffer = new IngestBuffer(flushFn, {
        flushThreshold: 10,
        strategy: 'STATIC',
        flushIntervalMs: 10000,
      })

      const items = Array.from({ length: 25 }, (_, i) => `item${i}`)
      await buffer.addBatch(items)

      // addBatch adds all items then checks threshold once
      // So it should flush once if items >= threshold
      expect(flushFn).toHaveBeenCalled()
    })
  })
})
