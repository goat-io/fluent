import * as diff from 'deep-diff'
import { AnyObject } from './types'

enum kind {
  'N' = 'NEW',
  'D' = 'DELETED',
  'E' = 'EDITED',
  'A' = 'ARRAY-EDITED'
}

export interface ChangelogInput {
  previous: AnyObject
  current: AnyObject
  author: string
}

export interface Changelog {
  kind: kind
  path: string[]
  user: string
  timestamp: string
  previous: string
  new: string
  item?: {
    kind: kind
    previous?: string
    new?: string
  }
}

export const Changelogs = (() => {
  /**
   *
   * Given two Objects, it calculates the changes
   * between them and generates a changelog.
   *
   * @param {Object} param
   * @param {Object} param.previous previous value
   * @param {Object} param.current current value
   * @param {String} param.author change author
   * @returns {Array} Changelog
   */
  const get = ({ previous, current, author }: ChangelogInput): Changelog[] => {
    const lhs = { ...previous }
    const rhs = { ...current }
    const timestamp = new Date().toISOString()
    const differences = diff(lhs, rhs)

    if (!differences) {
      return []
    }

    let _differences = []

    differences.forEach(d => {
      if (
        !d.path.includes('user') &&
        !d.path.includes('_ngram') &&
        !d.path.includes('submit')
      ) {
        const c = { ...d, user: author, timestamp }
        c.previous = String(c.lhs)
        c.new = String(d.rhs)
        delete c.rhs
        delete c.lhs
        _differences.push(c)
      }
    })

    _differences = _differences.map(d => {
      d.kind = kind[d.kind]
      d.path = d.path.map(String)
      d.item = d.item
        ? {
            kind: kind[d.item.kind],
            new: d.item.rhs,
            previous: d.item.lhs
          }
        : undefined

      return d
    })
    return _differences
  }

  return Object.freeze({
    get
  })
})()
