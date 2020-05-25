declare global {
  function hasOwnProperty(key: string | number | symbol): boolean
}

export const Objects = (() => {
  /**
   * Given an Object and its path, it will return the
   * given path if it exists or the default
   * @param fn Function returning the nested Object
   * @param defaultValue
   */
  const get = (fn: () => any, defaultValue?: any): any => {
    let value: any
    try {
      value = fn()
    } catch (e) {
      value = defaultValue
    }
    if (typeof value === 'undefined') {
      value = defaultValue
    }
    return value
  }
  /**
   * Given an object and the string version of the path it
   * will return the value if it exists or the default.
   * Simplified version of lodash get
   * @param {*} obj
   * @param {*} path
   * @param {*} def
   */
  const getFromPath = (obj: any, path: string, def?: any) => {
    let PATH = path
    let pathArray = []

    if (path.includes(' as ')) {
      pathArray = path.split(' as ')
      PATH = pathArray[0]
    }

    const assignedName = get(() => {
      return pathArray.length > 0 && pathArray[1].trim()
    }, undefined)

    const fullPath = PATH.replace(/\[/g, '.')
      .replace(/]/g, '')
      .split('.')
      .filter(Boolean)
      .map(e => e.trim())

    function everyFunc(step: any) {
      return !(step && (obj = obj[step]) === undefined)
    }

    const result = fullPath.every(everyFunc) ? obj : def

    return { label: assignedName || PATH, value: result }
  }

  type KeyFactory = (previousKey: string, currentKey: string) => string
  /**
   * Given a nested Object it generates a flattened version using
   * dot notation. Custom notation can be assigned using the
   * keyFactory helper function
   * @param ob
   * @param keyFactory
   */
  const flatten = (
    ob: { [key: string]: any },
    keyFactory: KeyFactory | null = null
  ): { [key: string]: any } => {
    if (keyFactory === null) {
      keyFactory = (previousKey, currentKey) => previousKey + '.' + currentKey
    }
    const toReturn: { [key: string]: string } = {}
    for (const i in ob) {
      if (!ob.hasOwnProperty(i)) {
        continue
      }
      if (typeof ob[i] === 'object') {
        const flatObject = flatten(ob[i])
        for (const x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) {
            continue
          }
          toReturn[keyFactory(i, x)] = flatObject[x]
        }
      } else {
        toReturn[i] = ob[i]
      }
    }
    return toReturn
  }
  /**
   *
   * @param obj
   */
  const isPlainObject = (obj: { [key: string]: any }) =>
    !!obj && obj.constructor === {}.constructor
  /**
   *
   * @param obj
   */
  const getNestedObject = (
    obj: { [key: string]: any },
    markNewObject: boolean
  ) =>
    Object.entries(obj).reduce((result, [prop, val]) => {
      prop.split('.').reduce((nestedResult, prop, propIndex, propArray) => {
        const lastProp = propIndex === propArray.length - 1
        if (lastProp) {
          nestedResult[prop] = isPlainObject(val)
            ? getNestedObject(val, markNewObject)
            : val
        } else {
          nestedResult[prop] =
            nestedResult[prop] ||
            (markNewObject
              ? {
                  isObject: true
                }
              : {})
        }
        return nestedResult[prop]
      }, result)
      return result
    }, {})
  /**
   * Opposite of the flatten method. Given a nested dot notation flatten object.
   * it will generate the corresponding nested object
   * @param obj
   */
  const nest = (
    obj: { [key: string]: any },
    markNewObject?: boolean
  ): { [key: string]: any } => {
    if (!obj) {
      return {}
    }
    return getNestedObject(obj, markNewObject || false)
  }
  /**
   * Deep clones a JS object using JSON.parse. This method
   * will not clone functions inside objects
   * @param {Object} object
   */
  const clone = (object: { [key: string]: any }) => {
    return JSON.parse(JSON.stringify(object))
  }
  /**
   * Given a value, it will check if it contains
   * none null, none undefined values inside
   * @param {string, Array, Object} value
   */
  const isEmpty = (value: any) => {
    if (typeof value === 'undefined') {
      return true
    }

    if (value === null) {
      return true
    }

    if (Array.isArray(value) || typeof value === 'string') {
      return !value.length
    }

    for (const key in value) {
      if (hasOwnProperty.call(value, key)) {
        return false
      }
    }
    return false
  }

  /**
   * Recursively removes all NULL values
   * from an Object or an Array
   *
   * @static
   * @param {Array|Object} object Array, Object to clean
   * @returns {Array|Object} returns the cleaned value
   */
  const deleteNulls = (object: { [key: string]: any }) => {
    const obj = object
    const isArray = obj instanceof Array

    for (const k in obj) {
      if (obj[k] === null) {
        isArray ? obj.splice(k, 1) : delete obj[k]
      } else if (typeof obj[k] === 'object') {
        deleteNulls(obj[k])
      }
    }
    return obj
  }

  return Object.freeze({
    clone,
    deleteNulls,
    flatten,
    get,
    getFromPath,
    isEmpty,
    nest
  })
})()
