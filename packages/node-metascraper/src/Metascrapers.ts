import { getAssetMetadata } from './getAssetMetadata.js'
import type { LinkPreviewResult } from './Metascrapers.types.js'
import { metaScraper } from './metaScraper.service.js'

export type { LinkPreviewResult } from './Metascrapers.types.js'

export class MetaScrapers {
  // Retained for source compatibility; browser rendering is never an implicit fallback.
  constructor(private browserServiceUrl?: string) {}

  getMetadataFromUrl = async (url: string): Promise<LinkPreviewResult> => {
    const meta = await metaScraper(url, this.browserServiceUrl)
    if (!meta) {
      throw new Error('Unable to retrieve public page metadata')
    }
    let assetMeta: LinkPreviewResult['assetMeta']
    for (const candidate of [meta.image, meta.logo]) {
      if (!candidate) {
        continue
      }
      try {
        const asset = await getAssetMetadata(candidate)
        if (asset?.isImage) {
          assetMeta = asset
          break
        }
      } catch {
        /* A broken image must not discard useful page metadata. */
      }
    }
    return { ...meta, url, assetMeta }
  }

  getAssetMetadata = getAssetMetadata
}
