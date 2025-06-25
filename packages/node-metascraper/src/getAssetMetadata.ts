import { Http } from '@goatlab/js-utils'
import { Jimp } from 'jimp'
import filetype from 'magic-bytes.js'
import { readFileSync } from 'fs'

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

const got = Http.getClient({
  // https: { rejectUnauthorized: false },
})

export const getAssetMetadata = async (
  imageUrl?: string
): Promise<(MarketplaceAsset & { buffer?: Buffer }) | undefined> => {
  if (!imageUrl) {
    return
  }

  try {
    let buffer: Buffer
    const isUrl = /^https?:\/\//i.test(imageUrl)

    if (isUrl) {
      // Fetch the image data using got
      const response = await got(imageUrl)

      buffer = Buffer.from(await response.arrayBuffer())
    } else {
      // Read the image data from the local file system
      buffer = readFileSync(imageUrl)
    }

    // Detect MIME type using magic-bytes.js
    const mimeType = filetype(buffer)
    const mime =
      mimeType && mimeType[0] ? `${mimeType[0].mime}` : 'image/unknown'

    // Determine if it's an image or not
    const isImage = mime?.startsWith('image/') || false
    const isVideo = mime?.startsWith('video/') || false
    const isFile = !isImage && !isVideo

    // Get dimensions if it's an image
    let height = 0
    let width = 0
    let isVertical = false

    if (isImage) {
      const jimpImage = await Jimp.read(buffer)

      width = jimpImage.bitmap.width
      height = jimpImage.bitmap.height
      isVertical = !!(height > width)
    }

    // Calculate size in bytes
    const sizeBytes = buffer.length

    // Return the metadata object
    const metadata: MarketplaceAsset & { buffer: Buffer } = {
      url: imageUrl,
      originalName: imageUrl.split('/').pop() || 'unknown',
      mimeType: mime || 'unknown',
      isImage,
      isVideo,
      isFile,
      height,
      width,
      isVertical,
      thumbnailUrl: imageUrl,
      sizeBytes,
      buffer
    }

    return metadata
  } catch (err) {
    console.error('Error fetching image metadata:', err)
    throw new Error('Failed to fetch image metadata')
  }
}
