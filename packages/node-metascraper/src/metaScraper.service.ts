import { URL } from 'node:url'
import { Promises } from '@goatlab/js-utils'
import * as cheerio from 'cheerio'
import { PuppeteerService } from './puppeteer.service'

const metascraper = require('metascraper')
const metascraperAuthor = require('metascraper-author')
const metascraperClearBit = require('metascraper-clearbit')
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
  metascraperClearBit(),
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

export const getHtmlFromUrl = async ({
  url,
  forcePuppeteer,
  puppeteerBrowserServiceUrl,
}: {
  url: string
  forcePuppeteer?: boolean
  puppeteerBrowserServiceUrl?: string
}): Promise<string | undefined> => {
  if (!forcePuppeteer) {
    const [error, response] = await Promises.try(
      fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      }).then(res => res.text()),
    )

    if (!error && response) {
      const metadata = await scraper({ html: response, url })

      if (metadata.description !== '.' && (metadata.title || metadata.author)) {
        return response
      }
    }
  }

  const { browser, page } = await new PuppeteerService(
    puppeteerBrowserServiceUrl,
  ).getPuppeteerPage()

  await page.goto(url, { waitUntil: 'networkidle2' })
  const html = await page.content()
  await browser.close()

  return html
}

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
    const html = await getHtmlFromUrl({ url, puppeteerBrowserServiceUrl })

    if (!html) {
      return null
    }

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
  } catch (err) {
    console.error('Error fetching link preview:', err)
    return null
  }
}
