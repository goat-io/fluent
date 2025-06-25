import { Promises } from '@goatlab/js-utils'
import { metaScraper } from './metaScraper.service'
import { getAssetMetadata, type MarketplaceAsset } from './getAssetMetadata'

export type LinkPreviewResult = {
  url: string
  title: string
  description: string
  image: string
  author: string
  date: string
  logo: string
  publisher: string
  domain: string
  lang: string
  feed: string
  assetMeta: MarketplaceAsset & {
    buffer: Buffer
  }
}

export class MetaScrapers {
  private browserServiceUrl?: string = undefined

  constructor(browserServiceUrl?: string) {
    this.browserServiceUrl = browserServiceUrl
  }

  getMetadataFromUrl = async (url: string): Promise<LinkPreviewResult> => {
    const meta = await metaScraper(url, this.browserServiceUrl)

    let [error, assetMeta] = await Promises.try(getAssetMetadata(meta?.image))

    // Default to the logo if the image fails
    if (error && meta) {
      ;[error, assetMeta] = await Promises.try(getAssetMetadata(meta?.logo))
      if (!error) {
        meta.url = meta?.logo || ''
      }
    }

    const previewData = {
      ...meta,
      assetMeta
    } as LinkPreviewResult

    return previewData
  }

  getAssetMetadata = getAssetMetadata
}
