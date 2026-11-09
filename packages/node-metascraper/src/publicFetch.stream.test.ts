// pnpm --filter @goatlab/node-metascraper test src/publicFetch.stream.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicFetch, sendPinned } from './publicFetch.js'

const m = vi.hoisted(() => ({
  mode: 'ok',
  options: null as any,
  responseDestroyed: false,
  requestDestroyed: false,
}))
vi.mock('node:https', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    request: vi.fn(
      (_url: URL, options: any, callback: (response: any) => void) => {
        m.options = options
        const req = new EventEmitter() as any
        req.destroy = () => {
          m.requestDestroyed = true
        }
        options.signal.addEventListener('abort', () => {
          req.destroy()
          req.emit('error', new Error('aborted'))
        })
        req.end = () => {
          if (m.mode === 'stall') {
            return
          }
          const response = new EventEmitter() as any
          response.statusCode = 200
          response.headers =
            m.mode === 'declared'
              ? { 'content-length': '100' }
              : m.mode === 'compressed'
                ? { 'content-encoding': 'gzip' }
                : {}
          response.destroy = () => {
            m.responseDestroyed = true
          }
          callback(response)
          if (!m.responseDestroyed) {
            response.emit(
              'data',
              Buffer.from(m.mode === 'stream' ? 'too large' : 'okay'),
            )
          }
          if (!m.responseDestroyed) {
            response.emit('end')
          }
        }
        return req
      },
    ),
  }
})
vi.mock('node:http', async () => ({
  request: (await import('node:https')).request,
}))
beforeEach(() => {
  m.mode = 'ok'
  m.options = null
  m.responseDestroyed = false
  m.requestDestroyed = false
})
const input = () => ({
  url: new URL('https://example.org/'),
  address: '8.8.8.8',
  maxBytes: 4,
  signal: new AbortController().signal,
})
describe('pinned streamed requests without network access', () => {
  it('pins lookup while retaining URL hostname and normal TLS verification', async () => {
    expect((await sendPinned(input())).body.toString()).toBe('okay')
    const callback = vi.fn()
    m.options.lookup('example.org', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4)
    expect(m.options.rejectUnauthorized).not.toBe(false)
    expect(m.options.headers['Accept-Encoding']).toBe('identity')
  })
  it.each(['declared', 'stream', 'compressed'])(
    'destroys rejected %s response without retaining an unbounded body',
    async mode => {
      m.mode = mode
      await expect(sendPinned(input())).rejects.toThrow()
      expect(m.responseDestroyed).toBe(true)
    },
  )
  it('aborts stalled response transport at the total deadline', async () => {
    m.mode = 'stall'
    await expect(
      publicFetch('https://example.org', {
        timeoutMs: 10,
        resolve: async () => ['8.8.8.8'],
      }),
    ).rejects.toThrow()
    expect(m.requestDestroyed).toBe(true)
  })
})
