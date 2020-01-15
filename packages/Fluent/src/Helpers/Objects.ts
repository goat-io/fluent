declare global {
  function hasOwnProperty(key: string | number | symbol): boolean
}

export const Objects = () => {
  /**
   * Given an Object and its path, if exisits it will
   * return the value of it, if not the default
   * @param {Object} obj
   * @param {String} path
   * @param {*} def
   */
  const get = (fn: () => void, def: any) => {
    try {
      return fn()
    } catch (e) {
      return def
    }
  }

  /**
   *
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
  /**
   * Deep clones a JS object using JSON.parse
   * This function will not clone object
   * functions
   * @param {Object} object
   */
  const clone = (object: any) => {
    return JSON.parse(JSON.stringify(object))
  }
  /**
   *
   * @param {*} value
   */
  const isEmpty = value => {
    if (!value) {
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
    return true
  }

  /**
   * Recursively removes all NULL values
   * from an Object or an Array
   *
   * @static
   * @param {Array|Object} object Array, Object to clean
   * @returns {Array|Object} returns the cleaned value
   */
  const deleteNulls = object => {
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
    get,
    getFromPath,
    isEmpty
  })
}
