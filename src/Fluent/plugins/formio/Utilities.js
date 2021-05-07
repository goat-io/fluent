/* eslint-disable no-unused-vars */
let Utilities = (() => {
  /**
   * Deep clones a JS object using JSON.parse
   * This function will not clone object
   * functions
   * @param {Object} object
   */
  const cloneDeep = object => {
    return JSON.parse(JSON.stringify(object));
  };
  /**
   * Given an Object and its path, if exisits it will
   * return the value of it, if not the default
   * @param {Object} obj
   * @param {String} path
   * @param {*} def
   */
  const get = (fn, def) => {
    try {
      return fn();
    } catch (e) {
      return def;
    }
  };
  /**
   *
   * @param {*} obj
   * @param {*} path
   * @param {*} def
   */
  const getFromPath = (obj, path, def) => {
    let _path = path;

    if (path.includes(' as ')) {
      path = path.split(' as ');
      _path = path[0];
    }

    let assignedName = get(() => {
      return Array.isArray(path) && path[1].trim();
    }, undefined);

    let fullPath = _path
      .replace(/\[/g, '.')
      .replace(/]/g, '')
      .split('.')
      .filter(Boolean)
      .map(e => e.trim());

    function everyFunc(step) {
      return !(step && (obj = obj[step]) === undefined);
    }

    let result = fullPath.every(everyFunc) ? obj : def;

    return { label: assignedName || _path, value: result };
  };
  /**
   *
   * @param {*} arr
   * @param {*} predicate
   */
  const uniqBy = (arr, predicate) => {
    const cb = typeof predicate === 'function' ? predicate : o => o[predicate];

    return [
      ...arr
        .reduce((map, item) => {
          const key = cb(item);

          map.has(key) || map.set(key, item);

          return map;
        }, new Map())
        .values()
    ];
  };
  /**
   *
   */
  const orderBy = () => { };
  /**
   *
   * @param {*} value
   */
  const isEmpty = value => {
    if (!value) {
      return true;
    }
    if (Array.isArray(value) || typeof value === 'string') {
      return !value.length;
    }
    for (let key in value) {
      if (hasOwnProperty.call(value, key)) {
        return false;
      }
    }
    return true;
  };
  /**
   *
   * @param {*} fn
   * @param {*} time
   */
  const debounce = (fn, time) => {
    let timeout;

    return function () {
      const functionCall = () => fn.apply(this, arguments);

      clearTimeout(timeout);
      timeout = setTimeout(functionCall, time);
    };
  };
  /**
   * Recursively removes all NULL values
   * from an Object or an Array
   *
   * @static
   * @param {Array|Object} object Array, Object to clean
   * @returns {Array|Object} returns the cleaned value
   */
  const deleteNulls = object => {
    let obj = object;
    var isArray = obj instanceof Array;

    for (let k in obj) {
      if (obj[k] === null) isArray ? obj.splice(k, 1) : delete obj[k];
      else if (typeof obj[k] === 'object') deleteNulls(obj[k]);
    }
    return obj;
  };

  const eachComponent = (components, fn, includeAll, path, parent) => {
    if (!components) return;
    path = path || '';
    components.forEach(component => {
      if (!component) {
        return;
      }
      const hasColumns = component.columns && Array.isArray(component.columns);
      const hasRows = component.rows && Array.isArray(component.rows);
      const hasComps =
        component.components && Array.isArray(component.components);
      let noRecurse = false;
      const newPath = component.key ?
        path ?
          `${path}.${component.key}` :
          component.key :
        '';

      // Keep track of parent references.
      if (parent) {
        // Ensure we don't create infinite JSON structures.
        component.parent = { ...parent };
        delete component.parent.components;
        delete component.parent.componentMap;
        delete component.parent.columns;
        delete component.parent.rows;
      }

      if (
        includeAll ||
        component.tree ||
        (!hasColumns && !hasRows && !hasComps)
      ) {
        noRecurse = fn(component, newPath);
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
          return newPath;
        } else if (component.key && component.type === 'form') {
          return `${newPath}.data`;
        }
        return path;
      };

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
          );
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
              );
            }
          });
        } else if (hasComps) {
          eachComponent(
            component.components,
            fn,
            includeAll,
            subPath(),
            parent ? component : null
          );
        }
      }
    });
  };

  const matchComponent = (component, query) => {
    if (typeof query === 'string') {
      return component.key === query;
    }
    let matches = false;

    Object.keys(query).forEach(path => {
      matches = getFromPath(component, path).value === query[path];
      if (!matches) {
        return false;
      }
    });
    return matches;
  };

  const findComponents = (components, query) => {
    const results = [];

    eachComponent(
      components,
      (component, path) => {
        if (matchComponent(component, query)) {
          component.path = path;
          results.push(component);
        }
      },
      true
    );
    return results;
  };

  const unixDate = () => {
    return Math.round(+new Date() / 1000);
  };

  return Object.freeze({
    cloneDeep,
    get,
    orderBy,
    isEmpty,
    debounce,
    getFromPath,
    deleteNulls,
    eachComponent,
    findComponents,
    unixDate
  });
})();

export default Utilities;
