import { AnyObject } from './types'

export enum ChangeType {
  NEW = 'N',
  DELETED = 'D',
  EDITED = 'E',
  ARRAY = 'A',
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
    timeStamp,
  }: ChangelogInput): Changelog[] => {
    const timestamp = timeStamp || new Date().toISOString()
    const changes: Changelog[] = []

    function addChange(
      kind: ChangeType,
      path: string[],
      data: { previous?: unknown; new?: unknown },
    ) {
      changes.push({
        kind,
        path,
        author,
        timestamp,
        previous:
          data.previous !== undefined
            ? JSON.stringify(data.previous)
            : undefined,
        new: data.new !== undefined ? JSON.stringify(data.new) : undefined,
      })
    }

    function compareArrays(
      lhs: unknown[],
      rhs: unknown[],
      path: string[],
      compareFunc: (l: unknown, r: unknown, p: string[]) => void,
    ) {
      const maxLength = Math.max(lhs.length, rhs.length)
      for (let i = 0; i < maxLength; i++) {
        const indexPath = path.concat([String(i)])
        if (i >= lhs.length) {
          addChange(ChangeType.NEW, indexPath, { new: rhs[i] })
        } else if (i >= rhs.length) {
          addChange(ChangeType.DELETED, indexPath, { previous: lhs[i] })
        } else {
          compareFunc(lhs[i], rhs[i], indexPath)
        }
      }
    }

    function compareObjects(
      lhs: AnyObject,
      rhs: AnyObject,
      path: string[],
      compareFunc: (l: unknown, r: unknown, p: string[]) => void,
    ) {
      const allKeys = new Set([...Object.keys(lhs), ...Object.keys(rhs)])
      for (const key of allKeys) {
        const keyPath = path.concat(key)
        if (!Object.hasOwn(rhs, key)) {
          addChange(ChangeType.DELETED, keyPath, { previous: lhs[key] })
        } else if (!Object.hasOwn(lhs, key)) {
          addChange(ChangeType.NEW, keyPath, { new: rhs[key] })
        } else {
          compareFunc(lhs[key], rhs[key], keyPath)
        }
      }
    }

    function deepCompare(lhs: AnyObject, rhs: AnyObject, path: string[] = []) {
      if (lhs === rhs || (Number.isNaN(lhs) && Number.isNaN(rhs))) {
        return
      }

      if (
        typeof lhs !== 'object' ||
        typeof rhs !== 'object' ||
        lhs == null ||
        rhs == null
      ) {
        addChange(ChangeType.EDITED, path, { previous: lhs, new: rhs })
        return
      }

      if (Array.isArray(lhs) && Array.isArray(rhs)) {
        compareArrays(lhs, rhs, path, deepCompare)
      } else {
        compareObjects(lhs, rhs, path, deepCompare)
      }
    }

    deepCompare(previous, current)
    return changes
  }

  return Object.freeze({
    get,
  })
})()
