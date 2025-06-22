import puppeteer from 'puppeteer-extra'

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')

puppeteer.use(StealthPlugin())
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

// const BROWSER_WS =
//   'wss://brd-customer-hl_1cb9eac7-zone-agro:595pgyin2iqa@brd.superproxy.io:9222'

export class PuppeteerService {
  private browserServiceUrl?: string = undefined

  constructor(browserServiceUrl?: string) {
    this.browserServiceUrl = browserServiceUrl
  }

  async getPuppeteerPage() {
    // Launch the browser
    const browser = await puppeteer.connect({
      browserWSEndpoint: this.browserServiceUrl
      // args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    // Open a new page
    const page = await browser.newPage()

    await page.setRequestInterception(true)

    page.on('request', async (request: any) => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        await request.abort()
      } else {
        await request.continue()
      }
    })

    return { page, browser }
  }
}
