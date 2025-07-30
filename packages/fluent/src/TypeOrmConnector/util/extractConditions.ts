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
    if (Object.hasOwn(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key
      if (
        obj[key] !== null &&
        typeof obj[key] === 'object' &&
        !Array.isArray(obj[key])
      ) {
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
type Condition = {
  operator: LogicOperator
  element: string
  value: Primitives | PrimitivesArray
}

export const extractConditions = (
  conditions: FluentQuery<any>['where'][]
): Condition[] => {
  const accumulatedClauses: Condition[] = []

  if (!conditions) {
    return accumulatedClauses
  }

  for (const clause of conditions) {
    if (!clause) {
      continue
    }

    const clauseConditions = extractClauseConditions(clause)
    accumulatedClauses.push(...clauseConditions)
  }

  return removeDuplicateConditions(accumulatedClauses)
}

function extractClauseConditions(clause: Record<string, any>): Condition[] {
  const conditions: Condition[] = []

  for (const element of Object.keys(clause)) {
    const value = clause[element]

    if (isAnyObject(value)) {
      const objectConditions = extractObjectConditions(element, value)
      conditions.push(...objectConditions)
    } else {
      conditions.push({
        operator: LogicOperator.Equals,
        element,
        value
      })
    }
  }

  return conditions
}

function extractObjectConditions(initialKey: string, value: any): Condition[] {
  const conditions: Condition[] = []
  const flatten = flattenWithTypes(value)

  for (const key of Object.keys(flatten)) {
    const transformedKey = key.replace(/.[0-9]/g, '')
    const condition = createConditionFromKey(
      initialKey,
      key,
      transformedKey,
      value,
      flatten
    )

    if (condition) {
      conditions.push(condition)
    }
  }

  return conditions
}

function createConditionFromKey(
  initialKey: string,
  key: string,
  transformedKey: string,
  originalValue: any,
  flatten: any
): Condition | null {
  // Handle direct operator
  // Check if transformedKey is a value in LogicOperator enum
  const operatorValue = Object.values(LogicOperator).find(
    val => val === transformedKey
  )
  if (operatorValue) {
    return createOperatorCondition(
      initialKey,
      transformedKey,
      key,
      originalValue,
      flatten
    )
  }

  // Handle nested operator
  if (transformedKey.includes('.')) {
    return createNestedCondition(initialKey, key, flatten)
  }

  // Default to equals operator
  return {
    operator: LogicOperator.Equals,
    element: `${initialKey}.${transformedKey}`,
    value: flatten[key] as Primitives | PrimitivesArray
  }
}

function createOperatorCondition(
  initialKey: string,
  operatorKey: string,
  flatKey: string,
  originalValue: any,
  flatten: any
): Condition {
  // Find the operator by its value (e.g., 'in' -> LogicOperator.In)
  const operatorEntry = Object.entries(LogicOperator).find(
    ([_key, value]) => value === operatorKey
  )

  if (!operatorEntry) {
    throw new Error(`Unknown operator: ${operatorKey}`)
  }

  const operator = operatorEntry[1] as LogicOperator

  // Special handling for IN and NOT IN operators
  if (operator === LogicOperator.In || operator === LogicOperator.NotIn) {
    return {
      operator,
      element: initialKey,
      value: originalValue[operatorKey]
    }
  }

  return {
    operator,
    element: initialKey,
    value: flatten[flatKey] as Primitives | PrimitivesArray
  }
}

function createNestedCondition(
  initialKey: string,
  key: string,
  flatten: any
): Condition | null {
  const parts = key.split('.')
  const possibleOperator = parts[parts.length - 1]

  if (!possibleOperator) {
    return null
  }

  // Check if possibleOperator is a value in LogicOperator enum
  const operatorEntry = Object.entries(LogicOperator).find(
    ([_key, value]) => value === possibleOperator
  )

  if (operatorEntry) {
    const elementPath = key.substring(
      0,
      key.length - possibleOperator.length - 1
    )
    return {
      operator: operatorEntry[1] as LogicOperator,
      element: `${initialKey}.${elementPath}`,
      value: flatten[key] as Primitives | PrimitivesArray
    }
  }

  return {
    operator: LogicOperator.Equals,
    element: `${initialKey}.${key}`,
    value: flatten[key] as Primitives | PrimitivesArray
  }
}

function removeDuplicateConditions(conditions: Condition[]): Condition[] {
  const seen = new Set<string>()
  return conditions.filter(condition => {
    const key = JSON.stringify(condition)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
