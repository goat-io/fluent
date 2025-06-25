import { describe, it, expect } from 'vitest'
import { MetaScrapers } from './Metascrapers'

describe('Metascrapers [real test]', () => {
  // it('should return metadata for a real URL (integration test)', async () => {
  //   const metaScrapers = new MetaScrapers()
  //   const realUrl = 'https://www.wikipedia.org/'

  //   const result = await metaScrapers.getMetadataFromUrl(realUrl)

  //   expect(result).toBeDefined()
  //   expect(typeof result.title).toBe('string')
  //   expect(result.url).toBe(realUrl)
  //   expect(result.title.length).toBeGreaterThan(0)
  //   expect(result.image.length).toBeGreaterThan(0)
  //   expect(result.assetMeta.url.length).toBeGreaterThan(0)
  // })

  it(
    'should return metadata for a real URL with a custom browserServiceUrl (integration test)',
    async () => {
      const metaScrapers = new MetaScrapers()
      const realUrl = 'https://www.npmjs.com/'

      const result = await metaScrapers.getMetadataFromUrl(realUrl)

      expect(result).toBeDefined()
      expect(typeof result.title).toBe('string')
      expect(result.title.length).toBeGreaterThan(0)
    },
    { timeout: 20_000 }
  )
})
