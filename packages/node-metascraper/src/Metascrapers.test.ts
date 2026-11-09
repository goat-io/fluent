// pnpm --filter @goatlab/node-metascraper test src/Metascrapers.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MetaScrapers } from './Metascrapers.js'

const mocks = vi.hoisted(() => ({ scrape: vi.fn(), asset: vi.fn() }))
vi.mock('./metaScraper.service.js', () => ({ metaScraper: mocks.scrape }))
vi.mock('./getAssetMetadata.js', () => ({ getAssetMetadata: mocks.asset }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.scrape.mockResolvedValue({
    url: 'https://example.org/page',
    title: 'Page',
    image: '',
    logo: 'https://cdn.example.org/logo.png',
  })
})
describe('preview asset fallback and target identity', () => {
  it('tries the logo when the image is missing without replacing the page target', async () => {
    mocks.asset.mockImplementation(async (url: string) =>
      url?.includes('logo') ? { url, isImage: true } : undefined,
    )
    const result = await new MetaScrapers().getMetadataFromUrl(
      'https://example.org/page',
    )
    expect(result.url).toBe('https://example.org/page')
    expect(result.assetMeta?.url).toBe('https://cdn.example.org/logo.png')
  })
  it('preserves the requested page when image failure falls back to a logo', async () => {
    mocks.scrape.mockResolvedValue({
      url: 'https://other.example/canonical',
      image: 'https://cdn.example.org/broken',
      logo: 'https://cdn.example.org/logo.png',
    })
    mocks.asset.mockImplementation(async (url: string) => {
      if (url.includes('broken')) {
        throw new Error('broken')
      }
      return { url, isImage: true }
    })
    const result = await new MetaScrapers().getMetadataFromUrl(
      'https://example.org/page',
    )
    expect(result.url).toBe('https://example.org/page')
    expect(result.assetMeta?.url).toContain('logo.png')
  })
  it('keeps useful page metadata if both images fail', async () => {
    mocks.asset.mockRejectedValue(new Error('not an image'))
    const result = await new MetaScrapers().getMetadataFromUrl(
      'https://example.org/page',
    )
    expect(result.title).toBe('Page')
    expect(result.assetMeta).toBeUndefined()
  })
})
