import pluralize from 'pluralize'
import { BaseDataElement, StringMap } from './types'
import { nGram } from './Ngram'
import { Objects } from './Objects'
import { reUnicodeWords } from './Strings/unicodeWords'

export interface NgramFromObject {
  fields: string[]
  object: BaseDataElement
}

const DETECT_JSON = /^\s*[{["\-\d]/
const reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g
class StringsClass {
  /**
   * Get the singular form of an English word.
   * @param  string  $value
   * @return string
   */
  singular = (value: string): string => pluralize.singular(value)

  /**
   * Get the plural form of an English word.
   * @param  string  $value
   * @return string
   */
  plural = (value: string, count = 2): string => pluralize(value, count, false)

  /**
   * Return the remainder of a string after the first occurrence of a given value.
   *
   * @param  string  $subject
   * @param  string  $search
   * @return string
   */
  after = (subject: string, search: string): string => {
    const result = subject.split(search)
    return result.length > 1 ? result[1] : subject
  }

  /**
   * Get the portion of a string before the first occurrence of a given value.
   *
   * @param  string  $subject
   * @param  string  $search
   * @return string
   */
  before = (subject: string, search: string): string => {
    const result = subject.split(search)
    return result.length > 1 ? result[0] : subject
  }

  upperFirst(s: string = ''): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  lowerFirst(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1)
  }

  /**
   * Convert a value to camel case.
   *
   * @param  string  $value
   * @return string
   */
  camel(s: string): string {
    // return s.replace(/(_\w)/g, m => m[1]!.toUpperCase())
    return this.words(s.replace(/['\u2019]/g, '')).reduce(
      (result, word, index) => {
        word = word.toLowerCase()
        return result + (index ? this.upperFirst(word) : word)
      },
      ''
    )
  }

  /**
   * Determine if a given string contains a given substring.
   *
   * @param  string  $haystack
   * @param  string | array  $needles
   * @return bool
   */
  contains = (haystack: string, needles: string | string[]) => {
    if (Array.isArray(needles)) {
      return needles.some(v => haystack.indexOf(v) >= 0)
    }
    return haystack.includes(needles)
  }

  /**
   * Limit the number of characters in a string.
   *
   * @param  string  $value
   * @param  int  $limit
   * @param  string  $end
   * @return string
   */
  limit = (value, lim = 100, end = '...') =>
    `${value.substring(0, lim).trim()}${end}`

  /**
   * Generate a URL friendly "slug" from a given string.
   *
   * @param  string  str
   * @param  string  separator
   * @return string
   */
  slug = (str: string, separator = '-'): string => {
    const a =
      'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b =
      'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return str
      .toString()
      .toLowerCase()
      .replace(/\s+/g, separator) // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, `${separator}and${separator}`) // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word characters
      .replace(/\-\-+/g, separator) // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
  }

  /**
   * Convert a string to snake case.
   *
   * @param  string  $value
   * @param  string  $delimiter
   * @return string
   */
  snake(s: string): string {
    return this.words(s.replace(/['\u2019]/g, '')).reduce(
      (result, word, index) => result + (index ? '_' : '') + word.toLowerCase(),
      ''
    )
  }

  private hasUnicodeWord = RegExp.prototype.test.bind(
    /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/
  )

  asciiWords(s: string): RegExpMatchArray | null {
    return s.match(reAsciiWord)
  }

  /**
   * Splits a Unicode `string` into an array of its words.
   *
   * @returns {Array} Returns the words of `string`.
   */
  unicodeWords(s: string): RegExpMatchArray | null {
    return s.match(reUnicodeWords)
  }

  /**
   * Splits `string` into an array of its words.
   *
   * @param [s=''] The string to inspect.
   * @param [pattern] The pattern to match words.
   * @returns Returns the words of `string`.
   * @example
   *
   * words('fred, barney, & pebbles')
   * // => ['fred', 'barney', 'pebbles']
   *
   * words('fred, barney, & pebbles', /[^, ]+/g)
   * // => ['fred', 'barney', '&', 'pebbles']
   */
  words(s: string, pattern?: RegExp | string): string[] {
    if (pattern === undefined) {
      const result = this.hasUnicodeWord(s)
        ? this.unicodeWords(s)
        : this.asciiWords(s)
      return result || []
    }
    return s.match(pattern) || []
  }

  kebabCase(s: string): string {
    return this.words(s.replace(/['\u2019]/g, '')).reduce(
      (result, word, index) => result + (index ? '-' : '') + word.toLowerCase(),
      ''
    )
  }
  /**
   * Attempts to parse object as JSON.
   * Returns original object if JSON parse failed (silently).
   */
  jsonParseIfPossible(
    obj: any,
    reviver?: (this: any, key: string, value: any) => any
  ): any {
    // Optimization: only try to parse if it looks like JSON: starts with a json possible character
    if (typeof obj === 'string' && obj && DETECT_JSON.test(obj)) {
      try {
        return JSON.parse(obj, reviver)
      } catch {}
    }

    return obj
  }

  /**
   * Converts the first character of string to upper case and the remaining to lower case.
   */
  capitalize(s: string = ''): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  }

  split(str: string, separator: string, limit: number): string[] {
    const parts = str.split(separator)
    return [
      ...parts.slice(0, limit - 1),
      parts.slice(limit - 1).join(separator)
    ]
  }

  removeWhitespace(s: string): string {
    return s.replace(/\s/g, '')
  }

  truncate(s: string, maxLen: number, omission = '...'): string {
    if (!s || s.length <= maxLen) return s

    return s.substr(0, maxLen - omission.length) + omission
  }

  truncateMiddle(s: string, maxLen: number, omission = '...'): string {
    if (!s || s.length <= maxLen) return s

    const mark1 = Math.round((maxLen - omission.length) / 2)
    const mark2 = s.length - Math.floor((maxLen - omission.length) / 2)
    return s.substr(0, mark1) + omission + s.substr(mark2)
  }

  substringBefore(s: string, delimiter: string): string {
    const pos = s.indexOf(delimiter)
    return s.substring(0, pos !== -1 ? pos : undefined)
  }

  substringBeforeLast(s: string, delimiter: string): string {
    const pos = s.lastIndexOf(delimiter)
    return s.substring(0, pos !== -1 ? pos : undefined)
  }

  substringAfter(s: string, delimiter: string): string {
    const pos = s.indexOf(delimiter)
    return pos !== -1 ? s.substring(pos + 1) : s
  }

  substringAfterLast(s: string, delimiter: string): string {
    const pos = s.lastIndexOf(delimiter)
    return pos !== -1 ? s.substring(pos + 1) : s
  }

  /**
   * Returns the substring between LAST `leftDelimiter` and then FIRST `rightDelimiter`.
   *
   * @example
   *
   * const s = '/Users/lalala/someFile.test.ts'
   * _substringBetweenLast(s, '/', '.')
   * // `someFile`
   */
  substringBetweenLast(
    s: string,
    leftDelimiter: string,
    rightDelimiter: string
  ): string {
    return this.substringBefore(
      this.substringAfterLast(s, leftDelimiter),
      rightDelimiter
    )
  }

  replaceAll(s: string, find: string, replaceWith: string): string {
    return s.replace(new RegExp(find, 'g'), replaceWith)
  }
  /**
   *
   * Generates a nGram based on a given text
   *
   * @param {string} text
   * @returns {string} generated nGram
   */
  ngram = (text?: string) => {
    if (!text || text === 'undefined ') {
      return ''
    }

    if (text.length === 1) {
      return text
    }
    // Include 1st and 2nd characters on Ngram
    let nGramString = `${text[0]} ${text[0]}${text[1]}`

    // Generate Ngram from N=3 for better search experience
    for (let i = 3; i <= text.length; i++) {
      const ngramArray: string[] = nGram(i)(text)
      nGramString = `${nGramString} ${ngramArray.join(' ')}`
    }

    return nGramString
  }

  nl2br(s: string): string {
    return s.replace(/\n/g, '<br>\n')
  }
  /**
   *
   * Given an Object It generates de corresponding nGram for
   * each attribute.
   *
   * @param {Object} param
   * @param {Array} param.fullTextFields Fields to add as full text
   * @param {Array} param.fields Fields to add as fuzzy search
   * @param {Array || Object} param.submissions description
   * @returns {String} Submissions with nGram
   */
  ngramFromObject = ({ fields, object }: NgramFromObject): string => {
    const submission = JSON.parse(JSON.stringify(object))

    const fullNGramString = fields.reduce((r, field) => {
      const text = Objects.getFromPath(submission, field, '')
      const nGramText = this.ngram(text.value)
      r = `${r} ${nGramText}`
      return r
    }, '')

    let ngramString = `${fullNGramString}`
      .replace(/undefined/g, '')
      .replace(/\s\s+/g, ' ')
      .trim()

    ngramString = ngramString
      .split(' ')
      .filter((item, i, allItems) => i === allItems.indexOf(item))
      .join(' ')

    return ngramString
  }
  /**
   *
   * Given an Array of Strings it generates de corresponding nGram for
   * each element.
   *
   * @param {Object} param
   * @param {Array} param Strings to generate ngram from
   * @returns {String} generated nGram string
   */
  ngramFromArray = (texts: string[]): string => {
    const fullNGramString = texts.reduce((r, text) => {
      const nGramText = this.ngram(text)
      r = `${r} ${nGramText}`
      return r
    }, '')

    let ngramString = `${fullNGramString}`
      .replace(/undefined/g, '')
      .replace(/\s\s+/g, ' ')
      .trim()

    ngramString = ngramString
      .split(' ')
      .filter((item, i, allItems) => i === allItems.indexOf(item))
      .join(' ')

    return ngramString
  }

  parseQueryString(search: string): StringMap {
    const qs: StringMap = {}
    search
      .slice(search[0] === '?' ? 1 : 0)
      .split('&')
      .forEach(p => {
        const [k, v] = p.split('=')
        if (!k) return
        qs[decodeURIComponent(k)] = decodeURIComponent(v || '')
      })
    return qs
  }
}
export const Strings = new StringsClass()
