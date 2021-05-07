import pluralize from 'pluralize'
import { nGram } from "./Ngram"
import { IDataElement } from '../Providers/types'
import { Objects } from './Objects'

export interface INgramFromObject {
  fields: string[]
  object: IDataElement
}

export const Strings = (() => {
  /**
   * Get the singular form of an English word.
   * @param  string  $value
   * @return string
   */
  const singular = (value: string): string => {
    return pluralize.singular(value)
  }

  /**
   * Get the plural form of an English word.
   * @param  string  $value
   * @return string
   */
  const plural = (value: string, count = 2): string => {
    return pluralize(value, count)
  }

  /**
   * Return the remainder of a string after the first occurrence of a given value.
   *
   * @param  string  $subject
   * @param  string  $search
   * @return string
   */
  const after = (subject: string, search: string): string => {
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
  const before = (subject: string, search: string): string => {
    const result = subject.split(search)
    return result.length > 1 ? result[0] : subject
  }

  /**
   * Convert a value to camel case.
   *
   * @param  string  $value
   * @return string
   */
  const camel = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
  }

  /**
   * Determine if a given string contains a given substring.
   *
   * @param  string  $haystack
   * @param  string | array  $needles
   * @return bool
   */
  const contains = (haystack: string, needles: string | string[]) => {
    if (Array.isArray(needles)) {
      return needles.some(v => {
        return haystack.indexOf(v) >= 0
      })
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
  const limit = (value, limit = 100, end = '...') => {
    return `${value.substring(0, limit).trim()}${end}`
  }

  /**
   * Generate a URL friendly "slug" from a given string.
   *
   * @param  string  str
   * @param  string  separator
   * @return string
   */
  const slug = (str: string, separator = '-'): string => {
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
  const snake = (str: string, delimiter = '_') => {
    return (
      str &&
      str
        .match(
          /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g
        )
        .map(x => x.toLowerCase())
        .join(delimiter)
    )
  }
  /**
   *
   * Generates a nGram based on a given text
   *
   * @param {string} text
   * @returns {string} generated nGram
   */
  const ngram = (text: string) => {
    if (!text || text === 'undefined ') {
      return ''
    }

    if (text.length === 1) {
      return text
    }
    // Include 1st and 2nd characters on Ngram
    let nGramString: string = `${text[0]} ${text[0]}${text[1]}`

    // Generate Ngram from N=3 for better search experience
    for (let i = 3; i <= text.length; i++) {
      const ngramArray: string[] = nGram(i)(text)
      nGramString = nGramString + ' ' + ngramArray.join(' ')
    }

    return nGramString
  }
  /**
   *
   * Given an Object It generates de corresponding nGram for
   * each attribute one.
   *
   * @param {Object} param
   * @param {Array} param.fullTextFields Fields to add as full text
   * @param {Array} param.fields Fields to add as fuzzy search
   * @param {Array || Object} param.submissions description
   * @returns {Array} Submissions with nGram
   */
  const ngramFromObject = ({ fields, object }: INgramFromObject): string => {
    const submission = JSON.parse(JSON.stringify(object))

    const fullNGramString = fields.reduce((r, field) => {
      const text = Objects.getFromPath(submission, field, '')
      const nGramText = ngram(text.value)
      r = `${r} ${nGramText}`
      return r
    }, '')

    let ngramString = `${fullNGramString}`
      .replace(/undefined/g, '')
      .replace(/\s\s+/g, ' ')
      .trim()

    ngramString = ngramString
      .split(' ')
      .filter((item, i, allItems) => {
        return i === allItems.indexOf(item)
      })
      .join(' ')

    return ngramString
  }

  return Object.freeze({
    after,
    before,
    camel,
    contains,
    limit,
    plural,
    singular,
    slug,
    snake,
    ngram,
    ngramFromObject
  })
})()
