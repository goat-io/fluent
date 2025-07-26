import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// pnpm test Http.spec.ts

import { Http } from './Http'

const client = Http.getClient({
  prefixUrl: 'https://api.github.com'
})

describe(' Http.getClient', () => {
  test('Should get data', async () => {
    const repo = await client.get('repos/octocat/Hello-World').json<any>()

    expect(repo).toBeDefined()
    expect(repo.name).toBe('Hello-World')
  })

  it('should return a KyInstance', () => {
    const client = Http.getClient()
    expect(typeof client.get).toBe('function')
    expect(typeof client.post).toBe('function')
    expect(typeof client.put).toBe('function')
    expect(typeof client.patch).toBe('function')
    expect(typeof client.delete).toBe('function')
    expect(typeof client.head).toBe('function')
  })

  it('should enable all logging options if debug is true', () => {
    const options: any = { debug: true }
    Http.getClient(options)
    expect(options.logStart).toBe(true)
    expect(options.logFinished).toBe(true)
    expect(options.logResponse).toBe(true)
    expect(options.logRequest).toBe(true)
  })

  it('should throw on 404 and include helpful error message', async () => {
    expect.assertions(2)
    try {
      await client.get('repos/octocat/does-not-exist').json()
    } catch (err: any) {
      expect(err).toBeDefined()
      expect(err.message).toMatch(/404/)
    }
  })

  it('should respect timeout option', async () => {
    const slowClient = Http.getClient({
      prefixUrl: 'https://httpstat.us',
      timeout: 100
    })
    expect.assertions(1)
    try {
      await slowClient.get('200?sleep=500').text()
    } catch (err: any) {
      expect(err.name).toMatch(/TimeoutError/)
    }
  })

  it('should allow custom headers', async () => {
    const customClient = Http.getClient({
      prefixUrl: 'https://httpbin.org'
    })
    const res = await customClient
      .get('headers', {
        headers: { 'X-Test-Header': 'test-value' }
      })
      .json<any>()
    expect(res.headers['X-Test-Header']).toBe('test-value')
  })

  it('should send POST requests with JSON body', async () => {
    const postClient = Http.getClient({
      prefixUrl: 'https://httpbin.org'
    })
    const data = { foo: 'bar' }
    const res = await postClient.post('post', { json: data }).json<any>()
    expect(res.json).toEqual(data)
  })

  it('should send query parameters', async () => {
    const queryClient = Http.getClient({
      prefixUrl: 'https://httpbin.org'
    })
    const res = await queryClient.get('get?hello=world').json<any>()
    expect(res.args.hello).toBe('world')
  })

  it('should redact password in shortUrl', () => {
    // @ts-ignore
    const url = new URL('https://user:secret@domain.com/path')
    const opt = {}
    const short = Http.getShortUrl(opt, url)

    expect(short).not.toContain('secret')
  })

  it('should remove search params if logWithSearchParams is false', () => {
    // @ts-ignore
    const url = new URL('https://domain.com/path?foo=bar')
    const opt = { logWithSearchParams: false }
    const short = Http.getShortUrl(opt, url)
    expect(short).toBe('https://domain.com/path')
  })

  it('should remove prefixUrl if logWithPrefixUrl is false', () => {
    // @ts-ignore
    const url = new URL('https://api.github.com/repos/octocat/Hello-World')
    const opt = { logWithPrefixUrl: false }
    const short = Http.getShortUrl(opt, url, 'https://api.github.com')
    expect(short).toBe('/repos/octocat/Hello-World')
  })

  // it('should retry failed requests according to retry option', async () => {
  //   const retryClient = Http.getClient({
  //     prefixUrl: 'https://httpstat.us',
  //     retry: { limit: 2, methods: ['get'], backoffLimit: 300 }
  //   })

  //   // httpstat.us/503 returns 503 Service Unavailable
  //   // We expect the client to retry the request according to the retry config
  //   expect.assertions(1)
  //   try {
  //     await retryClient.get('503').text()
  //   } catch (err: any) {
  //     // Should have retried and still failed
  //     expect(err.response.status).toBe(503)
  //   }
  // })

  // it('should not retry on POST by default', async () => {
  //   const retryClient = Http.getClient({
  //     prefixUrl: 'https://httpstat.us',
  //     retry: { limit: 2 }
  //   })

  //   expect.assertions(1)
  //   try {
  //     await retryClient.post('503').text()
  //   } catch (err: any) {
  //     // Should not retry POST by default, so only one attempt
  //     expect(err.response.status).toBe(503)
  //   }
  // })

  // it('should allow custom retry methods', async () => {
  //   const retryClient = Http.getClient({
  //     prefixUrl: 'https://httpstat.us',
  //     retry: { limit: 2, methods: ['post'] }
  //   })

  //   expect.assertions(1)
  //   try {
  //     await retryClient.post('503').text()
  //   } catch (err: any) {
  //     // Should retry POST because we set methods: ['post']
  //     expect(err.response.status).toBe(503)
  //   }
  // })
})
