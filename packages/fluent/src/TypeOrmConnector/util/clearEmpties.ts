import { ObjectId } from 'bson'

/**
 * Deeply removes all empty and nullish values from a
 * given object
 * @param object
 * @returns
 */
export const clearEmpties = (object: any): any => {
  if (Array.isArray(object)) {
    return clearEmptiesFromArray(object)
  }

  if (typeof object === 'object' && object !== null) {
    return clearEmptiesFromObject(object)
  }
  return object
}

function isEmptyValue(value: any): boolean {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  )
}

function isProcessableObject(value: any): boolean {
  return (
    value &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !(value instanceof ObjectId)
  )
}

function clearEmptiesFromArray(arr: any[]): any[] {
  // Process arrays backwards to handle splicing correctly
  for (let i = arr.length - 1; i >= 0; i--) {
    const value = arr[i]

    if (isProcessableObject(value)) {
      clearEmpties(value)
      if (
        Array.isArray(value)
          ? value.length === 0
          : Object.keys(value).length === 0
      ) {
        arr.splice(i, 1)
      }
    } else if (isEmptyValue(value)) {
      arr.splice(i, 1)
    }
  }
  return arr
}

function clearEmptiesFromObject(obj: Record<string, any>): Record<string, any> {
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) {
      continue
    }

    const value = obj[key]

    if (isEmptyValue(value)) {
      delete obj[key]
    } else if (isProcessableObject(value)) {
      clearEmpties(value)
      if (
        Array.isArray(value)
          ? value.length === 0
          : Object.keys(value).length === 0
      ) {
        delete obj[key]
      }
    }
  }
  return obj
}
