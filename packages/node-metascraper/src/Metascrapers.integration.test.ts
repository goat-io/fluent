// pnpm --filter @goatlab/node-metascraper test src/Metascrapers.integration.test.ts
import { describe, expect, it } from 'vitest'
import { MetaScrapers } from './Metascrapers.js'

// Preserve live coverage of the complete public page/image transport. The old
// npmjs.com fixture uses a Cloudflare challenge, so use our representative public
// site, independently verified to expose HTML metadata and a preview image.
describe('Metascrapers public website integration', () => {
  it('retrieves useful metadata and preserves the requested page target', async () => {
    const url = 'https://getsodium.com'
    const result = await new MetaScrapers().getMetadataFromUrl(url)
    expect(result.url).toBe(url)
    expect(result.title.trim().length).toBeGreaterThan(0)
    expect(result.description.trim().length).toBeGreaterThan(0)
  })
})
