import { ObjectId } from 'bson'

/**
 * Deeply removes all empty and nullish values from a
 * given object
 * @param object
 * @returns
 */
export const clearEmpties = object => {
  const isArr = Array.isArray(object)
  const keys = isArr ? object.length : Object.keys(object).length
  
  if (!keys) return object
  
  if (isArr) {
    // Process arrays backwards to handle splicing correctly
    for (let i = object.length - 1; i >= 0; i--) {
      const v = object[i]
      if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ObjectId)) {
        clearEmpties(v)
        if (!Object.keys(v).length) {
          object.splice(i, 1)
        }
      } else if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
        object.splice(i, 1)
      }
    }
  } else {
    for (const k in object) {
      if (!Object.prototype.hasOwnProperty.call(object, k)) continue
      
      const v = object[k]
      if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
        delete object[k]
      } else if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ObjectId)) {
        clearEmpties(v)
        if (!Object.keys(v).length) {
          delete object[k]
        }
      }
    }
  }
  return object
}
