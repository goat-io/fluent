import type { MarketplaceAsset } from './assetMetadata.types.js'
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
  assetMeta?: MarketplaceAsset & { buffer?: Buffer }
}
