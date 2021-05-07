/* eslint-disable no-unused-vars */
let Utilities = (() => {
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

    function everyFunc (step) {
      return !(step && (obj = obj[step]) === undefined);
    }

    let result = fullPath.every(everyFunc) ? obj : def;

    return { label: assignedName || _path, value: result };
  };

 
  return Object.freeze({
    get,
    getFromPath
  });
})();

export default Utilities;
