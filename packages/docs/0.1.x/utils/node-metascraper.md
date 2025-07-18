# Node Metascraper Package

The `@goatlab/node-metascraper` package provides powerful web scraping utilities for extracting metadata from web pages, including link previews, asset metadata, and social media information.

## Installation

```bash
npm install @goatlab/node-metascraper
# or
pnpm add @goatlab/node-metascraper
```

## Core Features

### MetaScrapers

The main class for web scraping and metadata extraction.

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

// Create instance
const scraper = new MetaScrapers()

// With optional browser service URL for JavaScript-heavy sites
const scraper = new MetaScrapers('http://localhost:3000/browser-service')
```

## Basic Usage

### Extract Metadata from URL

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

const scraper = new MetaScrapers()

const metadata = await scraper.getMetadataFromUrl('https://example.com')

console.log(metadata)
// Output includes:
// {
//   url: 'https://example.com',
//   title: 'Example Domain',
//   description: 'This domain is for use in illustrative examples...',
//   image: 'https://example.com/image.jpg',
//   author: 'Example Author',
//   date: '2023-01-01',
//   logo: 'https://example.com/logo.png',
//   publisher: 'Example Publisher',
//   domain: 'example.com',
//   lang: 'en',
//   feed: 'https://example.com/feed.xml',
//   assetMeta: {
//     width: 1200,
//     height: 630,
//     type: 'image/jpeg',
//     buffer: Buffer
//   }
// }
```

### LinkPreviewResult Interface

```typescript
interface LinkPreviewResult {
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

interface MarketplaceAsset {
  width: number
  height: number
  type: string
  size: number
}
```

## Advanced Usage

### Social Media Link Previews

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

const scraper = new MetaScrapers()

// Extract social media metadata
const socialMetadata = await scraper.getMetadataFromUrl('https://twitter.com/example/status/123')

// Rich metadata for social platforms
console.log({
  title: socialMetadata.title,
  description: socialMetadata.description,
  image: socialMetadata.image,
  author: socialMetadata.author,
  publisher: socialMetadata.publisher
})
```

### News Article Metadata

```typescript
const newsMetadata = await scraper.getMetadataFromUrl('https://news.example.com/article')

console.log({
  headline: newsMetadata.title,
  summary: newsMetadata.description,
  author: newsMetadata.author,
  publishDate: newsMetadata.date,
  featuredImage: newsMetadata.image,
  publication: newsMetadata.publisher
})
```

### Blog Post Metadata

```typescript
const blogMetadata = await scraper.getMetadataFromUrl('https://blog.example.com/post')

console.log({
  title: blogMetadata.title,
  excerpt: blogMetadata.description,
  author: blogMetadata.author,
  publishedAt: blogMetadata.date,
  coverImage: blogMetadata.image,
  siteName: blogMetadata.publisher
})
```

## Asset Metadata Extraction

### Image Metadata

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

const scraper = new MetaScrapers()

// Extract detailed image metadata
const imageMetadata = await scraper.getAssetMetadata('https://example.com/image.jpg')

console.log({
  dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
  fileSize: imageMetadata.size,
  mimeType: imageMetadata.type,
  buffer: imageMetadata.buffer // Raw image data
})
```

### Video Metadata

```typescript
// Extract video metadata
const videoUrl = 'https://example.com/video.mp4'
const videoMetadata = await scraper.getAssetMetadata(videoUrl)

console.log({
  dimensions: `${videoMetadata.width}x${videoMetadata.height}`,
  fileSize: videoMetadata.size,
  type: videoMetadata.type
})
```

## Error Handling and Fallbacks

### Robust Metadata Extraction

