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
  const get = ({ previous, current, author }: ChangelogInput): Changelog[] => {
    const timestamp = new Date().toISOString()
    const differences: Changelog[] = []

    function deepCompare(lhs: AnyObject, rhs: AnyObject, path: string[] = []) {
      for (const key in lhs) {
        if (rhs.hasOwnProperty(key)) {
          if (typeof lhs[key] === 'object' && typeof rhs[key] === 'object') {
            deepCompare(lhs[key], rhs[key], path.concat(key))
          } else if (lhs[key] !== rhs[key]) {
            if (
              !path.includes('user') &&
              !path.includes('_ngram') &&
              !path.includes('submit')
            ) {
              differences.push({
                kind:
                  lhs[key] === undefined
                    ? kind.N
                    : rhs[key] === undefined
                    ? kind.D
                    : kind.E,
                path: path.concat(key),
                user: author,
                timestamp,
                previous: String(lhs[key]),
                new: String(rhs[key])
              })
            }
          }
        } else if (
          !path.includes('user') &&
          !path.includes('_ngram') &&
          !path.includes('submit')
        ) {
          differences.push({
            kind: kind.D,
            path: path.concat(key),
            user: author,
            timestamp,
            previous: String(lhs[key]),
            new: undefined
          })
        }
      }

      for (const key in rhs) {
        if (
          !lhs.hasOwnProperty(key) &&
          !path.includes('user') &&
          !path.includes('_ngram') &&
          !path.includes('submit')
        ) {
          differences.push({
            kind: kind.N,
            path: path.concat(key),
            user: author,
            timestamp,
            previous: undefined,
            new: String(rhs[key])
          })
        }
      }
    }

    deepCompare(previous, current)

    return differences
  }

  return Object.freeze({
    get
  })
})()
