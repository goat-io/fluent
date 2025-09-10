import { readFileSync } from 'node:fs'
import * as https from 'node:https'
import { Jimp } from 'jimp'
import filetype from 'magic-bytes.js'

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

// Custom fetch with SSL configuration similar to rejectUnauthorized: false
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

const customFetch = async (url: string) => {
  return fetch(url, {
    // @ts-ignore - agent property exists in Node.js fetch
    agent: url.startsWith('https:') ? httpsAgent : undefined,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  })
}

export const getAssetMetadata = async (
  imageUrl?: string
): Promise<(MarketplaceAsset & { buffer?: Buffer }) | undefined> => {
  if (!imageUrl || imageUrl.trim() === '') {
    return
  }

  try {
    let buffer: Buffer
    let responseHeaders: Headers | undefined
    const isUrl = /^https?:\/\//i.test(imageUrl)

    if (isUrl) {
      // Fetch the image data using custom fetch with SSL config
      const response = await customFetch(imageUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      buffer = Buffer.from(await response.arrayBuffer())
      responseHeaders = response.headers
    } else {
      // Read the image data from the local file system
      buffer = readFileSync(imageUrl)
    }

    // Detect MIME type using magic-bytes.js, fallback to response headers
    const detectedMimeType = filetype(buffer)
    const headerMimeType = responseHeaders?.get('content-type')
    const mime =
      detectedMimeType?.[0]?.mime || headerMimeType || 'image/unknown'

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