```typescript
const extractMetadataRobustly = async (url: string) => {
  try {
    const scraper = new MetaScrapers()
    const metadata = await scraper.getMetadataFromUrl(url)
    
    // Fallback to logo if image fails
    if (!metadata.image && metadata.logo) {
      metadata.image = metadata.logo
    }
    
    // Provide default values
    return {
      url: metadata.url || url,
      title: metadata.title || 'Untitled',
      description: metadata.description || 'No description available',
      image: metadata.image || '/default-preview.jpg',
      author: metadata.author || 'Unknown',
      date: metadata.date || new Date().toISOString(),
      publisher: metadata.publisher || new URL(url).hostname
    }
  } catch (error) {
    console.error('Metadata extraction failed:', error)
    
    // Return minimal metadata on failure
    return {
      url,
      title: new URL(url).hostname,
      description: 'Unable to load preview',
      image: '/default-preview.jpg',
      author: 'Unknown',
      date: new Date().toISOString(),
      publisher: new URL(url).hostname
    }
  }
}
```

## Browser Service Integration

### Using External Browser Service

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

// For JavaScript-heavy sites that require rendering
const scraper = new MetaScrapers('https://browser-service.example.com')

// This will use the browser service to render JavaScript before scraping
const metadata = await scraper.getMetadataFromUrl('https://spa-app.example.com')
```

### Puppeteer Integration

```typescript
// If you have your own Puppeteer service
const scraper = new MetaScrapers('http://localhost:3000/puppeteer')

const metadata = await scraper.getMetadataFromUrl('https://dynamic-content.example.com')
```

## Real-world Examples

### Link Preview Service

```typescript
import express from 'express'
import { MetaScrapers } from '@goatlab/node-metascraper'

const app = express()
const scraper = new MetaScrapers()

app.get('/preview', async (req, res) => {
  const { url } = req.query
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }
  
  try {
    const metadata = await scraper.getMetadataFromUrl(url)
    
    res.json({
      success: true,
      data: {
        url: metadata.url,
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
        author: metadata.author,
        publisher: metadata.publisher,
        domain: metadata.domain
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to extract metadata'
    })
  }
})
```

### Social Media Card Generator

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class SocialCardGenerator {
  private scraper: MetaScrapers
  
  constructor(browserServiceUrl?: string) {
    this.scraper = new MetaScrapers(browserServiceUrl)
  }
  
  async generateCard(url: string) {
    const metadata = await this.scraper.getMetadataFromUrl(url)
    
    return {
      twitter: {
        card: 'summary_large_image',
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
        site: `@${metadata.publisher}`
      },
      facebook: {
        'og:type': 'website',
        'og:title': metadata.title,
        'og:description': metadata.description,
        'og:image': metadata.image,
        'og:url': metadata.url
      },
      linkedin: {
        title: metadata.title,
        summary: metadata.description,
        image: metadata.image,
        url: metadata.url
      }
    }
  }
}
```

### Content Aggregator

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class ContentAggregator {
  private scraper: MetaScrapers
  
  constructor() {
    this.scraper = new MetaScrapers()
  }
  
  async aggregateContent(urls: string[]) {
    const articles = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const metadata = await this.scraper.getMetadataFromUrl(url)
          
          return {
            url: metadata.url,
            title: metadata.title,
            description: metadata.description,
            image: metadata.image,
            author: metadata.author,
            publishedAt: metadata.date,
            publisher: metadata.publisher,
            domain: metadata.domain,
            language: metadata.lang
          }
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error)
          return null
        }
      })
    )
    
    return articles
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value)
  }
}
```

### Bookmark Manager

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class BookmarkManager {
  private scraper: MetaScrapers
  
  constructor() {
    this.scraper = new MetaScrapers()
  }
  
  async createBookmark(url: string, tags: string[] = []) {
    const metadata = await this.scraper.getMetadataFromUrl(url)
    
    return {
      id: this.generateId(),
      url: metadata.url,
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      author: metadata.author,
      domain: metadata.domain,
      tags,
      createdAt: new Date().toISOString(),
      metadata: {
        publisher: metadata.publisher,
        language: metadata.lang,
        publishedAt: metadata.date
      }
    }
  }
  
  async enrichBookmarks(bookmarks: Array<{ url: string }>) {
    return await Promise.all(
      bookmarks.map(async (bookmark) => {
        try {
          const metadata = await this.scraper.getMetadataFromUrl(bookmark.url)
          return {
            ...bookmark,
            title: metadata.title,
            description: metadata.description,
            image: metadata.image,
            domain: metadata.domain
          }
        } catch (error) {
          console.error(`Failed to enrich bookmark ${bookmark.url}:`, error)
          return bookmark
        }
      })
    )
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class CachedMetaScraper {
  private scraper: MetaScrapers
  private cache: Map<string, any>
  private cacheTimeout: number
  
  constructor(cacheTimeout = 3600000) { // 1 hour default
    this.scraper = new MetaScrapers()
    this.cache = new Map()
    this.cacheTimeout = cacheTimeout
  }
  
  async getMetadataFromUrl(url: string) {
    const cacheKey = this.getCacheKey(url)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    
    const metadata = await this.scraper.getMetadataFromUrl(url)
    
    this.cache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now()
    })
    
    return metadata
  }
  
  private getCacheKey(url: string): string {
    return Buffer.from(url).toString('base64')
  }
  
  clearCache(): void {
    this.cache.clear()
  }
}
```

