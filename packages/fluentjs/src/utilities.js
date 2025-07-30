/* eslint-disable no-unused-vars */
const Utilities = (() => {
  /**
   * Deep clones a JS object using JSON.parse
   * This function will not clone object
   * functions
   * @param {Object} object
   */
  const cloneDeep = object => {
    return JSON.parse(JSON.stringify(object))
  }
  /**
   * Gets default language stored in local database
   * @returns {string} language code (ie. en)
   */
  const getLanguage = () => {
    return (
      localStorage.getItem('defaultLanguage') || process.env.DEFAULT_LANGUAGE
    )
  }
  /**
   * Stores language as default in local database
   * @param {String} code
   */
  const setLanguage = code => {
    localStorage.setItem('defaultLanguage', code)
  }
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
  /**
   *
   * @param {*} arr
   * @param {*} predicate
   */
  const _uniqBy = (arr, predicate) => {
    const cb = typeof predicate === 'function' ? predicate : o => o[predicate]

    return [
      ...arr
        .reduce((map, item) => {
          const key = cb(item)

          map.has(key) || map.set(key, item)

          return map
        }, new Map())
        .values()
    ]
  }
  /**
   *
   */
  const orderBy = () => {
    // TODO: Implement orderBy functionality
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
   *
   * @param {*} fn
   * @param {*} time
   */
  const debounce = (fn, time) => {
    let timeout

    return function (...args) {
      const functionCall = () => fn.apply(this, args)

      clearTimeout(timeout)
      timeout = setTimeout(functionCall, time)
    }
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
    const isArray = Array.isArray(obj)

    for (const k in obj) {
      if (obj[k] === null) {
        isArray ? obj.splice(k, 1) : delete obj[k]
      } else if (typeof obj[k] === 'object') {
        deleteNulls(obj[k])
      }
    }
    return obj
  }

  const eachComponent = (components, fn, includeAll, path, parent) => {
    if (!components) {
      return
    }
    const currentPath = path || ''
    components.forEach(component => {
      if (!component) {
        return
      }
      const hasColumns = component.columns && Array.isArray(component.columns)
      const hasRows = component.rows && Array.isArray(component.rows)
      const hasComps =
        component.components && Array.isArray(component.components)
      let noRecurse = false
      const newPath = component.key
        ? currentPath
          ? `${currentPath}.${component.key}`
          : component.key
        : ''

      // Keep track of parent references.
      if (parent) {
        // Ensure we don't create infinite JSON structures.
        component.parent = { ...parent }
        component.parent.components = undefined
        component.parent.componentMap = undefined
        component.parent.columns = undefined
        component.parent.rows = undefined
      }

      if (
        includeAll ||
        component.tree ||
        (!hasColumns && !hasRows && !hasComps)
      ) {
        noRecurse = fn(component, newPath)
      }

      const subPath = () => {
        if (
          component.key &&
          ![
            'panel',
            'table',
            'well',
            'columns',
            'fieldset',
            'tabs',
            'form'
          ].includes(component.type) &&
          (['datagrid', 'container', 'editgrid'].includes(component.type) ||
            component.tree)
        ) {
          return newPath
        }
        if (component.key && component.type === 'form') {
          return `${newPath}.data`
        }
        return currentPath
      }

      if (!noRecurse) {
        if (hasColumns) {
          component.columns.forEach(column =>
            eachComponent(
              column.components,
              fn,
              includeAll,
              subPath(),
              parent ? component : null
            )
          )
        } else if (hasRows) {
          component.rows.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(column =>
                eachComponent(
                  column.components,
                  fn,
                  includeAll,
                  subPath(),
                  parent ? component : null
                )
              )
            }
          })
        } else if (hasComps) {
          eachComponent(
            component.components,
            fn,
            includeAll,
            subPath(),
            parent ? component : null
          )
        }
      }
    })
  }

  const matchComponent = (component, query) => {
    if (typeof query === 'string') {
      return component.key === query
    }
    let matches = false

    Object.keys(query).forEach(path => {
      matches = getFromPath(component, path).value === query[path]
      if (!matches) {
        return false
      }
    })
    return matches
  }

  const findComponents = (components, query) => {
    const results = []

    eachComponent(
      components,
      (component, path) => {
        if (matchComponent(component, query)) {
          component.path = path
          results.push(component)
        }
      },
      true
    )
    return results
  }

  const unixDate = () => {
    return Math.round(Date.now() / 1000)
  }

  return Object.freeze({
    cloneDeep,
    getLanguage,
    setLanguage,
    get,
    orderBy,
    isEmpty,
    debounce,
    getFromPath,
    deleteNulls,
    eachComponent,
    findComponents,
    unixDate
  })
})()

export default Utilities
