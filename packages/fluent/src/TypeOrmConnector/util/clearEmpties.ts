import { ObjectId } from 'bson'

/**
 * Deeply removes all empty and nullish values from a
 * given object
 * @param object
 * @returns
 */
export const clearEmpties = object => {
  Object.entries(object).forEach(([k, v]: [any, any]) => {
    if (v && typeof v === 'object') clearEmpties(v)
    if (
      (v && typeof v === 'object' && !Object.keys(v).length) ||
      v === null ||
      v === undefined ||
      v.length === 0
    ) {
      if (Array.isArray(object)) {
        // Do not remove Object ID
        if (!(object[k] instanceof ObjectId)) {
          object.splice(k, 1)
        }
      } else if (!(v instanceof Date) && !(v instanceof ObjectId)) {
        delete object[k]
      }
    }
  })
  return object
}
