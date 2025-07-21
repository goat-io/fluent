# @goatlab/node-metascraper

A Node.js wrapper around metascraper that simplifies metadata extraction from URLs. Supports both standard HTTP requests and Puppeteer-based scraping for JavaScript-heavy sites, with built-in image metadata extraction.

## Installation

```bash
npm install @goatlab/node-metascraper
# or
yarn add @goatlab/node-metascraper
# or
pnpm add @goatlab/node-metascraper
```

## Usage

```typescript
import { MetaScrapers } from '@goatlab/node-metascraper'

// Initialize without browser service (uses local Puppeteer)
const scraper = new MetaScrapers()

// Or initialize with remote browser service URL
const scraper = new MetaScrapers('http://your-browser-service:3000')

// Extract metadata from a URL
const metadata = await scraper.getMetadataFromUrl('https://example.com')

console.log(metadata)
// {
//   url: 'https://example.com',
//   title: 'Example Domain',
//   description: 'Example Domain. This domain is for use in illustrative examples...',
//   image: 'https://example.com/image.png',
//   author: 'Author Name',
//   date: '2024-01-01',
//   logo: 'https://example.com/logo.png',
//   publisher: 'Example',
//   domain: 'example.com',
//   lang: 'en',
//   feed: 'https://example.com/feed',
//   assetMeta: {
//     // Image metadata including dimensions, format, etc.
//     buffer: Buffer // Original image buffer
//   }
// }

// Extract metadata from an image URL directly
const imageMeta = await scraper.getAssetMetadata('https://example.com/image.png')
```

## Key Features

- **Automatic fallback** from simple HTTP requests to Puppeteer for JavaScript-rendered pages
- **Comprehensive metadata extraction** including title, description, author, date, publisher, language, and more
- **Image metadata analysis** with dimensions, format detection, and buffer access
- **RSS feed detection** with automatic title extraction
- **Malformed URL handling** with automatic correction
- **Remote browser support** for scalable Puppeteer operations
- **Built-in retry logic** that falls back to logo if main image fails