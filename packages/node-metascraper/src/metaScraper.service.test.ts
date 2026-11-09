// pnpm --filter @goatlab/node-metascraper test src/metaScraper.service.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getHtmlFromUrl,
  metaScraper,
  parseMetadataHtml,
} from './metaScraper.service.js'

const m = vi.hoisted(() => ({ fetch: vi.fn(), html: '', close: vi.fn() }))
vi.mock('./publicFetch.js', () => ({ publicFetch: m.fetch }))
vi.mock('./puppeteer.service.js', () => ({
  PuppeteerService: class {
    async getPuppeteerPage() {
      return {
        browser: { close: m.close },
        page: {
          goto: async () => {},
          content: async () => m.html,
          url: () => 'https://example.org/page',
        },
      }
    }
  },
}))
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())
describe('pure page metadata extraction', () => {
  it.each(['imgix.com.evil.org', 'evil-imgix.com', 'evil.org'])(
    'does not rewrite image URLs for lookalike host %s',
    async host => {
      const image = `https://${host}/imgix.com/image.png?logo_url=https%3A%2F%2Fexample.org%2Flogo.png`
      expect(
        await parseMetadataHtml(
          `<meta property="og:image" content="${image}">`,
          'https://example.org',
        ),
      ).toMatchObject({ image })
    },
  )
  it('supports logo extraction only for an exact imgix host or its subdomain', async () => {
    expect(
      await parseMetadataHtml(
        '<meta property="og:image" content="https://cdn.imgix.com/image.png?logo_url=https%3A%2F%2Fexample.org%2Flogo.png">',
        'https://example.org',
      ),
    ).toMatchObject({ image: 'https://example.org/logo.png' })
  })

  it('resolves relative images against the final redirected page URL', async () => {
    m.fetch.mockResolvedValue({
      url: 'https://destination.example.org/articles/final',
      body: Buffer.from(
        '<html><head><title>Redirected</title><meta property="og:image" content="./photo.png"></head></html>',
      ),
      headers: { 'content-type': 'text/html' },
    })
    expect(await metaScraper('https://short.example.org/go')).toMatchObject({
      image: 'https://destination.example.org/articles/photo.png',
    })
  })

  it('extracts HTML metadata without fetch, Clearbit enrichment or browser rendering', async () => {
    const fetch = vi.fn(() => {
      throw new Error('Unexpected network')
    })
    vi.stubGlobal('fetch', fetch)
    const result = await parseMetadataHtml(
      '<html><head><title>Example title</title><meta name="description" content="Description"><meta property="og:image" content="/photo.png"></head></html>',
      'https://example.org/page',
    )
    expect(result).toMatchObject({
      title: 'Example title',
      description: 'Description',
      image: 'https://example.org/photo.png',
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(m.fetch).not.toHaveBeenCalled()
  })
  it('returns simple HTML without falling back to a browser for incomplete metadata', async () => {
    m.fetch.mockResolvedValue({
      body: Buffer.from('<html><p>Body only</p></html>'),
      headers: { 'content-type': 'text/html' },
    })
    expect(
      await getHtmlFromUrl({
        url: 'https://example.org',
        puppeteerBrowserServiceUrl: 'wss://unused.example',
      }),
    ).toContain('Body only')
  })
  it('rejects non-HTML bodies', async () => {
    m.fetch.mockResolvedValue({
      body: Buffer.from('binary'),
      headers: { 'content-type': 'application/octet-stream' },
    })
    await expect(
      getHtmlFromUrl({ url: 'https://example.org' }),
    ).rejects.toThrow(/not HTML/)
  })
})

describe('bounded HTML document allowance', () => {
  const html = (size: number) =>
    `<html><head><title>Large article</title><meta property="og:image" content="/photo.png"></head><body>${'x'.repeat(size)}</body></html>`
  it.each([2_146_814, 4 * 1024 * 1024])(
    'accepts a %i-byte page through the actual secure fetch limit contract',
    async bytes => {
      const document = html(bytes - Buffer.byteLength(html(0)))
      expect(Buffer.byteLength(document)).toBe(bytes)
      const { publicFetch } =
        await vi.importActual<typeof import('./publicFetch.js')>(
          './publicFetch.js',
        )
      m.fetch.mockImplementation((url, options) =>
        publicFetch(url, {
          ...options,
          resolve: async () => ['8.8.8.8'],
          send: async () => ({
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: Buffer.from(document),
          }),
        }),
      )
      expect(await metaScraper('https://example.org/page')).toMatchObject({
        title: 'Large article',
        image: 'https://example.org/photo.png',
      })
      expect(m.fetch).toHaveBeenCalledWith('https://example.org/page', {
        maxBytes: 4 * 1024 * 1024,
      })
    },
  )
  it('rejects HTML beyond 4 MiB through the same secure fetch bound', async () => {
    const { publicFetch } =
      await vi.importActual<typeof import('./publicFetch.js')>(
        './publicFetch.js',
      )
    m.fetch.mockImplementation((url, options) =>
      publicFetch(url, {
        ...options,
        resolve: async () => ['8.8.8.8'],
        send: async () => ({
          status: 200,
          headers: {},
          body: Buffer.from(html(4 * 1024 * 1024)),
        }),
      }),
    )
    await expect(
      getHtmlFromUrl({ url: 'https://example.org' }),
    ).rejects.toThrow(/byte limit/)
  })
  it('uses the same HTML allowance in explicit browser mode and closes after rejection', async () => {
    m.html = html(2_146_814)
    expect(
      await getHtmlFromUrl({
        url: 'https://example.org',
        forcePuppeteer: true,
        puppeteerBrowserServiceUrl: 'wss://trusted.example',
      }),
    ).toContain('Large article')
    m.html = html(4 * 1024 * 1024)
    await expect(
      getHtmlFromUrl({
        url: 'https://example.org',
        forcePuppeteer: true,
        puppeteerBrowserServiceUrl: 'wss://trusted.example',
      }),
    ).rejects.toThrow(/byte limit/)
    expect(m.close).toHaveBeenCalledTimes(2)
  })
})
