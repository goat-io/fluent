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
      const lhsKeys = Object.keys(lhs)
      const rhsKeys = Object.keys(rhs)

      lhsKeys.forEach(key => {
        if (rhs.hasOwnProperty(key)) {
          const newPath = path.concat(key)
          const lhsValue = lhs[key]
          const rhsValue = rhs[key]

          if (Array.isArray(lhsValue) && Array.isArray(rhsValue)) {
            if (lhsValue.length !== rhsValue.length) {
              differences.push({
                kind: kind.A,
                path: newPath,
                user: author,
                timestamp,
                previous: JSON.stringify(lhsValue),
                new: JSON.stringify(rhsValue)
              })
            } else {
              lhsValue.forEach((item, index) => {
                if (item !== rhsValue[index]) {
                  differences.push({
                    kind: kind.A,
                    path: newPath.concat(index.toString()),
                    user: author,
                    timestamp,
                    previous: JSON.stringify(item),
                    new: JSON.stringify(rhsValue[index]),
                    item: {
                      kind: kind.N,
                      new: JSON.stringify(rhsValue[index])
                    }
                  })
                }
              })
            }
          } else if (
            typeof lhsValue === 'object' &&
            typeof rhsValue === 'object' &&
            !Array.isArray(lhsValue) &&
            !Array.isArray(rhsValue)
          ) {
            deepCompare(lhsValue, rhsValue, newPath)
          } else if (lhsValue !== rhsValue) {
            if (
              !path.includes('user') &&
              !path.includes('_ngram') &&
              !path.includes('submit')
            ) {
              differences.push({
                kind: lhsValue === undefined ? kind.N : kind.E,
                path: newPath,
                user: author,
                timestamp,
                previous:
                  lhsValue === undefined ? 'undefined' : String(lhsValue),
                new: rhsValue === undefined ? 'undefined' : String(rhsValue)
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
      })

      rhsKeys.forEach(key => {
        if (!lhs.hasOwnProperty(key)) {
          if (
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
      })
    }

    deepCompare(previous, current)

    return differences
  }

  return Object.freeze({
    get
  })
})()
