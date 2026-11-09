import { URL } from 'node:url'
import * as cheerio from 'cheerio'
import { publicFetch } from './publicFetch.js'

const metascraper = require('metascraper')
const metascraperAuthor = require('metascraper-author')
const metascraperDate = require('metascraper-date')
const metascraperDescription = require('metascraper-description')
const metascraperFeed = require('metascraper-feed')
const metascraperImage = require('metascraper-image')
const metascraperLang = require('metascraper-lang')
const metascraperLogo = require('metascraper-logo')
const metascraperPublisher = require('metascraper-publisher')
const metascraperTitle = require('metascraper-title')
const metascraperUrl = require('metascraper-url')

const scraper = metascraper([
  metascraperImage(),
  metascraperTitle(),
  metascraperDescription(),
  metascraperUrl(),
  metascraperAuthor(),
  metascraperDate(),
  metascraperLogo(),
  metascraperPublisher(),
  metascraperFeed(),
  metascraperLang(),
])

const getDomainFromUrl = (url: string): string => {
  try {
    const { hostname } = new URL(url)
    return hostname
  } catch (err) {
    console.error('Invalid URL:', err)
    return ''
  }
}

// Utility function to clean and properly decode malformed URLs
const fixMalformedUrl = (url: string): string => {
  try {
    // Detect and decode URLs like 'http://https%3A%2F%2F...'
    if (url.startsWith('http://https%3A')) {
      const decodedUrl = decodeURIComponent(url.replace('http://', ''))
      return decodedUrl
    }

    // Handle normal cases
    return url
  } catch (err) {
    console.error('Error fixing malformed URL:', err)
    return url // Return original URL if decoding fails
  }
}

const getPageResponse = async ({
  url,
  forcePuppeteer,
  puppeteerBrowserServiceUrl,
}: {
  url: string
  forcePuppeteer?: boolean
  puppeteerBrowserServiceUrl?: string
}) => {
  if (forcePuppeteer) {
    if (!puppeteerBrowserServiceUrl) {
      throw new Error(
        'Explicit browser mode requires a trusted browser endpoint',
      )
    }
    const { PuppeteerService } = await import('./puppeteer.service.js')
    const { browser, page } = await new PuppeteerService(
      puppeteerBrowserServiceUrl,
    ).getPuppeteerPage()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 })
      const html = await page.content()
      if (Buffer.byteLength(html) > 2 * 1024 * 1024) {
        throw new Error('HTML exceeds preview byte limit')
      }
      return { html, url: page.url() || url }
    } finally {
      await browser.close()
    }
  }
  const response = await publicFetch(url)
  const contentType = response.headers['content-type']
    ?.split(';')[0]
    ?.toLowerCase()
  if (
    contentType &&
    !['text/html', 'application/xhtml+xml'].includes(contentType)
  ) {
    throw new Error('Preview target is not HTML')
  }
  return { html: response.body.toString('utf8'), url: response.url }
}

/** Retain the existing string-only API while internal callers keep the final URL. */
export const getHtmlFromUrl = async (
  input: Parameters<typeof getPageResponse>[0],
): Promise<string | undefined> => (await getPageResponse(input)).html

export function extractRSSLinks(html: string, url: string): string | null {
  try {
    // Load the HTML into cheerio for parsing
    const $ = cheerio.load(html)

    // Find and extract all RSS feed links
    const rssLinks: { title: string; href: string }[] = []
    $('link[rel="alternate"][type="application/rss+xml"]').each(
      (_, element) => {
        const title = $(element).attr('title') || ''
        const href = $(element).attr('href') || ''
        if (title && href?.includes(url)) {
          rssLinks.push({ title, href })
        }
      },
    )

    const h1Tags: string[] = []
    $('h1').each((_, element) => {
      const h1Text = $(element).text().trim()
      h1Tags.push(h1Text)
    })

    if (rssLinks?.length) {
      return rssLinks[0]?.title || h1Tags[0] || ''
    }

    return null
  } catch (err) {
    console.error('Error fetching or parsing the page:', err)
    return null
  }
}

export async function metaScraper(
  url: string,
  puppeteerBrowserServiceUrl?: string,
) {
  try {
    const page = await getPageResponse({ url, puppeteerBrowserServiceUrl })

    if (!page.html) {
      return null
    }

    return await parseMetadataHtml(page.html, page.url)
  } catch (_err) {
    return null
  }
}

/** Extract metadata only; this function never fetches URLs or opens a browser. */
export async function parseMetadataHtml(html: string, url: string) {
  const alternativeTitle = extractRSSLinks(html, url)

  // Extract metadata using metascraper
  const metadata = await scraper({ html, url })
  const parsedUrl = metadata.url || url || ''
  // const title =

  let imageUrl = metadata.image

  if (metadata.image?.includes('imgix.com')) {
    const imgixUrl = new URL(metadata.image).searchParams.get('logo_url')

    if (imgixUrl) {
      imageUrl = imgixUrl
    }
  }

  return {
    url: parsedUrl,
    title: metadata.title || alternativeTitle || '',
    description: metadata.description || '',
    image: fixMalformedUrl(imageUrl || ''),
    author: metadata.author || '',
    date: metadata.date || '',
    logo: metadata.logo || '',
    publisher: metadata.publisher || '',
    domain: getDomainFromUrl(parsedUrl),
    lang: metadata.lang || '',
    feed: metadata.feed || '',
  }
}
