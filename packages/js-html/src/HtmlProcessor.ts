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
      onopentag(name, attribs) {
        if (Object.keys(attribs).length > 0) {
          isEmpty = false
        }
      },
      ontext(text) {
        // Check if there is any non-whitespace text
        if (text.trim()) {
          isEmpty = false
        }
      }
    },
    { decodeEntities: false }
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
    attributes: (href, element) => {
      if (element === 'keyword') {
        return {
          style: 'color: gray;text-decoration: none;'
        }
      } else if (element === 'hashtag') {
        return {
          style: 'color: green;text-decoration: none;'
        }
      }
      return {}
    },
    className: {},
    defaultProtocol: 'https',
    format: (value, type) => value,
    formatHref: {
      keyword: keyword => {
        if (keyword === this.expandKeyWord) {
          return '/expand'
        }

        return '/tags/' + keyword.toLowerCase()
      },
      hashtag: href => '/hashtag/' + href.substr(1),
      ticket: href => '/issues/' + href.substr(1),
      mention: href => 'account' + href //TODO: Cambiar luego x la url real
    },
    ignoreTags: ['script', 'style'],
    nl2br: false,
    rel: {},
    tagName: 'a',
    target: {},
    truncate: 0,
    validate: {}
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
      }
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
        ...toAdd
      },
      { decodeEntities: true }
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
        div: ['style']
      },
      transformTags: {
        br: (tagname, attr) => {
          return {
            tagName: 'div',
            attribs: {
              style: 'display:flex; margin:5px 0;'
            }
          }
        }
      }
    })
    return linkifyHtml(sanitized, this.parsingOptions)
  }

  getTruncatedHtml({
    truncate = Infinity,
    ellipsis = 'See more'
  }: {
    truncate?: number
    ellipsis?: string
  }) {
    const parsed = this.getParsedHtml()

    let truncatedHtml = truncateHtml(parsed, truncate, {
      ellipsis: '',
      keepImageTag: true,
      truncateLastWord: true
    })

    const extractedText = HtmlProcessor.extractTextFromHTML(parsed).trim()

    if (extractedText.length > truncate) {
      truncatedHtml = `${truncatedHtml} ${ellipsis}`
    }

    const reProcessHtml = linkifyHtml(truncatedHtml, this.parsingOptions)

    const finalResult = linkifyHtml(reProcessHtml, this.parsingOptions)

    return finalResult
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
        }
      },
      { decodeEntities: true }
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