### Batch Processing

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class BatchMetaScraper {
  private scraper: MetaScrapers
  private concurrency: number
  
  constructor(concurrency = 5) {
    this.scraper = new MetaScrapers()
    this.concurrency = concurrency
  }
  
  async scrapeUrls(urls: string[]) {
    const results = []
    
    for (let i = 0; i < urls.length; i += this.concurrency) {
      const batch = urls.slice(i, i + this.concurrency)
      
      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const metadata = await this.scraper.getMetadataFromUrl(url)
            return { url, metadata, success: true }
          } catch (error) {
            console.error(`Failed to scrape ${url}:`, error)
            return { url, error: error.message, success: false }
          }
        })
      )
      
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : null
      ).filter(Boolean))
      
      // Small delay between batches to be respectful
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return results
  }
}
```

## Error Handling Best Practices

### Comprehensive Error Handling

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class RobustMetaScraper {
  private scraper: MetaScrapers
  private maxRetries: number
  private retryDelay: number
  
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.scraper = new MetaScrapers()
    this.maxRetries = maxRetries
    this.retryDelay = retryDelay
  }
  
  async getMetadataFromUrl(url: string) {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const metadata = await this.scraper.getMetadataFromUrl(url)
        return this.validateMetadata(metadata)
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt + 1} failed for ${url}:`, error)
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        }
      }
    }
    
    throw new Error(`Failed to scrape ${url} after ${this.maxRetries} attempts: ${lastError?.message}`)
  }
  
  private validateMetadata(metadata: any) {
    // Ensure required fields exist
    if (!metadata.title) {
      metadata.title = 'Untitled'
    }
    
    if (!metadata.description) {
      metadata.description = 'No description available'
    }
    
    // Validate URL format
    if (metadata.image && !this.isValidUrl(metadata.image)) {
      metadata.image = null
    }
    
    return metadata
  }
  
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}
```

## Integration with Databases

### Save Metadata to Database

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

class MetadataRepository {
  private scraper: MetaScrapers
  
  constructor() {
    this.scraper = new MetaScrapers()
  }
  
  async saveUrlMetadata(url: string) {
    const metadata = await this.scraper.getMetadataFromUrl(url)
    
    const record = {
      url: metadata.url,
      title: metadata.title,
      description: metadata.description,
      image: metadata.image,
      author: metadata.author,
      publisher: metadata.publisher,
      domain: metadata.domain,
      language: metadata.lang,
      published_at: metadata.date ? new Date(metadata.date) : null,
      scraped_at: new Date(),
      asset_metadata: metadata.assetMeta
    }
    
    // Save to database
    await this.database.insert('url_metadata', record)
    
    return record
  }
  
  async getOrCreateMetadata(url: string) {
    // Check if metadata exists
    const existing = await this.database.findOne('url_metadata', { url })
    
    if (existing) {
      return existing
    }
    
    // Create new metadata
    return await this.saveUrlMetadata(url)
  }
}
```

## Contributing

The node-metascraper package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.