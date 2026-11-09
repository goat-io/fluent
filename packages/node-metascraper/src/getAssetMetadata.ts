import { readFile, stat } from 'node:fs/promises'
import { imageSize } from 'image-size'
import filetype from 'magic-bytes.js'
import type {
  AssetMetadataOptions,
  MarketplaceAsset,
} from './assetMetadata.types.js'
import { publicFetch } from './publicFetch.js'

export type { MarketplaceAsset } from './assetMetadata.types.js'

/** Local files require an explicit trusted-caller opt-in; page metadata never enables it. */
export const getAssetMetadata = async (
  imageUrl?: string,
  options: AssetMetadataOptions = {},
): Promise<(MarketplaceAsset & { buffer?: Buffer }) | undefined> => {
  if (!imageUrl?.trim()) {
    return undefined
  }
  const maxBytes = 8 * 1024 * 1024
  let buffer: Buffer
  let headerMimeType: string | undefined
  if (/^https?:\/\//i.test(imageUrl)) {
    const response = await publicFetch(imageUrl, { maxBytes })
    buffer = response.body
    headerMimeType = response.headers['content-type']?.split(';')[0]
  } else {
    if (!options.allowLocalFiles) {
      throw new Error('Local asset paths require explicit opt-in')
    }
    if ((await stat(imageUrl)).size > maxBytes) {
      throw new Error('Asset exceeds byte limit')
    }
    buffer = await readFile(imageUrl)
    if (buffer.length > maxBytes) {
      throw new Error('Asset exceeds byte limit')
    }
  }
  const mime =
    filetype(buffer)?.[0]?.mime || headerMimeType || 'application/octet-stream'
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  let width = 0
  let height = 0
  if (isImage) {
    // Inspect bounded headers rather than allocating a decoded pixel bitmap.
    const dimensions = imageSize(buffer)
    width = dimensions.width
    height = dimensions.height
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > 16384 ||
      height > 16384 ||
      width * height > 40_000_000
    ) {
      throw new Error('Image dimensions exceed preview limits')
    }
  }
  return {
    url: imageUrl,
    originalName: imageUrl.split('/').pop() || 'unknown',
    mimeType: mime,
    isImage,
    isVideo,
    isFile: !isImage && !isVideo,
    width,
    height,
    isVertical: height > width,
    thumbnailUrl: imageUrl,
    sizeBytes: buffer.length,
    buffer,
  }
}
