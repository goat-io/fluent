import { describe, expect, it } from 'vitest'
import { MetaScrapers } from './Metascrapers'

describe('Metascrapers [real test]', () => {
  it('should return metadata for a real URL with a custom browserServiceUrl (integration test)', async () => {
    const metaScrapers = new MetaScrapers()
    const realUrl = 'https://www.npmjs.com/'

    const result = await metaScrapers.getMetadataFromUrl(realUrl)

    expect(result).toBeDefined()
    expect(typeof result.title).toBe('string')
    expect(result.title.length).toBeGreaterThan(0)
  })
})
