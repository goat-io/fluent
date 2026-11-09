export type MarketplaceAsset = {
  id?: string
  url: string
  originalName: string
  mimeType: string
  isImage: boolean
  isVideo: boolean
  isFile: boolean
  height?: number
  width?: number
  isVertical?: boolean
  sizeBytes?: number
  thumbnailUrl?: string
  pages?: number | null
  duration?: number | null
  storyId?: string | null
  postId?: string | null
  ownerId?: string | null
  activityId?: string | null
}

export type AssetMetadataOptions = { allowLocalFiles?: boolean }
