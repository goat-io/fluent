// pnpm --filter @goatlab/node-metascraper test src/publicFetch.test.ts
import { describe, expect, it, vi } from 'vitest'
import { isPublicAddress, publicFetch } from './publicFetch.js'

describe('public preview transport', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '2002:7f00:1::',
  ])('rejects nonpublic IP %s', address => {
    expect(isPublicAddress(address)).toBe(false)
  })
  it.each([
    'file:///etc/passwd',
    'https://user:pass@example.org/',
    'http://127.0.0.1',
    'https://example.org:8080/',
  ])('rejects unsafe target without sending %s', async url => {
    const send = vi.fn()
    await expect(
      publicFetch(url, { send, resolve: async () => ['127.0.0.1'] }),
    ).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })
  it('pins the verified public address and revalidates every redirect', async () => {
    const resolve = vi.fn(async (host: string) =>
      host === 'evil.test' ? ['10.0.0.1'] : ['8.8.8.8'],
    )
    const send = vi.fn(async (_request: unknown) => ({
      status: 302,
      headers: { location: 'https://evil.test/' },
      body: Buffer.alloc(0),
    }))
    await expect(
      publicFetch('https://example.org', { resolve, send }),
    ).rejects.toThrow()
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]?.[0]).toMatchObject({ address: '8.8.8.8' })
  })
  it('rejects mixed DNS answers, status errors and redirect loops', async () => {
    const send = vi.fn(async () => ({
      status: 500,
      headers: {},
      body: Buffer.alloc(0),
    }))
    await expect(
      publicFetch('https://example.org', {
        resolve: async () => ['8.8.8.8', '127.0.0.1'],
        send,
      }),
    ).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
    await expect(
      publicFetch('https://example.org', {
        resolve: async () => ['8.8.8.8'],
        send,
      }),
    ).rejects.toThrow()
    const redirect = vi.fn(async () => ({
      status: 302,
      headers: { location: '/again' },
      body: Buffer.alloc(0),
    }))
    await expect(
      publicFetch('https://example.org', {
        resolve: async () => ['8.8.8.8'],
        send: redirect,
      }),
    ).rejects.toThrow()
    expect(redirect.mock.calls.length).toBeLessThanOrEqual(4)
  })
  it('bounds slow DNS by the total deadline', async () => {
    await expect(
      publicFetch('https://example.org', {
        timeoutMs: 10,
        resolve: () => new Promise(() => {}),
      }),
    ).rejects.toThrow(/timed out/i)
  })
})
