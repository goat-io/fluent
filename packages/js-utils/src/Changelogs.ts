import { AnyObject } from './types'

export enum ChangeType {
  NEW = 'N',
  DELETED = 'D',
  EDITED = 'E',
  ARRAY = 'A'
}

interface ChangelogInput {
  previous: AnyObject
  current: AnyObject
  author: string
  timeStamp?: string
}

interface Changelog {
  kind: ChangeType
  path: string[]
  author: string
  timestamp: string
  previous?: string
  new?: string
}

export const Changelogs = (() => {
  const get = ({
    previous,
    current,
    author,
    timeStamp
  }: ChangelogInput): Changelog[] => {
    const timestamp = timeStamp || new Date().toISOString()
    const changes: Changelog[] = []

    function deepCompare(lhs: AnyObject, rhs: AnyObject, path: string[] = []) {
      if (lhs === rhs || (lhs !== lhs && rhs !== rhs)) {
        // NaN check
        return
      }

      if (
        typeof lhs !== 'object' ||
        typeof rhs !== 'object' ||
        lhs == null ||
        rhs == null
      ) {
        changes.push({
          kind: ChangeType.EDITED,
          path,
          author,
          timestamp,
          previous: JSON.stringify(lhs),
          new: JSON.stringify(rhs)
        })
        return
      }

      if (Array.isArray(lhs) && Array.isArray(rhs)) {
        for (let i = 0; i < Math.max(lhs.length, rhs.length); i++) {
          if (i >= lhs.length) {
            changes.push({
              kind: ChangeType.NEW,
              path: path.concat([String(i)]),
              author,
              timestamp,
              new: JSON.stringify(rhs[i])
            })
          } else if (i >= rhs.length) {
            changes.push({
              kind: ChangeType.DELETED,
              path: path.concat([String(i)]),
              author,
              timestamp,
              previous: JSON.stringify(lhs[i])
            })
          } else {
            deepCompare(lhs[i], rhs[i], path.concat([String(i)]))
          }
        }
      } else {
        const allKeys = new Set([...Object.keys(lhs), ...Object.keys(rhs)])
        for (let key of allKeys) {
          if (!rhs.hasOwnProperty(key)) {
            changes.push({
              kind: ChangeType.DELETED,
              path: path.concat(key),
              author,
              timestamp,
              previous: JSON.stringify(lhs[key])
            })
          } else if (!lhs.hasOwnProperty(key)) {
            changes.push({
              kind: ChangeType.NEW,
              path: path.concat(key),
              author,
              timestamp,
              new: JSON.stringify(rhs[key])
            })
          } else {
            deepCompare(lhs[key], rhs[key], path.concat(key))
          }
        }
      }
    }

    deepCompare(previous, current)
    return changes
  }

  return Object.freeze({
    get
  })
})()
