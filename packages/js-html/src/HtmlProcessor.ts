import truncateHtml from 'html-truncate'
import { Parser } from 'htmlparser2'
import linkifyHtml from 'linkify-html'
import 'linkify-plugin-hashtag'
import linkifyRegisterKeywords from 'linkify-plugin-keyword'
import 'linkify-plugin-mention'
import 'linkify-plugin-ticket'
import { Opts } from 'linkifyjs'
import sanitizeHtml from 'sanitize-html'

const isEmptyHTML = (html: string) => {
  let isEmpty = true

  const parser = new Parser(
    {
      onopentag(_name, attribs) {
        if (Object.keys(attribs).length > 0) {
          isEmpty = false
        }
      },
      ontext(text) {
        // Check if there is any non-whitespace text
        if (text.trim()) {
          isEmpty = false
        }
      },
    },
    { decodeEntities: false },
  )

  parser.write(html)
  parser.end()

  return isEmpty
}

export class HtmlProcessor {
  private html: string

  public expandKeyWord: string = '...See more '
  private keywords: string[] = []

  public parsingOptions: Opts = {
    attributes: (_href, element) => {
      if (element === 'keyword') {
        return {
          style: 'color: gray;text-decoration: none;',
        }
      }
      if (element === 'hashtag') {
        return {
          style: 'color: green;text-decoration: none;',
        }
      }
      return {}
    },
    className: {},
    defaultProtocol: 'https',
    format: (value, _type) => value,
    formatHref: {
      keyword: keyword => {
        if (keyword === this.expandKeyWord) {
          return '/expand'
        }

        return `/tags/${keyword.toLowerCase()}`
      },
      hashtag: href => `/hashtag/${href.substr(1)}`,
      ticket: href => `/issues/${href.substr(1)}`,
      mention: href => `account${href}`, //TODO: Cambiar luego x la url real
    },
    ignoreTags: ['script', 'style'],
    nl2br: false,
    rel: {},
    tagName: 'a',
    target: {},
    truncate: 0,
    validate: {},
  }

  constructor({ html, keywords = [] }: { html: string; keywords?: string[] }) {
    this.html = html
    this.keywords = keywords
  }

  static isEmptyHTML(html: string): boolean {
    return isEmptyHTML(html)
  }

  static extractTextFromHTML(html: string): string {
    let textContent = ''

    const toAdd = {
      onselfclosingtag: (name: string) => {
        if (name === 'br') {
          textContent += '\n'
        }
      },
    }

    let skipText = false
    const parser = new Parser(
      {
        ontext(text) {
          if (!skipText) {
            textContent += text
          }
        },
        onopentag(name) {
          if (name === 'script' || name === 'style') {
            skipText = true
          }
        },
        onclosetag(name) {
          if (name === 'script' || name === 'style') {
            skipText = false
          }
        },
        ...toAdd,
      },
      { decodeEntities: true },
    )

    parser.write(html)
    parser.end()

    return textContent.trim()
  }

  getParsedHtml() {
    linkifyRegisterKeywords(this.keywords)

    const sanitized = sanitizeHtml(this.html, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'div', 'br'],
      allowedAttributes: {
        a: ['href'],
        div: ['style'],
      },
      transformTags: {
        br: (_tagname, _attr) => {
          return {
            tagName: 'div',
            attribs: {
              style: 'display:flex; margin:5px 0;',
            },
          }
        },
      },
    })
    return linkifyHtml(sanitized, this.parsingOptions)
  }

  getTruncatedHtml({
    truncate = Number.POSITIVE_INFINITY,
    ellipsis = 'See more',
  }: {
    truncate?: number
    ellipsis?: string
  }) {
    const parsed = this.getParsedHtml()

    let truncatedHtml = truncateHtml(parsed, truncate, {
      ellipsis: '',
      keepImageTag: true,
      truncateLastWord: true,
    })

    const extractedText = HtmlProcessor.extractTextFromHTML(parsed).trim()

    if (extractedText.length > truncate) {
      // Manually wrap the ellipsis in an <a> tag pointing to /expand.
      // We do this explicitly rather than relying on linkify-plugin-keyword because:
      // 1. linkify-plugin-keyword only supports single-word keywords
      // 2. Multi-word patterns like "...See more " are not reliably matched
      // 3. This ensures the "See more" link always works for RichTextDisplay components
      const ellipsisLink = `<a href="/expand" style="color: gray;text-decoration: none;">${ellipsis}</a>`
      truncatedHtml = `${truncatedHtml} ${ellipsisLink}`
    }

    // Call linkifyHtml once after truncation to handle any other linkifiable content.
    // The ellipsis is already wrapped in an <a> tag, so it won't be re-processed.
    //
    // IMPORTANT: We intentionally call linkifyHtml only ONCE here.
    // The original code had two calls, but this was unnecessary and caused bugs:
    //
    // 1. Content from getParsedHtml() is already linkified (URLs, @mentions, #hashtags are in <a> tags)
    // 2. linkifyHtml ignores content inside <a> tags, so already-linked content is safe
    // 3. Multiple linkifyHtml passes can cause issues when problematic keywords are registered
    //    (e.g., keywords containing spaces), leading to spurious links for whitespace
    //
    // Character count note: truncateHtml counts visible text, not HTML tags,
    // so the character count is consistent regardless of linkification.
    return linkifyHtml(truncatedHtml, this.parsingOptions)
  }

  isHTMLEmpty(): boolean {
    return isEmptyHTML(this.html)
  }

  registerKeywords(keywords: string[]): void {
    this.keywords.push(...keywords)
  }

  public cleanHTML(html: string) {
    let output = ''
    const parser = new Parser(
      {
        onopentag: (name, attribs) => {
          if (name !== 'br') {
            // Skip <br> tags during initial parsing
            output += `<${name}${this.formatAttributes(attribs)}>`
          }
        },
        ontext: text => {
          if (text.trim().length > 0) {
            output += text
          }
        },
        onclosetag: name => {
          if (name !== 'br') {
            output += `</${name}>`
          }
        },
      },
      { decodeEntities: true },
    )

    parser.write(html)
    parser.end()

    // Additional cleanup to remove empty tags that might have been created (recursively)
    let prevOutput: string
    do {
      prevOutput = output
      output = output.replace(/<(\w+)(?:\s+[^>]+)?>(\s|&nbsp;)*<\/\1>/g, '')
    } while (output !== prevOutput)

    return output
  }

  private formatAttributes(attribs: any) {
    return Object.keys(attribs)
      .map(key => ` ${key}="${attribs[key]}"`)
      .join('')
  }
}
