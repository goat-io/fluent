import { Objects } from '@goatlab/js-utils'
import {
  FluentQuery,
  LogicOperator,
  Primitives,
  PrimitivesArray
} from '../../types'
import { isAnyObject } from './isAnyObject'

/**
 * Custom flatten function that preserves types
 */
function flattenWithTypes(obj: any, prefix = '', result: any = {}): any {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key
      if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        flattenWithTypes(obj[key], newKey, result)
      } else {
        // Preserve the original type
        result[newKey] = obj[key]
      }
    }
  }
  return result
}

/**
 * Transforms the nested object WHERE clause into an
 * Array of clearly defined conditions
 * @param conditions
 * @returns
 */
export const extractConditions = (
  conditions: FluentQuery<any>['where'][]
): {
  operator: LogicOperator
  element: string
  value: Primitives | PrimitivesArray
}[] => {
  const accumulatedClauses: {
    operator: LogicOperator
    element: string
    value: Primitives | PrimitivesArray
  }[] = []

  if (!conditions) {
    return accumulatedClauses
  }

  for (const clause of conditions) {
    if (!clause) {
      continue
    }
    for (const el of Object.keys(clause)) {
      const value = clause[el]

      if (isAnyObject(value)) {
        const initialKey = el
        // Use a custom flatten that preserves types
        const flatten = flattenWithTypes(value)

        for (const key of Object.keys(flatten)) {
          // Remove .# from keys when we have an array in the flattened object
          const transformedKey = key.replace(new RegExp('.[0-9]', 'g'), '')

          if (LogicOperator[transformedKey]) {
            if (
              LogicOperator[transformedKey] === LogicOperator.in ||
              LogicOperator[transformedKey] === LogicOperator.notIn
            ) {
              // The IN operator accepts an array, therefore we need the full array as a value
              accumulatedClauses.push({
                operator: LogicOperator[transformedKey],
                element: `${initialKey}`,
                value: value[transformedKey]
              })
            } else {
              accumulatedClauses.push({
                operator: LogicOperator[transformedKey],
                element: `${initialKey}`,
                value: flatten[key] as Primitives | PrimitivesArray as Primitives | PrimitivesArray
              })
            }
          } else if (transformedKey.includes('.')) {
            const op = key.split('.').slice(-1).pop()

            if (!op) {
              continue
            }

            if (LogicOperator[op]) {
              accumulatedClauses.push({
                operator: LogicOperator[op],
                element: `${initialKey}.${key.replace(`.${op}`, '')}`,
                value: flatten[key] as Primitives | PrimitivesArray as Primitives | PrimitivesArray
              })
            } else {
              accumulatedClauses.push({
                operator: LogicOperator.equals,
                element: `${initialKey}.${key}`,
                value: flatten[key] as Primitives | PrimitivesArray as Primitives | PrimitivesArray
              })
            }
          } else {
            accumulatedClauses.push({
              operator: LogicOperator.equals,
              element: `${initialKey}.${transformedKey}`,
              value: flatten[key] as Primitives | PrimitivesArray
            })
          }
        }
      } else {
        accumulatedClauses.push({
          operator: LogicOperator.equals,
          element: el,
          value
        })
      }
    }
  }

  return accumulatedClauses.filter(
    (v, i, a) =>
      a.findIndex(v2 => JSON.stringify(v2) === JSON.stringify(v)) === i
  )
}
