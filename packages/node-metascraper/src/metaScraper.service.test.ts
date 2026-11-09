// pnpm --filter @goatlab/node-metascraper test src/metaScraper.service.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getHtmlFromUrl,
  metaScraper,
  parseMetadataHtml,
} from './metaScraper.service.js'

const m = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./publicFetch.js', () => ({ publicFetch: m.fetch }))
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())
describe('pure page metadata extraction', () => {
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
