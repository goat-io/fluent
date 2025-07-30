/* eslint-disable no-unused-vars */
const Utilities = (() => {
  /**
   * Given an Object and its path, if exisits it will
   * return the value of it, if not the default
   * @param {Object} obj
   * @param {String} path
   * @param {*} def
   */
  const get = (fn, def) => {
    try {
      return fn()
    } catch (_e) {
      return def
    }
  }
  /**
   *
   * @param {*} obj
   * @param {*} path
   * @param {*} def
   */
  const getFromPath = (obj, path, def) => {
    let Path = path
    let pathParts = path

    if (path.includes(' as ')) {
      pathParts = path.split(' as ')
      Path = pathParts[0]
    }

    const assignedName = get(() => {
      return Array.isArray(pathParts) && pathParts[1].trim()
    }, undefined)

    const fullPath = Path.replace(/\[/g, '.')
      .replace(/]/g, '')
      .split('.')
      .filter(Boolean)
      .map(e => e.trim())

    let currentObj = obj
    function everyFunc(step) {
      if (!step) {
        return true
      }
      currentObj = currentObj[step]
      return currentObj !== undefined
    }

    const result = fullPath.every(everyFunc) ? currentObj : def

    return { label: assignedName || Path, value: result }
  }

  return Object.freeze({
    get,
    getFromPath
  })
})()

export default Utilities
