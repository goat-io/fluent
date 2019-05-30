(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("@goatlab/goatjs", [], factory);
	else if(typeof exports === 'object')
		exports["@goatlab/goatjs"] = factory();
	else
		root["@goatlab/goatjs"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 40);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* eslint-disable no-unused-vars */
var Utilities = function () {
  /**
   * Deep clones a JS object using JSON.parse
   * This function will not clone object
   * functions
   * @param {Object} object
   */
  var cloneDeep = function cloneDeep(object) {
    return JSON.parse(JSON.stringify(object));
  };
  /**
   * Gets default language stored in local database
   * @returns {string} language code (ie. en)
   */
  var getLanguage = function getLanguage() {
    return localStorage.getItem('defaultLanguage') || process.env.DEFAULT_LANGUAGE;
  };
  /**
   * Stores language as default in local database
   * @param {String} code 
   */
  var setLanguage = function setLanguage(code) {
    localStorage.setItem('defaultLanguage', code);
  };
  /**
   * Given an Object and its path, if exisits it will
   * return the value of it, if not the default
   * @param {Object} obj
   * @param {String} path
   * @param {*} def
   */
  var get = function get(fn, def) {
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
  var getFromPath = function getFromPath(obj, path, def) {
    var _path = path;

    if (path.includes(' as ')) {
      path = path.split(' as ');
      _path = path[0];
    }

    var assignedName = get(function () {
      return Array.isArray(path) && path[1].trim();
    }, undefined);

    var fullPath = _path.replace(/\[/g, '.').replace(/]/g, '').split('.').filter(Boolean).map(function (e) {
      return e.trim();
    });

    function everyFunc(step) {
      return !(step && (obj = obj[step]) === undefined);
    }

    var result = fullPath.every(everyFunc) ? obj : def;

    return { label: assignedName || _path, value: result };
  };
  /**
   *
   * @param {*} arr
   * @param {*} predicate
   */
  var uniqBy = function uniqBy(arr, predicate) {
    var cb = typeof predicate === 'function' ? predicate : function (o) {
      return o[predicate];
    };

    return [].concat(_toConsumableArray(arr.reduce(function (map, item) {
      var key = cb(item);

      map.has(key) || map.set(key, item);

      return map;
    }, new Map()).values()));
  };
  /**
   *
   */
  var orderBy = function orderBy() {};
  /**
   *
   * @param {*} value
   */
  var isEmpty = function isEmpty(value) {
    if (!value) {
      return true;
    }
    if (Array.isArray(value) || typeof value === 'string') {
      return !value.length;
    }
    for (var key in value) {
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
  var debounce = function debounce(fn, time) {
    var timeout = void 0;

    return function () {
      var _this = this,
          _arguments = arguments;

      var functionCall = function functionCall() {
        return fn.apply(_this, _arguments);
      };

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
  var deleteNulls = function deleteNulls(object) {
    var obj = object;
    var isArray = obj instanceof Array;

    for (var k in obj) {
      if (obj[k] === null) isArray ? obj.splice(k, 1) : delete obj[k];else if (_typeof(obj[k]) === 'object') deleteNulls(obj[k]);
    }
    return obj;
  };

  var eachComponent = function eachComponent(components, fn, includeAll, path, parent) {
    if (!components) return;
    path = path || '';
    components.forEach(function (component) {
      if (!component) {
        return;
      }
      var hasColumns = component.columns && Array.isArray(component.columns);
      var hasRows = component.rows && Array.isArray(component.rows);
      var hasComps = component.components && Array.isArray(component.components);
      var noRecurse = false;
      var newPath = component.key ? path ? path + '.' + component.key : component.key : '';

      // Keep track of parent references.
      if (parent) {
        // Ensure we don't create infinite JSON structures.
        component.parent = _extends({}, parent);
        delete component.parent.components;
        delete component.parent.componentMap;
        delete component.parent.columns;
        delete component.parent.rows;
      }

      if (includeAll || component.tree || !hasColumns && !hasRows && !hasComps) {
        noRecurse = fn(component, newPath);
      }

      var subPath = function subPath() {
        if (component.key && !['panel', 'table', 'well', 'columns', 'fieldset', 'tabs', 'form'].includes(component.type) && (['datagrid', 'container', 'editgrid'].includes(component.type) || component.tree)) {
          return newPath;
        } else if (component.key && component.type === 'form') {
          return newPath + '.data';
        }
        return path;
      };

      if (!noRecurse) {
        if (hasColumns) {
          component.columns.forEach(function (column) {
            return eachComponent(column.components, fn, includeAll, subPath(), parent ? component : null);
          });
        } else if (hasRows) {
          component.rows.forEach(function (row) {
            if (Array.isArray(row)) {
              row.forEach(function (column) {
                return eachComponent(column.components, fn, includeAll, subPath(), parent ? component : null);
              });
            }
          });
        } else if (hasComps) {
          eachComponent(component.components, fn, includeAll, subPath(), parent ? component : null);
        }
      }
    });
  };

  var matchComponent = function matchComponent(component, query) {
    if (typeof query === 'string') {
      return component.key === query;
    }
    var matches = false;

    Object.keys(query).forEach(function (path) {
      matches = getFromPath(component, path).value === query[path];
      if (!matches) {
        return false;
      }
    });
    return matches;
  };

  var findComponents = function findComponents(components, query) {
    var results = [];

    eachComponent(components, function (component, path) {
      if (matchComponent(component, query)) {
        component.path = path;
        results.push(component);
      }
    }, true);
    return results;
  };

  var unixDate = function unixDate() {
    return Math.round(+new Date() / 1000);
  };

  return Object.freeze({
    cloneDeep: cloneDeep,
    getLanguage: getLanguage,
    setLanguage: setLanguage,
    get: get,
    orderBy: orderBy,
    isEmpty: isEmpty,
    debounce: debounce,
    getFromPath: getFromPath,
    deleteNulls: deleteNulls,
    eachComponent: eachComponent,
    findComponents: findComponents,
    unixDate: unixDate
  });
}();

exports.default = Utilities;
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(21)))

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var bind = __webpack_require__(23);
var isBuffer = __webpack_require__(24);

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim
};


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _goatFluent = __webpack_require__(3);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// TODO We still have to figure out how to solve the problem of
// The CONFIG URL and FLUENT_URL changing on APP sync
// Every page refresh will make the urls go back to their default
exports.default = _goatFluent.Fluent.model({
  properties: {
    name: "Configuration",
    config: {
      remote: {
        connector: 'formioConfig',
        token: ''
      }
    }
  },
  methods: {
    /**
     * Decides whether to set Configurations
     * Online or Offline
     * @param {Object} config.appConfig The application Config
     * @param {Boolean} config.forceOnline If we need online
     */
    set: function set(_ref) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var appConf = _ref.appConf,
            forceOnline = _ref.forceOnline;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (forceOnline) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt("return", _this.setOffline({ appConf: appConf }));

              case 2:
                return _context.abrupt("return", _this.setOnline({ appConf: appConf }));

              case 3:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },

    /**
     *
     * @param {*} param0
     */
    setOffline: function setOffline(_ref2) {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var appConf = _ref2.appConf;
        var localConfig, localConfigDate, offlineConfigDate;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _this2.local().first();

              case 2:
                localConfig = _context2.sent;
                localConfigDate = _this2.getConfigDate(localConfig);
                offlineConfigDate = appConf.offlineFiles.lastUpdated.date;

                // If local config is newer than offline

                if (!(localConfigDate > offlineConfigDate)) {
                  _context2.next = 7;
                  break;
                }

                return _context2.abrupt("return", localConfig);

              case 7:
                if (!localConfig) {
                  _context2.next = 10;
                  break;
                }

                _context2.next = 10;
                return _this2.local().clear({ sure: true });

              case 10:
                return _context2.abrupt("return", _this2.local().insert(_extends({}, appConf.offlineFiles.Configuration.data, {
                  fastUpdated: (0, _dayjs2.default)().unix()
                })));

              case 11:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },

    /**
     *
     * @param {*} param0
     */
    setOnline: function setOnline(_ref3) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var appConf = _ref3.appConf;
        var localConfig, remoteConfig;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _this3.local().first();

              case 2:
                localConfig = _context3.sent;
                _context3.next = 5;
                return _this3.remote().first();

              case 5:
                remoteConfig = _context3.sent;

                if (!(!localConfig && !remoteConfig)) {
                  _context3.next = 8;
                  break;
                }

                throw new Error("Application is not connected to internet, or the configuration file cannot be pulled");

              case 8:
                if (remoteConfig) {
                  _context3.next = 10;
                  break;
                }

                return _context3.abrupt("return", localConfig);

              case 10:
                if (!localConfig) {
                  _context3.next = 13;
                  break;
                }

                _context3.next = 13;
                return _this3.local().clear({ sure: true });

              case 13:
                return _context3.abrupt("return", _this3.local().insert(_extends({}, remoteConfig.data, {
                  fastUpdated: (0, _dayjs2.default)().unix()
                })));

              case 14:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },

    /**
     *
     * @param {*} config
     */
    getConfigDate: function getConfigDate(config) {
      return _utilities2.default.get(function () {
        return config.fastUpdated;
      }, 0);
    }
  }
}).compose(_goatFluent.Fluent.privatize).privatizeMethods("setOnlineConfig", "setOfflineConfig", "getConfigDate", "assingGlobalVariable", "getRemote")();

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(module) {var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;

var _typeof2 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function webpackUniversalModuleDefinition(root, factory) {
  if (( false ? undefined : _typeof2(exports)) === 'object' && ( false ? undefined : _typeof2(module)) === 'object') module.exports = factory();else if (true) !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));else {}
})(undefined, function () {
  return (/******/function (modules) {
      // webpackBootstrap
      /******/ // The module cache
      /******/var installedModules = {};
      /******/
      /******/ // The require function
      /******/function __webpack_require__(moduleId) {
        /******/
        /******/ // Check if module is in cache
        /******/if (installedModules[moduleId]) {
          /******/return installedModules[moduleId].exports;
          /******/
        }
        /******/ // Create a new module (and put it into the cache)
        /******/var module = installedModules[moduleId] = {
          /******/i: moduleId,
          /******/l: false,
          /******/exports: {}
          /******/ };
        /******/
        /******/ // Execute the module function
        /******/modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        /******/
        /******/ // Flag the module as loaded
        /******/module.l = true;
        /******/
        /******/ // Return the exports of the module
        /******/return module.exports;
        /******/
      }
      /******/
      /******/
      /******/ // expose the modules object (__webpack_modules__)
      /******/__webpack_require__.m = modules;
      /******/
      /******/ // expose the module cache
      /******/__webpack_require__.c = installedModules;
      /******/
      /******/ // define getter function for harmony exports
      /******/__webpack_require__.d = function (exports, name, getter) {
        /******/if (!__webpack_require__.o(exports, name)) {
          /******/Object.defineProperty(exports, name, { enumerable: true, get: getter });
          /******/
        }
        /******/
      };
      /******/
      /******/ // define __esModule on exports
      /******/__webpack_require__.r = function (exports) {
        /******/if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
          /******/Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
          /******/
        }
        /******/Object.defineProperty(exports, '__esModule', { value: true });
        /******/
      };
      /******/
      /******/ // create a fake namespace object
      /******/ // mode & 1: value is a module id, require it
      /******/ // mode & 2: merge all properties of value into the ns
      /******/ // mode & 4: return value when already ns object
      /******/ // mode & 8|1: behave like require
      /******/__webpack_require__.t = function (value, mode) {
        /******/if (mode & 1) value = __webpack_require__(value);
        /******/if (mode & 8) return value;
        /******/if (mode & 4 && (typeof value === 'undefined' ? 'undefined' : _typeof2(value)) === 'object' && value && value.__esModule) return value;
        /******/var ns = Object.create(null);
        /******/__webpack_require__.r(ns);
        /******/Object.defineProperty(ns, 'default', { enumerable: true, value: value });
        /******/if (mode & 2 && typeof value != 'string') for (var key in value) {
          __webpack_require__.d(ns, key, function (key) {
            return value[key];
          }.bind(null, key));
        } /******/return ns;
        /******/
      };
      /******/
      /******/ // getDefaultExport function for compatibility with non-harmony modules
      /******/__webpack_require__.n = function (module) {
        /******/var getter = module && module.__esModule ?
        /******/function getDefault() {
          return module['default'];
        } :
        /******/function getModuleExports() {
          return module;
        };
        /******/__webpack_require__.d(getter, 'a', getter);
        /******/return getter;
        /******/
      };
      /******/
      /******/ // Object.prototype.hasOwnProperty.call
      /******/__webpack_require__.o = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
      };
      /******/
      /******/ // __webpack_public_path__
      /******/__webpack_require__.p = "";
      /******/
      /******/
      /******/ // Load entry module and return exports
      /******/return __webpack_require__(__webpack_require__.s = 13);
      /******/
    }(
    /************************************************************************/
    /******/[
    /* 0 */
    /***/function (module, exports, __webpack_require__) {

      var compose = __webpack_require__(2);
      var Shortcut = __webpack_require__(17);
      var isStamp = __webpack_require__(6);
      var isString = __webpack_require__(18);
      var isObject = __webpack_require__(1);
      var isFunction = __webpack_require__(3);
      var merge = __webpack_require__(8);
      var assign = __webpack_require__(7);

      var concat = Array.prototype.concat;
      function extractFunctions() {
        var fns = concat.apply([], arguments).filter(isFunction);
        return fns.length === 0 ? undefined : fns;
      }

      function standardiseDescriptor(descr) {
        if (!isObject(descr)) return descr;

        var methods = descr.methods;
        var properties = descr.properties;
        var props = descr.props;
        var initializers = descr.initializers;
        var init = descr.init;
        var composers = descr.composers;
        var deepProperties = descr.deepProperties;
        var deepProps = descr.deepProps;
        var pd = descr.propertyDescriptors;
        var staticProperties = descr.staticProperties;
        var statics = descr.statics;
        var staticDeepProperties = descr.staticDeepProperties;
        var deepStatics = descr.deepStatics;
        var configuration = descr.configuration;
        var conf = descr.conf;
        var deepConfiguration = descr.deepConfiguration;
        var deepConf = descr.deepConf;

        var p = isObject(props) || isObject(properties) ? assign({}, props, properties) : undefined;

        var dp = isObject(deepProps) ? merge({}, deepProps) : undefined;
        dp = isObject(deepProperties) ? merge(dp, deepProperties) : dp;

        var sp = isObject(statics) || isObject(staticProperties) ? assign({}, statics, staticProperties) : undefined;

        var sdp = isObject(deepStatics) ? merge({}, deepStatics) : undefined;
        sdp = isObject(staticDeepProperties) ? merge(sdp, staticDeepProperties) : sdp;

        var spd = descr.staticPropertyDescriptors;
        if (isString(descr.name)) spd = assign({}, spd || {}, { name: { value: descr.name } });

        var c = isObject(conf) || isObject(configuration) ? assign({}, conf, configuration) : undefined;

        var dc = isObject(deepConf) ? merge({}, deepConf) : undefined;
        dc = isObject(deepConfiguration) ? merge(dc, deepConfiguration) : dc;

        var ii = extractFunctions(init, initializers);

        var cc = extractFunctions(composers);

        var descriptor = {};
        if (methods) descriptor.methods = methods;
        if (p) descriptor.properties = p;
        if (ii) descriptor.initializers = ii;
        if (cc) descriptor.composers = cc;
        if (dp) descriptor.deepProperties = dp;
        if (sp) descriptor.staticProperties = sp;
        if (sdp) descriptor.staticDeepProperties = sdp;
        if (pd) descriptor.propertyDescriptors = pd;
        if (spd) descriptor.staticPropertyDescriptors = spd;
        if (c) descriptor.configuration = c;
        if (dc) descriptor.deepConfiguration = dc;

        return descriptor;
      }

      function stampit() {
        'use strict'; // to make sure `this` is not pointing to `global` or `window`

        var length = arguments.length,
            args = [];
        for (var i = 0; i < length; i += 1) {
          var arg = arguments[i];
          args.push(isStamp(arg) ? arg : standardiseDescriptor(arg));
        }

        return compose.apply(this || baseStampit, args); // jshint ignore:line
      }

      var baseStampit = Shortcut.compose({
        staticProperties: {
          create: function create() {
            return this.apply(this, arguments);
          },
          compose: stampit // infecting
        }
      });

      var shortcuts = Shortcut.compose.staticProperties;
      for (var prop in shortcuts) {
        stampit[prop] = shortcuts[prop].bind(baseStampit);
      }stampit.compose = stampit.bind();

      module.exports = stampit;

      /***/
    },
    /* 1 */
    /***/function (module, exports) {

      module.exports = function isObject(arg) {
        var type = typeof arg === 'undefined' ? 'undefined' : _typeof2(arg);
        return Boolean(arg) && (type === 'object' || type === 'function');
      };

      /***/
    },
    /* 2 */
    /***/function (module, exports, __webpack_require__) {

      var isArray = __webpack_require__(5);
      var isFunction = __webpack_require__(3);
      var isObject = __webpack_require__(1);
      var isStamp = __webpack_require__(6);
      var isComposable = __webpack_require__(15);

      var assign = __webpack_require__(7);
      var merge = __webpack_require__(8);

      var slice = Array.prototype.slice;

      /**
       * Creates new factory instance.
       * @returns {Function} The new factory function.
       */
      function createFactory() {
        return function Stamp(options) {
          var descriptor = Stamp.compose || {};
          // Next line was optimized for most JS VMs. Please, be careful here!
          var obj = { __proto__: descriptor.methods }; // jshint ignore:line

          merge(obj, descriptor.deepProperties);
          assign(obj, descriptor.properties);
          Object.defineProperties(obj, descriptor.propertyDescriptors || {});

          if (!descriptor.initializers || descriptor.initializers.length === 0) return obj;

          if (options === undefined) options = {};
          var inits = descriptor.initializers;
          var length = inits.length;
          for (var i = 0; i < length; i += 1) {
            var initializer = inits[i];
            if (isFunction(initializer)) {
              var returnedValue = initializer.call(obj, options, { instance: obj, stamp: Stamp, args: slice.apply(arguments) });
              obj = returnedValue === undefined ? obj : returnedValue;
            }
          }

          return obj;
        };
      }

      /**
       * Returns a new stamp given a descriptor and a compose function implementation.
       * @param {Descriptor} [descriptor={}] The information about the object the stamp will be creating.
       * @param {Compose} composeFunction The "compose" function implementation.
       * @returns {Stamp}
       */
      function createStamp(descriptor, composeFunction) {
        var Stamp = createFactory();

        if (descriptor.staticDeepProperties) {
          merge(Stamp, descriptor.staticDeepProperties);
        }
        if (descriptor.staticProperties) {
          assign(Stamp, descriptor.staticProperties);
        }
        if (descriptor.staticPropertyDescriptors) {
          Object.defineProperties(Stamp, descriptor.staticPropertyDescriptors);
        }

        var composeImplementation = isFunction(Stamp.compose) ? Stamp.compose : composeFunction;
        Stamp.compose = function _compose() {
          'use strict'; // to make sure `this` is not pointing to `global` or `window`

          return composeImplementation.apply(this, arguments);
        };
        assign(Stamp.compose, descriptor);

        return Stamp;
      }

      function concatAssignFunctions(dstObject, srcArray, propName) {
        if (!isArray(srcArray)) return;

        var length = srcArray.length;
        var dstArray = dstObject[propName] || [];
        dstObject[propName] = dstArray;
        for (var i = 0; i < length; i += 1) {
          var fn = srcArray[i];
          if (isFunction(fn) && dstArray.indexOf(fn) < 0) {
            dstArray.push(fn);
          }
        }
      }

      function combineProperties(dstObject, srcObject, propName, action) {
        if (!isObject(srcObject[propName])) return;
        if (!isObject(dstObject[propName])) dstObject[propName] = {};
        action(dstObject[propName], srcObject[propName]);
      }

      function deepMergeAssign(dstObject, srcObject, propName) {
        combineProperties(dstObject, srcObject, propName, merge);
      }
      function mergeAssign(dstObject, srcObject, propName) {
        combineProperties(dstObject, srcObject, propName, assign);
      }

      /**
       * Mutates the dstDescriptor by merging the srcComposable data into it.
       * @param {Descriptor} dstDescriptor The descriptor object to merge into.
       * @param {Composable} [srcComposable] The composable
       * (either descriptor or stamp) to merge data form.
       */
      function mergeComposable(dstDescriptor, srcComposable) {
        var srcDescriptor = srcComposable && srcComposable.compose || srcComposable;

        mergeAssign(dstDescriptor, srcDescriptor, 'methods');
        mergeAssign(dstDescriptor, srcDescriptor, 'properties');
        deepMergeAssign(dstDescriptor, srcDescriptor, 'deepProperties');
        mergeAssign(dstDescriptor, srcDescriptor, 'propertyDescriptors');
        mergeAssign(dstDescriptor, srcDescriptor, 'staticProperties');
        deepMergeAssign(dstDescriptor, srcDescriptor, 'staticDeepProperties');
        mergeAssign(dstDescriptor, srcDescriptor, 'staticPropertyDescriptors');
        mergeAssign(dstDescriptor, srcDescriptor, 'configuration');
        deepMergeAssign(dstDescriptor, srcDescriptor, 'deepConfiguration');
        concatAssignFunctions(dstDescriptor, srcDescriptor.initializers, 'initializers');
        concatAssignFunctions(dstDescriptor, srcDescriptor.composers, 'composers');
      }

      /**
       * Given the list of composables (stamp descriptors and stamps) returns
       * a new stamp (composable factory function).
       * @typedef {Function} Compose
       * @param {...(Composable)} [arguments] The list of composables.
       * @returns {Stamp} A new stamp (aka composable factory function)
       */
      module.exports = function compose() {
        'use strict'; // to make sure `this` is not pointing to `global` or `window`

        var descriptor = {};
        var composables = [];
        if (isComposable(this)) {
          mergeComposable(descriptor, this);
          composables.push(this);
        }

        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (isComposable(arg)) {
            mergeComposable(descriptor, arg);
            composables.push(arg);
          }
        }

        var stamp = createStamp(descriptor, compose);

        var composers = descriptor.composers;
        if (isArray(composers) && composers.length > 0) {
          for (var j = 0; j < composers.length; j += 1) {
            var composer = composers[j];
            var returnedValue = composer({ stamp: stamp, composables: composables });
            stamp = isStamp(returnedValue) ? returnedValue : stamp;
          }
        }

        return stamp;
      };

      /**
       * The Stamp Descriptor
       * @typedef {Function|Object} Descriptor
       * @returns {Stamp} A new stamp based on this Stamp
       * @property {Object} [methods] Methods or other data used as object instances' prototype
       * @property {Array<Function>} [initializers] List of initializers called for each object instance
       * @property {Array<Function>} [composers] List of callbacks called each time a composition happens
       * @property {Object} [properties] Shallow assigned properties of object instances
       * @property {Object} [deepProperties] Deeply merged properties of object instances
       * @property {Object} [staticProperties] Shallow assigned properties of Stamps
       * @property {Object} [staticDeepProperties] Deeply merged properties of Stamps
       * @property {Object} [configuration] Shallow assigned properties of Stamp arbitrary metadata
       * @property {Object} [deepConfiguration] Deeply merged properties of Stamp arbitrary metadata
       * @property {Object} [propertyDescriptors] ES5 Property Descriptors applied to object instances
       * @property {Object} [staticPropertyDescriptors] ES5 Property Descriptors applied to Stamps
       */

      /**
       * The Stamp factory function
       * @typedef {Function} Stamp
       * @returns {*} Instantiated object
       * @property {Descriptor} compose - The Stamp descriptor and composition function
       */

      /**
       * A composable object - stamp or descriptor
       * @typedef {Stamp|Descriptor} Composable
       */

      /***/
    },
    /* 3 */
    /***/function (module, exports) {

      module.exports = function isFunction(arg) {
        return typeof arg === 'function';
      };

      /***/
    },
    /* 4 */
    /***/function (module, exports) {

      var g;

      // This works in non-strict mode
      g = function () {
        return this;
      }();

      try {
        // This works if eval is allowed (see CSP)
        g = g || new Function("return this")();
      } catch (e) {
        // This works if the window reference is available
        if ((typeof window === 'undefined' ? 'undefined' : _typeof2(window)) === "object") g = window;
      }

      // g can still be undefined, but nothing to do about it...
      // We return undefined, instead of nothing here, so it's
      // easier to handle this case. if(!global) { ...}

      module.exports = g;

      /***/
    },
    /* 5 */
    /***/function (module, exports) {

      module.exports = Array.isArray;

      /***/
    },
    /* 6 */
    /***/function (module, exports, __webpack_require__) {

      var isFunction = __webpack_require__(3);

      module.exports = function isStamp(arg) {
        return isFunction(arg) && isFunction(arg.compose);
      };

      /***/
    },
    /* 7 */
    /***/function (module, exports) {

      module.exports = Object.assign;

      /***/
    },
    /* 8 */
    /***/function (module, exports, __webpack_require__) {

      var isPlainObject = __webpack_require__(16);
      var isObject = __webpack_require__(1);
      var isArray = __webpack_require__(5);

      /**
       * The 'src' argument plays the command role.
       * The returned values is always of the same type as the 'src'.
       * @param dst The object to merge into
       * @param src The object to merge from
       * @returns {*}
       */
      function mergeOne(dst, src) {
        if (src === undefined) return dst;

        // According to specification arrays must be concatenated.
        // Also, the '.concat' creates a new array instance. Overrides the 'dst'.
        if (isArray(src)) return (isArray(dst) ? dst : []).concat(src);

        // Now deal with non plain 'src' object. 'src' overrides 'dst'
        // Note that functions are also assigned! We do not deep merge functions.
        if (!isPlainObject(src)) return src;

        // See if 'dst' is allowed to be mutated.
        // If not - it's overridden with a new plain object.
        var returnValue = isObject(dst) ? dst : {};

        var keys = Object.keys(src);
        for (var i = 0; i < keys.length; i += 1) {
          var key = keys[i];

          var srcValue = src[key];
          // Do not merge properties with the 'undefined' value.
          if (srcValue !== undefined) {
            var dstValue = returnValue[key];
            // Recursive calls to mergeOne() must allow only plain objects or arrays in dst
            var newDst = isPlainObject(dstValue) || isArray(srcValue) ? dstValue : {};

            // deep merge each property. Recursion!
            returnValue[key] = mergeOne(newDst, srcValue);
          }
        }

        return returnValue;
      }

      module.exports = function (dst) {
        for (var i = 1; i < arguments.length; i++) {
          dst = mergeOne(dst, arguments[i]);
        }
        return dst;
      };

      /***/
    },
    /* 9 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";
      /* WEBPACK VAR INJECTION */
      (function (global) {

        Object.defineProperty(exports, "__esModule", {
          value: true
        });

        var _it = __webpack_require__(0);

        var _it2 = _interopRequireDefault(_it);

        var _privatize = __webpack_require__(19);

        var _privatize2 = _interopRequireDefault(_privatize);

        function _interopRequireDefault(obj) {
          return obj && obj.__esModule ? obj : { default: obj };
        }

        exports.default = (0, _it2.default)({
          properties: {
            name: 'baseModel',
            config: {
              remote: {
                path: undefined,
                token: undefined,
                pullForm: false
              },
              local: {
                connector: 'loki'
              },
              merge: {
                connector: 'formio-loki'
              }
            }
          },
          methods: {
            /**
             * 
             */
            getModelName: function getModelName() {
              return this.name;
            },

            /**
             * 
             */
            getFluentConfig: function getFluentConfig() {
              var FLUENT = void 0;
              if (typeof window !== 'undefined' && window && window._FLUENT_) {
                FLUENT = window._FLUENT_;
              } else if (global && global._FLUENT_) {
                FLUENT = global._FLUENT_;
              }

              return FLUENT;
            },

            /**
             * 
             * @param {*} connectors 
             * @param {*} type 
             */
            getConnector: function getConnector(connectors, type) {
              var connectorName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

              if (Array.isArray(connectors)) {
                return this.getConnectorFromArray(connectors, type, connectorName);
              }

              if (connectors instanceof Object) {
                return connectors;
              }

              return undefined;
            },

            /**
             * 
             * @param {*} connectors 
             * @param {*} type 
             */
            getConnectorFromArray: function getConnectorFromArray(connectors, type) {
              var _this = this;

              var connectorName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

              // Default case
              if (connectors.length === 1) return connectors[0];

              // If the model assigns specific one
              if (this.config && this.config[type] && this.config[type].connector) {
                var Lcon = connectors.find(function (c) {
                  return c.name === _this.config[type].connector;
                });

                if (Lcon instanceof Object) return Lcon;
              }

              // If connectorName is specified
              if (connectorName) {
                var _Lcon = connectors.find(function (c) {
                  return c.name === connectorName;
                });

                if (_Lcon instanceof Object) return _Lcon;
              }

              var base = connectors.find(function (c) {
                return c.default;
              });

              if (base instanceof Object) return base;

              return undefined;
            },

            /**
             * [remote description]
             * @return {[type]} [description]
             */
            remote: function remote() {
              var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                  _ref$token = _ref.token,
                  token = _ref$token === undefined ? undefined : _ref$token,
                  _ref$pullForm = _ref.pullForm,
                  pullForm = _ref$pullForm === undefined ? undefined : _ref$pullForm,
                  _ref$connectorName = _ref.connectorName,
                  connectorName = _ref$connectorName === undefined ? undefined : _ref$connectorName,
                  _ref$path = _ref.path,
                  path = _ref$path === undefined ? undefined : _ref$path;

              var FLUENT = this.getFluentConfig();
              var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.remote;

              if (!connectors) {
                throw new Error('No remote connector was defined. Please define it using Fluent.config()');
              }

              var remoteConnector = this.getConnector(connectors, 'remote', connectorName || false);

              this.config.remote.token = token || this.config.remote.token;
              this.config.remote.path = path || this.config.remote.path;

              console.log('aaaa');

              if (pullForm) {
                this.config.remote.pullForm = pullForm || this.config.remote.pullForm;
              }

              if (remoteConnector) {
                return remoteConnector.connector({
                  remoteConnection: this.config.remote,
                  connector: remoteConnector
                });
              }

              throw new Error('No default remote connector found. Please assign one as your default in Fluent.config');
            },

            /**
             * [local description]
             * @return {[type]} [description]
             */
            local: function local() {
              var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                  _ref2$connectorName = _ref2.connectorName,
                  connectorName = _ref2$connectorName === undefined ? undefined : _ref2$connectorName;

              var FLUENT = this.getFluentConfig();
              var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.local;

              if (!connectors) throw new Error('No local connector was defined. Please define it using Fluent.config()');

              var localConnector = this.getConnector(connectors, 'local', connectorName || false);

              if (localConnector) return localConnector.connector({ name: this.name, connector: localConnector });

              throw new Error('No default local connector found. Please assign one as your default in Fluent.config');
            },

            /**
            * [local description]
            * @return {[type]} [description]
            */
            merged: function merged() {
              var local = this.local();
              var remote = this.remote();

              var FLUENT = this.getFluentConfig();
              var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.merge;

              if (!connectors) {
                throw new Error('No merge connector was defined. Please define it using Fluent.config()');
              }

              var mergeConnector = this.getConnector(connectors, 'merge');

              if (mergeConnector) {
                return mergeConnector.connector({ local: local, remote: remote, name: this.name, connector: mergeConnector });
              }

              throw new Error('No default merge connector found. Please assign one as your default in Fluent.config');
            }
          }
        }).compose(_privatize2.default);
        /* WEBPACK VAR INJECTION */
      }).call(this, __webpack_require__(4));

      /***/
    },
    /* 10 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _extends = Object.assign || function (target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }return target;
      };

      var _it = __webpack_require__(0);

      var _it2 = _interopRequireDefault(_it);

      var _utilities = __webpack_require__(11);

      var _utilities2 = _interopRequireDefault(_utilities);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      function _asyncToGenerator(fn) {
        return function () {
          var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
            function step(key, arg) {
              try {
                var info = gen[key](arg);var value = info.value;
              } catch (error) {
                reject(error);return;
              }if (info.done) {
                resolve(value);
              } else {
                return Promise.resolve(value).then(function (value) {
                  step("next", value);
                }, function (err) {
                  step("throw", err);
                });
              }
            }return step("next");
          });
        };
      }

      function _toConsumableArray(arr) {
        if (Array.isArray(arr)) {
          for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
          }return arr2;
        } else {
          return Array.from(arr);
        }
      }

      exports.default = (0, _it2.default)({
        init: function init(data) {
          if (!Array.isArray(data)) {
            throw new Error('Collect method only accepts arrays of data');
          }
          this.data = data;
        },

        properties: {
          data: []
        },
        methods: {
          /**
           * 
           */
          get: function get() {
            return this.data;
          },

          /**
           * Alias for the "get" method
           * @return function
           */
          all: function all() {
            return this.get();
          },

          /**
           * Alias for the "average" method.
           *
           * @param  {String}  path Path of the key
           * @return function
           */
          avg: function avg(path) {
            return this.average(path);
          },

          /**
           * Get the average value of a given key.
           *
           * @param  {String}  path Path of the key
           * @return static
           */
          average: function average() {
            var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

            var data = [].concat(_toConsumableArray(this.data));
            var sum = data.reduce(function (acc, element) {
              var value = element;

              if (element instanceof Object) {
                var extract = _utilities2.default.getFromPath(element, path, undefined);
                if (typeof extract !== 'undefined' && extract.value) {
                  value = extract.value;
                }
              }
              return acc + value;
            }, 0);

            try {
              var avg = sum / data.length;
              return avg;
            } catch (e) {
              throw new Error('Division between "' + sum + '" and "' + data.length + '" is not valid.');
            }
          },
          chunkApply: function chunkApply(size, callback) {
            var _this = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
              var totalSize, count, reducer, promiseChain;
              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      if (!(callback === undefined)) {
                        _context.next = 2;
                        break;
                      }

                      throw new Error('Callback function not defined.');

                    case 2:
                      totalSize = _this.data.length;
                      count = 0;

                      _this.chunks(size);

                      // console.log(`Processed ${count}/${totalSize} elements...`);

                      /* for (const chunk of this.data) {
                        const promises = [];
                         chunk.forEach((element) => {
                          promises.push(callback(element, count));
                          count = count + 1;
                        });
                         await Promise.all(promises);
                         // count = (count + size) > totalSize ? totalSize : count + size;
                        console.log(`Processed ${count}/${totalSize} elements...`);
                      } */

                      reducer = function reducer(chain, batch) {
                        return chain.then(function () {
                          return Promise.all(batch.map(function (d) {
                            return callback(d);
                          }));
                        }).then(function () {
                          count = count + size > totalSize ? totalSize : count + size;
                          console.log('Processed ' + count + '/' + totalSize + ' elements...');
                        });
                      };

                      console.log('Processed ' + count + '/' + totalSize + ' elements...');
                      promiseChain = _this.data.reduce(reducer, Promise.resolve());
                      return _context.abrupt('return', promiseChain);

                    case 9:
                    case 'end':
                      return _context.stop();
                  }
                }
              }, _callee, _this);
            }))();
          },

          /**
           * Chunks the given array
           *
           * @param {Int} size
           * @return static
           */
          chunks: function chunks(size) {
            var data = [].concat(_toConsumableArray(this.data));
            var results = [];

            while (data.length) {
              results.push(data.splice(0, size));
            }

            this.data = results;
            return this;
          },

          /**
           * 
           */
          collapse: function collapse() {
            var data = [].concat(_toConsumableArray(this.data));
            var results = [];

            data.forEach(function (chunk) {
              if (Array.isArray(chunk)) {
                chunk.forEach(function (element) {
                  results.push(element);
                });
              } else {
                results.push(chunk);
              }
            });
            this.data = results;

            return this;
          },
          unChunk: function unChunk() {
            return this.collapse();
          },
          combine: function combine(array) {
            var data = [].concat(_toConsumableArray(this.data));
            var result = void 0;
            data.forEach(function (e, index) {
              if (!(e instanceof Object)) {
                if (!result) {
                  result = {};
                }
                result[e] = array[index];
              } else {
                if (!result) {
                  result = [];
                }
                result[index] = _extends({}, e, { _value: array[index] });
              }
            });

            this.data = result;
            return this;
          },
          concat: function concat(array) {
            this.data = [].concat(_toConsumableArray(this.data), _toConsumableArray(array));
            return this;
          },
          contains: function contains() {
            var value = void 0;
            var path = void 0;
            var Fx = void 0;
            if (arguments.length === 1) {
              if (this.isFunction(arguments.length <= 0 ? undefined : arguments[0])) {
                Fx = arguments.length <= 0 ? undefined : arguments[0];
              }
              value = arguments.length <= 0 ? undefined : arguments[0];
            } else {
              value = arguments.length <= 1 ? undefined : arguments[1];
              path = arguments.length <= 0 ? undefined : arguments[0];
            }
            var data = [].concat(_toConsumableArray(this.data));

            return data.some(function (e, index) {
              if (Fx) {
                return !!Fx(e, index);
              }
              var val = e;
              if (e instanceof Object) {
                var extract = _utilities2.default.getFromPath(e, path, undefined);
                if (extract.value) {
                  val = extract.value;
                }
              }
              return val === value;
            });
          },

          /**
           * Returns an array of duplicate submissions, based on an array of keys.
           * @param {Array} keys - Keys where the function compares an object to evaluate its similarity. 
           */
          duplicatesBy: function duplicatesBy(keys) {
            var data = [].concat(_toConsumableArray(this.data));
            var duplicates = [];

            data.reduce(function (object, submission) {
              var finalKey = keys.reduce(function (string, key) {
                return string + _utilities2.default.getFromPath(submission, key, '').value;
              }, '');

              if (object.hasOwnProperty(finalKey)) {
                duplicates.push(submission);
              } else {
                object[finalKey] = true;
              }

              return object;
            }, {});

            this.data = duplicates;

            return this;
          },
          count: function count() {
            return this.data.length;
          },
          isFunction: function isFunction(functionToCheck) {
            return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
          }
        }
      });

      /***/
    },
    /* 11 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      /* eslint-disable no-unused-vars */
      var Utilities = function () {
        /**
         * Given an Object and its path, if exisits it will
         * return the value of it, if not the default
         * @param {Object} obj
         * @param {String} path
         * @param {*} def
         */
        var get = function get(fn, def) {
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
        var getFromPath = function getFromPath(obj, path, def) {
          var _path = path;

          if (path.includes(' as ')) {
            path = path.split(' as ');
            _path = path[0];
          }

          var assignedName = get(function () {
            return Array.isArray(path) && path[1].trim();
          }, undefined);

          var fullPath = _path.replace(/\[/g, '.').replace(/]/g, '').split('.').filter(Boolean).map(function (e) {
            return e.trim();
          });

          function everyFunc(step) {
            return !(step && (obj = obj[step]) === undefined);
          }

          var result = fullPath.every(everyFunc) ? obj : def;

          return { label: assignedName || _path, value: result };
        };

        return Object.freeze({
          get: get,
          getFromPath: getFromPath
        });
      }();

      exports.default = Utilities;

      /***/
    },
    /* 12 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? function (obj) {
        return typeof obj === 'undefined' ? 'undefined' : _typeof2(obj);
      } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === 'undefined' ? 'undefined' : _typeof2(obj);
      };

      var _it = __webpack_require__(0);

      var _it2 = _interopRequireDefault(_it);

      var _utilities = __webpack_require__(11);

      var _utilities2 = _interopRequireDefault(_utilities);

      var _Collection = __webpack_require__(10);

      var _Collection2 = _interopRequireDefault(_Collection);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      function _toConsumableArray(arr) {
        if (Array.isArray(arr)) {
          for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
          }return arr2;
        } else {
          return Array.from(arr);
        }
      }

      function _asyncToGenerator(fn) {
        return function () {
          var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
            function step(key, arg) {
              try {
                var info = gen[key](arg);var value = info.value;
              } catch (error) {
                reject(error);return;
              }if (info.done) {
                resolve(value);
              } else {
                return Promise.resolve(value).then(function (value) {
                  step("next", value);
                }, function (err) {
                  step("throw", err);
                });
              }
            }return step("next");
          });
        };
      }

      exports.default = (0, _it2.default)({
        init: function init(_ref) {
          var name = _ref.name,
              remoteConnection = _ref.remoteConnection,
              connector = _ref.connector;

          if (!name && !remoteConnection) {
            throw new Error("Model must have a name or path");
          }

          if (!connector) {
            throw new Error("Model must have a connector. Please register one using Fluent.config");
          }
          this.name = name || this.name;
          this.remoteConnection = remoteConnection || this.remoteConnection;
          this.connector = connector || this.connector;
          this.chainReference = [];
          this.whereArray = [];
          this.orWhereArray = [];
          this.selectArray = [];
          this.orderByArray = [];
          this.limitNumber = undefined;
          this.offsetNumber = undefined;
          this.populate = [];
          this.chunk = null;
          this.pullSize = null;
          this.ownerId = undefined;
          this.paginator = undefined;
          this.rawQuery = undefined;
        },

        properties: {
          operators: ["=", "<", ">", "<=", ">=", "<>", "!=", "in", "nin", "like", "regexp", "startsWith", "endsWith", "contains"]
        },
        methods: {
          /**
           *
           */
          get: function get() {
            throw new Error("get() method not implemented");
          },

          /**
           *
           */
          all: function all() {
            throw new Error("all() method not implemented");
          },

          /**
           *
           */
          find: function find(id) {
            throw new Error("find() method not implemented");
          },

          /**
           *
           */
          findOne: function findOne() {
            throw new Error("findOne() method not implemented");
          },

          /**
           *
           */
          remove: function remove() {
            throw new Error("remove() method not implemented");
          },

          /**
           *
           */
          softDelete: function softDelete() {
            throw new Error("softDelete() method not implemented");
          },

          /**
           *
           */
          insert: function insert() {
            throw new Error("insert() method not implemented");
          },

          /**
           *
           */
          update: function update() {
            throw new Error("update() method not implemented");
          },

          /**
           *
           */
          clear: function clear() {
            throw new Error("clear() method not implemented");
          },

          /**
           *
           */
          updateOrCreate: function updateOrCreate() {
            throw new Error("updateOrCreate() method not implemented");
          },

          /**
           *
           */
          findAndRemove: function findAndRemove() {
            throw new Error("findAndRemove() method not implemented");
          },

          /**
           *
           * @param {*} paginator
           */
          paginate: function paginate() {
            throw new Error("paginate() method not implemented");
          },

          /**
           * @param {*} tableView
           */
          tableView: function tableView() {
            throw new Error("tableView() method not implemented");
          },

          /**
           * @param {*} raw
           */
          raw: function raw() {
            throw new Error("raw() method not implemented");
          },
          owner: function owner(user) {
            this.chainReference.push({ method: "owner", args: user });
            this.ownerId = user;
            return this;
          },
          own: function own(user) {
            return this.owner(user);
          },

          /**
           * Executes the Get() method and
           * returns the its first result
           *
           * @return {Object} First result
           */
          first: function first() {
            var _this = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
              var data;
              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _context.next = 2;
                      return _this.get();

                    case 2:
                      data = _context.sent;
                      return _context.abrupt("return", _utilities2.default.get(function () {
                        return data[0];
                      }, []));

                    case 4:
                    case "end":
                      return _context.stop();
                  }
                }
              }, _callee, _this);
            }))();
          },

          /**
           *
           * Gets the data in the current query and
           * transforms it into a collection
           * @returns {Collection} Fluent Collection
           */
          collect: function collect() {
            var _this2 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
              var data;
              return regeneratorRuntime.wrap(function _callee2$(_context2) {
                while (1) {
                  switch (_context2.prev = _context2.next) {
                    case 0:
                      _context2.next = 2;
                      return _this2.get();

                    case 2:
                      data = _context2.sent;

                      if (Array.isArray(data)) {
                        _context2.next = 5;
                        break;
                      }

                      throw new Error("Collect method only accepts arrays of data");

                    case 5:
                      return _context2.abrupt("return", (0, _Collection2.default)(data));

                    case 6:
                    case "end":
                      return _context2.stop();
                  }
                }
              }, _callee2, _this2);
            }))();
          },

          /**
           * Adds the given columns to the SelectArray
           * to use as column filter for the data
           *
           * @param {Array|String} columns The columns to select
           * @returns {Model} Fluent Model
           */
          select: function select() {
            for (var _len = arguments.length, columns = Array(_len), _key = 0; _key < _len; _key++) {
              columns[_key] = arguments[_key];
            }

            columns = this.prepareInput(columns);
            this.chainReference.push({ method: "select", args: columns });
            this.selectArray = this.selectArray.concat(columns).filter(function (elem, pos, arr) {
              return arr.indexOf(elem) === pos;
            });

            return this;
          },

          /**
           * Maps the given Data to show only those fields
           * explicitly detailed on the Select function
           *
           * @param {Array} data Data from local or remote DB
           * @returns {Array} Formatted data with the selected columns
           */
          jsApplySelect: function jsApplySelect(data) {
            var _this3 = this;

            var _data = Array.isArray(data) ? [].concat(_toConsumableArray(data)) : [data];

            if (this.selectArray.length > 0) {
              _data = _data.map(function (element) {
                var newElement = {};

                _this3.selectArray.forEach(function (attribute) {
                  var extract = _utilities2.default.getFromPath(element, attribute, undefined);

                  var value = _utilities2.default.get(function () {
                    return extract.value;
                  }, undefined);

                  if (typeof value !== "undefined") {
                    if ((typeof value === "undefined" ? "undefined" : _typeof(value)) === "object" && value.hasOwnProperty("data") && value.data.hasOwnProperty("name")) {
                      newElement[extract.label] = value.data.name;
                    } else {
                      newElement[extract.label] = value;
                    }
                  }
                });

                return newElement;
              });
            }

            return _data;
          },

          /**
           *  Sets the offset number for
           *  the given query
           *
           * @param {int} offset The given offset
           * @returns {Model} Fluent Model
           */
          offset: function offset(_offset) {
            this.chainReference.push({ method: "offset", args: _offset });
            this.offsetNumber = _offset;
            return this;
          },

          /**
           *  Alias for the offset method
           *
           * @param {int} offset the given offset
           */
          skip: function skip(offset) {
            return this.offset(offset);
          },

          /**
           *  Adds where filters to the query
           *  whereArray
           * @param {String|Array} args Where filters
           * @returns {Model} Fluent Model
           */
          where: function where() {
            var _this4 = this;

            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              args[_key2] = arguments[_key2];
            }

            this.chainReference.push({ method: "where", args: args });
            this.whereArray = [];
            args = Array.isArray(args[0]) ? args : [args];
            args.forEach(function (arg) {
              if (arg.length !== 3) {
                throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
              }
              _this4.whereArray.push(arg);
            });
            return this;
          },

          /**
           * Pushes where filters with AND condition
           * to the whereArray
           *
           * @param {String|Array} args Where filters
           * @returns {Model} Fluent Model
           */
          andWhere: function andWhere() {
            var _this5 = this;

            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
              args[_key3] = arguments[_key3];
            }

            this.chainReference.push({ method: "andWhere", args: args });
            args = Array.isArray(args[0]) ? args : [args];
            args.forEach(function (arg) {
              if (arg.length !== 3) {
                throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
              }
              _this5.whereArray.push(arg);
            });
            return this;
          },

          /**
           * Pushes where filter with OR condition
           * to the orWhereArray
           *
           * @param {String|Array} args OR where filters
           * @returns {Model} Fluent Model
           */
          orWhere: function orWhere() {
            var _this6 = this;

            for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
              args[_key4] = arguments[_key4];
            }

            this.chainReference.push({ method: "orWhere", args: args });
            args = Array.isArray(args[0]) ? args : [args];
            args.forEach(function (arg) {
              if (arg.length !== 3) {
                throw new Error('There orWhere clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
              }
              _this6.orWhereArray.push(arg);
            });
            return this;
          },

          /**
           * Limits the number of results for the
           * given query
           * @param {int} limit limit number
           * @returns {Model} Fluent Model
           */
          limit: function limit(_limit) {
            this.chainReference.push({ method: "limit", args: _limit });
            this.limitNumber = _limit;
            return this;
          },

          /**
           * Alias for the limit method
           *
           * @param {*} limit limit number
           * @returns {Model} Fluent Model
           */
          take: function take(limit) {
            return this.limit(limit);
          },

          /**
           * Gets all values for a given KEY
           * @param {String} keyPath The path to the key
           * @returns {Array}
           */
          pluck: function pluck(keyPath) {
            var _this7 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
              var data;
              return regeneratorRuntime.wrap(function _callee3$(_context3) {
                while (1) {
                  switch (_context3.prev = _context3.next) {
                    case 0:
                      _this7.chainReference.push({ method: "pluck", args: keyPath });
                      _context3.next = 3;
                      return _this7.get();

                    case 3:
                      data = _context3.sent;

                      data = data.map(function (e) {
                        var extracted = _utilities2.default.getFromPath(e, keyPath, undefined);

                        if (typeof extracted.value !== "undefined") {
                          return extracted.value;
                        }
                      });
                      return _context3.abrupt("return", data);

                    case 6:
                    case "end":
                      return _context3.stop();
                  }
                }
              }, _callee3, _this7);
            }))();
          },

          /**
           *
           * @param {*} args
           */
          orderBy: function orderBy() {
            for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
              args[_key5] = arguments[_key5];
            }

            this.chainReference.push({ method: "orderBy", args: args });
            this.orderByArray = args;
            return this;
          },

          /**
           *
           * @param {*} data
           */
          jsApplyOrderBy: function jsApplyOrderBy(data) {
            var _data = [].concat(_toConsumableArray(data));

            if (this.orderByArray.length === 0) {
              return _data;
            }
            var field = this.orderByArray[0];

            if (this.selectArray.length > 0 && (field.includes(".") || field.includes("["))) {
              throw new Error('Cannot orderBy nested attribute "' + field + '" when using Select. You must rename the attribute');
            }

            var order = this.orderByArray[1];
            var type = this.orderByArray[2];

            if (!type) {
              type = "string";
            }

            _data = _data.sort(function (a, b) {
              var A = _utilities2.default.getFromPath(a, field, undefined).value;
              var B = _utilities2.default.getFromPath(b, field, undefined).value;

              if (typeof A === "undefined" || typeof B === "undefined") {
                throw new Error('Cannot order by property "' + field + '" not all values have this property');
              }
              // For default order and numbers
              if (type.includes("string") || type.includes("number")) {
                if (order === "asc") {
                  return A > B ? 1 : A < B ? -1 : 0;
                }
                return A > B ? -1 : A < B ? 1 : 0;
              } else if (type.includes("date")) {
                if (order === "asc") {
                  return new Date(A) - new Date(B);
                }
                return new Date(B) - new Date(A);
              }
            });
            return _data;
          },

          /**
           *
           * @param {*} input
           */
          prepareInput: function prepareInput(input) {
            var cols = [];

            input.forEach(function (item) {
              var value = Array.isArray(item) ? item : item.split(",");

              value = value.map(function (e) {
                return e.trim();
              });
              cols = cols.concat(value);
            });

            cols.filter(function (elem, pos, arr) {
              return arr.indexOf(elem) === pos;
            });

            return cols;
          },
          ArrayInsert: function ArrayInsert(dataArray, options) {
            var _this8 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
              var initial, length, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, element, a;

              return regeneratorRuntime.wrap(function _callee4$(_context4) {
                while (1) {
                  switch (_context4.prev = _context4.next) {
                    case 0:
                      initial = 1;
                      length = dataArray.length;
                      _iteratorNormalCompletion = true;
                      _didIteratorError = false;
                      _iteratorError = undefined;
                      _context4.prev = 5;
                      _iterator = dataArray[Symbol.iterator]();

                    case 7:
                      if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                        _context4.next = 26;
                        break;
                      }

                      element = _step.value;

                      if (options && options.showProgress) {
                        console.log("Inserting " + initial + " of " + length);
                      }
                      _context4.prev = 10;
                      _context4.next = 13;
                      return _this8.insert(element, options);

                    case 13:
                      a = _context4.sent;

                      if (options && options.showProgress) {
                        console.log("Element " + initial + " inserted");
                      }
                      initial++;
                      _context4.next = 23;
                      break;

                    case 18:
                      _context4.prev = 18;
                      _context4.t0 = _context4["catch"](10);

                      console.log("ERROR - Element " + initial + " - " + JSON.stringify(element) + " could not be inserted");
                      console.log(_context4.t0);
                      initial++;

                    case 23:
                      _iteratorNormalCompletion = true;
                      _context4.next = 7;
                      break;

                    case 26:
                      _context4.next = 32;
                      break;

                    case 28:
                      _context4.prev = 28;
                      _context4.t1 = _context4["catch"](5);
                      _didIteratorError = true;
                      _iteratorError = _context4.t1;

                    case 32:
                      _context4.prev = 32;
                      _context4.prev = 33;

                      if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                      }

                    case 35:
                      _context4.prev = 35;

                      if (!_didIteratorError) {
                        _context4.next = 38;
                        break;
                      }

                      throw _iteratorError;

                    case 38:
                      return _context4.finish(35);

                    case 39:
                      return _context4.finish(32);

                    case 40:
                    case "end":
                      return _context4.stop();
                  }
                }
              }, _callee4, _this8, [[5, 28, 32, 40], [10, 18], [33,, 35, 39]]);
            }))();
          }
        }
      });

      /***/
    },
    /* 13 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.MergeConnector = exports.Interface = exports.Fluent = exports.Model = undefined;

      var _Fluent = __webpack_require__(14);

      var _Fluent2 = _interopRequireDefault(_Fluent);

      var _Model = __webpack_require__(9);

      var _Model2 = _interopRequireDefault(_Model);

      var _Interface = __webpack_require__(12);

      var _Interface2 = _interopRequireDefault(_Interface);

      var _MergeConnector = __webpack_require__(20);

      var _MergeConnector2 = _interopRequireDefault(_MergeConnector);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      exports.Model = _Model2.default;
      exports.Fluent = _Fluent2.default;
      exports.Interface = _Interface2.default;
      exports.MergeConnector = _MergeConnector2.default;

      /***/
    },
    /* 14 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";
      /* WEBPACK VAR INJECTION */
      (function (global) {

        Object.defineProperty(exports, "__esModule", {
          value: true
        });

        var _extends = Object.assign || function (target) {
          for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
              }
            }
          }return target;
        };

        var _it = __webpack_require__(0);

        var _it2 = _interopRequireDefault(_it);

        var _Model = __webpack_require__(9);

        var _Model2 = _interopRequireDefault(_Model);

        var _Collection = __webpack_require__(10);

        var _Collection2 = _interopRequireDefault(_Collection);

        function _interopRequireDefault(obj) {
          return obj && obj.__esModule ? obj : { default: obj };
        }

        function _toConsumableArray(arr) {
          if (Array.isArray(arr)) {
            for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
              arr2[i] = arr[i];
            }return arr2;
          } else {
            return Array.from(arr);
          }
        }

        var Fluent = (0, _it2.default)({
          init: function init() {
            this.registerGlobalVariable();
          },

          properties: {},
          methods: {
            model: function model() {
              for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
              }

              this.registerModel(args);
              return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
            },
            extend: function extend() {
              for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
              }

              this.registerModel(args);
              return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
            },
            compose: function compose() {
              for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
              }

              this.registerModel(args);
              return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
            },
            collect: function collect(args) {
              return (0, _Collection2.default)(args);
            },
            registerGlobalVariable: function registerGlobalVariable() {
              if (typeof window !== "undefined" && window && !window._FLUENT_) {
                window._FLUENT_ = {
                  connectors: {},
                  models: {}
                };
              }

              if (global && !global._FLUENT_) {
                global._FLUENT_ = {
                  connectors: {},
                  models: {}
                };
              }
            },
            registerModel: function registerModel(args) {
              var name = args && args[0] && args[0].properties && args[0].properties.name ? args[0].properties.name : undefined;

              if (!name || name === "baseModel") {
                return;
              }

              if (!(typeof name === "string")) {
                throw new Error("You must assign a name to your Model when using Fluent.compose");
              }

              if (typeof window !== "undefined") {
                window._FLUENT_.models[name] = true;
                return;
              }
              global._FLUENT_.models[name] = true;
            },
            config: function config(_ref) {
              var _ref$REMOTE_CONNECTOR = _ref.REMOTE_CONNECTORS,
                  REMOTE_CONNECTORS = _ref$REMOTE_CONNECTOR === undefined ? undefined : _ref$REMOTE_CONNECTOR,
                  _ref$LOCAL_CONNECTORS = _ref.LOCAL_CONNECTORS,
                  LOCAL_CONNECTORS = _ref$LOCAL_CONNECTORS === undefined ? undefined : _ref$LOCAL_CONNECTORS,
                  _ref$MERGE_CONNECTORS = _ref.MERGE_CONNECTORS,
                  MERGE_CONNECTORS = _ref$MERGE_CONNECTORS === undefined ? undefined : _ref$MERGE_CONNECTORS;

              if (typeof window !== "undefined" && window) {
                window._FLUENT_.connectors = {
                  local: LOCAL_CONNECTORS,
                  remote: REMOTE_CONNECTORS,
                  merge: MERGE_CONNECTORS
                };
              }

              if (typeof global !== "undefined" && global) {
                global._FLUENT_.connectors = {
                  local: LOCAL_CONNECTORS,
                  remote: REMOTE_CONNECTORS,
                  merge: MERGE_CONNECTORS
                };
              }
            },
            getConfig: function getConfig() {
              if (typeof window !== "undefined" && window) {
                return window._FLUENT_;
              }

              if (typeof global !== "undefined" && global) {
                return global._FLUENT_;
              }
            },
            registerConnector: function registerConnector(_ref2) {
              var type = _ref2.type,
                  connector = _ref2.connector;

              if (!type || !connector) throw new Error('type and connector must be defined');
              if (!['local', 'remote', 'merge'].includes(type)) throw new Error('type must be either local, remote or merge');

              var ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_;
              var connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : [];

              if (connectors.length === 0) {
                connector = _extends({}, connector, {
                  default: true
                });

                connectors.push(connector);
                ctx.connectors[type] = connectors;
                return;
              }

              if (connectors.find(function (o) {
                return o.name === connector.name;
              })) {
                console.log("A " + type + " connector with the name '" + connector.name + "' already exists");
                return;
              }

              connectors.push(connector);
              ctx.connectors[type] = connectors;
            },
            deregisterConnector: function deregisterConnector(_ref3) {
              var type = _ref3.type,
                  name = _ref3.name;

              if (!type || !name) throw new Error('type and name must be defined');
              if (!['local', 'remote', 'merge'].includes(type)) throw new Error('type must be either local, remote or merge');

              var ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_;
              var connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : [];

              if (connectors.length === 0) return;

              var filteredConnectors = connectors.filter(function (o) {
                return o.name !== name;
              });
              ctx.connectors[type] = filteredConnectors;
            }
          }
        })();

        exports.default = Fluent;
        /* WEBPACK VAR INJECTION */
      }).call(this, __webpack_require__(4));

      /***/
    },
    /* 15 */
    /***/function (module, exports, __webpack_require__) {

      // More proper implementation would be
      // isDescriptor(obj) || isStamp(obj)
      // but there is no sense since stamp is function and function is object.
      module.exports = __webpack_require__(1);

      /***/
    },
    /* 16 */
    /***/function (module, exports) {

      module.exports = function isPlainObject(value) {
        return Boolean(value) && (typeof value === 'undefined' ? 'undefined' : _typeof2(value)) === 'object' && Object.getPrototypeOf(value) === Object.prototype;
      };

      /***/
    },
    /* 17 */
    /***/function (module, exports, __webpack_require__) {

      var compose = __webpack_require__(2);

      function createShortcut(propName) {
        return function (arg) {
          'use strict';

          var param = {};
          param[propName] = arg;
          return this && this.compose ? this.compose(param) : compose(param);
        };
      }

      var properties = createShortcut('properties');
      var staticProperties = createShortcut('staticProperties');
      var configuration = createShortcut('configuration');
      var deepProperties = createShortcut('deepProperties');
      var staticDeepProperties = createShortcut('staticDeepProperties');
      var deepConfiguration = createShortcut('deepConfiguration');
      var initializers = createShortcut('initializers');

      module.exports = compose({
        staticProperties: {
          methods: createShortcut('methods'),

          props: properties,
          properties: properties,

          statics: staticProperties,
          staticProperties: staticProperties,

          conf: configuration,
          configuration: configuration,

          deepProps: deepProperties,
          deepProperties: deepProperties,

          deepStatics: staticDeepProperties,
          staticDeepProperties: staticDeepProperties,

          deepConf: deepConfiguration,
          deepConfiguration: deepConfiguration,

          init: initializers,
          initializers: initializers,

          composers: createShortcut('composers'),

          propertyDescriptors: createShortcut('propertyDescriptors'),

          staticPropertyDescriptors: createShortcut('staticPropertyDescriptors')
        }
      });

      /***/
    },
    /* 18 */
    /***/function (module, exports) {

      module.exports = function isString(arg) {
        return typeof arg === 'string';
      };

      /***/
    },
    /* 19 */
    /***/function (module, exports, __webpack_require__) {

      var compose = __webpack_require__(2);
      var privates = new WeakMap(); // WeakMap works in IE11, node 0.12

      var makeProxyFunction = function makeProxyFunction(fn, name) {
        function proxiedFn() {
          'use strict';

          var fields = privates.get(this); // jshint ignore:line
          return fn.apply(fields, arguments);
        }

        Object.defineProperty(proxiedFn, 'name', {
          value: name,
          configurable: true
        });

        return proxiedFn;
      };

      function initializer(_, opts) {
        var descriptor = opts.stamp.compose;
        var privateMethodNames = descriptor.deepConfiguration.Privatize.methods;

        var newObject = {}; // our proxy object
        privates.set(newObject, this);

        var methods = descriptor.methods;
        if (!methods) {
          return newObject;
        }

        var methodNames = Object.keys(methods);
        for (var i = 0; i < methodNames.length; i++) {
          var name = methodNames[i];
          if (privateMethodNames.indexOf(name) < 0) {
            // not private, thus wrap
            newObject[name] = makeProxyFunction(methods[name], name);
          }
        }

        // Integration with @stamp/instanceof
        if (typeof Symbol !== "undefined") {
          var stampSymbol = Symbol.for('stamp');
          if (methods[stampSymbol]) {
            newObject[stampSymbol] = opts.stamp;
          }
        }

        return newObject;
      }

      var Privatize = compose({
        initializers: [initializer],
        deepConfiguration: { Privatize: { methods: [] } },
        staticProperties: {
          privatizeMethods: function privatizeMethods() {
            'use strict';

            var methodNames = [];
            for (var i = 0; i < arguments.length; i++) {
              var arg = arguments[i];
              if (typeof arg === 'string' && arg.length > 0) {
                methodNames.push(arg);
              }
            }
            var Stamp = this && this.compose ? this : Privatize;
            return Stamp.compose({
              deepConfiguration: {
                Privatize: {
                  methods: methodNames
                }
              }
            });
          }
        },
        composers: [function (opts) {
          var initializers = opts.stamp.compose.initializers;
          // Keep our initializer the last to return proxy object
          initializers.splice(initializers.indexOf(initializer), 1);
          initializers.push(initializer);
        }]
      });

      module.exports = Privatize;

      /***/
    },
    /* 20 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _Interface = __webpack_require__(12);

      var _Interface2 = _interopRequireDefault(_Interface);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      function _asyncToGenerator(fn) {
        return function () {
          var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
            function step(key, arg) {
              try {
                var info = gen[key](arg);var value = info.value;
              } catch (error) {
                reject(error);return;
              }if (info.done) {
                resolve(value);
              } else {
                return Promise.resolve(value).then(function (value) {
                  step("next", value);
                }, function (err) {
                  step("throw", err);
                });
              }
            }return step("next");
          });
        };
      }

      exports.default = _Interface2.default.compose({
        properties: {
          localFx: undefined,
          remoteFx: undefined
        },
        init: function init(connectors) {
          this.connectors = connectors;
        },

        methods: {
          get: function get() {
            var _this = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
              var localData, remoteData;
              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _this.prepareMergedFunctions();
                      _context.next = 3;
                      return _this.localFx.get();

                    case 3:
                      localData = _context.sent;
                      _context.next = 6;
                      return _this.remoteFx.get();

                    case 6:
                      remoteData = _context.sent;
                      return _context.abrupt("return", localData.concat(remoteData));

                    case 8:
                    case "end":
                      return _context.stop();
                  }
                }
              }, _callee, _this);
            }))();
          },
          prepareMergedFunctions: function prepareMergedFunctions() {
            var _this2 = this;

            this.localFx = this.connectors.local;
            this.remoteFx = this.connectors.remote;

            this.chainReference.forEach(function (chain) {
              var method = chain.method;
              var args = chain.args;

              _this2.localFx = _this2.localFx[method](args);
              _this2.remoteFx = _this2.remoteFx[method](args);
            });
          }
        }
      });

      /***/
    }]
    /******/)
  );
});
//# sourceMappingURL=goat-fluent.js.map
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(20)(module)))

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

!function(t,n){ true?module.exports=n():undefined}(this,function(){"use strict";var t="millisecond",n="second",e="minute",r="hour",i="day",s="week",u="month",o="quarter",a="year",h=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(t,n,e){var r=String(t);return!r||r.length>=n?t:""+Array(n+1-r.length).join(e)+t},d={s:c,z:function(t){var n=-t.utcOffset(),e=Math.abs(n),r=Math.floor(e/60),i=e%60;return(n<=0?"+":"-")+c(r,2,"0")+":"+c(i,2,"0")},m:function(t,n){var e=12*(n.year()-t.year())+(n.month()-t.month()),r=t.clone().add(e,u),i=n-r<0,s=t.clone().add(e+(i?-1:1),u);return Number(-(e+(n-r)/(i?r-s:s-r))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return{M:u,y:a,w:s,d:i,h:r,m:e,s:n,ms:t,Q:o}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},$={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},l="en",m={};m[l]=$;var y=function(t){return t instanceof v},M=function(t,n,e){var r;if(!t)return null;if("string"==typeof t)m[t]&&(r=t),n&&(m[t]=n,r=t);else{var i=t.name;m[i]=t,r=i}return e||(l=r),r},g=function(t,n,e){if(y(t))return t.clone();var r=n?"string"==typeof n?{format:n,pl:e}:n:{};return r.date=t,new v(r)},D=d;D.l=M,D.i=y,D.w=function(t,n){return g(t,{locale:n.$L,utc:n.$u})};var v=function(){function c(t){this.$L=this.$L||M(t.locale,null,!0)||l,this.parse(t)}var d=c.prototype;return d.parse=function(t){this.$d=function(t){var n=t.date,e=t.utc;if(null===n)return new Date(NaN);if(D.u(n))return new Date;if(n instanceof Date)return new Date(n);if("string"==typeof n&&!/Z$/i.test(n)){var r=n.match(h);if(r)return e?new Date(Date.UTC(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)):new Date(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)}return new Date(n)}(t),this.init()},d.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds()},d.$utils=function(){return D},d.isValid=function(){return!("Invalid Date"===this.$d.toString())},d.isSame=function(t,n){var e=g(t);return this.startOf(n)<=e&&e<=this.endOf(n)},d.isAfter=function(t,n){return g(t)<this.startOf(n)},d.isBefore=function(t,n){return this.endOf(n)<g(t)},d.$g=function(t,n,e){return D.u(t)?this[n]:this.set(e,t)},d.year=function(t){return this.$g(t,"$y",a)},d.month=function(t){return this.$g(t,"$M",u)},d.day=function(t){return this.$g(t,"$W",i)},d.date=function(t){return this.$g(t,"$D","date")},d.hour=function(t){return this.$g(t,"$H",r)},d.minute=function(t){return this.$g(t,"$m",e)},d.second=function(t){return this.$g(t,"$s",n)},d.millisecond=function(n){return this.$g(n,"$ms",t)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(t,o){var h=this,f=!!D.u(o)||o,c=D.p(t),d=function(t,n){var e=D.w(h.$u?Date.UTC(h.$y,n,t):new Date(h.$y,n,t),h);return f?e:e.endOf(i)},$=function(t,n){return D.w(h.toDate()[t].apply(h.toDate(),(f?[0,0,0,0]:[23,59,59,999]).slice(n)),h)},l=this.$W,m=this.$M,y=this.$D,M="set"+(this.$u?"UTC":"");switch(c){case a:return f?d(1,0):d(31,11);case u:return f?d(1,m):d(0,m+1);case s:var g=this.$locale().weekStart||0,v=(l<g?l+7:l)-g;return d(f?y-v:y+(6-v),m);case i:case"date":return $(M+"Hours",0);case r:return $(M+"Minutes",1);case e:return $(M+"Seconds",2);case n:return $(M+"Milliseconds",3);default:return this.clone()}},d.endOf=function(t){return this.startOf(t,!1)},d.$set=function(s,o){var h,f=D.p(s),c="set"+(this.$u?"UTC":""),d=(h={},h[i]=c+"Date",h.date=c+"Date",h[u]=c+"Month",h[a]=c+"FullYear",h[r]=c+"Hours",h[e]=c+"Minutes",h[n]=c+"Seconds",h[t]=c+"Milliseconds",h)[f],$=f===i?this.$D+(o-this.$W):o;if(f===u||f===a){var l=this.clone().set("date",1);l.$d[d]($),l.init(),this.$d=l.set("date",Math.min(this.$D,l.daysInMonth())).toDate()}else d&&this.$d[d]($);return this.init(),this},d.set=function(t,n){return this.clone().$set(t,n)},d.get=function(t){return this[D.p(t)]()},d.add=function(t,o){var h,f=this;t=Number(t);var c=D.p(o),d=function(n){var e=g(f);return D.w(e.date(e.date()+Math.round(n*t)),f)};if(c===u)return this.set(u,this.$M+t);if(c===a)return this.set(a,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(h={},h[e]=6e4,h[r]=36e5,h[n]=1e3,h)[c]||1,l=this.valueOf()+t*$;return D.w(l,this)},d.subtract=function(t,n){return this.add(-1*t,n)},d.format=function(t){var n=this;if(!this.isValid())return"Invalid Date";var e=t||"YYYY-MM-DDTHH:mm:ssZ",r=D.z(this),i=this.$locale(),s=this.$H,u=this.$m,o=this.$M,a=i.weekdays,h=i.months,c=function(t,r,i,s){return t&&(t[r]||t(n,e))||i[r].substr(0,s)},d=function(t){return D.s(s%12||12,t,"0")},$=i.meridiem||function(t,n,e){var r=t<12?"AM":"PM";return e?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:D.s(o+1,2,"0"),MMM:c(i.monthsShort,o,h,3),MMMM:h[o]||h(this,e),D:this.$D,DD:D.s(this.$D,2,"0"),d:String(this.$W),dd:c(i.weekdaysMin,this.$W,a,2),ddd:c(i.weekdaysShort,this.$W,a,3),dddd:a[this.$W],H:String(s),HH:D.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:D.s(u,2,"0"),s:String(this.$s),ss:D.s(this.$s,2,"0"),SSS:D.s(this.$ms,3,"0"),Z:r};return e.replace(f,function(t,n){return n||l[t]||r.replace(":","")})},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(t,h,f){var c,d=D.p(h),$=g(t),l=6e4*($.utcOffset()-this.utcOffset()),m=this-$,y=D.m(this,$);return y=(c={},c[a]=y/12,c[u]=y,c[o]=y/3,c[s]=(m-l)/6048e5,c[i]=(m-l)/864e5,c[r]=m/36e5,c[e]=m/6e4,c[n]=m/1e3,c)[d]||m,f?y:D.a(y)},d.daysInMonth=function(){return this.endOf(u).$D},d.$locale=function(){return m[this.$L]},d.locale=function(t,n){if(!t)return this.$L;var e=this.clone();return e.$L=M(t,n,!0),e},d.clone=function(){return D.w(this.toDate(),this)},d.toDate=function(){return new Date(this.$d)},d.toJSON=function(){return this.toISOString()},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},c}();return g.prototype=v.prototype,g.extend=function(t,n){return t(n,v,g),g},g.locale=M,g.isDayjs=y,g.unix=function(t){return g(1e3*t)},g.en=m[l],g.Ls=m,g});


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _goatFluent = __webpack_require__(3);

var _Labels = __webpack_require__(42);

var _Labels2 = _interopRequireDefault(_Labels);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: "Form",
    config: {
      remote: {
        path: "form",
        pullForm: true
      }
    }
  },
  methods: {
    getModel: function getModel(_ref) {
      var path = _ref.path;

      return _goatFluent.Fluent.model({
        properties: {
          config: {
            remote: { path: path }
          }
        }
      })();
    },
    find: function find(_ref2) {
      var path = _ref2.path;

      return this.local().where("data.path", "=", path).first();
    },

    /**
     *
     * @param {*} action
     */
    cardFormattedForms: function cardFormattedForms(action) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var result;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _this.local().get();

              case 2:
                result = _context.sent;

                result = result.filter(function (o) {
                  return o.data.tags.indexOf("visible") > -1;
                });
                result = result.sort(function (a, b) {
                  a = a.data.title;
                  b = b.data.title;
                  return a > b ? 1 : a < b ? -1 : 0;
                });

                result = result.map(function (f) {
                  return {
                    title: f.data.title,
                    tags: f.data.tags,
                    customIcon: true,
                    icon: action === "create" ? "statics/customSVG/startSurvey.svg" : "statics/customSVG/collectedData.svg",
                    subtitle: "Last updated: " + (0, _dayjs2.default)(f.data.modified).fromNow(),
                    actions: [{
                      text: action === "create" ? "Start" : "View data",
                      target: "form",
                      view: action,
                      path: f.data.path
                    }]
                  };
                });

                result = { cards: result };
                return _context.abrupt("return", result);

              case 8:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },

    /**
     *
     */
    FormLabels: function FormLabels(i18n) {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var forms;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _this2.local().get();

              case 2:
                forms = _context2.sent;
                return _context2.abrupt("return", _Labels2.default.get(forms, i18n));

              case 4:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },

    /**
     *
     * @param {*} forms
     */
    getUpdatedAt: function getUpdatedAt(forms) {
      return _utilities2.default.get(function () {
        return forms[0].fastUpdated;
      }, 0);
    },

    /**
     *
     * @param {*} param0
     */
    setOffline: function setOffline(_ref3) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var appConf = _ref3.appConf;
        var localForms, localDate, config, offlineForms, unixDate;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return _this3.local().get();

              case 2:
                localForms = _context4.sent;
                localDate = _this3.getUpdatedAt(localForms);
                _context4.next = 6;
                return _Configuration2.default.local().first();

              case 6:
                config = _context4.sent;
                offlineForms = _utilities2.default.get(function () {
                  return appConf.offlineFiles.Forms;
                });

                // If the JSON file is newer than the local
                // DB data

                if (!(config.fastUpdated < localDate)) {
                  _context4.next = 10;
                  break;
                }

                return _context4.abrupt("return", localForms);

              case 10:
                if (!localForms) {
                  _context4.next = 13;
                  break;
                }

                _context4.next = 13;
                return _this3.local().clear({ sure: true });

              case 13:
                unixDate = (0, _dayjs2.default)().unix();

                offlineForms.forEach(function () {
                  var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(form) {
                    return regeneratorRuntime.wrap(function _callee3$(_context3) {
                      while (1) {
                        switch (_context3.prev = _context3.next) {
                          case 0:
                            _context3.next = 2;
                            return _this3.local().insert({ data: form, fastUpdated: unixDate });

                          case 2:
                          case "end":
                            return _context3.stop();
                        }
                      }
                    }, _callee3, _this3);
                  }));

                  return function (_x) {
                    return _ref4.apply(this, arguments);
                  };
                }());
                return _context4.abrupt("return", offlineForms);

              case 16:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, _this3);
      }))();
    },

    /**
     *
     */
    setOnline: function setOnline() {
      var _this4 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var remoteForms, unixDate, forms;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return _this4.remote().limit(9999999).get();

              case 2:
                remoteForms = _context5.sent;
                unixDate = (0, _dayjs2.default)().unix();

                if (!(remoteForms && !_utilities2.default.isEmpty(remoteForms))) {
                  _context5.next = 11;
                  break;
                }

                _context5.next = 7;
                return _this4.local().clear({ sure: true });

              case 7:
                forms = remoteForms.reduce(function (forms, form) {
                  var element = {
                    data: form,
                    fastUpdated: unixDate
                  };
                  forms.push(element);
                  return forms;
                }, []);
                _context5.next = 10;
                return _this4.local().insert(forms, { showProgress: true });

              case 10:
                return _context5.abrupt("return", _context5.sent);

              case 11:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, _this4);
      }))();
    },

    /**
     *
     * @param {*} param0
     */
    set: function set(_ref5) {
      var _this5 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var appConf = _ref5.appConf,
            forceOnline = _ref5.forceOnline;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                if (forceOnline) {
                  _context6.next = 2;
                  break;
                }

                return _context6.abrupt("return", _this5.setOffline({ appConf: appConf }));

              case 2:
                return _context6.abrupt("return", _this5.setOnline());

              case 3:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, _this5);
      }))();
    },
    getFastTableTemplates: function getFastTableTemplates(_ref6) {
      var _this6 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        var path = _ref6.path;
        var fullForm, templates;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return _this6.local().where("data.path", "=", path).first();

              case 2:
                fullForm = _context7.sent;
                templates = [];


                _utilities2.default.eachComponent(fullForm.data.components, function (c) {
                  if (c.properties && c.properties.FAST_TABLE_TEMPLATE) {
                    templates.push({
                      key: c.key,
                      template: c.properties.FAST_TABLE_TEMPLATE
                    });
                  }
                });

                return _context7.abrupt("return", templates);

              case 6:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, _this6);
      }))();
    }
  }
})();

/***/ }),
/* 6 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "to", function() { return to; });
/**
 * @param { Promise } promise
 * @param { Object= } errorExt - Additional Information you can pass to the err object
 * @return { Promise }
 */
function to(promise, errorExt) {
    return promise
        .then(function (data) { return [null, data]; })
        .catch(function (err) {
        if (errorExt) {
            Object.assign(err, errorExt);
        }
        return [err, undefined];
    });
}


/* harmony default export */ __webpack_exports__["default"] = (to);
//# sourceMappingURL=await-to-js.es5.js.map


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(45);

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Event = __webpack_require__(9);

var _Event2 = _interopRequireDefault(_Event);

var _axios = __webpack_require__(7);

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-unused-vars */
var Connection = function () {
  var online = typeof window !== "undefined" && window && window.navigator ? window.navigator.onLine : true;

  function setOnline() {
    if (!online) {
      online = true;
      _Event2.default.emit({
        name: "GOAT:CONNECTION:ONLINE",
        data: online,
        text: "Application is now online"
      });
    }
  }

  function setOffline() {
    if (online) {
      online = false;
      _Event2.default.emit({
        name: "GOAT:CONNECTION:OFFLINE",
        data: online,
        text: "Application is now offline"
      });
    }
  }

  /**
   * [status description]
   * @return {Promise} [description]
   */
  function initEventListeners() {
    _Event2.default.listen({
      name: "online",
      callback: function callback() {
        console.log("App is now online");
        setOnline();
      }
    });
    _Event2.default.listen({
      name: "offline",
      callback: function callback() {
        console.log("App is now offline");
        setOffline();
      }
    });
  }

  function isOnline() {
    return new Promise(function (resolve, reject) {
      _axios2.default.get("https://yesno.wtf/api").then(function (res) {
        resolve(true);
      }).catch(function (err) {
        resolve(false);
      });
    });
  }

  return Object.freeze({
    isOnline: isOnline,
    initEventListeners: initEventListeners
  });
}();
// import Promise from "bluebird";
exports.default = Connection;

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
var Event = function () {
  var CustomEvent = function CustomEvent(event, params) {
    var evt = document.createEvent('CustomEvent');

    params = params || { bubbles: false, cancelable: false, detail: undefined };

    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };

  function emit(_ref) {
    var name = _ref.name,
        data = _ref.data,
        text = _ref.text;

    if (!name) throw new Error('Event must have a name.');
    if (!data) throw new Error('Event must have data.');
    if (!text) throw new Error('Event must have a text.');
    var customEvent = CustomEvent(name, {
      detail: {
        data: data,
        text: text
      }
    });

    window.dispatchEvent(customEvent);
  }
  function listen(_ref2) {
    var name = _ref2.name,
        callback = _ref2.callback;

    if (!name) throw new Error('Listener must have a name.');
    if (!callback) throw new Error('Listener must have a callback.');
    window.addEventListener(name, callback);
  }

  function remove(_ref3) {
    var name = _ref3.name,
        callback = _ref3.callback;

    if (!name) throw new Error('Listener must have a name to detach');
    if (!callback) throw new Error('Listener must have a callback to detach');
    window.removeEventListener(name, callback);
  }
  return Object.freeze({
    emit: emit,
    listen: listen,
    remove: remove
  });
}();

exports.default = Event;

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _Auth = __webpack_require__(16);

var _Auth2 = _interopRequireDefault(_Auth);

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

var _goatFluent = __webpack_require__(3);

var _Columns = __webpack_require__(78);

var _Columns2 = _interopRequireDefault(_Columns);

var _awaitToJs = __webpack_require__(6);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

var _axios = __webpack_require__(7);

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: "Submission",
    config: {
      remote: undefined
    }
  },
  init: function init(_ref) {
    var path = _ref.path;

    this.path = path;
    this.config = {
      remote: { path: path }
    };
  },

  methods: {
    form: function form() {
      // return this.belongTo('Form', 'path', 'path');

      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },
    getUnsync: function getUnsync() {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var unsynced;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _this2.local().where("sync", "=", false).andWhere("draft", "=", false).andWhere("syncError", "=", false).owner((0, _Auth2.default)().connector().email()).orderBy("created", "desc", "date").get();

              case 2:
                _context2.t0 = function (d) {
                  return !d.queuedForSync;
                };

                unsynced = _context2.sent.filter(_context2.t0);
                return _context2.abrupt("return", unsynced);

              case 5:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },
    showView: function showView(_ref2) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var from = _ref2.from,
            limit = _ref2.limit,
            owner = _ref2.owner,
            paginator = _ref2.paginator,
            filter = _ref2.filter,
            url = _ref2.url,
            timeFilter = _ref2.timeFilter,
            companyFilter = _ref2.companyFilter,
            classifier = _ref2.classifier;

        var tableCols, cols, submissions, error, result, _ref3, _ref4, _ref5, _ref6, parameters, resultAxios, flattenedResponse, _ref7, _ref8, _error, _result, remote, templates;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _Columns2.default.getTableView(_this3.path);

              case 2:
                tableCols = _context3.sent;
                cols = tableCols.map(function (o) {
                  return "data." + o.path + " as " + o.path;
                });


                tableCols = tableCols.map(function (o) {
                  return o.path;
                });

                cols = [].concat(_toConsumableArray(cols), ["_id", "created", "modified", "syncError", "draft", "sync"]);

                submissions = [];

                if (!(from === "remote")) {
                  _context3.next = 39;
                  break;
                }

                error = void 0, result = void 0;

                if (paginator) {
                  _context3.next = 27;
                  break;
                }

                if (timeFilter) {
                  _context3.next = 19;
                  break;
                }

                _context3.next = 13;
                return (0, _awaitToJs2.default)(_this3.remote().select(cols).limit(limit).get());

              case 13:
                _ref3 = _context3.sent;
                _ref4 = _slicedToArray(_ref3, 2);
                error = _ref4[0];
                result = _ref4[1];
                _context3.next = 25;
                break;

              case 19:
                _context3.next = 21;
                return (0, _awaitToJs2.default)(_this3.remote().where('modified', '>=', (0, _dayjs2.default)().subtract(1, timeFilter).toISOString()).select(cols).limit(limit).get());

              case 21:
                _ref5 = _context3.sent;
                _ref6 = _slicedToArray(_ref5, 2);
                error = _ref6[0];
                result = _ref6[1];

              case 25:
                _context3.next = 35;
                break;

              case 27:
                parameters = {
                  tableCols: tableCols,
                  paginator: paginator,
                  filter: filter,
                  classifiedBy: owner
                };


                if (classifier) {
                  parameters = _extends({}, parameters, {
                    timeFilter: (0, _dayjs2.default)().subtract(1, timeFilter).toISOString(),
                    extraFilters: companyFilter !== 'all' ? { 'data.company': companyFilter } : {}
                  });
                }

                _context3.next = 31;
                return _axios2.default.get(url.base + "/tableSearch/" + url.form, {
                  params: parameters
                });

              case 31:
                resultAxios = _context3.sent;
                flattenedResponse = resultAxios.data.docs.map(function (sub) {
                  var o = {};
                  var _iteratorNormalCompletion = true;
                  var _didIteratorError = false;
                  var _iteratorError = undefined;

                  try {
                    for (var _iterator = cols[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                      var col = _step.value;

                      var res = _utilities2.default.getFromPath(sub, col, '');
                      o[res.label] = res.value;
                    }
                  } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                      }
                    } finally {
                      if (_didIteratorError) {
                        throw _iteratorError;
                      }
                    }
                  }

                  return o;
                });


                paginator = {
                  page: resultAxios.data.page,
                  rowsPerPage: resultAxios.data.limit,
                  rowsNumber: resultAxios.data.totalDocs
                };

                result = {
                  paginator: paginator,
                  data: flattenedResponse
                };

              case 35:

                if (error) {
                  console.log("error", error);
                  submissions = [];
                }
                submissions = !error && result;
                _context3.next = 52;
                break;

              case 39:
                _context3.next = 41;
                return _this3.local().select(cols).limit(limit).owner(owner).get();

              case 41:
                submissions = _context3.sent;
                _context3.next = 44;
                return (0, _awaitToJs2.default)(_this3.remote().select(cols).limit(limit).owner((0, _Auth2.default)().connector().user()._id).get());

              case 44:
                _ref7 = _context3.sent;
                _ref8 = _slicedToArray(_ref7, 2);
                _error = _ref8[0];
                _result = _ref8[1];
                remote = [];

                if (_error) {
                  console.log("error", _error);
                }

                remote = _error ? [] : _result;

                submissions = [].concat(_toConsumableArray(submissions), _toConsumableArray(remote));

              case 52:
                _context3.next = 54;
                return _Form2.default.getFastTableTemplates({ path: _this3.path });

              case 54:
                templates = _context3.sent;


                if (paginator) {
                  submissions.data = submissions.data.map(function (s) {
                    var sub = {
                      _id: s._id,
                      status: s.sync === false ? "offline" : "online",
                      draft: s.draft,
                      HumanUpdated: Number.isInteger(s.modified) ? _dayjs2.default.unix(s.modified).fromNow() : (0, _dayjs2.default)(s.modified).fromNow(),
                      syncError: s.syncError ? s.syncError : false,
                      updated: Number.isInteger(s.modified) ? s.modified : (0, _dayjs2.default)(s.modified).unix()
                    };

                    // Custom templates using FAST_TABLE_TEMPLATE propertie
                    templates.forEach(function (t) {
                      /* eslint-disable */
                      var newFx = new Function("value", "data", t.template);
                      /* eslint-enable */
                      try {
                        s[t.key] = newFx(s[t.key], s);
                      } catch (error) {
                        console.log("There is an error in one of your calculations", error);
                      }
                    });

                    return _extends({}, sub, s);
                  });

                  submissions.data = submissions.data.sort(function (a, b) {
                    a = new Date(a.updated);
                    b = new Date(b.updated);
                    return a > b ? -1 : a < b ? 1 : 0;
                  });
                } else {
                  submissions = submissions.map(function (s) {
                    var sub = {
                      _id: s._id,
                      status: s.sync === false ? "offline" : "online",
                      draft: s.draft,
                      HumanUpdated: Number.isInteger(s.modified) ? _dayjs2.default.unix(s.modified).fromNow() : (0, _dayjs2.default)(s.modified).fromNow(),
                      syncError: s.syncError ? s.syncError : false,
                      updated: Number.isInteger(s.modified) ? s.modified : (0, _dayjs2.default)(s.modified).unix()
                    };

                    // Custom templates using FAST_TABLE_TEMPLATE propertie
                    templates.forEach(function (t) {
                      /* eslint-disable */
                      var newFx = new Function("value", "data", t.template);
                      /* eslint-enable */
                      try {
                        s[t.key] = newFx(s[t.key], s);
                      } catch (error) {
                        console.log("There is an error in one of your calculations", error);
                      }
                    });

                    return _extends({}, sub, s);
                  });

                  submissions = submissions.sort(function (a, b) {
                    a = new Date(a.updated);
                    b = new Date(b.updated);
                    return a > b ? -1 : a < b ? 1 : 0;
                  });
                }

                return _context3.abrupt("return", submissions);

              case 57:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },
    getParallelParticipants: function getParallelParticipants(_id, path) {
      var _this4 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var currentSubmission, groupId, submissions, a;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return _this4.local().where("_id", "=", _id).first();

              case 2:
                currentSubmission = _context4.sent;
                groupId = _utilities2.default.get(function () {
                  return currentSubmission.data.parallelSurvey;
                });


                groupId = groupId && groupId !== "[object Object]" ? JSON.parse(groupId).groupId : undefined;

                _context4.next = 7;
                return _this4.local().where("path", "=", path).get();

              case 7:
                submissions = _context4.sent;
                a = submissions.filter(function (submission) {
                  var parallelSurveyID = _utilities2.default.get(function () {
                    return submission.data.parallelSurvey;
                  });
                  try {
                    parallelSurveyID = parallelSurveyID && parallelSurveyID !== "[object Object]" ? JSON.parse(parallelSurveyID).groupId : undefined;
                    return parallelSurveyID && parallelSurveyID === groupId;
                  } catch (e) {
                    return false;
                  }
                });
                return _context4.abrupt("return", a.map(function (e) {
                  return JSON.parse(e.data.parallelSurvey);
                }));

              case 10:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, _this4);
      }))();
    },
    getParallelSurvey: function getParallelSurvey(submission) {
      var parallelsurveyInfo = _utilities2.default.get(function () {
        return submission.parallelSurvey;
      });

      parallelsurveyInfo = parallelsurveyInfo && parallelsurveyInfo !== "[object Object]" ? JSON.parse(parallelsurveyInfo) : undefined;

      return parallelsurveyInfo;
    },
    setParallelSurvey: function setParallelSurvey(parallelsurveyInfo) {
      return JSON.stringify(parallelsurveyInfo);
    },
    getGroups: function getGroups(formId) {
      var _this5 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var submissions, groups;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return _this5.local().where("path", "=", formId).get();

              case 2:
                submissions = _context5.sent;


                submissions = formId ? submissions.filter(function (submission) {
                  return submission.data.formio.formId === formId;
                }) : submissions;

                groups = submissions.map(function (submission) {
                  return _this5.local().getParallelSurvey(submission) ? {
                    groupId: _this5.local().getParallelSurvey(submission).groupId,
                    groupName: _this5.local().getParallelSurvey(submission).groupName
                  } : undefined;
                });


                groups = groups.filter(function (group) {
                  return typeof group !== "undefined";
                });

                return _context5.abrupt("return", _utilities2.default.uniqBy(groups, "groupId"));

              case 7:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, _this5);
      }))();
    },
    getGroup: function getGroup(id) {
      var _this6 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var groups;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return _this6.local().getGroups();

              case 2:
                groups = _context6.sent;


                groups = groups.filter(function (group) {
                  return group.groupId === id;
                });
                return _context6.abrupt("return", groups[0]);

              case 5:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, _this6);
      }))();
    },
    removeFromGroup: function removeFromGroup(submission) {
      var _this7 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, _this7);
      }))();
    },
    assingToGroup: function assingToGroup(submissionId, groupId) {
      var _this8 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
        var group, submission, parallelData, parallelSurvey;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return _this8.local().getGroup(groupId[0]);

              case 2:
                group = _context8.sent;
                _context8.next = 5;
                return _this8.local().get(submissionId);

              case 5:
                submission = _context8.sent;
                parallelData = _this8.local().getParallelSurvey(submission);
                parallelSurvey = _extends({}, parallelData, {
                  groupId: group.groupId,
                  groupName: group.groupName
                });


                submission.data.data.parallelSurvey = _this8.local().setParallelSurvey(parallelSurvey);
                _context8.next = 11;
                return _this8.local().update(submission);

              case 11:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, _this8);
      }))();
    }
  }
});

/***/ }),
/* 11 */
/***/ (function(module, exports) {

module.exports = function isObject(arg) {
  var type = typeof arg;
  return Boolean(arg) && (type === 'object' || type === 'function');
};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _goatFluent = __webpack_require__(3);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: 'Translation',
    config: {
      remote: {
        path: 'translations'
      }
    }
  },
  methods: {
    getFormTranslations: function getFormTranslations() {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var i18n, localTranslations;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                i18n = {};
                _context.next = 3;
                return _this.local().first();

              case 3:
                localTranslations = _context.sent;


                localTranslations = _utilities2.default.get(function () {
                  return localTranslations.data;
                }, {});

                Object.keys(localTranslations).forEach(function (languageCode) {
                  if (languageCode !== 'type') {
                    i18n[languageCode] = localTranslations[languageCode];
                  }
                });
                return _context.abrupt('return', i18n);

              case 7:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },

    /**
     *
     */
    supportedLanguages: function supportedLanguages() {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var translations, isoLanguages, languages;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _this2.local().get();

              case 2:
                translations = _context2.sent;

                if (!(translations.length === 0)) {
                  _context2.next = 5;
                  break;
                }

                return _context2.abrupt('return', []);

              case 5:
                isoLanguages = _this2.getIsoLanguages();
                languages = [];


                translations = _utilities2.default.get(function () {
                  return translations[0].data;
                }, []);

                Object.keys(translations).forEach(function (languageCode) {
                  var iso = isoLanguages.find(function (l) {
                    return l.code === languageCode;
                  });

                  if (iso) {
                    languages.push(iso);
                  }
                });

                languages = languages.sort(function (a, b) {
                  a = a.label;
                  b = b.label;
                  return a > b ? 1 : a < b ? -1 : 0;
                });
                return _context2.abrupt('return', languages);

              case 11:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },

    /**
     *
     */
    getIsoLanguages: function getIsoLanguages() {
      return __webpack_require__(43);
    },

    /**
     *
     * @param {*} localTranslations
     */
    getLocalizationDate: function getLocalizationDate(localTranslations) {
      return _utilities2.default.get(function () {
        return localTranslations[0].fastUpdated;
      }, 0);
    },

    /**
     * [authenticate description]
     * @param  {[type]} username [description]
     * @param  {[type]} password [description]
     * @return {[type]}          [description]
     */
    set: function set(_ref) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var appConf = _ref.appConf,
            forceOnline = _ref.forceOnline;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (forceOnline) {
                  _context3.next = 2;
                  break;
                }

                return _context3.abrupt('return', _this3.setOffline({ appConf: appConf }));

              case 2:
                return _context3.abrupt('return', _this3.setOnline({ appConf: appConf }));

              case 3:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },

    /**
     *
     * @param {*} param0
     */
    setOffline: function setOffline(_ref2) {
      var _this4 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var appConf = _ref2.appConf;
        var localTranslations, localDate, config, offlineTranslations, trans;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return _this4.local().get();

              case 2:
                localTranslations = _context4.sent;
                localDate = _this4.getLocalizationDate(localTranslations);
                _context4.next = 6;
                return _Configuration2.default.local().first();

              case 6:
                config = _context4.sent;
                offlineTranslations = appConf.offlineFiles.Translations;

                // If the offline Json is older than the local data

                if (!(config.fastUpdated < localDate)) {
                  _context4.next = 10;
                  break;
                }

                return _context4.abrupt('return', localTranslations[0].data);

              case 10:
                _context4.next = 12;
                return _this4.process(offlineTranslations);

              case 12:
                trans = _context4.sent;
                return _context4.abrupt('return', _this4.storeTranslations(trans));

              case 14:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this4);
      }))();
    },

    /**
     *
     * @param {*} param0
     */
    setOnline: function setOnline(_ref3) {
      var _this5 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var appConf = _ref3.appConf;
        var localTranslations, appTranslations;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return _this5.local().get();

              case 2:
                localTranslations = _context5.sent;
                _context5.next = 5;
                return _this5.remote().limit(50000).get();

              case 5:
                appTranslations = _context5.sent;

                if (!appTranslations) {
                  _context5.next = 14;
                  break;
                }

                _context5.next = 9;
                return _this5.process(appTranslations);

              case 9:
                appTranslations = _context5.sent;
                _context5.next = 12;
                return _this5.storeTranslations(appTranslations);

              case 12:
                appTranslations = _context5.sent;
                return _context5.abrupt('return', appTranslations);

              case 14:
                if (!(localTranslations.length > 0 && localTranslations[0].data)) {
                  _context5.next = 16;
                  break;
                }

                return _context5.abrupt('return', localTranslations[0].data);

              case 16:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this5);
      }))();
    },

    /**
     *
     * @param {*} translationsArray
     */
    storeTranslations: function storeTranslations(translationsArray) {
      var _this6 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var appTranslations;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                // Remove all previous translations
                _this6.local().clear({ sure: true });

                // Insert the new ones
                _context6.next = 3;
                return _this6.local().insert({
                  data: translationsArray,
                  fastUpdated: (0, _dayjs2.default)().unix()
                });

              case 3:
                appTranslations = _context6.sent;
                return _context6.abrupt('return', appTranslations.data);

              case 5:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, _this6);
      }))();
    },

    /**
     * [setTranslations description]
     * @param {[type]} appTranslations [description]
     */
    process: function process(translations) {
      var _this7 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        var lenguages, result;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                lenguages = _this7.getIsoLanguages();
                result = {};


                result.label = {};
                // Foreach of the locale lenguages, set the translations
                lenguages.forEach(function (language) {
                  translations.forEach(function (translation) {
                    if (translation.data && translation.data[language.code]) {
                      if (!result[language.code]) {
                        result[language.code] = {};
                      }
                      result[language.code][translation.data.label] = translation.data[language.code];
                    }

                    if (translation.data && translation.data.label) {
                      result['label'][translation.data.label] = translation.data.label;
                    }
                  });
                });

                return _context7.abrupt('return', result);

              case 5:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, _this7);
      }))();
    },
    updateLabel: function updateLabel(label, translation) {
      var _this8 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
        var trans, id, newTranslations, result;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return _this8.remote().where('data.label', '=', label).first();

              case 2:
                trans = _context8.sent;
                id = trans._id;
                newTranslations = _extends({}, trans.data, translation);
                _context8.next = 7;
                return _this8.remote().update({
                  _id: id,
                  data: newTranslations
                });

              case 7:
                result = _context8.sent;
                return _context8.abrupt('return', result);

              case 9:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, _this8);
      }))();
    },
    createTranslation: function createTranslation(label) {
      var _this9 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                return _context9.abrupt('return', _this9.remote().insert({
                  data: {
                    en: label,
                    label: label
                  }
                }));

              case 1:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, _this9);
      }))();
    }
  }
})();

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _goatFluent = __webpack_require__(3);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _awaitToJs = __webpack_require__(6);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: "Pages",
    config: {
      remote: {
        path: "fast-app-pages",
        token: undefined
      }
    }
  },
  methods: {
    /**
     * Decides whether to set submissions
     * Online or Offline
     * @param {Object} config.appConfig The application Config
     * @param {Boolean} config.forceOnline If we need online
     */
    set: function set(_ref) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var appConf = _ref.appConf,
            forceOnline = _ref.forceOnline;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (forceOnline) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt("return", _this.setOffline({ appConf: appConf }));

              case 2:
                return _context.abrupt("return", _this.setOnline());

              case 3:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },

    /**
     * Sets all pages from the offline
     * JSON files
     * @param {Object} appConfig Application config
     * @return {Object} App pages
     */
    setOffline: function setOffline(_ref2) {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var appConf = _ref2.appConf;
        var localPages, localDate, config, offlinePages, p, i;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _this2.local().first();

              case 2:
                localPages = _context2.sent;
                localDate = _this2.getUpdatedDate(localPages);
                _context2.next = 6;
                return _Configuration2.default.local().first();

              case 6:
                config = _context2.sent;
                offlinePages = _utilities2.default.get(function () {
                  return appConf.offlineFiles.Pages[0].data;
                });

                // Check if pages follows new or legacy format

                if (!offlinePages.hasOwnProperty("pages")) {
                  p = [];


                  for (i = 0; i < appConf.offlineFiles.Pages.length; i += 1) {
                    p.push(appConf.offlineFiles.Pages[i].data);
                  }

                  offlinePages = {
                    pages: p,
                    submit: true
                  };
                }

                // If the configuration in the JSON file is
                // older than the one in the local DB

                if (!(config.fastUpdated < localDate)) {
                  _context2.next = 11;
                  break;
                }

                return _context2.abrupt("return", _utilities2.default.get(function () {
                  return localPages.data;
                }));

              case 11:
                if (!localPages) {
                  _context2.next = 14;
                  break;
                }

                _context2.next = 14;
                return _this2.local().clear({ sure: true });

              case 14:
                return _context2.abrupt("return", _this2.local().insert(_extends({}, offlinePages, {
                  fastUpdated: (0, _dayjs2.default)().unix()
                })));

              case 15:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },

    /**
     * Sets all pages from the online
     * JSON files
     * @return {Object} App pages
     */
    setOnline: function setOnline() {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var localPages, _ref3, _ref4, error, pages, p, i;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _this3.local().first();

              case 2:
                localPages = _context3.sent;
                _context3.next = 5;
                return (0, _awaitToJs2.default)(_this3.remote().limit(9999999).get());

              case 5:
                _ref3 = _context3.sent;
                _ref4 = _slicedToArray(_ref3, 2);
                error = _ref4[0];
                pages = _ref4[1];

                if (!error) {
                  _context3.next = 12;
                  break;
                }

                console.log(error);
                throw new Error("Could not get remote Pages.");

              case 12:

                // Check if pages follows new or legacy format
                if (!pages[0].data.hasOwnProperty("pages")) {
                  p = [];


                  for (i = 0; i < pages.length; i += 1) {
                    p.push(pages[i].data);
                  }

                  pages = {
                    pages: p,
                    submit: true
                  };
                } else {
                  pages = _utilities2.default.get(function () {
                    return pages[0].data;
                  });
                }

                // If we pulled the remote pages and
                // The submission is not empty

                if (!(pages && !_utilities2.default.isEmpty(pages))) {
                  _context3.next = 18;
                  break;
                }

                if (!localPages) {
                  _context3.next = 17;
                  break;
                }

                _context3.next = 17;
                return _this3.local().clear({ sure: true });

              case 17:
                return _context3.abrupt("return", _this3.local().insert(_extends({}, pages, { fastUpdated: (0, _dayjs2.default)().unix() })));

              case 18:
                return _context3.abrupt("return", localPages);

              case 19:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },

    /**
     * Takes the local pages and gets the
     * updated at date
     *
     * @param {Array} pages Array of local pages
     * @returns {number} date las updated
     */
    getUpdatedDate: function getUpdatedDate(pages) {
      return _utilities2.default.get(function () {
        return pages.fastUpdated;
      }, 0);
    }
  }
})();

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _axios = __webpack_require__(7);

var _axios2 = _interopRequireDefault(_axios);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _goatFluent = __webpack_require__(3);

var _Connection = __webpack_require__(8);

var _Connection2 = _interopRequireDefault(_Connection);

var _awaitToJs = __webpack_require__(6);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: 'User',
    config: {
      remote: {
        path: 'user',
        token: undefined
      }
    }
  },
  methods: {
    storeLocally: function storeLocally(user) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var localUser, isUserAlreadyStored, _ref, _ref2, error, onlineUser;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _this.local().where('data.email', '=', user.data.email).first();

              case 2:
                localUser = _context.sent;


                user = _utilities2.default.deleteNulls(user);
                isUserAlreadyStored = !!localUser && !_utilities2.default.isEmpty(localUser);

                //  check if user is already present in local storage

                if (!isUserAlreadyStored) {
                  _context.next = 7;
                  break;
                }

                throw new Error('The user email is already taken');

              case 7:
                if (!_Connection2.default.isOnline()) {
                  _context.next = 17;
                  break;
                }

                _context.next = 10;
                return (0, _awaitToJs2.default)(_Form2.default.getModel({ path: 'userregister' }).remote().insert(user));

              case 10:
                _ref = _context.sent;
                _ref2 = _slicedToArray(_ref, 2);
                error = _ref2[0];
                onlineUser = _ref2[1];

                if (!error) {
                  _context.next = 16;
                  break;
                }

                throw new Error('The user email is already taken');

              case 16:
                return _context.abrupt('return', _this.local().insert(onlineUser));

              case 17:
                return _context.abrupt('return', _this.local().insert(user));

              case 18:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },
    updateUser: function updateUser(user) {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var localUser;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _this2.local().where('data.email', '=', user.data.email).pluck('_id');

              case 2:
                localUser = _context3.sent;


                localUser.forEach(function () {
                  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(_id) {
                    return regeneratorRuntime.wrap(function _callee2$(_context2) {
                      while (1) {
                        switch (_context2.prev = _context2.next) {
                          case 0:
                            _context2.next = 2;
                            return _this2.local().remove(_id);

                          case 2:
                          case 'end':
                            return _context2.stop();
                        }
                      }
                    }, _callee2, _this2);
                  }));

                  return function (_x) {
                    return _ref3.apply(this, arguments);
                  };
                }());

                user = _utilities2.default.deleteNulls(user);

                return _context3.abrupt('return', _this2.local().insert(user));

              case 6:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this2);
      }))();
    },
    login: function login(_ref4) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var credentials = _ref4.credentials,
            role = _ref4.role;
        var url;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return _Configuration2.default.local().first();

              case 2:
                url = _context4.sent.APP_URL;


                if (role === 'admin') {
                  url = url + '/admin/login';
                } else {
                  url = url + '/user/login';
                }
                return _context4.abrupt('return', _axios2.default.post(url, {
                  data: credentials
                }));

              case 5:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this3);
      }))();
    }
  }
})();

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

var utils = __webpack_require__(1);
var normalizeHeaderName = __webpack_require__(47);

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = __webpack_require__(25);
  } else if (typeof process !== 'undefined') {
    // For node use HTTP adapter
    adapter = __webpack_require__(25);
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(21)))

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _it = __webpack_require__(17);

var _it2 = _interopRequireDefault(_it);

var _Formio = __webpack_require__(66);

var _Formio2 = _interopRequireDefault(_Formio);

var _Keycloak = __webpack_require__(68);

var _Keycloak2 = _interopRequireDefault(_Keycloak);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _it2.default)({
  init: function init(_ref) {
    var baseUrl = _ref.baseUrl;

    this.baseUrl = baseUrl;
  },

  properties: {
    default: "Formio",
    baseUrl: undefined,
    connectors: {
      Formio: _Formio2.default,
      Keycloak: _Keycloak2.default
    }
  },
  methods: {
    getConnector: function getConnector(connector) {
      return this.connectors[connector]({ baseUrl: this.baseUrl });
    },
    connector: function connector(connectorName) {
      if (!connectorName) return this.getConnector(this.default);

      return this.getConnector(connectorName);
    }
  }
});

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

var compose = __webpack_require__(29);
var Shortcut = __webpack_require__(64);
var isStamp = __webpack_require__(31);
var isString = __webpack_require__(65);
var isObject = __webpack_require__(11);
var isFunction = __webpack_require__(18);
var merge = __webpack_require__(33);
var assign = __webpack_require__(32);

var concat = Array.prototype.concat;
function extractFunctions() {
  var fns = concat.apply([], arguments).filter(isFunction);
  return fns.length === 0 ? undefined : fns;
}

function standardiseDescriptor(descr) {
  if (!isObject(descr)) return descr;

  var methods = descr.methods;
  var properties = descr.properties;
  var props = descr.props;
  var initializers = descr.initializers;
  var init = descr.init;
  var composers = descr.composers;
  var deepProperties = descr.deepProperties;
  var deepProps = descr.deepProps;
  var pd = descr.propertyDescriptors;
  var staticProperties = descr.staticProperties;
  var statics = descr.statics;
  var staticDeepProperties = descr.staticDeepProperties;
  var deepStatics = descr.deepStatics;
  var configuration = descr.configuration;
  var conf = descr.conf;
  var deepConfiguration = descr.deepConfiguration;
  var deepConf = descr.deepConf;

  var p = isObject(props) || isObject(properties) ?
    assign({}, props, properties) : undefined;

  var dp = isObject(deepProps) ? merge({}, deepProps) : undefined;
  dp = isObject(deepProperties) ? merge(dp, deepProperties) : dp;

  var sp = isObject(statics) || isObject(staticProperties) ?
    assign({}, statics, staticProperties) : undefined;

  var sdp = isObject(deepStatics) ? merge({}, deepStatics) : undefined;
  sdp = isObject(staticDeepProperties) ? merge(sdp, staticDeepProperties) : sdp;

  var spd = descr.staticPropertyDescriptors;
  if (isString(descr.name)) spd = assign({}, spd || {}, { name: { value: descr.name } });

  var c = isObject(conf) || isObject(configuration) ?
    assign({}, conf, configuration) : undefined;

  var dc = isObject(deepConf) ? merge({}, deepConf) : undefined;
  dc = isObject(deepConfiguration) ? merge(dc, deepConfiguration) : dc;

  var ii = extractFunctions(init, initializers);

  var cc = extractFunctions(composers);

  var descriptor = {};
  if (methods) descriptor.methods = methods;
  if (p) descriptor.properties = p;
  if (ii) descriptor.initializers = ii;
  if (cc) descriptor.composers = cc;
  if (dp) descriptor.deepProperties = dp;
  if (sp) descriptor.staticProperties = sp;
  if (sdp) descriptor.staticDeepProperties = sdp;
  if (pd) descriptor.propertyDescriptors = pd;
  if (spd) descriptor.staticPropertyDescriptors = spd;
  if (c) descriptor.configuration = c;
  if (dc) descriptor.deepConfiguration = dc;

  return descriptor;
}

function stampit() {
  'use strict'; // to make sure `this` is not pointing to `global` or `window`
  var length = arguments.length, args = [];
  for (var i = 0; i < length; i += 1) {
    var arg = arguments[i];
    args.push(isStamp(arg) ? arg : standardiseDescriptor(arg));
  }

  return compose.apply(this || baseStampit, args); // jshint ignore:line
}

var baseStampit = Shortcut.compose({
  staticProperties: {
    create: function () { return this.apply(this, arguments); },
    compose: stampit // infecting
  }
});

var shortcuts = Shortcut.compose.staticProperties;
for (var prop in shortcuts) stampit[prop] = shortcuts[prop].bind(baseStampit);
stampit.compose = stampit.bind();

module.exports = stampit;


/***/ }),
/* 18 */
/***/ (function(module, exports) {

module.exports = function isFunction(arg) {
  return typeof arg === 'function';
};


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _goatFluent = __webpack_require__(3);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Connection = __webpack_require__(8);

var _Connection2 = _interopRequireDefault(_Connection);

var _awaitToJs = __webpack_require__(6);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _goatFluent.Fluent.model({
  properties: {
    name: 'Role',
    config: {
      remote: {
        path: 'access',
        token: undefined,
        pullForm: true
      }
    }
  },
  methods: {
    set: function set(_ref) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var url = _ref.url,
            appConf = _ref.appConf,
            forceOnline = _ref.forceOnline;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (forceOnline) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt('return', _this.setOffline({ appConf: appConf }));

              case 2:
                return _context.abrupt('return', _this.setOnline({ url: url }));

              case 3:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },
    getRolesDate: function getRolesDate(localRoles) {
      return _utilities2.default.get(function () {
        return localRoles.fastUpdated;
      }, 0);
    },
    setOnline: function setOnline() {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var error, remoteRoles, localRoles, isOnline, _ref2, _ref3, insertedRoles;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                error = void 0;
                remoteRoles = void 0;
                _context2.next = 4;
                return _this2.local().first();

              case 4:
                localRoles = _context2.sent;
                _context2.next = 7;
                return _Connection2.default.isOnline();

              case 7:
                isOnline = _context2.sent;

                if (!isOnline) {
                  _context2.next = 17;
                  break;
                }

                _context2.next = 11;
                return (0, _awaitToJs2.default)(_this2.remote().first());

              case 11:
                _ref2 = _context2.sent;
                _ref3 = _slicedToArray(_ref2, 2);
                error = _ref3[0];
                remoteRoles = _ref3[1];

                if (!error) {
                  _context2.next = 17;
                  break;
                }

                throw new Error(error);

              case 17:

                remoteRoles = _utilities2.default.get(function () {
                  return remoteRoles.roles;
                });

                if (!remoteRoles) {
                  _context2.next = 27;
                  break;
                }

                if (!localRoles) {
                  _context2.next = 22;
                  break;
                }

                _context2.next = 22;
                return _this2.local().clear();

              case 22:
                remoteRoles.fastUpdated = (0, _dayjs2.default)().unix();

                _context2.next = 25;
                return _this2.local().insert(remoteRoles);

              case 25:
                insertedRoles = _context2.sent;
                return _context2.abrupt('return', insertedRoles);

              case 27:
                return _context2.abrupt('return', localRoles);

              case 28:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },
    setOffline: function setOffline(_ref4) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var appConf = _ref4.appConf;
        var localRoles, rolesDate, offlineRolesDate, insertedRoles;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _this3.local().first();

              case 2:
                localRoles = _context3.sent;
                rolesDate = _this3.getRolesDate(localRoles);
                offlineRolesDate = appConf.offlineFiles.lastUpdated.date;

                if (!(offlineRolesDate > rolesDate || !localRoles)) {
                  _context3.next = 13;
                  break;
                }

                if (!localRoles) {
                  _context3.next = 9;
                  break;
                }

                _context3.next = 9;
                return _this3.local().clear();

              case 9:
                _context3.next = 11;
                return _this3.local().insert(appConf.offlineFiles.Roles);

              case 11:
                insertedRoles = _context3.sent;
                return _context3.abrupt('return', insertedRoles);

              case 13:
                return _context3.abrupt('return', localRoles);

              case 14:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    }
  }
})();

/***/ }),
/* 20 */
/***/ (function(module, exports) {

module.exports = function(module) {
	if (!module.webpackPolyfill) {
		module.deprecate = function() {};
		module.paths = [];
		// module.parent = undefined by default
		if (!module.children) module.children = [];
		Object.defineProperty(module, "loaded", {
			enumerable: true,
			get: function() {
				return module.l;
			}
		});
		Object.defineProperty(module, "id", {
			enumerable: true,
			get: function() {
				return module.i;
			}
		});
		module.webpackPolyfill = 1;
	}
	return module;
};


/***/ }),
/* 21 */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _User = __webpack_require__(14);

var _User2 = _interopRequireDefault(_User);

var _Auth = __webpack_require__(16);

var _Auth2 = _interopRequireDefault(_Auth);

var _Submission = __webpack_require__(10);

var _Submission2 = _interopRequireDefault(_Submission);

var _OfflineData = __webpack_require__(79);

var _OfflineData2 = _interopRequireDefault(_OfflineData);

var _Scheduler = __webpack_require__(39);

var _Scheduler2 = _interopRequireDefault(_Scheduler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Sync = function () {
  function Sync() {
    _classCallCheck(this, Sync);
  }

  _createClass(Sync, null, [{
    key: 'now',

    /**
     *
     * @param {*} vm
     */
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(vm) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return Sync.syncUsers();

              case 2:
                if (!(0, _Auth2.default)().connector().check()) {
                  _context.next = 5;
                  break;
                }

                _context.next = 5;
                return Sync.syncSubmission(vm);

              case 5:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function now(_x) {
        return _ref.apply(this, arguments);
      }

      return now;
    }()
    /**
     *
     * @param {*} db
     * @param {*} vm
     */

  }, {
    key: 'syncSubmission',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var usersAreSync, unsyncSubmissions, isSyncing;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return Sync.areUsersSynced();

              case 2:
                usersAreSync = _context2.sent;

                if (usersAreSync) {
                  _context2.next = 5;
                  break;
                }

                return _context2.abrupt('return');

              case 5:
                _context2.next = 7;
                return (0, _Submission2.default)().getUnsync();

              case 7:
                unsyncSubmissions = _context2.sent;
                _context2.next = 10;
                return _Scheduler2.default.isSyncing();

              case 10:
                isSyncing = _context2.sent;


                if (unsyncSubmissions.length > 0 && !isSyncing) {
                  _OfflineData2.default.send(unsyncSubmissions);
                }

              case 12:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function syncSubmission() {
        return _ref2.apply(this, arguments);
      }

      return syncSubmission;
    }()
    /**
     *
     */

  }, {
    key: 'getUsersToSync',
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _User2.default.local().where('sync', '=', false).andWhere('queuedForSync', '=', false).andWhere('syncError', '=', false).get();

              case 2:
                return _context3.abrupt('return', _context3.sent);

              case 3:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function getUsersToSync() {
        return _ref3.apply(this, arguments);
      }

      return getUsersToSync;
    }()
    /**
     *
     */

  }, {
    key: 'areUsersSynced',
    value: function () {
      var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var users;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return Sync.getUsersToSync();

              case 2:
                users = _context4.sent;
                return _context4.abrupt('return', !!users && Array.isArray(users) && users.length === 0);

              case 4:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function areUsersSynced() {
        return _ref4.apply(this, arguments);
      }

      return areUsersSynced;
    }()
    /**
     *
     * @param {*} param
     */

  }, {
    key: 'syncUsers',
    value: function () {
      var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var users, isSyncing;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return Sync.getUsersToSync();

              case 2:
                users = _context5.sent;
                _context5.next = 5;
                return _Scheduler2.default.isSyncing();

              case 5:
                isSyncing = _context5.sent;


                if (Array.isArray(users) && users.length > 0 && !isSyncing) {
                  _OfflineData2.default.syncUsers(users);
                }

              case 7:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function syncUsers() {
        return _ref5.apply(this, arguments);
      }

      return syncUsers;
    }()
  }]);

  return Sync;
}();

exports.default = Sync;

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};


/***/ }),
/* 24 */
/***/ (function(module, exports) {

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);
var settle = __webpack_require__(48);
var buildURL = __webpack_require__(50);
var parseHeaders = __webpack_require__(51);
var isURLSameOrigin = __webpack_require__(52);
var createError = __webpack_require__(26);
var btoa = (typeof window !== 'undefined' && window.btoa && window.btoa.bind(window)) || __webpack_require__(53);

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();
    var loadEvent = 'onreadystatechange';
    var xDomain = false;

    // For IE 8/9 CORS support
    // Only supports POST and GET calls and doesn't returns the response headers.
    // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
    if ( true &&
        typeof window !== 'undefined' &&
        window.XDomainRequest && !('withCredentials' in request) &&
        !isURLSameOrigin(config.url)) {
      request = new window.XDomainRequest();
      loadEvent = 'onload';
      xDomain = true;
      request.onprogress = function handleProgress() {};
      request.ontimeout = function handleTimeout() {};
    }

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request[loadEvent] = function handleLoad() {
      if (!request || (request.readyState !== 4 && !xDomain)) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        // IE sends 1223 instead of 204 (https://github.com/axios/axios/issues/201)
        status: request.status === 1223 ? 204 : request.status,
        statusText: request.status === 1223 ? 'No Content' : request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = __webpack_require__(54);

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
          cookies.read(config.xsrfCookieName) :
          undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var enhanceError = __webpack_require__(49);

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};


/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

var isArray = __webpack_require__(30);
var isFunction = __webpack_require__(18);
var isObject = __webpack_require__(11);
var isStamp = __webpack_require__(31);
var isComposable = __webpack_require__(62);

var assign = __webpack_require__(32);
var merge = __webpack_require__(33);

var slice = Array.prototype.slice;

/**
 * Creates new factory instance.
 * @returns {Function} The new factory function.
 */
function createFactory() {
  return function Stamp(options) {
    var descriptor = Stamp.compose || {};
    // Next line was optimized for most JS VMs. Please, be careful here!
    var obj = {__proto__: descriptor.methods}; // jshint ignore:line

    merge(obj, descriptor.deepProperties);
    assign(obj, descriptor.properties);
    Object.defineProperties(obj, descriptor.propertyDescriptors || {});

    if (!descriptor.initializers || descriptor.initializers.length === 0) return obj;

    if (options === undefined) options = {};
    var inits = descriptor.initializers;
    var length = inits.length;
    for (var i = 0; i < length; i += 1) {
      var initializer = inits[i];
      if (isFunction(initializer)) {
        var returnedValue = initializer.call(obj, options,
          {instance: obj, stamp: Stamp, args: slice.apply(arguments)});
        obj = returnedValue === undefined ? obj : returnedValue;
      }
    }

    return obj;
  };
}

/**
 * Returns a new stamp given a descriptor and a compose function implementation.
 * @param {Descriptor} [descriptor={}] The information about the object the stamp will be creating.
 * @param {Compose} composeFunction The "compose" function implementation.
 * @returns {Stamp}
 */
function createStamp(descriptor, composeFunction) {
  var Stamp = createFactory();

  if (descriptor.staticDeepProperties) {
    merge(Stamp, descriptor.staticDeepProperties);
  }
  if (descriptor.staticProperties) {
    assign(Stamp, descriptor.staticProperties);
  }
  if (descriptor.staticPropertyDescriptors) {
    Object.defineProperties(Stamp, descriptor.staticPropertyDescriptors);
  }

  var composeImplementation = isFunction(Stamp.compose) ? Stamp.compose : composeFunction;
  Stamp.compose = function _compose() {
    'use strict'; // to make sure `this` is not pointing to `global` or `window`
    return composeImplementation.apply(this, arguments);
  };
  assign(Stamp.compose, descriptor);

  return Stamp;
}

function concatAssignFunctions(dstObject, srcArray, propName) {
  if (!isArray(srcArray)) return;

  var length = srcArray.length;
  var dstArray = dstObject[propName] || [];
  dstObject[propName] = dstArray;
  for (var i = 0; i < length; i += 1) {
    var fn = srcArray[i];
    if (isFunction(fn) && dstArray.indexOf(fn) < 0) {
      dstArray.push(fn);
    }
  }
}


function combineProperties(dstObject, srcObject, propName, action) {
  if (!isObject(srcObject[propName])) return;
  if (!isObject(dstObject[propName])) dstObject[propName] = {};
  action(dstObject[propName], srcObject[propName]);
}

function deepMergeAssign(dstObject, srcObject, propName) {
  combineProperties(dstObject, srcObject, propName, merge);
}
function mergeAssign(dstObject, srcObject, propName) {
  combineProperties(dstObject, srcObject, propName, assign);
}

/**
 * Mutates the dstDescriptor by merging the srcComposable data into it.
 * @param {Descriptor} dstDescriptor The descriptor object to merge into.
 * @param {Composable} [srcComposable] The composable
 * (either descriptor or stamp) to merge data form.
 */
function mergeComposable(dstDescriptor, srcComposable) {
  var srcDescriptor = (srcComposable && srcComposable.compose) || srcComposable;

  mergeAssign(dstDescriptor, srcDescriptor, 'methods');
  mergeAssign(dstDescriptor, srcDescriptor, 'properties');
  deepMergeAssign(dstDescriptor, srcDescriptor, 'deepProperties');
  mergeAssign(dstDescriptor, srcDescriptor, 'propertyDescriptors');
  mergeAssign(dstDescriptor, srcDescriptor, 'staticProperties');
  deepMergeAssign(dstDescriptor, srcDescriptor, 'staticDeepProperties');
  mergeAssign(dstDescriptor, srcDescriptor, 'staticPropertyDescriptors');
  mergeAssign(dstDescriptor, srcDescriptor, 'configuration');
  deepMergeAssign(dstDescriptor, srcDescriptor, 'deepConfiguration');
  concatAssignFunctions(dstDescriptor, srcDescriptor.initializers, 'initializers');
  concatAssignFunctions(dstDescriptor, srcDescriptor.composers, 'composers');
}

/**
 * Given the list of composables (stamp descriptors and stamps) returns
 * a new stamp (composable factory function).
 * @typedef {Function} Compose
 * @param {...(Composable)} [arguments] The list of composables.
 * @returns {Stamp} A new stamp (aka composable factory function)
 */
module.exports = function compose() {
  'use strict'; // to make sure `this` is not pointing to `global` or `window`
  var descriptor = {};
  var composables = [];
  if (isComposable(this)) {
    mergeComposable(descriptor, this);
    composables.push(this);
  }

  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    if (isComposable(arg)) {
      mergeComposable(descriptor, arg);
      composables.push(arg);
    }
  }

  var stamp = createStamp(descriptor, compose);

  var composers = descriptor.composers;
  if (isArray(composers) && composers.length > 0) {
    for (var j = 0; j < composers.length; j += 1) {
      var composer = composers[j];
      var returnedValue = composer({stamp: stamp, composables: composables});
      stamp = isStamp(returnedValue) ? returnedValue : stamp;
    }
  }

  return stamp;
};


/**
 * The Stamp Descriptor
 * @typedef {Function|Object} Descriptor
 * @returns {Stamp} A new stamp based on this Stamp
 * @property {Object} [methods] Methods or other data used as object instances' prototype
 * @property {Array<Function>} [initializers] List of initializers called for each object instance
 * @property {Array<Function>} [composers] List of callbacks called each time a composition happens
 * @property {Object} [properties] Shallow assigned properties of object instances
 * @property {Object} [deepProperties] Deeply merged properties of object instances
 * @property {Object} [staticProperties] Shallow assigned properties of Stamps
 * @property {Object} [staticDeepProperties] Deeply merged properties of Stamps
 * @property {Object} [configuration] Shallow assigned properties of Stamp arbitrary metadata
 * @property {Object} [deepConfiguration] Deeply merged properties of Stamp arbitrary metadata
 * @property {Object} [propertyDescriptors] ES5 Property Descriptors applied to object instances
 * @property {Object} [staticPropertyDescriptors] ES5 Property Descriptors applied to Stamps
 */

/**
 * The Stamp factory function
 * @typedef {Function} Stamp
 * @returns {*} Instantiated object
 * @property {Descriptor} compose - The Stamp descriptor and composition function
 */

/**
 * A composable object - stamp or descriptor
 * @typedef {Stamp|Descriptor} Composable
 */



/***/ }),
/* 30 */
/***/ (function(module, exports) {

module.exports = Array.isArray;


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

var isFunction = __webpack_require__(18);

module.exports = function isStamp(arg) {
  return isFunction(arg) && isFunction(arg.compose);
};


/***/ }),
/* 32 */
/***/ (function(module, exports) {

module.exports = Object.assign;


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

var isPlainObject = __webpack_require__(63);
var isObject = __webpack_require__(11);
var isArray = __webpack_require__(30);

/**
 * The 'src' argument plays the command role.
 * The returned values is always of the same type as the 'src'.
 * @param dst The object to merge into
 * @param src The object to merge from
 * @returns {*}
 */
function mergeOne(dst, src) {
  if (src === undefined) return dst;

  // According to specification arrays must be concatenated.
  // Also, the '.concat' creates a new array instance. Overrides the 'dst'.
  if (isArray(src)) return (isArray(dst) ? dst : []).concat(src);

  // Now deal with non plain 'src' object. 'src' overrides 'dst'
  // Note that functions are also assigned! We do not deep merge functions.
  if (!isPlainObject(src)) return src;

  // See if 'dst' is allowed to be mutated.
  // If not - it's overridden with a new plain object.
  var returnValue = isObject(dst) ? dst : {};

  var keys = Object.keys(src);
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];

    var srcValue = src[key];
    // Do not merge properties with the 'undefined' value.
    if (srcValue !== undefined) {
      var dstValue = returnValue[key];
      // Recursive calls to mergeOne() must allow only plain objects or arrays in dst
      var newDst = isPlainObject(dstValue) || isArray(srcValue) ? dstValue : {};

      // deep merge each property. Recursion!
      returnValue[key] = mergeOne(newDst, srcValue);
    }
  }

  return returnValue;
}

module.exports = function (dst) {
  for (var i = 1; i < arguments.length; i++) {
    dst = mergeOne(dst, arguments[i]);
  }
  return dst;
};


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

(function(){
  var crypt = __webpack_require__(67),
      utf8 = __webpack_require__(35).utf8,
      isBuffer = __webpack_require__(24),
      bin = __webpack_require__(35).bin,

  // The core
  md5 = function (message, options) {
    // Convert to byte array
    if (message.constructor == String)
      if (options && options.encoding === 'binary')
        message = bin.stringToBytes(message);
      else
        message = utf8.stringToBytes(message);
    else if (isBuffer(message))
      message = Array.prototype.slice.call(message, 0);
    else if (!Array.isArray(message))
      message = message.toString();
    // else, assume byte array already

    var m = crypt.bytesToWords(message),
        l = message.length * 8,
        a =  1732584193,
        b = -271733879,
        c = -1732584194,
        d =  271733878;

    // Swap endian
    for (var i = 0; i < m.length; i++) {
      m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
             ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
    }

    // Padding
    m[l >>> 5] |= 0x80 << (l % 32);
    m[(((l + 64) >>> 9) << 4) + 14] = l;

    // Method shortcuts
    var FF = md5._ff,
        GG = md5._gg,
        HH = md5._hh,
        II = md5._ii;

    for (var i = 0; i < m.length; i += 16) {

      var aa = a,
          bb = b,
          cc = c,
          dd = d;

      a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
      d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
      c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
      b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
      a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
      d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
      c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
      b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
      a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
      d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
      c = FF(c, d, a, b, m[i+10], 17, -42063);
      b = FF(b, c, d, a, m[i+11], 22, -1990404162);
      a = FF(a, b, c, d, m[i+12],  7,  1804603682);
      d = FF(d, a, b, c, m[i+13], 12, -40341101);
      c = FF(c, d, a, b, m[i+14], 17, -1502002290);
      b = FF(b, c, d, a, m[i+15], 22,  1236535329);

      a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
      d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
      c = GG(c, d, a, b, m[i+11], 14,  643717713);
      b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
      a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
      d = GG(d, a, b, c, m[i+10],  9,  38016083);
      c = GG(c, d, a, b, m[i+15], 14, -660478335);
      b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
      a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
      d = GG(d, a, b, c, m[i+14],  9, -1019803690);
      c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
      b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
      a = GG(a, b, c, d, m[i+13],  5, -1444681467);
      d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
      c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
      b = GG(b, c, d, a, m[i+12], 20, -1926607734);

      a = HH(a, b, c, d, m[i+ 5],  4, -378558);
      d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
      c = HH(c, d, a, b, m[i+11], 16,  1839030562);
      b = HH(b, c, d, a, m[i+14], 23, -35309556);
      a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
      d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
      c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
      b = HH(b, c, d, a, m[i+10], 23, -1094730640);
      a = HH(a, b, c, d, m[i+13],  4,  681279174);
      d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
      c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
      b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
      a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
      d = HH(d, a, b, c, m[i+12], 11, -421815835);
      c = HH(c, d, a, b, m[i+15], 16,  530742520);
      b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

      a = II(a, b, c, d, m[i+ 0],  6, -198630844);
      d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
      c = II(c, d, a, b, m[i+14], 15, -1416354905);
      b = II(b, c, d, a, m[i+ 5], 21, -57434055);
      a = II(a, b, c, d, m[i+12],  6,  1700485571);
      d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
      c = II(c, d, a, b, m[i+10], 15, -1051523);
      b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
      a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
      d = II(d, a, b, c, m[i+15], 10, -30611744);
      c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
      b = II(b, c, d, a, m[i+13], 21,  1309151649);
      a = II(a, b, c, d, m[i+ 4],  6, -145523070);
      d = II(d, a, b, c, m[i+11], 10, -1120210379);
      c = II(c, d, a, b, m[i+ 2], 15,  718787259);
      b = II(b, c, d, a, m[i+ 9], 21, -343485551);

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return crypt.endian([a, b, c, d]);
  };

  // Auxiliary functions
  md5._ff  = function (a, b, c, d, x, s, t) {
    var n = a + (b & c | ~b & d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._gg  = function (a, b, c, d, x, s, t) {
    var n = a + (b & d | c & ~d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._hh  = function (a, b, c, d, x, s, t) {
    var n = a + (b ^ c ^ d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._ii  = function (a, b, c, d, x, s, t) {
    var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };

  // Package private blocksize
  md5._blocksize = 16;
  md5._digestsize = 16;

  module.exports = function (message, options) {
    if (message === undefined || message === null)
      throw new Error('Illegal argument ' + message);

    var digestbytes = crypt.wordsToBytes(md5(message, options));
    return options && options.asBytes ? digestbytes :
        options && options.asString ? bin.bytesToString(digestbytes) :
        crypt.bytesToHex(digestbytes);
  };

})();


/***/ }),
/* 35 */
/***/ (function(module, exports) {

var charenc = {
  // UTF-8 encoding
  utf8: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
    }
  },

  // Binary encoding
  bin: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      for (var bytes = [], i = 0; i < str.length; i++)
        bytes.push(str.charCodeAt(i) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      for (var str = [], i = 0; i < bytes.length; i++)
        str.push(String.fromCharCode(bytes[i]));
      return str.join('');
    }
  }
};

module.exports = charenc;


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _it = __webpack_require__(17);

var _it2 = _interopRequireDefault(_it);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _it2.default)({
  methods: {
    user: function user() {
      throw new Error("user() method not implemented in this connector");
    },
    email: function email() {
      throw new Error("email() method not implemented in this connector");
    },
    hasRoleIn: function hasRoleIn() {
      throw new Error("hasRoleIn() method not implemented in this connector");
    },
    hasRoleIdIn: function hasRoleIdIn() {
      throw new Error("hasRoleIdIn() method not implemented in this connector");
    },
    hasRole: function hasRole() {
      throw new Error("hasRole() method not implemented in this connector");
    },
    check: function check() {
      throw new Error("check() method not implemented in this connector");
    },
    logOut: function logOut() {
      throw new Error("logOut() method not implemented in this connector");
    },
    attempt: function attempt(credentials, baseUrl, role) {
      throw new Error("authenticate() method not implemented in this connector");
    }
  }
});

/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var has = Object.prototype.hasOwnProperty;
var isArray = Array.isArray;

var hexTable = (function () {
    var array = [];
    for (var i = 0; i < 256; ++i) {
        array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
    }

    return array;
}());

var compactQueue = function compactQueue(queue) {
    while (queue.length > 1) {
        var item = queue.pop();
        var obj = item.obj[item.prop];

        if (isArray(obj)) {
            var compacted = [];

            for (var j = 0; j < obj.length; ++j) {
                if (typeof obj[j] !== 'undefined') {
                    compacted.push(obj[j]);
                }
            }

            item.obj[item.prop] = compacted;
        }
    }
};

var arrayToObject = function arrayToObject(source, options) {
    var obj = options && options.plainObjects ? Object.create(null) : {};
    for (var i = 0; i < source.length; ++i) {
        if (typeof source[i] !== 'undefined') {
            obj[i] = source[i];
        }
    }

    return obj;
};

var merge = function merge(target, source, options) {
    if (!source) {
        return target;
    }

    if (typeof source !== 'object') {
        if (isArray(target)) {
            target.push(source);
        } else if (target && typeof target === 'object') {
            if ((options && (options.plainObjects || options.allowPrototypes)) || !has.call(Object.prototype, source)) {
                target[source] = true;
            }
        } else {
            return [target, source];
        }

        return target;
    }

    if (!target || typeof target !== 'object') {
        return [target].concat(source);
    }

    var mergeTarget = target;
    if (isArray(target) && !isArray(source)) {
        mergeTarget = arrayToObject(target, options);
    }

    if (isArray(target) && isArray(source)) {
        source.forEach(function (item, i) {
            if (has.call(target, i)) {
                var targetItem = target[i];
                if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
                    target[i] = merge(targetItem, item, options);
                } else {
                    target.push(item);
                }
            } else {
                target[i] = item;
            }
        });
        return target;
    }

    return Object.keys(source).reduce(function (acc, key) {
        var value = source[key];

        if (has.call(acc, key)) {
            acc[key] = merge(acc[key], value, options);
        } else {
            acc[key] = value;
        }
        return acc;
    }, mergeTarget);
};

var assign = function assignSingleSource(target, source) {
    return Object.keys(source).reduce(function (acc, key) {
        acc[key] = source[key];
        return acc;
    }, target);
};

var decode = function (str, decoder, charset) {
    var strWithoutPlus = str.replace(/\+/g, ' ');
    if (charset === 'iso-8859-1') {
        // unescape never throws, no try...catch needed:
        return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
    }
    // utf-8
    try {
        return decodeURIComponent(strWithoutPlus);
    } catch (e) {
        return strWithoutPlus;
    }
};

var encode = function encode(str, defaultEncoder, charset) {
    // This code was originally written by Brian White (mscdex) for the io.js core querystring library.
    // It has been adapted here for stricter adherence to RFC 3986
    if (str.length === 0) {
        return str;
    }

    var string = typeof str === 'string' ? str : String(str);

    if (charset === 'iso-8859-1') {
        return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
            return '%26%23' + parseInt($0.slice(2), 16) + '%3B';
        });
    }

    var out = '';
    for (var i = 0; i < string.length; ++i) {
        var c = string.charCodeAt(i);

        if (
            c === 0x2D // -
            || c === 0x2E // .
            || c === 0x5F // _
            || c === 0x7E // ~
            || (c >= 0x30 && c <= 0x39) // 0-9
            || (c >= 0x41 && c <= 0x5A) // a-z
            || (c >= 0x61 && c <= 0x7A) // A-Z
        ) {
            out += string.charAt(i);
            continue;
        }

        if (c < 0x80) {
            out = out + hexTable[c];
            continue;
        }

        if (c < 0x800) {
            out = out + (hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        if (c < 0xD800 || c >= 0xE000) {
            out = out + (hexTable[0xE0 | (c >> 12)] + hexTable[0x80 | ((c >> 6) & 0x3F)] + hexTable[0x80 | (c & 0x3F)]);
            continue;
        }

        i += 1;
        c = 0x10000 + (((c & 0x3FF) << 10) | (string.charCodeAt(i) & 0x3FF));
        out += hexTable[0xF0 | (c >> 18)]
            + hexTable[0x80 | ((c >> 12) & 0x3F)]
            + hexTable[0x80 | ((c >> 6) & 0x3F)]
            + hexTable[0x80 | (c & 0x3F)];
    }

    return out;
};

var compact = function compact(value) {
    var queue = [{ obj: { o: value }, prop: 'o' }];
    var refs = [];

    for (var i = 0; i < queue.length; ++i) {
        var item = queue[i];
        var obj = item.obj[item.prop];

        var keys = Object.keys(obj);
        for (var j = 0; j < keys.length; ++j) {
            var key = keys[j];
            var val = obj[key];
            if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
                queue.push({ obj: obj, prop: key });
                refs.push(val);
            }
        }
    }

    compactQueue(queue);

    return value;
};

var isRegExp = function isRegExp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var isBuffer = function isBuffer(obj) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }

    return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
};

var combine = function combine(a, b) {
    return [].concat(a, b);
};

module.exports = {
    arrayToObject: arrayToObject,
    assign: assign,
    combine: combine,
    compact: compact,
    decode: decode,
    encode: encode,
    isBuffer: isBuffer,
    isRegExp: isRegExp,
    merge: merge
};


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var replace = String.prototype.replace;
var percentTwenties = /%20/g;

module.exports = {
    'default': 'RFC3986',
    formatters: {
        RFC1738: function (value) {
            return replace.call(value, percentTwenties, '+');
        },
        RFC3986: function (value) {
            return value;
        }
    },
    RFC1738: 'RFC1738',
    RFC3986: 'RFC3986'
};


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FastIsSyncing = false;
var Scheduler = function () {
  function Scheduler() {
    _classCallCheck(this, Scheduler);
  }

  _createClass(Scheduler, null, [{
    key: "isSyncing",
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", FastIsSyncing);

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function isSyncing() {
        return _ref.apply(this, arguments);
      }

      return isSyncing;
    }()
  }, {
    key: "startSync",
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                FastIsSyncing = true;
                return _context2.abrupt("return", this.isSyncing());

              case 2:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function startSync() {
        return _ref2.apply(this, arguments);
      }

      return startSync;
    }()
  }, {
    key: "stopSync",
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                FastIsSyncing = false;
                return _context3.abrupt("return", this.isSyncing());

              case 2:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function stopSync() {
        return _ref3.apply(this, arguments);
      }

      return stopSync;
    }()
  }]);

  return Scheduler;
}();

exports.default = Scheduler;

/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Utilities = exports.Sync = exports.Hash = exports.Role = exports.OfflinePlugin = exports.User = exports.Import = exports.Translation = exports.Configuration = exports.ParallelSurvey = exports.Submission = exports.Pages = exports.Form = exports.Auth = exports.Connection = exports.GOAT = exports.Event = exports.Moment = undefined;

var _start = __webpack_require__(41);

var _start2 = _interopRequireDefault(_start);

var _Auth = __webpack_require__(16);

var _Auth2 = _interopRequireDefault(_Auth);

var _Connection = __webpack_require__(8);

var _Connection2 = _interopRequireDefault(_Connection);

var _Event = __webpack_require__(9);

var _Event2 = _interopRequireDefault(_Event);

var _moment = __webpack_require__(84);

var _moment2 = _interopRequireDefault(_moment);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

var _Pages = __webpack_require__(13);

var _Pages2 = _interopRequireDefault(_Pages);

var _Submission = __webpack_require__(10);

var _Submission2 = _interopRequireDefault(_Submission);

var _ParallelSurvey = __webpack_require__(85);

var _ParallelSurvey2 = _interopRequireDefault(_ParallelSurvey);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _Translation = __webpack_require__(12);

var _Translation2 = _interopRequireDefault(_Translation);

var _Import = __webpack_require__(89);

var _Import2 = _interopRequireDefault(_Import);

var _User = __webpack_require__(14);

var _User2 = _interopRequireDefault(_User);

var _offlinePlugin = __webpack_require__(90);

var _offlinePlugin2 = _interopRequireDefault(_offlinePlugin);

var _Role = __webpack_require__(19);

var _Role2 = _interopRequireDefault(_Role);

var _Hash = __webpack_require__(92);

var _Hash2 = _interopRequireDefault(_Hash);

var _Sync = __webpack_require__(22);

var _Sync2 = _interopRequireDefault(_Sync);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.Moment = _moment2.default;
exports.Event = _Event2.default;
exports.GOAT = _start2.default;
exports.Connection = _Connection2.default;
exports.Auth = _Auth2.default;
exports.Form = _Form2.default;
exports.Pages = _Pages2.default;
exports.Submission = _Submission2.default;
exports.ParallelSurvey = _ParallelSurvey2.default;
exports.Configuration = _Configuration2.default;
exports.Translation = _Translation2.default;
exports.Import = _Import2.default;
exports.User = _User2.default;
exports.OfflinePlugin = _offlinePlugin2.default;
exports.Role = _Role2.default;
exports.Hash = _Hash2.default;
exports.Sync = _Sync2.default;
exports.Utilities = _utilities2.default;

/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

var _Translation = __webpack_require__(12);

var _Translation2 = _interopRequireDefault(_Translation);

var _Pages = __webpack_require__(13);

var _Pages2 = _interopRequireDefault(_Pages);

var _SyncInterval = __webpack_require__(44);

var _SyncInterval2 = _interopRequireDefault(_SyncInterval);

var _Role = __webpack_require__(19);

var _Role2 = _interopRequireDefault(_Role);

var _goatFluent = __webpack_require__(3);

var _fluentLoki = __webpack_require__(80);

var _fluentLoki2 = _interopRequireDefault(_fluentLoki);

var _fluentFormio = __webpack_require__(81);

var _fluentFormio2 = _interopRequireDefault(_fluentFormio);

var _fluentLoopback = __webpack_require__(82);

var _fluentLoopback2 = _interopRequireDefault(_fluentLoopback);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Errors = __webpack_require__(83);

var _Errors2 = _interopRequireDefault(_Errors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/* eslint-disable no-unused-vars */
var GOAT = function () {
  /**
   * Loads all configuration for the GOAT app
   * This is the main start function and mandatory
   * to execute if you will use it!
   *
   * @param {*} conf
   * @param {*} conf.appConf Configuration of the App
   */
  var start = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_ref) {
      var appConf = _ref.appConf,
          forceOnline = _ref.forceOnline;
      var config, promises, results, appTranslations;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              console.log("Setting configura...tion!");
              _Errors2.default.interceptAxios();

              if (forceOnline) {
                _context.next = 6;
                break;
              }

              _context.next = 5;
              return _goatFluent.Fluent.config({
                REMOTE_CONNECTORS: [{
                  default: true,
                  name: "formio",
                  baseUrl: appConf.fluentFormioBaseUrl,
                  connector: _fluentFormio2.default
                }, {
                  name: "formioConfig",
                  baseUrl: appConf.appConfigUrl,
                  connector: _fluentFormio2.default
                }, {
                  name: "loopback",
                  baseUrl: appConf.loopbackBaseUrl,
                  connector: _fluentLoopback2.default
                }],
                LOCAL_CONNECTORS: [{
                  name: "loki",
                  connector: _fluentLoki2.default,
                  default: true
                }],
                MERGE_CONNECTORS: [{
                  default: true,
                  name: "formioLoki",
                  connector: _goatFluent.MergeConnector
                }]
              });

            case 5:
              _SyncInterval2.default.set(3000);

            case 6:
              _context.next = 8;
              return _Configuration2.default.set({ appConf: appConf, forceOnline: forceOnline });

            case 8:
              config = _context.sent;
              promises = [_Role2.default.set({ appConf: appConf, forceOnline: forceOnline }), _Pages2.default.set({ appConf: appConf, forceOnline: forceOnline }), _Form2.default.set({ appConf: appConf, forceOnline: forceOnline }), _Translation2.default.set({ appConf: appConf, forceOnline: forceOnline })];
              _context.next = 12;
              return Promise.all(promises);

            case 12:
              results = _context.sent;
              appTranslations = results[3];
              return _context.abrupt("return", {
                config: config,
                translations: appTranslations,
                defaultLanguage: _utilities2.default.getLanguage()
              });

            case 15:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function start(_x) {
      return _ref2.apply(this, arguments);
    };
  }();
  /**
   *
   * Triggers a full Online update of all Configuration,
   * Forms, Pages and Roles of the application
   *
   * @param {Object} conf
   * @param {Object} conf.appConf Configuration of the App
   * @returns
   */


  var sync = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(_ref3) {
      var appConf = _ref3.appConf;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              return _context2.abrupt("return", start({ appConf: appConf, forceOnline: true }));

            case 1:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    return function sync(_x2) {
      return _ref4.apply(this, arguments);
    };
  }();

  return Object.freeze({
    start: start,
    sync: sync
  });
}();

exports.default = GOAT;

/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Translation = __webpack_require__(12);

var _Translation2 = _interopRequireDefault(_Translation);

var _Pages = __webpack_require__(13);

var _Pages2 = _interopRequireDefault(_Pages);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FormLabels = function () {
  function FormLabels() {
    _classCallCheck(this, FormLabels);
  }

  _createClass(FormLabels, null, [{
    key: "get",

    /**
     *
     * @param {*} formNameFilter
     * @param {*} languageFilter
     */
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(forms, i18n) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", this.handle(forms, i18n));

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function get(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return get;
    }()
    /**
     *
     * @param {*} formNameFilter
     * @param {*} languageFilter
     */

  }, {
    key: "handle",
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(forms, i18n) {
        var labels, translations;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.fetchAllLabels(forms, i18n);

              case 2:
                labels = _context2.sent;
                _context2.next = 5;
                return _Translation2.default.local().first();

              case 5:
                translations = _context2.sent.data;


                // Merge labels and translations
                Object.keys(translations).forEach(function (languageCode) {
                  var translationsLabels = translations[languageCode];

                  Object.keys(translationsLabels).forEach(function (translationLabel) {
                    if (labels[translationLabel] && translationsLabels[translationLabel] && translationsLabels[translationLabel] !== "") {
                      labels[translationLabel].translations[languageCode] = translationsLabels[translationLabel];
                    }
                  });
                });

                return _context2.abrupt("return", labels);

              case 8:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function handle(_x3, _x4) {
        return _ref2.apply(this, arguments);
      }

      return handle;
    }()
    /**
     *  Fetches all Labels for the different
     *  types of labels inputs that the
     *  application has
     */

  }, {
    key: "fetchAllLabels",
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(forms, i18n) {
        var allLabels, formLabels, appLabels, pagesLabels;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                allLabels = {};


                forms = forms.map(function (form) {
                  return form.data;
                });

                formLabels = this.getFormLabels(forms);
                _context3.next = 5;
                return this.getAppLabels(i18n);

              case 5:
                appLabels = _context3.sent;


                allLabels = this.mergeLabels(formLabels, appLabels);

                _context3.t0 = this;
                _context3.next = 10;
                return _Pages2.default.local().first();

              case 10:
                _context3.t1 = _context3.sent;
                _context3.next = 13;
                return _context3.t0.getPagesLabels.call(_context3.t0, _context3.t1);

              case 13:
                pagesLabels = _context3.sent;


                allLabels = this.mergeLabels(allLabels, pagesLabels);

                return _context3.abrupt("return", allLabels);

              case 16:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fetchAllLabels(_x5, _x6) {
        return _ref3.apply(this, arguments);
      }

      return fetchAllLabels;
    }()
    /**
     * Given an Object with text labels and a label Object
     * to add. It checks if the label already exists or
     * creates it if needed
     * @param {Object} labels
     * @param {Object} label
     */

  }, {
    key: "createOrAdd",
    value: function createOrAdd(_ref4) {
      var labels = _ref4.labels,
          label = _ref4.label;

      var newObject = _extends({}, labels);

      if (!label) {
        return newObject;
      }

      // If the label already exists
      if (newObject[label.text]) {
        // If the location is an Array of Locations
        if (label.location && Array.isArray(label.location)) {
          label.location.forEach(function (l) {
            newObject[label.text].location.push({
              text: label.text,
              template: label.template,
              type: l.type,
              picture: l.picture
            });
          });
        } else {
          newObject[label.text].location.push(label);
        }
        // If the label does not exist
      } else {
        if (label.location && Array.isArray(label.location)) {
          newObject[label.text] = {
            location: [],
            template: label.template,
            translations: {}
          };
          label.location.forEach(function (l) {
            newObject[label.text].location.push({
              text: label.text,
              template: label.template,
              type: l.type,
              picture: l.picture
            });
          });
        } else {
          newObject[label.text] = {
            location: [label],
            translations: {}
          };
        }
      }
      return newObject;
    }
    /**
     * Merges 2 different sets of translations into
     * a single one with no repeted elements
     *
     * @param {Object} labelsObject1
     * @param {Object} labelsObject2
     */

  }, {
    key: "mergeLabels",
    value: function mergeLabels(labelsObject1, labelsObject2) {
      var _this = this;

      var merged = _extends({}, labelsObject1);

      Object.keys(labelsObject2).forEach(function (key) {
        merged = _this.createOrAdd({
          labels: merged,
          label: _extends({}, labelsObject2[key], {
            text: key
          })
        });
      });
      return merged;
    }
    /**
     * Extracts all labels that could potentially
     * be translated from the Form.io forms
     * @param {Array} Forms
     */

  }, {
    key: "getFormLabels",
    value: function getFormLabels(Forms) {
      var _this2 = this;

      var extrapolateTranslations = function extrapolateTranslations(text) {
        // The following regex captures all Form.io template interpolations using the
        // formio component's instance i18n translation function (https://regexr.com/43sfm).
        // Warning: the "positive lookbehind" (?<=) feature may not be available for all browsers.
        // const regex = /(?<=\{\{\s*?instance.t\(\s*?[\'|\"])(.*?)(?=([\'|\"]\s*?\))(\s*?)\}\})/g;
        var regex = /\{\{\s*?instance.t\(\s*?[\'|\"](.*?)(?=([\'|\"]\s*?\))\s*?\}\})/g;
        var matched = [];
        var match = regex.exec(text);
        // Loop through all matches
        while (match !== null) {
          matched.push(match[0].replace(/.*?instance\.t\(\s*[\'|\"']/, "").trim());
          match = regex.exec(text);
        }
        return matched;
      };

      var componentLabels = {};
      // Extract all labels for all available forms

      var formioLabelsPositions = ["suffix", "prefix", "addAnother", "removeRow", "saveRow", "legend", "title", "label", "placeholder", "errorLabel"];

      Forms.forEach(function (form) {
        // Add title of the Forms to the translations
        componentLabels = _this2.createOrAdd({
          labels: componentLabels,
          label: {
            text: form.title,
            type: "formTitle",
            component: form.path,
            form: form.path,
            picture: null
          }
        });
        // Go across every component
        _utilities2.default.eachComponent(form.components, function (component) {
          // Check for the common translated Items listed above
          formioLabelsPositions.forEach(function (position) {
            if (component[position] && component[position] !== "") {
              // Add the Label if is not empty
              componentLabels = _this2.createOrAdd({
                labels: componentLabels,
                label: {
                  text: component[position],
                  type: position,
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              });
            }
          });

          // Check for components that have tooltips
          if (component.tooltip) {
            var texts = extrapolateTranslations(component.tooltip);

            if (texts.length === 0) {
              texts.push(component.tooltip);
            }

            texts.forEach(function (text) {
              componentLabels = _this2.createOrAdd({
                labels: componentLabels,
                label: {
                  text: text,
                  type: "tooltip",
                  component: component.key,
                  form: form.path,
                  picture: null
                }
              });
            });
          }

          // Check for components that have values with labels (i.e: radio)
          if (component.values) {
            component.values.forEach(function (value) {
              if (value.label && value.label !== "") {
                componentLabels = _this2.createOrAdd({
                  labels: componentLabels,
                  label: {
                    text: value.label,
                    type: "value",
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                });
              }
            });
          }

          // Check for html text in HTML or Content components
          if (component.type === "htmlelement" || component.type === "content") {
            var html = (component.content || component.html || "").trim();

            if (html !== "") {
              var _texts = extrapolateTranslations(html);
              // If no interpolation found check if content is simple text (no html string)
              if (_texts.length === 0 && !/<[a-z][\s\S]*>/i.test(html)) {
                _texts.push(html);
              }
              // Create a label for each match (if none, don't anything)
              _texts.forEach(function (text) {
                // Omit empty text strings
                if (text !== "") {
                  componentLabels = _this2.createOrAdd({
                    labels: componentLabels,
                    label: {
                      text: text,
                      type: "html",
                      component: component.key,
                      form: form.path,
                      picture: null
                    }
                  });
                }
              });
            }
          }

          // Check specificaly for select elements
          if (component.type === "select") {
            if (component.data && component.data.values) {
              component.data.values.forEach(function (value) {
                if (value.label && value.label !== "") {
                  componentLabels = _this2.createOrAdd({
                    labels: componentLabels,
                    label: {
                      text: value.label,
                      type: "selectValue",
                      component: component.key,
                      form: form.path,
                      picture: null
                    }
                  });
                }
              });
            }
          }

          // Check for survey elements
          if (component.type === "survey") {
            if (component.questions) {
              // Check for every question on the survey
              component.questions.forEach(function (q) {
                componentLabels = _this2.createOrAdd({
                  labels: componentLabels,
                  label: {
                    text: q.label,
                    type: "surveyLabel",
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                });
              });
              // Check every text of the answers
              component.values.forEach(function (v) {
                componentLabels = _this2.createOrAdd({
                  labels: componentLabels,
                  label: {
                    text: v.label,
                    type: "surveyValues",
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                });
              });
            }
          }

          // Check for Edit Grid component header and footer templates
          if (component.type === "editgrid" && component.templates) {
            var header = extrapolateTranslations(component.templates.header);
            var footer = extrapolateTranslations(component.templates.footer);

            // Create a label for each match (if none, don't anything)
            Array().concat(header, footer).forEach(function (text) {
              // Omit empty text strings
              if (text !== "") {
                componentLabels = _this2.createOrAdd({
                  labels: componentLabels,
                  label: {
                    text: text,
                    type: "editgrid",
                    component: component.key,
                    form: form.path,
                    picture: null
                  }
                });
              }
            });
          }
        }, true);
      });

      return componentLabels;
    }
    /**
     *  Creates the Labels Object for the
     *  App translations
     * @param {Array} appLabels
     */

  }, {
    key: "getAppLabels",
    value: function () {
      var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(appLabels) {
        var _this3 = this;

        var translations;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                translations = {};


                appLabels.forEach(function (l) {
                  translations = _this3.createOrAdd({
                    labels: translations,
                    label: l
                  });
                });

                return _context4.abrupt("return", translations);

              case 3:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function getAppLabels(_x7) {
        return _ref5.apply(this, arguments);
      }

      return getAppLabels;
    }()
    /**
     *  Creates the Labels Object for the
     *  App Pages
     * @param {Array} appLabels
     */

  }, {
    key: "getPagesLabels",
    value: function () {
      var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(Pages) {
        var _this4 = this;

        var pagesLabels;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                pagesLabels = {};


                Pages.pages.forEach(function (page) {
                  if (page.title && page.title !== "") {
                    pagesLabels = _this4.createOrAdd({
                      labels: pagesLabels,
                      label: {
                        text: page.title,
                        type: "pageTitle",
                        picture: null,
                        page: page
                      }
                    });
                  }
                  page.cards.forEach(function (card) {
                    if (card.title && card.title !== "") {
                      pagesLabels = _this4.createOrAdd({
                        labels: pagesLabels,
                        label: {
                          text: card.title,
                          type: "pageCardTitle",
                          picture: null,
                          card: card,
                          page: page
                        }
                      });
                    }

                    if (card.subtitle && card.subtitle !== "") {
                      _this4.createOrAdd({
                        labels: pagesLabels,
                        label: {
                          text: card.subtitle,
                          type: "pageCardSubtitle",
                          picture: null,
                          card: card,
                          page: page
                        }
                      });
                    }

                    card.actions.forEach(function (action) {
                      if (action.text && action.text !== "") {
                        pagesLabels = _this4.createOrAdd({
                          labels: pagesLabels,
                          label: {
                            text: action.text,
                            type: "pageActionButtonText",
                            picture: null,
                            card: card,
                            page: page
                          }
                        });
                      }
                    });
                  });
                });

                return _context5.abrupt("return", pagesLabels);

              case 3:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getPagesLabels(_x8) {
        return _ref6.apply(this, arguments);
      }

      return getPagesLabels;
    }()
  }]);

  return FormLabels;
}();

exports.default = FormLabels;

/***/ }),
/* 43 */
/***/ (function(module) {

module.exports = [{"code":"ab","direction":"ltr","label":"Abkhazian"},{"code":"aa","direction":"ltr","label":"Afar"},{"code":"af","direction":"ltr","label":"Afrikaans"},{"code":"ak","direction":"ltr","label":"Akan"},{"code":"sq","direction":"ltr","label":"Albanian"},{"code":"am","direction":"ltr","label":"Amharic"},{"code":"ar","direction":"rtl","label":"Arabic"},{"code":"an","direction":"ltr","label":"Aragonese"},{"code":"hy","direction":"ltr","label":"Armenian"},{"code":"as","direction":"ltr","label":"Assamese"},{"code":"av","direction":"ltr","label":"Avaric"},{"code":"ae","direction":"ltr","label":"Avestan"},{"code":"ay","direction":"ltr","label":"Aymara"},{"code":"az","direction":"ltr","label":"Azerbaijani"},{"code":"bm","direction":"ltr","label":"Bambara"},{"code":"ba","direction":"ltr","label":"Bashkir"},{"code":"eu","direction":"ltr","label":"Basque"},{"code":"be","direction":"ltr","label":"Belarusian"},{"code":"bn","direction":"ltr","label":"Bengali"},{"code":"bh","direction":"ltr","label":"Bihari languages"},{"code":"bi","direction":"ltr","label":"Bislama"},{"code":"bs","direction":"ltr","label":"Bosnian"},{"code":"br","direction":"ltr","label":"Breton"},{"code":"bg","direction":"ltr","label":"Bulgarian"},{"code":"my","direction":"ltr","label":"Burmese"},{"code":"ca","direction":"ltr","label":"Catalan, Valencian"},{"code":"km","direction":"ltr","label":"Central Khmer"},{"code":"ch","direction":"ltr","label":"Chamorro"},{"code":"ce","direction":"ltr","label":"Chechen"},{"code":"ny","direction":"ltr","label":"Chichewa"},{"code":"zh","direction":"ltr","label":"Chinese"},{"code":"cu","direction":"ltr","label":"Church Slavonic, Old Bulgarian, Old Church Slavonic"},{"code":"cv","direction":"ltr","label":"Chuvash"},{"code":"kw","direction":"ltr","label":"Cornish"},{"code":"co","direction":"ltr","label":"Corsican"},{"code":"cr","direction":"ltr","label":"Cree"},{"code":"hr","direction":"ltr","label":"Croatian"},{"code":"cs","direction":"ltr","label":"Czech"},{"code":"da","direction":"ltr","label":"Danish"},{"code":"dv","direction":"ltr","label":"Divehi, Dhivehi, Maldivian"},{"code":"nl","direction":"ltr","label":"Dutch, Flemish"},{"code":"dz","direction":"ltr","label":"Dzongkha"},{"code":"en","direction":"ltr","label":"English"},{"code":"eo","direction":"ltr","label":"Esperanto"},{"code":"et","direction":"ltr","label":"Estonian"},{"code":"ee","direction":"ltr","label":"Ewe"},{"code":"fo","direction":"ltr","label":"Faroese"},{"code":"fj","direction":"ltr","label":"Fijian"},{"code":"fi","direction":"ltr","label":"Finnish"},{"code":"fr","direction":"ltr","label":"French"},{"code":"ff","direction":"ltr","label":"Fulah"},{"code":"gd","direction":"ltr","label":"Gaelic, Scottish Gaelic"},{"code":"gl","direction":"ltr","label":"Galician"},{"code":"lg","direction":"ltr","label":"Ganda"},{"code":"ka","direction":"ltr","label":"Georgian"},{"code":"de","direction":"ltr","label":"German"},{"code":"ki","direction":"ltr","label":"Gikuyu, Kikuyu"},{"code":"el","direction":"ltr","label":"Greek (Modern)"},{"code":"kl","direction":"ltr","label":"Greenlandic, Kalaallisut"},{"code":"gn","direction":"ltr","label":"Guarani"},{"code":"gu","direction":"ltr","label":"Gujarati"},{"code":"ht","direction":"ltr","label":"Haitian, Haitian Creole"},{"code":"ha","direction":"ltr","label":"Hausa"},{"code":"he","direction":"ltr","label":"Hebrew"},{"code":"hz","direction":"ltr","label":"Herero"},{"code":"hi","direction":"ltr","label":"Hindi"},{"code":"ho","direction":"ltr","label":"Hiri Motu"},{"code":"hu","direction":"ltr","label":"Hungarian"},{"code":"is","direction":"ltr","label":"Icelandic"},{"code":"io","direction":"ltr","label":"Ido"},{"code":"ig","direction":"ltr","label":"Igbo"},{"code":"id","direction":"ltr","label":"Indonesian"},{"code":"ia","direction":"ltr","label":"Interlingua (International Auxiliary Language Association)"},{"code":"ie","direction":"ltr","label":"Interlingue"},{"code":"iu","direction":"ltr","label":"Inuktitut"},{"code":"ik","direction":"ltr","label":"Inupiaq"},{"code":"ga","direction":"ltr","label":"Irish"},{"code":"it","direction":"ltr","label":"Italian"},{"code":"ja","direction":"ltr","label":"Japanese"},{"code":"jv","direction":"ltr","label":"Javanese"},{"code":"kn","direction":"ltr","label":"Kannada"},{"code":"kr","direction":"ltr","label":"Kanuri"},{"code":"ks","direction":"ltr","label":"Kashmiri"},{"code":"kk","direction":"ltr","label":"Kazakh"},{"code":"rw","direction":"ltr","label":"Kinyarwanda"},{"code":"kv","direction":"ltr","label":"Komi"},{"code":"kg","direction":"ltr","label":"Kongo"},{"code":"ko","direction":"ltr","label":"Korean"},{"code":"kj","direction":"ltr","label":"Kwanyama, Kuanyama"},{"code":"ku","direction":"ltr","label":"Kurdish"},{"code":"ky","direction":"ltr","label":"Kyrgyz"},{"code":"lo","direction":"ltr","label":"Lao"},{"code":"la","direction":"ltr","label":"Latin"},{"code":"lv","direction":"ltr","label":"Latvian"},{"code":"lb","direction":"ltr","label":"Letzeburgesch, Luxembourgish"},{"code":"li","direction":"ltr","label":"Limburgish, Limburgan, Limburger"},{"code":"ln","direction":"ltr","label":"Lingala"},{"code":"lt","direction":"ltr","label":"Lithuanian"},{"code":"lu","direction":"ltr","label":"Luba-Katanga"},{"code":"mk","direction":"ltr","label":"Macedonian"},{"code":"mg","direction":"ltr","label":"Malagasy"},{"code":"ms","direction":"ltr","label":"Malay"},{"code":"ml","direction":"ltr","label":"Malayalam"},{"code":"mt","direction":"ltr","label":"Maltese"},{"code":"gv","direction":"ltr","label":"Manx"},{"code":"mi","direction":"ltr","label":"Maori"},{"code":"mr","direction":"ltr","label":"Marathi"},{"code":"mh","direction":"ltr","label":"Marshallese"},{"code":"ro","direction":"ltr","label":"Moldovan, Moldavian, Romanian"},{"code":"mn","direction":"ltr","label":"Mongolian"},{"code":"na","direction":"ltr","label":"Nauru"},{"code":"nv","direction":"ltr","label":"Navajo, Navaho"},{"code":"nd","direction":"ltr","label":"Northern Ndebele"},{"code":"ng","direction":"ltr","label":"Ndonga"},{"code":"ne","direction":"ltr","label":"Nepali"},{"code":"se","direction":"ltr","label":"Northern Sami"},{"code":"no","direction":"ltr","label":"Norwegian"},{"code":"nb","direction":"ltr","label":"Norwegian Bokmål"},{"code":"nn","direction":"ltr","label":"Norwegian Nynorsk"},{"code":"ii","direction":"ltr","label":"Nuosu, Sichuan Yi"},{"code":"oc","direction":"ltr","label":"Occitan (post 1500)"},{"code":"oj","direction":"ltr","label":"Ojibwa"},{"code":"or","direction":"ltr","label":"Oriya"},{"code":"om","direction":"ltr","label":"Oromo"},{"code":"os","direction":"ltr","label":"Ossetian, Ossetic"},{"code":"pi","direction":"ltr","label":"Pali"},{"code":"pa","direction":"ltr","label":"Panjabi, Punjabi"},{"code":"ps","direction":"ltr","label":"Pashto, Pushto"},{"code":"fa","direction":"ltr","label":"Persian"},{"code":"pl","direction":"ltr","label":"Polish"},{"code":"pt","direction":"ltr","label":"Portuguese"},{"code":"qu","direction":"ltr","label":"Quechua"},{"code":"rm","direction":"ltr","label":"Romansh"},{"code":"rn","direction":"ltr","label":"Rundi"},{"code":"ru","direction":"ltr","label":"Russian"},{"code":"sm","direction":"ltr","label":"Samoan"},{"code":"sg","direction":"ltr","label":"Sango"},{"code":"sa","direction":"ltr","label":"Sanskrit"},{"code":"sc","direction":"ltr","label":"Sardinian"},{"code":"sr","direction":"ltr","label":"Serbian"},{"code":"sn","direction":"ltr","label":"Shona"},{"code":"sd","direction":"ltr","label":"Sindhi"},{"code":"si","direction":"ltr","label":"Sinhala, Sinhalese"},{"code":"sk","direction":"ltr","label":"Slovak"},{"code":"sl","direction":"ltr","label":"Slovenian"},{"code":"so","direction":"ltr","label":"Somali"},{"code":"st","direction":"ltr","label":"Sotho, Southern"},{"code":"nr","direction":"ltr","label":"South Ndebele"},{"code":"es","direction":"ltr","label":"Spanish"},{"code":"su","direction":"ltr","label":"Sundanese"},{"code":"sw","direction":"ltr","label":"Swahili"},{"code":"ss","direction":"ltr","label":"Swati"},{"code":"sv","direction":"ltr","label":"Swedish"},{"code":"tl","direction":"ltr","label":"Tagalog"},{"code":"ty","direction":"ltr","label":"Tahitian"},{"code":"tg","direction":"ltr","label":"Tajik"},{"code":"ta","direction":"ltr","label":"Tamil"},{"code":"tt","direction":"ltr","label":"Tatar"},{"code":"te","direction":"ltr","label":"Telugu"},{"code":"th","direction":"ltr","label":"Thai"},{"code":"bo","direction":"ltr","label":"Tibetan"},{"code":"ti","direction":"ltr","label":"Tigrinya"},{"code":"to","direction":"ltr","label":"Tonga (Tonga Islands)"},{"code":"ts","direction":"ltr","label":"Tsonga"},{"code":"tn","direction":"ltr","label":"Tswana"},{"code":"tr","direction":"ltr","label":"Turkish"},{"code":"tk","direction":"ltr","label":"Turkmen"},{"code":"tw","direction":"ltr","label":"Twi"},{"code":"ug","direction":"ltr","label":"Uighur, Uyghur"},{"code":"uk","direction":"ltr","label":"Ukrainian"},{"code":"umb","direction":"ltr","label":"Umbundu"},{"code":"ur","direction":"ltr","label":"Urdu"},{"code":"uz","direction":"ltr","label":"Uzbek"},{"code":"ve","direction":"ltr","label":"Venda"},{"code":"vi","direction":"ltr","label":"Vietnamese"},{"code":"vo","direction":"ltr","label":"Volap_k"},{"code":"wa","direction":"ltr","label":"Walloon"},{"code":"cy","direction":"ltr","label":"Welsh"},{"code":"fy","direction":"ltr","label":"Western Frisian"},{"code":"wo","direction":"ltr","label":"Wolof"},{"code":"xh","direction":"ltr","label":"Xhosa"},{"code":"yi","direction":"ltr","label":"Yiddish"},{"code":"yo","direction":"ltr","label":"Yoruba"},{"code":"za","direction":"ltr","label":"Zhuang, Chuang"},{"code":"zu","direction":"ltr","label":"Zulu"}];

/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Sync = __webpack_require__(22);

var _Sync2 = _interopRequireDefault(_Sync);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var SyncInterval = function () {
  var set = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(milliseconds) {
      var rInterval, _debouncedSync;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              rInterval = function rInterval(callback, delay) {
                var dateNow = Date.now,
                    requestAnimation = typeof window !== 'undefined' && window.requestAnimationFrame,
                    start = dateNow(),
                    stop = void 0,
                    intervalFunc = function intervalFunc() {
                  // eslint-disable-next-line no-use-before-define
                  dateNow() - start < delay || (start += delay, callback());
                  // eslint-disable-next-line no-use-before-define
                  stop || requestAnimation(intervalFunc);
                };

                requestAnimation(intervalFunc);
                return {
                  clear: function clear() {
                    stop = 1;
                  }
                };
              };

              _debouncedSync = _utilities2.default.debounce(_Sync2.default.now, 2000);


              rInterval(_debouncedSync, milliseconds);

            case 3:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function set(_x) {
      return _ref.apply(this, arguments);
    };
  }();

  return Object.freeze({
    set: set
  });
}();

exports.default = SyncInterval;

/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);
var bind = __webpack_require__(23);
var Axios = __webpack_require__(46);
var defaults = __webpack_require__(15);

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(utils.merge(defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = __webpack_require__(28);
axios.CancelToken = __webpack_require__(60);
axios.isCancel = __webpack_require__(27);

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = __webpack_require__(61);

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var defaults = __webpack_require__(15);
var utils = __webpack_require__(1);
var InterceptorManager = __webpack_require__(55);
var dispatchRequest = __webpack_require__(56);

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, {method: 'get'}, this.defaults, config);
  config.method = config.method.toLowerCase();

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var createError = __webpack_require__(26);

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  // Note: status is not exposed by XDomainRequest
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }
  error.request = request;
  error.response = response;
  return error;
};


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};


/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function E() {
  this.message = 'String contains an invalid character';
}
E.prototype = new Error;
E.prototype.code = 5;
E.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new E();
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);
var transformData = __webpack_require__(57);
var isCancel = __webpack_require__(27);
var defaults = __webpack_require__(15);
var isAbsoluteURL = __webpack_require__(58);
var combineURLs = __webpack_require__(59);

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};


/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(1);

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var Cancel = __webpack_require__(28);

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;


/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};


/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

// More proper implementation would be
// isDescriptor(obj) || isStamp(obj)
// but there is no sense since stamp is function and function is object.
module.exports = __webpack_require__(11);


/***/ }),
/* 63 */
/***/ (function(module, exports) {

module.exports = function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype;
};


/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

var compose = __webpack_require__(29);

function createShortcut(propName) {
  return function (arg) {
    'use strict';
    var param = {};
    param[propName] = arg;
    return this && this.compose ? this.compose(param) : compose(param);
  };
}

var properties = createShortcut('properties');
var staticProperties = createShortcut('staticProperties');
var configuration = createShortcut('configuration');
var deepProperties = createShortcut('deepProperties');
var staticDeepProperties = createShortcut('staticDeepProperties');
var deepConfiguration = createShortcut('deepConfiguration');
var initializers = createShortcut('initializers');

module.exports = compose({
  staticProperties: {
    methods: createShortcut('methods'),

    props: properties,
    properties: properties,

    statics: staticProperties,
    staticProperties: staticProperties,

    conf: configuration,
    configuration: configuration,

    deepProps: deepProperties,
    deepProperties: deepProperties,

    deepStatics: staticDeepProperties,
    staticDeepProperties: staticDeepProperties,

    deepConf: deepConfiguration,
    deepConfiguration: deepConfiguration,

    init: initializers,
    initializers: initializers,

    composers: createShortcut('composers'),

    propertyDescriptors: createShortcut('propertyDescriptors'),

    staticPropertyDescriptors: createShortcut('staticPropertyDescriptors')
  }
});


/***/ }),
/* 65 */
/***/ (function(module, exports) {

module.exports = function isString(arg) {
  return typeof arg === 'string';
};


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _md = __webpack_require__(34);

var _md2 = _interopRequireDefault(_md);

var _AuthInterface = __webpack_require__(36);

var _AuthInterface2 = _interopRequireDefault(_AuthInterface);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

var _User = __webpack_require__(14);

var _User2 = _interopRequireDefault(_User);

var _Connection = __webpack_require__(8);

var _Connection2 = _interopRequireDefault(_Connection);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Role = __webpack_require__(19);

var _Role2 = _interopRequireDefault(_Role);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }
// import Promise from 'bluebird';


exports.default = _AuthInterface2.default.compose({
  methods: {
    /**
     *
     *
     * @param {any} credentials
     * @returns
     */
    localAuthenticate: function localAuthenticate(credentials) {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var username, password, config, hashedPassword, dbUser, userFound, isValidUser;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                username = credentials.username, password = credentials.password;
                _context.next = 3;
                return _Configuration2.default.local().first();

              case 3:
                config = _context.sent;


                // Hash password
                hashedPassword = (0, _md2.default)(password, config.MD5_KEY);

                // Get the user

                _context.next = 7;
                return _User2.default.local().where('data.username', '=', username).get();

              case 7:
                dbUser = _context.sent;
                userFound = dbUser && dbUser[0] ? dbUser[0] : undefined;

                if (userFound) {
                  _context.next = 11;
                  break;
                }

                throw new Error();

              case 11:
                // Compare hashed passwords
                isValidUser = userFound.data.hashedPassword === hashedPassword;

                if (isValidUser) {
                  _context.next = 14;
                  break;
                }

                throw new Error();

              case 14:
                return _context.abrupt('return', userFound);

              case 15:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },

    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    remoteAuthenticate: function remoteAuthenticate(credentials, role) {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var response, user;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _User2.default.login({ credentials: credentials, role: role });

              case 2:
                response = _context2.sent;
                user = response.data;
                _context2.next = 6;
                return _User2.default.updateUser(user);

              case 6:
                return _context2.abrupt('return', response);

              case 7:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },

    /**
     *
     * Authenticates the User with the given credentials
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    authenticate: function authenticate(credentials, role) {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var isOnline;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _Connection2.default.isOnline();

              case 2:
                isOnline = _context3.sent;

                if (!isOnline) {
                  _context3.next = 5;
                  break;
                }

                return _context3.abrupt('return', _this3.remoteAuthenticate(credentials, role));

              case 5:
                return _context3.abrupt('return', _this3.localAuthenticate(credentials));

              case 6:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },

    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    attempt: function attempt(credentials, role) {
      var _this4 = this;

      role = role || 'user';

      return new Promise(function (resolve, reject) {
        _this4.authenticate(credentials, role)
        // If credentials are OK
        .then(function () {
          var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(response) {
            var headers, user, roles;
            return regeneratorRuntime.wrap(function _callee4$(_context4) {
              while (1) {
                switch (_context4.prev = _context4.next) {
                  case 0:
                    headers = response.headers || {};
                    user = response.data;
                    /* eslint-disable*/

                    user.x_jwt_token = headers['x-jwt-token'];
                    /* eslint-enable*/

                    // Save auth user
                    localStorage.setItem('authUser', JSON.stringify(user));
                    localStorage.setItem('formioToken', headers['x-jwt-token']);
                    // user.isAdmin = true
                    _context4.next = 7;
                    return _Role2.default.local().first();

                  case 7:
                    roles = _context4.sent;


                    user.rolesNames = [];
                    Object.keys(roles).forEach(function (key) {
                      if (key !== '$loki' && key !== '_id' && key !== 'meta') {
                        if (user.roles && user.roles.indexOf(roles[key]._id) !== -1) {
                          user.rolesNames.push(roles[key]);
                        }
                      }
                    });

                    localStorage.setItem('authUser', JSON.stringify(user));

                    resolve(user);

                  case 12:
                  case 'end':
                    return _context4.stop();
                }
              }
            }, _callee4, _this4);
          }));

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        }())
        // If there are errors
        .catch(function (error) {
          console.log('There was an error over here!');
          reject(error);
        });
      });
    },

    /**
     *
     *
     * @returns
     */
    user: function user() {
      try {
        var user = JSON.parse(localStorage.getItem('authUser'));

        return user === null ? false : user;
      } catch (e) {
        localStorage.removeItem('authUser');
        return false;
      }
    },

    /**
     *
     *
     * @returns
     */
    email: function email() {
      var email = '';

      if (this.user() && this.user().data && this.user().data.email) {
        email = this.user().data.email;
      } else if (this.user() && this.user().email) {
        email = this.user().email;
      }
      return email;
    },

    /**
     *
     *
     * @param {any} roleName
     * @returns
     */
    hasRole: function hasRole(roleName) {
      var user = JSON.parse(localStorage.getItem('authUser'));

      user = user === null ? false : user;

      var result = user.rolesNames.find(function (r) {
        return r.title === roleName;
      });

      return typeof result !== 'undefined';
    },

    /**
     *
     *
     * @param {any} roles
     * @returns
     */

    hasRoleIn: function hasRoleIn(roles) {
      var _this5 = this;

      if (!roles || _utilities2.default.isEmpty(roles)) {
        return true;
      }
      return roles.some(function (role) {
        return _this5.hasRole(role) || role === 'Authenticated';
      });
    },

    /**
     *
     *
     * @param {any} rolesIds
     * @returns
     */
    hasRoleIdIn: function hasRoleIdIn(rolesIds) {
      var _this6 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var appRoles, roles;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                if (!(!rolesIds || _utilities2.default.isEmpty(rolesIds))) {
                  _context5.next = 2;
                  break;
                }

                return _context5.abrupt('return', true);

              case 2:
                _context5.next = 4;
                return _Role2.default.local().first();

              case 4:
                appRoles = _context5.sent;
                roles = rolesIds.reduce(function (reducer, roleId) {
                  Object.keys(appRoles).forEach(function (role) {
                    if (appRoles[role] && appRoles[role]._id && appRoles[role]._id === roleId) {
                      reducer.push(appRoles[role].title);
                    }
                  });
                  return reducer;
                }, []);
                return _context5.abrupt('return', roles.some(function (role) {
                  return _this6.hasRole(role) || role === 'Authenticated';
                }));

              case 7:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this6);
      }))();
    },

    /**
     * Checks if the current user is
     * Authenticated
     * @return {boolean}
     */
    check: function check() {
      var user = JSON.parse(localStorage.getItem('authUser'));

      return !!user && !!user.x_jwt_token;
    },

    /**
     * Logs out autheticated user
     *
     */
    logOut: function logOut() {
      var _this7 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return localStorage.removeItem('authUser');

              case 2:
                _context6.next = 4;
                return localStorage.removeItem('formioToken');

              case 4:
                _context6.next = 6;
                return localStorage.removeItem('formioUser');

              case 6:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, _this7);
      }))();
    }
  }
});

/***/ }),
/* 67 */
/***/ (function(module, exports) {

(function() {
  var base64map
      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  crypt = {
    // Bit-wise rotation left
    rotl: function(n, b) {
      return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotation right
    rotr: function(n, b) {
      return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function(n) {
      // If number given, swap endian
      if (n.constructor == Number) {
        return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
      }

      // Else, assume array and swap all items
      for (var i = 0; i < n.length; i++)
        n[i] = crypt.endian(n[i]);
      return n;
    },

    // Generate an array of any length of random bytes
    randomBytes: function(n) {
      for (var bytes = []; n > 0; n--)
        bytes.push(Math.floor(Math.random() * 256));
      return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function(bytes) {
      for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
      return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function(words) {
      for (var bytes = [], b = 0; b < words.length * 32; b += 8)
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function(bytes) {
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join('');
    },

    // Convert a hex string to a byte array
    hexToBytes: function(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function(bytes) {
      for (var base64 = [], i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        for (var j = 0; j < 4; j++)
          if (i * 8 + j * 6 <= bytes.length * 8)
            base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
          else
            base64.push('=');
      }
      return base64.join('');
    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function(base64) {
      // Remove non-base-64 characters
      base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

      for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
          imod4 = ++i % 4) {
        if (imod4 == 0) continue;
        bytes.push(((base64map.indexOf(base64.charAt(i - 1))
            & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
            | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
      }
      return bytes;
    }
  };

  module.exports = crypt;
})();


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _it = __webpack_require__(17);

var _it2 = _interopRequireDefault(_it);

var _qs = __webpack_require__(69);

var _qs2 = _interopRequireDefault(_qs);

var _btoa = __webpack_require__(72);

var _btoa2 = _interopRequireDefault(_btoa);

var _axios = __webpack_require__(7);

var _axios2 = _interopRequireDefault(_axios);

var _AuthInterface = __webpack_require__(36);

var _AuthInterface2 = _interopRequireDefault(_AuthInterface);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = _AuthInterface2.default.compose({
  init: function init(_ref) {
    var baseUrl = _ref.baseUrl;

    this.url.baseUrl = baseUrl;
  },

  properties: {
    url: {
      baseUrl: undefined,
      loginUrl: '/realms/users/protocol/openid-connect/token',
      logoutUrl: '/realms/users/protocol/openid-connect/logout'
    },
    serviceAccount: {
      clientId: 'goat-client',
      secretId: '4ec6a304-2377-4d55-bf3f-ca32b97ec600'
    }
  },
  methods: {
    checkUrl: function checkUrl() {
      if (this.url.baseUrl) return this.url.baseUrl;

      throw new Error('No url found for Keycloak connector');
    },
    logout: function logout() {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var url, result;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                url = '' + _this.url.baseUrl + _this.url.loginUrl;
                _context.next = 3;
                return fetch(url, {
                  method: 'POST',
                  body: _qs2.default.stringify({
                    client_id: _this.serviceAccount.clientId,
                    refresh_token: localStorage.getItem('refreshToken')
                  }),
                  headers: {
                    'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                  }
                });

              case 3:
                result = _context.sent;


                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');

              case 6:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }))();
    },
    refreshServiceAccount: function refreshServiceAccount() {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var url, query, result;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                url = '' + _this2.url.baseUrl + _this2.url.loginUrl;
                _context2.next = 3;
                return fetch(url, {
                  method: 'POST',
                  body: _qs2.default.stringify({
                    client_id: _this2.serviceAccount.clientId,
                    grant_type: 'refresh_token',
                    refresh_token: localStorage.getItem('refreshToken')
                  }),
                  headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                  }
                });

              case 3:
                query = _context2.sent;
                _context2.next = 6;
                return query.json();

              case 6:
                result = _context2.sent;


                localStorage.setItem('token', result.access_token);
                localStorage.setItem('refreshToken', result.refresh_token);

              case 9:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this2);
      }))();
    },
    loginServiceAccount: function loginServiceAccount() {
      var _this3 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var url, auth, query, result;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                url = '' + _this3.url.baseUrl + _this3.url.loginUrl;
                auth = (0, _btoa2.default)(_this3.serviceAccount.clientId + ':' + _this3.serviceAccount.secretId);
                _context3.next = 4;
                return fetch(url, {
                  method: 'POST',
                  body: _qs2.default.stringify({
                    'grant_type': 'client_credentials'
                  }),
                  headers: {
                    'Authorization': 'Basic ' + auth,
                    'Content-Type': 'application/x-www-form-urlencoded'
                  }
                });

              case 4:
                query = _context3.sent;
                _context3.next = 7;
                return query.json();

              case 7:
                result = _context3.sent;


                localStorage.setItem('token', result.access_token);
                localStorage.setItem('refreshToken', result.refresh_token);

              case 10:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this3);
      }))();
    },
    attempt: function attempt(credentials, role) {
      var _this4 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                console.log(_this4.url);
                _context4.next = 3;
                return _this4.loginServiceAccount();

              case 3:
                return _context4.abrupt('return', _this4.serviceAccount);

              case 4:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this4);
      }))();
    }
  }
});

/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var stringify = __webpack_require__(70);
var parse = __webpack_require__(71);
var formats = __webpack_require__(38);

module.exports = {
    formats: formats,
    parse: parse,
    stringify: stringify
};


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(37);
var formats = __webpack_require__(38);
var has = Object.prototype.hasOwnProperty;

var arrayPrefixGenerators = {
    brackets: function brackets(prefix) { // eslint-disable-line func-name-matching
        return prefix + '[]';
    },
    comma: 'comma',
    indices: function indices(prefix, key) { // eslint-disable-line func-name-matching
        return prefix + '[' + key + ']';
    },
    repeat: function repeat(prefix) { // eslint-disable-line func-name-matching
        return prefix;
    }
};

var isArray = Array.isArray;
var push = Array.prototype.push;
var pushToArray = function (arr, valueOrArray) {
    push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray]);
};

var toISO = Date.prototype.toISOString;

var defaults = {
    addQueryPrefix: false,
    allowDots: false,
    charset: 'utf-8',
    charsetSentinel: false,
    delimiter: '&',
    encode: true,
    encoder: utils.encode,
    encodeValuesOnly: false,
    formatter: formats.formatters[formats['default']],
    // deprecated
    indices: false,
    serializeDate: function serializeDate(date) { // eslint-disable-line func-name-matching
        return toISO.call(date);
    },
    skipNulls: false,
    strictNullHandling: false
};

var stringify = function stringify( // eslint-disable-line func-name-matching
    object,
    prefix,
    generateArrayPrefix,
    strictNullHandling,
    skipNulls,
    encoder,
    filter,
    sort,
    allowDots,
    serializeDate,
    formatter,
    encodeValuesOnly,
    charset
) {
    var obj = object;
    if (typeof filter === 'function') {
        obj = filter(prefix, obj);
    } else if (obj instanceof Date) {
        obj = serializeDate(obj);
    } else if (generateArrayPrefix === 'comma' && isArray(obj)) {
        obj = obj.join(',');
    }

    if (obj === null) {
        if (strictNullHandling) {
            return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset) : prefix;
        }

        obj = '';
    }

    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || utils.isBuffer(obj)) {
        if (encoder) {
            var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset);
            return [formatter(keyValue) + '=' + formatter(encoder(obj, defaults.encoder, charset))];
        }
        return [formatter(prefix) + '=' + formatter(String(obj))];
    }

    var values = [];

    if (typeof obj === 'undefined') {
        return values;
    }

    var objKeys;
    if (isArray(filter)) {
        objKeys = filter;
    } else {
        var keys = Object.keys(obj);
        objKeys = sort ? keys.sort(sort) : keys;
    }

    for (var i = 0; i < objKeys.length; ++i) {
        var key = objKeys[i];

        if (skipNulls && obj[key] === null) {
            continue;
        }

        if (isArray(obj)) {
            pushToArray(values, stringify(
                obj[key],
                typeof generateArrayPrefix === 'function' ? generateArrayPrefix(prefix, key) : prefix,
                generateArrayPrefix,
                strictNullHandling,
                skipNulls,
                encoder,
                filter,
                sort,
                allowDots,
                serializeDate,
                formatter,
                encodeValuesOnly,
                charset
            ));
        } else {
            pushToArray(values, stringify(
                obj[key],
                prefix + (allowDots ? '.' + key : '[' + key + ']'),
                generateArrayPrefix,
                strictNullHandling,
                skipNulls,
                encoder,
                filter,
                sort,
                allowDots,
                serializeDate,
                formatter,
                encodeValuesOnly,
                charset
            ));
        }
    }

    return values;
};

var normalizeStringifyOptions = function normalizeStringifyOptions(opts) {
    if (!opts) {
        return defaults;
    }

    if (opts.encoder !== null && opts.encoder !== undefined && typeof opts.encoder !== 'function') {
        throw new TypeError('Encoder has to be a function.');
    }

    var charset = opts.charset || defaults.charset;
    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
        throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
    }

    var format = formats['default'];
    if (typeof opts.format !== 'undefined') {
        if (!has.call(formats.formatters, opts.format)) {
            throw new TypeError('Unknown format option provided.');
        }
        format = opts.format;
    }
    var formatter = formats.formatters[format];

    var filter = defaults.filter;
    if (typeof opts.filter === 'function' || isArray(opts.filter)) {
        filter = opts.filter;
    }

    return {
        addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
        allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
        charset: charset,
        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
        delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
        encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
        encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
        encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
        filter: filter,
        formatter: formatter,
        serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
        skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
        sort: typeof opts.sort === 'function' ? opts.sort : null,
        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
    };
};

module.exports = function (object, opts) {
    var obj = object;
    var options = normalizeStringifyOptions(opts);

    var objKeys;
    var filter;

    if (typeof options.filter === 'function') {
        filter = options.filter;
        obj = filter('', obj);
    } else if (isArray(options.filter)) {
        filter = options.filter;
        objKeys = filter;
    }

    var keys = [];

    if (typeof obj !== 'object' || obj === null) {
        return '';
    }

    var arrayFormat;
    if (opts && opts.arrayFormat in arrayPrefixGenerators) {
        arrayFormat = opts.arrayFormat;
    } else if (opts && 'indices' in opts) {
        arrayFormat = opts.indices ? 'indices' : 'repeat';
    } else {
        arrayFormat = 'indices';
    }

    var generateArrayPrefix = arrayPrefixGenerators[arrayFormat];

    if (!objKeys) {
        objKeys = Object.keys(obj);
    }

    if (options.sort) {
        objKeys.sort(options.sort);
    }

    for (var i = 0; i < objKeys.length; ++i) {
        var key = objKeys[i];

        if (options.skipNulls && obj[key] === null) {
            continue;
        }
        pushToArray(keys, stringify(
            obj[key],
            key,
            generateArrayPrefix,
            options.strictNullHandling,
            options.skipNulls,
            options.encode ? options.encoder : null,
            options.filter,
            options.sort,
            options.allowDots,
            options.serializeDate,
            options.formatter,
            options.encodeValuesOnly,
            options.charset
        ));
    }

    var joined = keys.join(options.delimiter);
    var prefix = options.addQueryPrefix === true ? '?' : '';

    if (options.charsetSentinel) {
        if (options.charset === 'iso-8859-1') {
            // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
            prefix += 'utf8=%26%2310003%3B&';
        } else {
            // encodeURIComponent('✓')
            prefix += 'utf8=%E2%9C%93&';
        }
    }

    return joined.length > 0 ? prefix + joined : '';
};


/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(37);

var has = Object.prototype.hasOwnProperty;

var defaults = {
    allowDots: false,
    allowPrototypes: false,
    arrayLimit: 20,
    charset: 'utf-8',
    charsetSentinel: false,
    comma: false,
    decoder: utils.decode,
    delimiter: '&',
    depth: 5,
    ignoreQueryPrefix: false,
    interpretNumericEntities: false,
    parameterLimit: 1000,
    parseArrays: true,
    plainObjects: false,
    strictNullHandling: false
};

var interpretNumericEntities = function (str) {
    return str.replace(/&#(\d+);/g, function ($0, numberStr) {
        return String.fromCharCode(parseInt(numberStr, 10));
    });
};

// This is what browsers will submit when the ✓ character occurs in an
// application/x-www-form-urlencoded body and the encoding of the page containing
// the form is iso-8859-1, or when the submitted form has an accept-charset
// attribute of iso-8859-1. Presumably also with other charsets that do not contain
// the ✓ character, such as us-ascii.
var isoSentinel = 'utf8=%26%2310003%3B'; // encodeURIComponent('&#10003;')

// These are the percent-encoded utf-8 octets representing a checkmark, indicating that the request actually is utf-8 encoded.
var charsetSentinel = 'utf8=%E2%9C%93'; // encodeURIComponent('✓')

var parseValues = function parseQueryStringValues(str, options) {
    var obj = {};
    var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, '') : str;
    var limit = options.parameterLimit === Infinity ? undefined : options.parameterLimit;
    var parts = cleanStr.split(options.delimiter, limit);
    var skipIndex = -1; // Keep track of where the utf8 sentinel was found
    var i;

    var charset = options.charset;
    if (options.charsetSentinel) {
        for (i = 0; i < parts.length; ++i) {
            if (parts[i].indexOf('utf8=') === 0) {
                if (parts[i] === charsetSentinel) {
                    charset = 'utf-8';
                } else if (parts[i] === isoSentinel) {
                    charset = 'iso-8859-1';
                }
                skipIndex = i;
                i = parts.length; // The eslint settings do not allow break;
            }
        }
    }

    for (i = 0; i < parts.length; ++i) {
        if (i === skipIndex) {
            continue;
        }
        var part = parts[i];

        var bracketEqualsPos = part.indexOf(']=');
        var pos = bracketEqualsPos === -1 ? part.indexOf('=') : bracketEqualsPos + 1;

        var key, val;
        if (pos === -1) {
            key = options.decoder(part, defaults.decoder, charset);
            val = options.strictNullHandling ? null : '';
        } else {
            key = options.decoder(part.slice(0, pos), defaults.decoder, charset);
            val = options.decoder(part.slice(pos + 1), defaults.decoder, charset);
        }

        if (val && options.interpretNumericEntities && charset === 'iso-8859-1') {
            val = interpretNumericEntities(val);
        }

        if (val && options.comma && val.indexOf(',') > -1) {
            val = val.split(',');
        }

        if (has.call(obj, key)) {
            obj[key] = utils.combine(obj[key], val);
        } else {
            obj[key] = val;
        }
    }

    return obj;
};

var parseObject = function (chain, val, options) {
    var leaf = val;

    for (var i = chain.length - 1; i >= 0; --i) {
        var obj;
        var root = chain[i];

        if (root === '[]' && options.parseArrays) {
            obj = [].concat(leaf);
        } else {
            obj = options.plainObjects ? Object.create(null) : {};
            var cleanRoot = root.charAt(0) === '[' && root.charAt(root.length - 1) === ']' ? root.slice(1, -1) : root;
            var index = parseInt(cleanRoot, 10);
            if (!options.parseArrays && cleanRoot === '') {
                obj = { 0: leaf };
            } else if (
                !isNaN(index)
                && root !== cleanRoot
                && String(index) === cleanRoot
                && index >= 0
                && (options.parseArrays && index <= options.arrayLimit)
            ) {
                obj = [];
                obj[index] = leaf;
            } else {
                obj[cleanRoot] = leaf;
            }
        }

        leaf = obj;
    }

    return leaf;
};

var parseKeys = function parseQueryStringKeys(givenKey, val, options) {
    if (!givenKey) {
        return;
    }

    // Transform dot notation to bracket notation
    var key = options.allowDots ? givenKey.replace(/\.([^.[]+)/g, '[$1]') : givenKey;

    // The regex chunks

    var brackets = /(\[[^[\]]*])/;
    var child = /(\[[^[\]]*])/g;

    // Get the parent

    var segment = brackets.exec(key);
    var parent = segment ? key.slice(0, segment.index) : key;

    // Stash the parent if it exists

    var keys = [];
    if (parent) {
        // If we aren't using plain objects, optionally prefix keys that would overwrite object prototype properties
        if (!options.plainObjects && has.call(Object.prototype, parent)) {
            if (!options.allowPrototypes) {
                return;
            }
        }

        keys.push(parent);
    }

    // Loop through children appending to the array until we hit depth

    var i = 0;
    while ((segment = child.exec(key)) !== null && i < options.depth) {
        i += 1;
        if (!options.plainObjects && has.call(Object.prototype, segment[1].slice(1, -1))) {
            if (!options.allowPrototypes) {
                return;
            }
        }
        keys.push(segment[1]);
    }

    // If there's a remainder, just add whatever is left

    if (segment) {
        keys.push('[' + key.slice(segment.index) + ']');
    }

    return parseObject(keys, val, options);
};

var normalizeParseOptions = function normalizeParseOptions(opts) {
    if (!opts) {
        return defaults;
    }

    if (opts.decoder !== null && opts.decoder !== undefined && typeof opts.decoder !== 'function') {
        throw new TypeError('Decoder has to be a function.');
    }

    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
        throw new Error('The charset option must be either utf-8, iso-8859-1, or undefined');
    }
    var charset = typeof opts.charset === 'undefined' ? defaults.charset : opts.charset;

    return {
        allowDots: typeof opts.allowDots === 'undefined' ? defaults.allowDots : !!opts.allowDots,
        allowPrototypes: typeof opts.allowPrototypes === 'boolean' ? opts.allowPrototypes : defaults.allowPrototypes,
        arrayLimit: typeof opts.arrayLimit === 'number' ? opts.arrayLimit : defaults.arrayLimit,
        charset: charset,
        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
        comma: typeof opts.comma === 'boolean' ? opts.comma : defaults.comma,
        decoder: typeof opts.decoder === 'function' ? opts.decoder : defaults.decoder,
        delimiter: typeof opts.delimiter === 'string' || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults.delimiter,
        depth: typeof opts.depth === 'number' ? opts.depth : defaults.depth,
        ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
        interpretNumericEntities: typeof opts.interpretNumericEntities === 'boolean' ? opts.interpretNumericEntities : defaults.interpretNumericEntities,
        parameterLimit: typeof opts.parameterLimit === 'number' ? opts.parameterLimit : defaults.parameterLimit,
        parseArrays: opts.parseArrays !== false,
        plainObjects: typeof opts.plainObjects === 'boolean' ? opts.plainObjects : defaults.plainObjects,
        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling
    };
};

module.exports = function (str, opts) {
    var options = normalizeParseOptions(opts);

    if (str === '' || str === null || typeof str === 'undefined') {
        return options.plainObjects ? Object.create(null) : {};
    }

    var tempObj = typeof str === 'string' ? parseValues(str, options) : str;
    var obj = options.plainObjects ? Object.create(null) : {};

    // Iterate over the keys and setup the new object

    var keys = Object.keys(tempObj);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var newObj = parseKeys(key, tempObj[key], options);
        obj = utils.merge(obj, newObj, options);
    }

    return utils.compact(obj);
};


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(Buffer) {(function () {
  "use strict";

  function btoa(str) {
    var buffer;

    if (str instanceof Buffer) {
      buffer = str;
    } else {
      buffer = Buffer.from(str.toString(), 'binary');
    }

    return buffer.toString('base64');
  }

  module.exports = btoa;
}());

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(73).Buffer))

/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(global) {/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */



var base64 = __webpack_require__(75)
var ieee754 = __webpack_require__(76)
var isArray = __webpack_require__(77)

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(74)))

/***/ }),
/* 74 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || new Function("return this")();
} catch (e) {
	// This works if the window reference is available
	if (typeof window === "object") g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}


/***/ }),
/* 76 */
/***/ (function(module, exports) {

exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}


/***/ }),
/* 77 */
/***/ (function(module, exports) {

var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};


/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Columns = function () {
  function Columns() {
    _classCallCheck(this, Columns);
  }

  _createClass(Columns, null, [{
    key: 'getTableView',
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(path) {
        var form;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _Form2.default.local().where('data.path', '=', path).first();

              case 2:
                form = _context.sent.data;
                return _context.abrupt('return', _utilities2.default.findComponents(form.components, {
                  input: true,
                  tableView: true
                }).filter(function (c) {
                  return !!(c.label !== '');
                }));

              case 4:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function getTableView(_x) {
        return _ref.apply(this, arguments);
      }

      return getTableView;
    }()
  }]);

  return Columns;
}();

exports.default = Columns;

/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _Connection = __webpack_require__(8);

var _Connection2 = _interopRequireDefault(_Connection);

var _Submission = __webpack_require__(10);

var _Submission2 = _interopRequireDefault(_Submission);

var _Event = __webpack_require__(9);

var _Event2 = _interopRequireDefault(_Event);

var _Scheduler = __webpack_require__(39);

var _Scheduler2 = _interopRequireDefault(_Scheduler);

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

var _awaitToJs = __webpack_require__(6);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var OfflineData = function () {
  var send = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(data) {
      var _this = this;

      var offlineSubmissions, isOnline, PromiseEach, _ref8, _ref9, error;

      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              offlineSubmissions = data;
              _context4.next = 3;
              return _Connection2.default.isOnline();

            case 3:
              isOnline = _context4.sent;

              PromiseEach = function () {
                var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(arr, fn) {
                  var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item;

                  return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                      switch (_context2.prev = _context2.next) {
                        case 0:
                          _iteratorNormalCompletion = true;
                          _didIteratorError = false;
                          _iteratorError = undefined;
                          _context2.prev = 3;
                          _iterator = arr[Symbol.iterator]();

                        case 5:
                          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                            _context2.next = 12;
                            break;
                          }

                          item = _step.value;
                          _context2.next = 9;
                          return fn(item);

                        case 9:
                          _iteratorNormalCompletion = true;
                          _context2.next = 5;
                          break;

                        case 12:
                          _context2.next = 18;
                          break;

                        case 14:
                          _context2.prev = 14;
                          _context2.t0 = _context2["catch"](3);
                          _didIteratorError = true;
                          _iteratorError = _context2.t0;

                        case 18:
                          _context2.prev = 18;
                          _context2.prev = 19;

                          if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                          }

                        case 21:
                          _context2.prev = 21;

                          if (!_didIteratorError) {
                            _context2.next = 24;
                            break;
                          }

                          throw _iteratorError;

                        case 24:
                          return _context2.finish(21);

                        case 25:
                          return _context2.finish(18);

                        case 26:
                        case "end":
                          return _context2.stop();
                      }
                    }
                  }, _callee2, this, [[3, 14, 18, 26], [19,, 21, 25]]);
                }));

                return function PromiseEach(_x3, _x4) {
                  return _ref7.apply(this, arguments);
                };
              }();

              if (!isOnline) {
                _context4.next = 17;
                break;
              }

              _context4.next = 8;
              return _Scheduler2.default.startSync();

            case 8:
              _context4.next = 10;
              return (0, _awaitToJs2.default)(PromiseEach(offlineSubmissions, function () {
                var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(offlineSubmission) {
                  return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                      switch (_context3.prev = _context3.next) {
                        case 0:
                          _context3.next = 2;
                          return sendSubmission(offlineSubmission);

                        case 2:
                        case "end":
                          return _context3.stop();
                      }
                    }
                  }, _callee3, _this);
                }));

                return function (_x5) {
                  return _ref10.apply(this, arguments);
                };
              }()));

            case 10:
              _ref8 = _context4.sent;
              _ref9 = _slicedToArray(_ref8, 1);
              error = _ref9[0];


              _Scheduler2.default.stopSync();
              if (error) {
                console.log(error);
              }

              console.log("Submissions Synced");
              _Event2.default.emit({
                name: "GOAT:SUBMISSION:SYNCED",
                data: {},
                text: "The submissions have been synced"
              });

            case 17:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this);
    }));

    return function send(_x2) {
      return _ref6.apply(this, arguments);
    };
  }();

  var sendSubmission = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(offlineSubmission) {
      var remoteEndPoint, sub, _ref2, _ref3, error, insertedData, _ref4, _ref5, e;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              remoteEndPoint = _Form2.default.getModel({
                path: offlineSubmission.path
              }).remote();


              offlineSubmission.queuedForSync = true;
              sub = (0, _Submission2.default)(offlineSubmission.path);

              // Set the submission as queuedForSync

              _context.next = 5;
              return sub.local().update(offlineSubmission);

            case 5:
              _context.next = 7;
              return (0, _awaitToJs2.default)(remoteEndPoint.insert(offlineSubmission));

            case 7:
              _ref2 = _context.sent;
              _ref3 = _slicedToArray(_ref2, 2);
              error = _ref3[0];
              insertedData = _ref3[1];

              if (!error) {
                _context.next = 17;
                break;
              }

              console.log(error);
              offlineSubmission.queuedForSync = false;
              offlineSubmission.syncError = error;
              sub.local().update(offlineSubmission);
              throw new Error("Error while Syncing data");

            case 17:
              if (insertedData._id) {
                _context.next = 19;
                break;
              }

              throw Error("The remote endpoint did not save the submission properly (no _id back)");

            case 19:
              _context.next = 21;
              return (0, _awaitToJs2.default)(sub.local().remove(offlineSubmission._id));

            case 21:
              _ref4 = _context.sent;
              _ref5 = _slicedToArray(_ref4, 1);
              e = _ref5[0];

              if (!e) {
                _context.next = 26;
                break;
              }

              throw new Error("Sync error:Could not remove local submission after sync");

            case 26:
              return _context.abrupt("return", true);

            case 27:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, undefined);
    }));

    return function sendSubmission(_x) {
      return _ref.apply(this, arguments);
    };
  }();

  return Object.freeze({
    send: send
  });
}();

exports.default = OfflineData;

/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

!function(t,e){ true?module.exports=e():undefined}(this,function(){return function(t){var e={};function r(n){if(e[n])return e[n].exports;var i=e[n]={i:n,l:!1,exports:{}};return t[n].call(i.exports,i,i.exports,r),i.l=!0,i.exports}return r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n})},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.t=function(t,e){if(1&e&&(t=r(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var i in t)r.d(n,i,function(e){return t[e]}.bind(null,i));return n},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=2)}([function(t,e){var r;r=function(){return this}();try{r=r||new Function("return this")()}catch(t){"object"==typeof window&&(r=window)}t.exports=r},function(t,e,r){var n,i,o;i=[],void 0===(o="function"==typeof(n=function(){return function(){function t(t,e){if(this.app="loki",this.options=e||{},void 0!==t&&(this.app=t),this.catalog=null,!this.checkAvailability())throw new Error("indexedDB does not seem to be supported for your environment")}function e(t){this.db=null,this.initializeLokiCatalog(t)}return t.prototype.closeDatabase=function(){this.catalog&&this.catalog.db&&(this.catalog.db.close(),this.catalog.db=null)},t.prototype.checkAvailability=function(){return!("undefined"==typeof indexedDB||!indexedDB)},t.prototype.loadDatabase=function(t,r){var n=this.app,i=this;null!==this.catalog&&null!==this.catalog.db?this.catalog.getAppKey(n,t,function(t){if("function"==typeof r){if(0===t.id)return void r(null);r(t.val)}else console.log(t.val)}):this.catalog=new e(function(e){i.catalog=e,i.loadDatabase(t,r)})},t.prototype.loadKey=t.prototype.loadDatabase,t.prototype.saveDatabase=function(t,r,n){var i=this.app,o=this;function s(t){t&&!0===t.success?n(null):n(new Error("Error saving database")),o.options.closeAfterSave&&o.closeDatabase()}null!==this.catalog&&null!==this.catalog.db?this.catalog.setAppKey(i,t,r,s):this.catalog=new e(function(e){o.saveDatabase(t,r,s)})},t.prototype.saveKey=t.prototype.saveDatabase,t.prototype.deleteDatabase=function(t,r){var n=this.app,i=this;null!==this.catalog&&null!==this.catalog.db?this.catalog.getAppKey(n,t,function(t){var e=t.id;0!==e?i.catalog.deleteAppKey(e,r):"function"==typeof r&&r({success:!0})}):this.catalog=new e(function(e){i.catalog=e,i.deleteDatabase(t,r)})},t.prototype.deleteKey=t.prototype.deleteDatabase,t.prototype.deleteDatabasePartitions=function(t){var e=this;this.getDatabaseList(function(r){r.forEach(function(r){r.startsWith(t)&&e.deleteDatabase(r)})})},t.prototype.getDatabaseList=function(t){var r=this.app,n=this;null!==this.catalog&&null!==this.catalog.db?this.catalog.getAppKeys(r,function(e){for(var r=[],n=0;n<e.length;n++)r.push(e[n].key);"function"==typeof t?t(r):r.forEach(function(t){console.log(t)})}):this.catalog=new e(function(e){n.catalog=e,n.getDatabaseList(t)})},t.prototype.getKeyList=t.prototype.getDatabaseList,t.prototype.getCatalogSummary=function(t){this.app;var r=this;null!==this.catalog&&null!==this.catalog.db?this.catalog.getAllKeys(function(e){for(var r,n,i,o,s,a=[],l=0;l<e.length;l++)r=e[l],i=r.app||"",o=r.key||"",s=r.val||"",n=2*i.length+2*o.length+s.length+1,a.push({app:r.app,key:r.key,size:n});"function"==typeof t?t(a):a.forEach(function(t){console.log(t)})}):this.catalog=new e(function(e){r.catalog=e,r.getCatalogSummary(t)})},e.prototype.initializeLokiCatalog=function(t){var e=indexedDB.open("LokiCatalog",1),r=this;e.onupgradeneeded=function(t){var e=t.target.result;if(e.objectStoreNames.contains("LokiAKV")&&e.deleteObjectStore("LokiAKV"),!e.objectStoreNames.contains("LokiAKV")){var r=e.createObjectStore("LokiAKV",{keyPath:"id",autoIncrement:!0});r.createIndex("app","app",{unique:!1}),r.createIndex("key","key",{unique:!1}),r.createIndex("appkey","appkey",{unique:!0})}},e.onsuccess=function(e){r.db=e.target.result,"function"==typeof t&&t(r)},e.onerror=function(t){throw t}},e.prototype.getAppKey=function(t,e,r){var n,i=this.db.transaction(["LokiAKV"],"readonly"),o=i.objectStore("LokiAKV"),s=o.index("appkey"),a=t+","+e,l=s.get(a);l.onsuccess=(n=r,function(t){var e=t.target.result;null==e&&(e={id:0,success:!1}),"function"==typeof n?n(e):console.log(e)}),l.onerror=function(t){return function(e){if("function"!=typeof t)throw e;t({id:0,success:!1})}}(r)},e.prototype.getAppKeyById=function(t,e,r){var n=this.db.transaction(["LokiAKV"],"readonly"),i=n.objectStore("LokiAKV"),o=i.get(t);o.onsuccess=function(t,e){return function(r){"function"==typeof e?e(r.target.result,t):console.log(r.target.result)}}(r,e)},e.prototype.setAppKey=function(t,e,r,n){var i,o=this.db.transaction(["LokiAKV"],"readwrite"),s=o.objectStore("LokiAKV"),a=s.index("appkey"),l=t+","+e,c=a.get(l);c.onsuccess=function(i){var o=i.target.result;null==o?o={app:t,key:e,appkey:t+","+e,val:r}:o.val=r;var a,l=s.put(o);l.onerror=(a=n,function(t){"function"==typeof a?a({success:!1}):(console.error("LokiCatalog.setAppKey (set) onerror"),console.error(c.error))}),l.onsuccess=function(t){return function(e){"function"==typeof t&&t({success:!0})}}(n)},c.onerror=(i=n,function(t){"function"==typeof i?i({success:!1}):(console.error("LokiCatalog.setAppKey (get) onerror"),console.error(c.error))})},e.prototype.deleteAppKey=function(t,e){var r,n=this.db.transaction(["LokiAKV"],"readwrite"),i=n.objectStore("LokiAKV"),o=i.delete(t);o.onsuccess=(r=e,function(t){"function"==typeof r&&r({success:!0})}),o.onerror=function(t){return function(e){"function"==typeof t?t({success:!1}):(console.error("LokiCatalog.deleteAppKey raised onerror"),console.error(o.error))}}(e)},e.prototype.getAppKeys=function(t,e){var r,n=this.db.transaction(["LokiAKV"],"readonly"),i=n.objectStore("LokiAKV"),o=i.index("app"),s=IDBKeyRange.only(t),a=o.openCursor(s);a.onsuccess=function(t,e){return function(r){var n=r.target.result;if(n){var i=n.value;t.push(i),n.continue()}else"function"==typeof e?e(t):console.log(t)}}([],e),a.onerror=(r=e,function(t){"function"==typeof r?r(null):(console.error("LokiCatalog.getAppKeys raised onerror"),console.error(t))})},e.prototype.getAllKeys=function(t){var e,r=this.db.transaction(["LokiAKV"],"readonly"),n=r.objectStore("LokiAKV"),i=n.openCursor();i.onsuccess=function(t,e){return function(r){var n=r.target.result;if(n){var i=n.value;t.push(i),n.continue()}else"function"==typeof e?e(t):console.log(t)}}([],t),i.onerror=(e=t,function(t){"function"==typeof e&&e(null)})},t}()})?n.apply(e,i):n)||(t.exports=o)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n,i=r(3),o=(n=i)&&n.__esModule?n:{default:n};e.default=o.default},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},i=l(r(4)),o=l(r(8)),s=l(r(9)),a=r(12);function l(t){return t&&t.__esModule?t:{default:t}}function c(t){return function(){var e=t.apply(this,arguments);return new Promise(function(t,r){return function n(i,o){try{var s=e[i](o),a=s.value}catch(t){return void r(t)}if(!s.done)return Promise.resolve(a).then(function(t){n("next",t)},function(t){n("throw",t)});t(a)}("next")})}}e.default=a.Interface.compose({methods:{get:function(){var t=this;return c(regeneratorRuntime.mark(function e(){var r,n;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return r=t.prepareFilter(),e.next=3,t.getModel();case 3:return e.t0=r,e.t1=t.offsetNumber,e.t2=t.limitNumber,e.next=8,e.sent.chain().find(e.t0).offset(e.t1).limit(e.t2).data();case 8:return n=e.sent,n=t.jsApplySelect(n),n=t.jsApplyOrderBy(n),e.abrupt("return",n);case 12:case"end":return e.stop()}},e,t)}))()},prepareFilter:function(){var t=this,e={$and:[]},r={$or:[]},n={};return this.whereArray.length>0&&(this.whereArray.forEach(function(r){var n={};if(r[0].includes("["))throw new Error('Error in: "'+r[0]+'" "Where" close does not work with Array elements');n[r[0]]={};var i=t.getLokiOperator(r[1]);n[r[0]][i]=r[2],i.includes("$regex|")&&(delete n[r[0]][i],n[r[0]].$regex=i.replace("$regex|","").replace("{{$var}}",r[2])),e.$and.push(n)}),n=e),this.orWhereArray.length>0&&(this.orWhereArray.forEach(function(e){var n={};n[e[0]]={};var i=t.getLokiOperator(e[1]);n[e[0]][i]=e[2],i.includes("$regex|")&&(delete n[e[0]][i],n[e[0]].$regex=i.replace("$regex|","").replace("{{$var}}",e[2])),r.$or.push(n)}),n={$or:[e,r]}),n},getLokiOperator:function(t){if(!this.operators.includes(t))throw new Error('The "'+t+'" operator is not supported');var e={"=":"$eq","<":"$lt",">":"$gt","<=":"$lte",">=":"$gte","<>":"$ne","!=":"$ne",in:"$in",nin:"$nin",like:"$aeq",regexp:"$regex",startsWith:"$regex|^{{$var}}",endsWith:"$regex|{{$var}}$",contains:"$regex|{{$var}}"},r=o.default.get(function(){return e[t]},void 0);if(!r)throw new Error('The operator "'+t+'" is not supported in Loki ');return r},getModel:function(){var t=this;return c(regeneratorRuntime.mark(function e(){var r;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,i.default.get();case 2:return r=e.sent,e.abrupt("return",r.getCollection(t.name));case 4:case"end":return e.stop()}},e,t)}))()},all:function(){var t=this;return c(regeneratorRuntime.mark(function e(){var r;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,t.getModel();case 2:return r=e.sent,e.abrupt("return",r.find());case 4:case"end":return e.stop()}},e,t)}))()},remove:function(t){var e=this;return c(regeneratorRuntime.mark(function r(){var n;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if(t){r.next=2;break}throw new Error("No id assign to remove().You must give and _id to delete");case 2:if(t.includes("_local")){r.next=4;break}throw new Error("You can`t delete non local submissions");case 4:return r.next=6,e.getModel();case 6:return n=r.sent,r.abrupt("return",n.findAndRemove({_id:t}));case 8:case"end":return r.stop()}},r,e)}))()},insert:function(t,e){var r=this;return c(regeneratorRuntime.mark(function n(){var i;return regeneratorRuntime.wrap(function(n){for(;;)switch(n.prev=n.next){case 0:if(!Array.isArray(t)){n.next=2;break}return n.abrupt("return",r.ArrayInsert(t,e));case 2:return t=o.default.cloneDeep(t),n.next=5,r.getModel();case 5:return i=n.sent,t._id=(0,s.default)()+"_local",n.abrupt("return",i.insert(t));case 8:case"end":return n.stop()}},n,r)}))()},update:function(t){var e=this;return c(regeneratorRuntime.mark(function r(){var i,o,s;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if(t._id){r.next=2;break}throw new Error("Loki connector error. Cannot update a Model without _id key");case 2:return r.next=4,e.getModel();case 4:return i=r.sent,t.modified=Math.round(+new Date/1e3),r.next=8,i.findOne({_id:t._id});case 8:return o=r.sent,s=n({},o,t),r.abrupt("return",i.update(s));case 11:case"end":return r.stop()}},r,e)}))()},updateOrCreate:function(t){var e=this;return c(regeneratorRuntime.mark(function r(){var n,i=t.document;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,e.getModel();case 2:return n=t.sent,t.next=5,n.findOne(i);case 5:t.sent||n.insert(i);case 7:case"end":return t.stop()}},r,e)}))()},findAndRemove:function(t){var e=this;return c(regeneratorRuntime.mark(function r(){var n,i=t.filter;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,e.getModel();case 2:return n=t.sent,t.abrupt("return",n.findAndRemove(i));case 4:case"end":return t.stop()}},r,e)}))()},clear:function(){var t=this;return c(regeneratorRuntime.mark(function e(){var r;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,t.getModel();case 2:return r=e.sent,e.abrupt("return",r.clear({removeIndices:!0}));case 4:case"end":return e.stop()}},e,t)}))()}}})},function(t,e,r){"use strict";(function(t){Object.defineProperty(e,"__esModule",{value:!0});var n=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},i=s(r(5)),o=s(r(1));function s(t){return t&&t.__esModule?t:{default:t}}var a,l,c,u,h,f=null,d=(c=function(){return"undefined"!=typeof window&&window&&window._FLUENT_&&window._FLUENT_.models?window._FLUENT_.models:t&&t._FLUENT_&&t._FLUENT_.models?t._FLUENT_.models:void 0},u=function(){var t=c(),e=f.collections.reduce(function(t,e){return t.push(e.name),t},[]),r=[];return Object.keys(t).forEach(function(t){e.includes(t)||r.push(t)}),r},a=regeneratorRuntime.mark(function t(){var e;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:if(f){t.next=4;break}return t.next=3,new Promise(function(t){var e=void 0,r=void 0,s=void 0,a={autosave:!0,autosaveInterval:1e3,autoload:!0,autoloadCallback:function(){var e=c();if(!e)throw new Error('Cannot Start FLUENT, no models registered or you dont have access to the "window" or "global" variable');Object.keys(e).forEach(function(t){var e=s.getCollection(t);e||s.addCollection(t)}),t(s)},throttledSaves:!1};try{e=new o.default("GOAT"),r=new i.default.LokiPartitioningAdapter(e,{paging:!0}),s=new i.default("GOAT",n({},a,{adapter:r}))}catch(t){s=new i.default("GOAT",a)}});case 3:f=t.sent;case 4:return(e=u()).length>0&&e.forEach(function(t){f.addCollection(t)}),t.abrupt("return",f);case 7:case"end":return t.stop()}},t,this)}),l=function(){var t=a.apply(this,arguments);return new Promise(function(e,r){return function n(i,o){try{var s=t[i](o),a=s.value}catch(t){return void r(t)}if(!s.done)return Promise.resolve(a).then(function(t){n("next",t)},function(t){n("throw",t)});e(a)}("next")})},h=function(){return l.apply(this,arguments)},Object.freeze({get:h}));e.default=d}).call(this,r(0))},function(t,e,r){(function(n,i){var o,s,a;s=[],void 0===(a="function"==typeof(o=function(){return function(){"use strict";var t=Object.prototype.hasOwnProperty,e={copyProperties:function(t,e){var r;for(r in t)e[r]=t[r]},resolveTransformObject:function(t,r,n){var i,o;if("number"!=typeof n&&(n=0),++n>=10)return t;for(i in t)"string"==typeof t[i]&&0===t[i].indexOf("[%lktxp]")?(o=t[i].substring(8),r.hasOwnProperty(o)&&(t[i]=r[o])):"object"==typeof t[i]&&(t[i]=e.resolveTransformObject(t[i],r,n));return t},resolveTransformParams:function(t,r){var n,i,o=[];if(void 0===r)return t;for(n=0;n<t.length;n++)i=y(t[n],"shallow-recurse-objects"),o.push(e.resolveTransformObject(i,r));return o},getIn:function(t,e,r){if(null!=t){if(!r)return t[e];if("string"==typeof e&&(e=e.split(".")),!Array.isArray(e))throw new Error("path must be a string or array. Found "+typeof e);for(var n=0,i=e.length;null!=t&&n<i;)t=t[e[n++]];return n&&n==i?t:void 0}}},o={aeq:s,lt:a,gt:l};function s(t,e){var r,n,i,o;if(t===e)return!0;if(!t||!e||!0===t||!0===e||t!=t||e!=e){switch(t){case void 0:case null:i=1;break;case!1:i=3;break;case!0:i=4;break;case"":i=5;break;default:i=t==t?9:0}switch(e){case void 0:case null:o=1;break;case!1:o=3;break;case!0:o=4;break;case"":o=5;break;default:o=e==e?9:0}if(9!==i||9!==o)return i===o}return r=Number(t),n=Number(e),r==r||n==n?r===n:(r=t.toString(),n=e.toString(),r==n)}function a(t,e,r){var n,i,o,s;if(!t||!e||!0===t||!0===e||t!=t||e!=e){switch(t){case void 0:case null:o=1;break;case!1:o=3;break;case!0:o=4;break;case"":o=5;break;default:o=t==t?9:0}switch(e){case void 0:case null:s=1;break;case!1:s=3;break;case!0:s=4;break;case"":s=5;break;default:s=e==e?9:0}if(9!==o||9!==s)return o===s?r:o<s}return n=Number(t),i=Number(e),n==n&&i==i?n<i||!(n>i)&&r:n==n&&i!=i||(i!=i||n==n)&&(t<e||!(t>e)&&(t==e?r:(n=t.toString(),i=e.toString(),n<i||n==i&&r)))}function l(t,e,r){var n,i,o,s;if(!t||!e||!0===t||!0===e||t!=t||e!=e){switch(t){case void 0:case null:o=1;break;case!1:o=3;break;case!0:o=4;break;case"":o=5;break;default:o=t==t?9:0}switch(e){case void 0:case null:s=1;break;case!1:s=3;break;case!0:s=4;break;case"":s=5;break;default:s=e==e?9:0}if(9!==o||9!==s)return o===s?r:o>s}return n=Number(t),i=Number(e),n==n&&i==i?n>i||!(n<i)&&r:(n!=n||i==i)&&(i==i&&n!=n||t>e||!(t<e)&&(t==e?r:(n=t.toString(),i=e.toString(),n>i||n==i&&r)))}function c(t,e,r){return o.aeq(t,e)?0:o.lt(t,e,!1)?r?1:-1:o.gt(t,e,!1)?r?-1:1:0}function u(t,e,r,n,i){var o,s=i||0,a=e[s],l=!1;if("object"==typeof t&&a in t&&(o=t[a]),s+1>=e.length)l=r(o,n);else if(Array.isArray(o))for(var c=0,h=o.length;c<h&&!0!==(l=u(o[c],e,r,n,s+1));c+=1);else l=u(o,e,r,n,s+1);return l}function h(e){return"string"==typeof e||Array.isArray(e)?function(t){return-1!==e.indexOf(t)}:"object"==typeof e&&null!==e?function(r){return t.call(e,r)}:null}function f(e,r){for(var n in r)if(t.call(r,n))return d[n](e,r[n]);return!1}var d={$eq:function(t,e){return t===e},$aeq:function(t,e){return t==e},$ne:function(t,e){return e!=e?t==t:t!==e},$dteq:function(t,e){return o.aeq(t,e)},$gt:function(t,e){return o.gt(t,e,!1)},$gte:function(t,e){return o.gt(t,e,!0)},$lt:function(t,e){return o.lt(t,e,!1)},$lte:function(t,e){return o.lt(t,e,!0)},$jgt:function(t,e){return t>e},$jgte:function(t,e){return t>=e},$jlt:function(t,e){return t<e},$jlte:function(t,e){return t<=e},$between:function(t,e){return null!=t&&o.gt(t,e[0],!0)&&o.lt(t,e[1],!0)},$jbetween:function(t,e){return null!=t&&t>=e[0]&&t<=e[1]},$in:function(t,e){return-1!==e.indexOf(t)},$nin:function(t,e){return-1===e.indexOf(t)},$keyin:function(t,e){return t in e},$nkeyin:function(t,e){return!(t in e)},$definedin:function(t,e){return void 0!==e[t]},$undefinedin:function(t,e){return void 0===e[t]},$regex:function(t,e){return e.test(t)},$containsString:function(t,e){return"string"==typeof t&&-1!==t.indexOf(e)},$containsNone:function(t,e){return!d.$containsAny(t,e)},$containsAny:function(t,e){var r=h(t);return null!==r&&(Array.isArray(e)?e.some(r):r(e))},$contains:function(t,e){var r=h(t);return null!==r&&(Array.isArray(e)?e.every(r):r(e))},$type:function(t,e){var r=typeof t;return"object"===r&&(Array.isArray(t)?r="array":t instanceof Date&&(r="date")),"object"!=typeof e?r===e:f(r,e)},$finite:function(t,e){return e===isFinite(t)},$size:function(t,e){return!!Array.isArray(t)&&("object"!=typeof e?t.length===e:f(t.length,e))},$len:function(t,e){return"string"==typeof t&&("object"!=typeof e?t.length===e:f(t.length,e))},$where:function(t,e){return!0===e(t)},$not:function(t,e){return!f(t,e)},$and:function(t,e){for(var r=0,n=e.length;r<n;r+=1)if(!f(t,e[r]))return!1;return!0},$or:function(t,e){for(var r=0,n=e.length;r<n;r+=1)if(f(t,e[r]))return!0;return!1},$exists:function(t,e){return e?void 0!==t:void 0===t}},p={$eq:d.$eq,$aeq:!0,$dteq:!0,$gt:!0,$gte:!0,$lt:!0,$lte:!0,$in:!0,$between:!0};function y(t,e){if(null==t)return null;var r,n=e||"parse-stringify";switch(n){case"parse-stringify":r=JSON.parse(JSON.stringify(t));break;case"jquery-extend-deep":r=jQuery.extend(!0,{},t);break;case"shallow":r=Object.create(t.constructor.prototype),Object.keys(t).map(function(e){r[e]=t[e]});break;case"shallow-assign":r=Object.create(t.constructor.prototype),Object.assign(r,t);break;case"shallow-recurse-objects":r=y(t,"shallow");var i=Object.keys(t);i.forEach(function(e){"object"==typeof t[e]&&"Object"===t[e].constructor.name?r[e]=y(t[e],"shallow-recurse-objects"):Array.isArray(t[e])&&(r[e]=function(t,e){if("parse-stringify"==e)return y(t,e);for(var r=[],n=0,i=t.length;n<i;n++)r[n]=y(t[n],e);return r}(t[e],"shallow-recurse-objects"))})}return r}function v(){try{return window&&void 0!==window.localStorage&&null!==window.localStorage}catch(t){return!1}}function g(){}function m(t,e){this.filename=t||"loki.db",this.collections=[],this.databaseVersion=1.5,this.engineVersion=1.5,this.autosave=!1,this.autosaveInterval=5e3,this.autosaveHandle=null,this.throttledSaves=!0,this.options={},this.persistenceMethod=null,this.persistenceAdapter=null,this.throttledSavePending=!1,this.throttledCallbacks=[],this.verbose=!(!e||!e.hasOwnProperty("verbose"))&&e.verbose,this.events={init:[],loaded:[],flushChanges:[],close:[],changes:[],warning:[]},e&&e.hasOwnProperty("env")?this.ENV=e.env:this.ENV=void 0!==n&&(n.android||n.NSObject)?"NATIVESCRIPT":"undefined"==typeof window?"NODEJS":void 0!==n&&n.window&&void 0!==i?"NODEJS":"undefined"!=typeof document?-1===document.URL.indexOf("http://")&&-1===document.URL.indexOf("https://")?"CORDOVA":"BROWSER":"CORDOVA","undefined"===this.ENV&&(this.ENV="NODEJS"),this.configureOptions(e,!0),this.on("init",this.clearChanges)}function b(t){this.hashStore={},this.options=t||{},this.options.hasOwnProperty("asyncResponses")||(this.options.asyncResponses=!1),this.options.hasOwnProperty("asyncTimeout")||(this.options.asyncTimeout=50)}function w(t,e){if(this.mode="reference",this.adapter=null,this.options=e||{},this.dbref=null,this.dbname="",this.pageIterator={},!t)throw new Error("LokiPartitioningAdapter requires a (non-reference mode) adapter on construction");if("reference"===t.mode)throw new Error("LokiPartitioningAdapter cannot be instantiated with a reference mode adapter");this.adapter=t,this.options.hasOwnProperty("paging")||(this.options.paging=!1),this.options.hasOwnProperty("pageSize")||(this.options.pageSize=26214400),this.options.hasOwnProperty("delimiter")||(this.options.delimiter="$<\n")}function x(){try{this.fs=r(7)}catch(t){this.fs=null}}function I(){}function O(t,e){return e=e||{},this.collection=t,this.filteredrows=[],this.filterInitialized=!1,this}function A(t,e,r){this.collection=t,this.name=e,this.rebuildPending=!1,this.options=r||{},this.options.hasOwnProperty("persistent")||(this.options.persistent=!1),this.options.hasOwnProperty("sortPriority")||(this.options.sortPriority="passive"),this.options.hasOwnProperty("minRebuildInterval")||(this.options.minRebuildInterval=1),this.resultset=new O(t),this.resultdata=[],this.resultsdirty=!1,this.cachedresultset=null,this.filterPipeline=[],this.sortFunction=null,this.sortCriteria=null,this.sortCriteriaSimple=null,this.sortDirty=!1,this.events={rebuild:[]}}function P(e,r){this.name=e,this.data=[],this.idIndex=[],this.binaryIndices={},this.constraints={unique:{},exact:{}},this.uniqueNames=[],this.transforms={},this.objType=e,this.dirty=!0,this.cachedIndex=null,this.cachedBinaryIndex=null,this.cachedData=null;var n=this;(r=r||{}).hasOwnProperty("unique")&&(Array.isArray(r.unique)||(r.unique=[r.unique]),r.unique.forEach(function(t){n.uniqueNames.push(t),n.constraints.unique[t]=new F(t)})),r.hasOwnProperty("exact")&&r.exact.forEach(function(t){n.constraints.exact[t]=new R(t)}),this.adaptiveBinaryIndices=!r.hasOwnProperty("adaptiveBinaryIndices")||r.adaptiveBinaryIndices,this.transactional=!!r.hasOwnProperty("transactional")&&r.transactional,this.cloneObjects=!!r.hasOwnProperty("clone")&&r.clone,this.cloneMethod=r.hasOwnProperty("cloneMethod")?r.cloneMethod:"parse-stringify",this.asyncListeners=!!r.hasOwnProperty("asyncListeners")&&r.asyncListeners,this.disableMeta=!!r.hasOwnProperty("disableMeta")&&r.disableMeta,this.disableChangesApi=!r.hasOwnProperty("disableChangesApi")||r.disableChangesApi,this.disableDeltaChangesApi=!r.hasOwnProperty("disableDeltaChangesApi")||r.disableDeltaChangesApi,this.disableChangesApi&&(this.disableDeltaChangesApi=!0),this.autoupdate=!!r.hasOwnProperty("autoupdate")&&r.autoupdate,this.serializableIndices=!r.hasOwnProperty("serializableIndices")||r.serializableIndices,this.ttl={age:null,ttlInterval:null,daemon:null},this.setTTL(r.ttl||-1,r.ttlInterval),this.maxId=0,this.DynamicViews=[],this.events={insert:[],update:[],"pre-insert":[],"pre-update":[],close:[],flushbuffer:[],error:[],delete:[],warning:[]},this.changes=[],this.ensureId();var i=[];if(r&&r.indices)if("[object Array]"===Object.prototype.toString.call(r.indices))i=r.indices;else{if("string"!=typeof r.indices)throw new TypeError("Indices needs to be a string or an array of strings");i=[r.indices]}for(var o=0;o<i.length;o++)this.ensureIndex(i[o]);function s(t,e){var r=null!==e&&"object"==typeof e?Object.keys(e):null;if(r&&r.length&&["string","boolean","number"].indexOf(typeof e)<0){for(var i={},o=0;o<r.length;o++){var a=r[o];if(e.hasOwnProperty(a))if(!t.hasOwnProperty(a)||n.uniqueNames.indexOf(a)>=0||"$loki"==a||"meta"==a)i[a]=e[a];else{var l=s(t[a],e[a]);void 0!==l&&l!={}&&(i[a]=l)}}return 0===Object.keys(i).length?void 0:i}return t===e?void 0:e}function a(){n.changes=[]}this.observerCallback=function(e){var r="function"==typeof Set?new Set:[];r.add||(r.add=function(t){return-1===this.indexOf(t)&&this.push(t),this}),e.forEach(function(t){r.add(t.object)}),r.forEach(function(e){if(!t.call(e,"$loki"))return n.removeAutoUpdateObserver(e);try{n.update(e)}catch(t){}})},this.getChangeDelta=function(t,e){return e?s(e,t):JSON.parse(JSON.stringify(t))},this.getObjectDelta=s,this.getChanges=function(){return n.changes},this.flushChanges=a,this.setChangesApi=function(t){n.disableChangesApi=!t,t||(n.disableDeltaChangesApi=!1)},this.on("delete",function(t){n.disableChangesApi||n.createChange(n.name,"R",t)}),this.on("warning",function(t){n.console.warn(t)}),a()}function k(t){return-1!==t.indexOf(".")}function D(t){return parseFloat(t,10)}function S(t,e){return t+e}function C(t,e){return t-e}function E(t){return t.reduce(S,0)/t.length}function j(t,e,r){if(!1===r)return t[e];for(var n=e.split("."),i=t;n.length>0;)i=i[n.shift()];return i}function M(t,e,r){for(var n,i,o=0,s=t.length;o<s;){if(i=o+s>>1,0===(n=r.apply(null,[e,t[i]])))return{found:!0,index:i};n<0?s=i:o=i+1}return{found:!1,index:s}}function N(t){return function(e,r){return M(e,r,t)}}function $(){}function F(t){this.field=t,this.keyMap={},this.lokiMap={}}function R(t){this.index={},this.field=t}return g.prototype.events={},g.prototype.asyncListeners=!1,g.prototype.on=function(t,e){var r,n=this;return Array.isArray(t)?(t.forEach(function(t){n.on(t,e)}),e):((r=this.events[t])||(r=this.events[t]=[]),r.push(e),e)},g.prototype.emit=function(t){var e=this,r=Array.prototype.slice.call(arguments,1);if(!t||!this.events[t])throw new Error("No event "+t+" defined");this.events[t].forEach(function(t){e.asyncListeners?setTimeout(function(){t.apply(e,r)},1):t.apply(e,r)})},g.prototype.addListener=g.prototype.on,g.prototype.removeListener=function(t,e){var r=this;if(Array.isArray(t))t.forEach(function(t){r.removeListener(t,e)});else if(this.events[t]){var n=this.events[t];n.splice(n.indexOf(e),1)}},m.prototype=new g,m.prototype.constructor=m,m.prototype.getIndexedAdapter=function(){return r(1)},m.prototype.configureOptions=function(t,e){var r={fs:x,localStorage:I,memory:b};if(this.options={},this.persistenceMethod=null,this.persistenceAdapter=null,void 0!==t){if(this.options=t,this.options.hasOwnProperty("persistenceMethod")&&"function"==typeof r[t.persistenceMethod]&&(this.persistenceMethod=t.persistenceMethod,this.persistenceAdapter=new r[t.persistenceMethod]),this.options.hasOwnProperty("adapter")&&(this.persistenceMethod="adapter",this.persistenceAdapter=t.adapter,this.options.adapter=null),t.autoload&&e){var n=this;setTimeout(function(){n.loadDatabase(t,t.autoloadCallback)},1)}this.options.hasOwnProperty("autosaveInterval")&&(this.autosaveDisable(),this.autosaveInterval=parseInt(this.options.autosaveInterval,10)),this.options.hasOwnProperty("autosave")&&this.options.autosave&&(this.autosaveDisable(),this.autosave=!0,this.options.hasOwnProperty("autosaveCallback")?this.autosaveEnable(t,t.autosaveCallback):this.autosaveEnable()),this.options.hasOwnProperty("throttledSaves")&&(this.throttledSaves=this.options.throttledSaves)}this.options.hasOwnProperty("serializationMethod")||(this.options.serializationMethod="normal"),this.options.hasOwnProperty("destructureDelimiter")||(this.options.destructureDelimiter="$<\n"),null===this.persistenceAdapter&&(this.persistenceMethod={NODEJS:"fs",BROWSER:"localStorage",CORDOVA:"localStorage",MEMORY:"memory"}[this.ENV],this.persistenceMethod&&(this.persistenceAdapter=new r[this.persistenceMethod]))},m.prototype.copy=function(t){var e,r,n=new m(this.filename,{env:"NA"});if(t=t||{},n.loadJSONObject(this,{retainDirtyFlags:!0}),t.hasOwnProperty("removeNonSerializable")&&!0===t.removeNonSerializable)for(n.autosaveHandle=null,n.persistenceAdapter=null,e=n.collections.length,r=0;r<e;r++)n.collections[r].constraints=null,n.collections[r].ttl=null;return n},m.prototype.addCollection=function(t,e){var r,n=this.collections.length;if(e&&!0===e.disableMeta){if(!1===e.disableChangesApi)throw new Error("disableMeta option cannot be passed as true when disableChangesApi is passed as false");if(!1===e.disableDeltaChangesApi)throw new Error("disableMeta option cannot be passed as true when disableDeltaChangesApi is passed as false");if("number"==typeof e.ttl&&e.ttl>0)throw new Error("disableMeta option cannot be passed as true when ttl is enabled")}for(r=0;r<n;r+=1)if(this.collections[r].name===t)return this.collections[r];var i=new P(t,e);return this.collections.push(i),this.verbose&&(i.console=console),i},m.prototype.loadCollection=function(t){if(!t.name)throw new Error("Collection must have a name property to be loaded");this.collections.push(t)},m.prototype.getCollection=function(t){var e,r=this.collections.length;for(e=0;e<r;e+=1)if(this.collections[e].name===t)return this.collections[e];return this.emit("warning","collection "+t+" not found"),null},m.prototype.renameCollection=function(t,e){var r=this.getCollection(t);return r&&(r.name=e),r},m.prototype.listCollections=function(){for(var t=this.collections.length,e=[];t--;)e.push({name:this.collections[t].name,type:this.collections[t].objType,count:this.collections[t].data.length});return e},m.prototype.removeCollection=function(t){var e,r=this.collections.length;for(e=0;e<r;e+=1)if(this.collections[e].name===t){var n=new P(t,{}),i=this.collections[e];for(var o in i)i.hasOwnProperty(o)&&n.hasOwnProperty(o)&&(i[o]=n[o]);return void this.collections.splice(e,1)}},m.prototype.getName=function(){return this.name},m.prototype.serializeReplacer=function(t,e){switch(t){case"autosaveHandle":case"persistenceAdapter":case"constraints":case"ttl":return null;case"throttledSavePending":case"throttledCallbacks":return;default:return e}},m.prototype.serialize=function(t){switch((t=t||{}).hasOwnProperty("serializationMethod")||(t.serializationMethod=this.options.serializationMethod),t.serializationMethod){case"normal":return JSON.stringify(this,this.serializeReplacer);case"pretty":return JSON.stringify(this,this.serializeReplacer,2);case"destructured":return this.serializeDestructured();default:return JSON.stringify(this,this.serializeReplacer)}},m.prototype.toJson=m.prototype.serialize,m.prototype.serializeDestructured=function(t){var e,r,n,i,o,s=[];if((t=t||{}).hasOwnProperty("partitioned")||(t.partitioned=!1),t.hasOwnProperty("delimited")||(t.delimited=!0),t.hasOwnProperty("delimiter")||(t.delimiter=this.options.destructureDelimiter),!0===t.partitioned&&t.hasOwnProperty("partition")&&t.partition>=0)return this.serializeCollection({delimited:t.delimited,delimiter:t.delimiter,collectionIndex:t.partition});for((o=new m(this.filename)).loadJSONObject(this),e=0;e<o.collections.length;e++)o.collections[e].data=[];if(!0===t.partitioned&&-1===t.partition)return o.serialize({serializationMethod:"normal"});for(s.push(o.serialize({serializationMethod:"normal"})),o=null,e=0;e<this.collections.length;e++)if(n=this.serializeCollection({delimited:t.delimited,delimiter:t.delimiter,collectionIndex:e}),!1===t.partitioned&&!1===t.delimited){if(!Array.isArray(n))throw new Error("a nondelimited, non partitioned collection serialization did not return an expected array");for(i=n.length,r=0;r<i;r++)s.push(n[r]),n[r]=null;s.push("")}else s.push(n);return t.partitioned?(t.delimited,s):t.delimited?(s.push(""),s.join(t.delimiter)):(s.push(""),s)},m.prototype.serializeCollection=function(t){var e,r,n=[];if((t=t||{}).hasOwnProperty("delimited")||(t.delimited=!0),!t.hasOwnProperty("collectionIndex"))throw new Error("serializeCollection called without 'collectionIndex' option");for(e=this.collections[t.collectionIndex].data.length,n=[],r=0;r<e;r++)n.push(JSON.stringify(this.collections[t.collectionIndex].data[r]));return t.delimited?(n.push(""),n.join(t.delimiter)):n},m.prototype.deserializeDestructured=function(t,e){var r,n,i,o=[],s=0,a=1,l=!1;if((e=e||{}).hasOwnProperty("partitioned")||(e.partitioned=!1),e.hasOwnProperty("delimited")||(e.delimited=!0),e.hasOwnProperty("delimiter")||(e.delimiter=this.options.destructureDelimiter),e.partitioned){if(e.hasOwnProperty("partition"))return-1===e.partition?r=JSON.parse(t[0]):this.deserializeCollection(t[e.partition+1],e);for(r=JSON.parse(t[0]),n=r.collections.length,s=0;s<n;s++)r.collections[s].data=this.deserializeCollection(t[s+1],e);return r}if(e.delimited){if(o=t.split(e.delimiter),t=null,0===o.length)return null}else o=t;for(r=JSON.parse(o[0]),n=r.collections.length,o[0]=null;!l;)o[a],""===o[a]?++s>n&&(l=!0):(i=JSON.parse(o[a]),r.collections[s].data.push(i)),o[a++]=null;return r},m.prototype.deserializeCollection=function(t,e){var r,n,i=[];for((e=e||{}).hasOwnProperty("partitioned")||(e.partitioned=!1),e.hasOwnProperty("delimited")||(e.delimited=!0),e.hasOwnProperty("delimiter")||(e.delimiter=this.options.destructureDelimiter),e.delimited?(i=t.split(e.delimiter)).pop():i=t,n=i.length,r=0;r<n;r++)i[r]=JSON.parse(i[r]);return i},m.prototype.loadJSON=function(t,e){var r;if(0===t.length)r={};else switch(this.options.serializationMethod){case"normal":case"pretty":r=JSON.parse(t);break;case"destructured":r=this.deserializeDestructured(t);break;default:r=JSON.parse(t)}this.loadJSONObject(r,e)},m.prototype.loadJSONObject=function(t,r){var n,i,o,s,a,l,c=0,u=t.collections?t.collections.length:0;function h(t){var n,i=r[t.name];return i.proto?(n=i.inflate||e.copyProperties,function(t){var e=new i.proto;return n(t,e),e}):i.inflate}for(this.name=t.name,t.hasOwnProperty("throttledSaves")&&r&&!r.hasOwnProperty("throttledSaves")&&(this.throttledSaves=t.throttledSaves),this.collections=[];c<u;c+=1){if(n=t.collections[c],(i=this.addCollection(n.name,{disableChangesApi:n.disableChangesApi,disableDeltaChangesApi:n.disableDeltaChangesApi,disableMeta:n.disableMeta})).adaptiveBinaryIndices=!!n.hasOwnProperty("adaptiveBinaryIndices")&&!0===n.adaptiveBinaryIndices,i.transactional=n.transactional,i.asyncListeners=n.asyncListeners,i.cloneObjects=n.cloneObjects,i.cloneMethod=n.cloneMethod||"parse-stringify",i.autoupdate=n.autoupdate,i.changes=n.changes,r&&!0===r.retainDirtyFlags?i.dirty=n.dirty:i.dirty=!1,o=n.data.length,s=0,r&&r.hasOwnProperty(n.name))for(a=h(n);s<o;s++)l=a(n.data[s]),i.data[s]=l,i.addAutoUpdateObserver(l);else for(;s<o;s++)i.data[s]=n.data[s],i.addAutoUpdateObserver(i.data[s]);if(i.maxId=void 0===n.maxId?0:n.maxId,i.idIndex=n.idIndex,void 0!==n.binaryIndices&&(i.binaryIndices=n.binaryIndices),void 0!==n.transforms&&(i.transforms=n.transforms),i.ensureId(),i.uniqueNames=[],n.hasOwnProperty("uniqueNames"))for(i.uniqueNames=n.uniqueNames,s=0;s<i.uniqueNames.length;s++)i.ensureUniqueIndex(i.uniqueNames[s]);if(void 0!==n.DynamicViews){for(var f=0;f<n.DynamicViews.length;f++){var d=n.DynamicViews[f],p=i.addDynamicView(d.name,d.options);p.resultdata=d.resultdata,p.resultsdirty=d.resultsdirty,p.filterPipeline=d.filterPipeline,p.sortCriteria=d.sortCriteria,p.sortFunction=null,p.sortDirty=d.sortDirty,p.resultset.filteredrows=d.resultset.filteredrows,p.resultset.filterInitialized=d.resultset.filterInitialized,p.rematerialize({removeWhereFilters:!0})}t.databaseVersion<1.5&&(i.ensureAllIndexes(!0),i.dirty=!0)}}},m.prototype.close=function(t){this.autosave&&(this.autosaveDisable(),this.autosaveDirty()&&(this.saveDatabase(t),t=void 0)),t&&this.on("close",t),this.emit("close")},m.prototype.generateChangesNotification=function(t){function e(t){return t.name}var r=[],n=t||this.collections.map(e);return this.collections.forEach(function(t){-1!==n.indexOf(e(t))&&(r=r.concat(t.getChanges()))}),r},m.prototype.serializeChanges=function(t){return JSON.stringify(this.generateChangesNotification(t))},m.prototype.clearChanges=function(){this.collections.forEach(function(t){t.flushChanges&&t.flushChanges()})},b.prototype.loadDatabase=function(t,e){var r=this;this.options.asyncResponses?setTimeout(function(){r.hashStore.hasOwnProperty(t)?e(r.hashStore[t].value):e(null)},this.options.asyncTimeout):this.hashStore.hasOwnProperty(t)?e(this.hashStore[t].value):e(null)},b.prototype.saveDatabase=function(t,e,r){var n,i=this;this.options.asyncResponses?setTimeout(function(){n=i.hashStore.hasOwnProperty(t)?i.hashStore[t].savecount:0,i.hashStore[t]={savecount:n+1,lastsave:new Date,value:e},r()},this.options.asyncTimeout):(n=this.hashStore.hasOwnProperty(t)?this.hashStore[t].savecount:0,this.hashStore[t]={savecount:n+1,lastsave:new Date,value:e},r())},b.prototype.deleteDatabase=function(t,e){this.hashStore.hasOwnProperty(t)&&delete this.hashStore[t],"function"==typeof e&&e()},w.prototype.loadDatabase=function(t,e){var r=this;this.dbname=t,this.dbref=new m(t),this.adapter.loadDatabase(t,function(t){if(t){"string"!=typeof t&&e(new Error("LokiPartitioningAdapter received an unexpected response from inner adapter loadDatabase()"));var n=JSON.parse(t);r.dbref.loadJSONObject(n),n=null,r.dbref.collections.length,0!==r.dbref.collections.length?(r.pageIterator={collection:0,pageIndex:0},r.loadNextPartition(0,function(){e(r.dbref)})):e(r.dbref)}else e(t)})},w.prototype.loadNextPartition=function(t,e){var r=this.dbname+"."+t,n=this;if(!0===this.options.paging)return this.pageIterator.pageIndex=0,void this.loadNextPage(e);this.adapter.loadDatabase(r,function(r){var i=n.dbref.deserializeCollection(r,{delimited:!0,collectionIndex:t});n.dbref.collections[t].data=i,++t<n.dbref.collections.length?n.loadNextPartition(t,e):e()})},w.prototype.loadNextPage=function(t){var e=this.dbname+"."+this.pageIterator.collection+"."+this.pageIterator.pageIndex,r=this;this.adapter.loadDatabase(e,function(e){var n=e.split(r.options.delimiter);e="";var i,o=n.length,s=""===n[o-1];for(s&&(n.pop(),o=n.length,""===n[o-1]&&1===o&&(n.pop(),o=n.length)),i=0;i<o;i++)r.dbref.collections[r.pageIterator.collection].data.push(JSON.parse(n[i])),n[i]=null;n=[],s?++r.pageIterator.collection<r.dbref.collections.length?r.loadNextPartition(r.pageIterator.collection,t):t():(r.pageIterator.pageIndex++,r.loadNextPage(t))})},w.prototype.exportDatabase=function(t,e,r){var n,i=e.collections.length;for(this.dbref=e,this.dbname=t,this.dirtyPartitions=[-1],n=0;n<i;n++)e.collections[n].dirty&&this.dirtyPartitions.push(n);this.saveNextPartition(function(t){r(t)})},w.prototype.saveNextPartition=function(t){var e=this,r=this.dirtyPartitions.shift(),n=this.dbname+(-1===r?"":"."+r);if(this.options.paging&&-1!==r)return this.pageIterator={collection:r,docIndex:0,pageIndex:0},void this.saveNextPage(function(r){0===e.dirtyPartitions.length?t(r):e.saveNextPartition(t)});var i=this.dbref.serializeDestructured({partitioned:!0,delimited:!0,partition:r});this.adapter.saveDatabase(n,i,function(r){r?t(r):0===e.dirtyPartitions.length?t(null):e.saveNextPartition(t)})},w.prototype.saveNextPage=function(t){var e=this,r=this.dbref.collections[this.pageIterator.collection],n=this.dbname+"."+this.pageIterator.collection+"."+this.pageIterator.pageIndex,i=0,o=r.data.length,s=this.options.delimiter.length,a="",l="",c=!1,u=!1,h=function(r){l="",r&&t(r),c?t(null):(e.pageIterator.pageIndex++,e.saveNextPage(t))};for(0===r.data.length&&(c=!0);;)if(c||(a=JSON.stringify(r.data[this.pageIterator.docIndex]),l+=a,i+=a.length,++this.pageIterator.docIndex>=o&&(c=!0)),i>=this.options.pageSize&&(u=!0),u&&!c||(l+=this.options.delimiter,i+=s),c||u)return void this.adapter.saveDatabase(n,l,h)},x.prototype.loadDatabase=function(t,e){var r=this;this.fs.stat(t,function(n,i){!n&&i.isFile()?r.fs.readFile(t,{encoding:"utf8"},function(t,r){e(t?new Error(t):r)}):e(null)})},x.prototype.saveDatabase=function(t,e,r){var n=this,i=t+"~";this.fs.writeFile(i,e,function(e){e?r(new Error(e)):n.fs.rename(i,t,r)})},x.prototype.deleteDatabase=function(t,e){this.fs.unlink(t,function(t){t?e(new Error(t)):e()})},I.prototype.loadDatabase=function(t,e){v()?e(localStorage.getItem(t)):e(new Error("localStorage is not available"))},I.prototype.saveDatabase=function(t,e,r){v()?(localStorage.setItem(t,e),r(null)):r(new Error("localStorage is not available"))},I.prototype.deleteDatabase=function(t,e){v()?(localStorage.removeItem(t),e(null)):e(new Error("localStorage is not available"))},m.prototype.throttledSaveDrain=function(t,e){var r=this,n=(new Date).getTime();if(this.throttledSaves||t(!0),(e=e||{}).hasOwnProperty("recursiveWait")||(e.recursiveWait=!0),e.hasOwnProperty("recursiveWaitLimit")||(e.recursiveWaitLimit=!1),e.hasOwnProperty("recursiveWaitLimitDuration")||(e.recursiveWaitLimitDuration=2e3),e.hasOwnProperty("started")||(e.started=(new Date).getTime()),this.throttledSaves&&this.throttledSavePending){if(!e.recursiveWait)return void this.throttledCallbacks.push(t);this.throttledCallbacks.push(function(){return r.throttledSavePending?e.recursiveWaitLimit&&n-e.started>e.recursiveWaitLimitDuration?void t(!1):void r.throttledSaveDrain(t,e):void t(!0)})}else t(!0)},m.prototype.loadDatabaseInternal=function(t,e){var r=e||function(t,e){if(t)throw t},n=this;null!==this.persistenceAdapter?this.persistenceAdapter.loadDatabase(this.filename,function(e){if("string"==typeof e){var i=!1;try{n.loadJSON(e,t||{}),i=!0}catch(t){r(t)}i&&(r(null),n.emit("loaded","database "+n.filename+" loaded"))}else{if(!e)return r(null),void n.emit("loaded","empty database "+n.filename+" loaded");if(e instanceof Error)return void r(e);if("object"==typeof e)return n.loadJSONObject(e,t||{}),r(null),void n.emit("loaded","database "+n.filename+" loaded");r("unexpected adapter response : "+e)}}):r(new Error("persistenceAdapter not configured"))},m.prototype.loadDatabase=function(t,e){var r=this;this.throttledSaves?this.throttledSaveDrain(function(n){if(n)return r.throttledSavePending=!0,void r.loadDatabaseInternal(t,function(t){0===r.throttledCallbacks.length?r.throttledSavePending=!1:r.saveDatabase(),"function"==typeof e&&e(t)});"function"==typeof e&&e(new Error("Unable to pause save throttling long enough to read database"))},t):this.loadDatabaseInternal(t,e)},m.prototype.saveDatabaseInternal=function(t){var e=t||function(t){if(t)throw t},r=this;null!==this.persistenceAdapter?"reference"===this.persistenceAdapter.mode&&"function"==typeof this.persistenceAdapter.exportDatabase?this.persistenceAdapter.exportDatabase(this.filename,this.copy({removeNonSerializable:!0}),function(t){r.autosaveClearFlags(),e(t)}):(r.autosaveClearFlags(),this.persistenceAdapter.saveDatabase(this.filename,r.serialize(),function(t){e(t)})):e(new Error("persistenceAdapter not configured"))},m.prototype.saveDatabase=function(t){if(this.throttledSaves)if(this.throttledSavePending)this.throttledCallbacks.push(t);else{var e=this.throttledCallbacks;this.throttledCallbacks=[],e.unshift(t),this.throttledSavePending=!0;var r=this;this.saveDatabaseInternal(function(t){r.throttledSavePending=!1,e.forEach(function(e){"function"==typeof e&&setTimeout(function(){e(t)},1)}),r.throttledCallbacks.length>0&&r.saveDatabase()})}else this.saveDatabaseInternal(t)},m.prototype.save=m.prototype.saveDatabase,m.prototype.deleteDatabase=function(t,e){var r=e||function(t,e){if(t)throw t};"function"!=typeof t||e||(r=t),null!==this.persistenceAdapter?this.persistenceAdapter.deleteDatabase(this.filename,function(t){r(t)}):r(new Error("persistenceAdapter not configured"))},m.prototype.autosaveDirty=function(){for(var t=0;t<this.collections.length;t++)if(this.collections[t].dirty)return!0;return!1},m.prototype.autosaveClearFlags=function(){for(var t=0;t<this.collections.length;t++)this.collections[t].dirty=!1},m.prototype.autosaveEnable=function(t,e){this.autosave=!0;var r=5e3,n=this;void 0!==this.autosaveInterval&&null!==this.autosaveInterval&&(r=this.autosaveInterval),this.autosaveHandle=setInterval(function(){n.autosaveDirty()&&n.saveDatabase(e)},r)},m.prototype.autosaveDisable=function(){void 0!==this.autosaveHandle&&null!==this.autosaveHandle&&(clearInterval(this.autosaveHandle),this.autosaveHandle=null)},O.prototype.reset=function(){return this.filteredrows.length>0&&(this.filteredrows=[]),this.filterInitialized=!1,this},O.prototype.toJSON=function(){var t=this.copy();return t.collection=null,t},O.prototype.limit=function(t){this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex());var e=new O(this.collection);return e.filteredrows=this.filteredrows.slice(0,t),e.filterInitialized=!0,e},O.prototype.offset=function(t){this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex());var e=new O(this.collection);return e.filteredrows=this.filteredrows.slice(t),e.filterInitialized=!0,e},O.prototype.copy=function(){var t=new O(this.collection);return this.filteredrows.length>0&&(t.filteredrows=this.filteredrows.slice()),t.filterInitialized=this.filterInitialized,t},O.prototype.branch=O.prototype.copy,O.prototype.transform=function(t,r){var n,i,o=this;if("string"==typeof t&&this.collection.transforms.hasOwnProperty(t)&&(t=this.collection.transforms[t]),"object"!=typeof t||!Array.isArray(t))throw new Error("Invalid transform");for(void 0!==r&&(t=e.resolveTransformParams(t,r)),n=0;n<t.length;n++)switch((i=t[n]).type){case"find":o.find(i.value);break;case"where":o.where(i.value);break;case"simplesort":o.simplesort(i.property,i.desc||i.options);break;case"compoundsort":o.compoundsort(i.value);break;case"sort":o.sort(i.value);break;case"limit":o=o.limit(i.value);break;case"offset":o=o.offset(i.value);break;case"map":o=o.map(i.value,i.dataOptions);break;case"eqJoin":o=o.eqJoin(i.joinData,i.leftJoinKey,i.rightJoinKey,i.mapFun,i.dataOptions);break;case"mapReduce":o=o.mapReduce(i.mapFunction,i.reduceFunction);break;case"update":o.update(i.value);break;case"remove":o.remove()}return o},O.prototype.sort=function(t){this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex());var e,r,n=(e=t,r=this.collection.data,function(t,n){return e(r[t],r[n])});return this.filteredrows.sort(n),this},O.prototype.simplesort=function(t,r){var n,i=10,o=this.collection.data.length,s=this.filteredrows.length,a=this.collection.binaryIndices.hasOwnProperty(t);if(void 0!==r&&!1!==r||(r={desc:!1}),!0===r&&(r={desc:!0}),0===s){if(this.filterInitialized)return this;if(this.collection.binaryIndices.hasOwnProperty(t))return this.collection.ensureIndex(t),this.filteredrows=this.collection.binaryIndices[t].values.slice(0),r.desc&&this.filteredrows.reverse(),this;this.filteredrows=this.collection.prepareFullDocIndex()}else if(!r.disableIndexIntersect&&a&&(n=o/s,r.useJavascriptSorting&&(i=6),n<=i||r.forceIndexIntersect)){var l,u=this.filteredrows,h={};for(l=0;l<s;l++)h[u[l]]=!0;var f=this.collection.binaryIndices[t].values;return this.filteredrows=f.filter(function(t){return h[t]}),r.desc&&this.filteredrows.reverse(),this}if(r.useJavascriptSorting)return this.sort(function(e,r){return e[t]===r[t]?0:e[t]>r[t]?1:e[t]<r[t]?-1:void 0});var d,p,y,v,g,m,b=(d=t,p=r.desc,y=this.collection.data,function(t,r){return~d.indexOf(".")?(m=d.split("."),v=e.getIn(y[t],m,!0),g=e.getIn(y[r],m,!0)):(v=y[t][d],g=y[r][d]),c(v,g,p)});return this.filteredrows.sort(b),this},O.prototype.compoundsort=function(t){if(0===t.length)throw new Error("Invalid call to compoundsort, need at least one property");var r;if(1===t.length)return r=t[0],Array.isArray(r)?this.simplesort(r[0],r[1]):this.simplesort(r,!1);for(var n=0,i=t.length;n<i;n+=1)r=t[n],Array.isArray(r)||(t[n]=[r,!1]);this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex());var o,s,a=(o=t,s=this.collection.data,function(t,r){return function(t,r,n){for(var i,o,s,a,l,u=0,h=0,f=t.length;h<f;h++)if(i=t[h],~(o=i[0]).indexOf(".")?(l=o.split("."),s=e.getIn(r,l,!0),a=e.getIn(n,l,!0)):(s=r[o],a=n[o]),0!==(u=c(s,a,i[1])))return u;return 0}(o,s[t],s[r])});return this.filteredrows.sort(a),this},O.prototype.findOr=function(t){for(var e=null,r=0,n=0,i=[],o=[],s=0,a=this.count(),l=0,c=t.length;l<c;l++){if(e=this.branch().find(t[l]).filteredrows,(n=e.length)===a)return this;for(r=0;r<n;r++)s=e[r],void 0===o[s]&&(o[s]=!0,i.push(s))}return this.filteredrows=i,this.filterInitialized=!0,this},O.prototype.$or=O.prototype.findOr,O.prototype.findAnd=function(t){for(var e=0,r=t.length;e<r;e++){if(0===this.count())return this;this.find(t[e])}return this},O.prototype.$and=O.prototype.findAnd,O.prototype.find=function(r,n){if(0===this.collection.data.length)return this.filteredrows=[],this.filterInitialized=!0,this;var i,o,s,a,l,c,h,f=r||"getAll",y=!1,v=[],g=[],m=null;if(n=n||!1,"object"==typeof f){for(i in f)(a={})[i]=f[i],g.push(a),t.call(f,i)&&(o=i,s=f[i]);if(g.length>1)return this.find({$and:g},n)}if(!o||"getAll"===f)return n&&(this.filteredrows=this.collection.data.length>0?[0]:[],this.filterInitialized=!0),this;if("$and"===o||"$or"===o)return this[o](s),n&&this.filteredrows.length>1&&(this.filteredrows=this.filteredrows.slice(0,1)),this;if(null===s||"object"!=typeof s||s instanceof Date)l="$eq",c=s;else{if("object"!=typeof s)throw new Error("Do not know what you want to do.");for(h in s)if(t.call(s,h)){l=h,c=s[h];break}}"$regex"!==l&&"object"!=typeof c||(c=function t(e,r){if("$regex"===e)Array.isArray(r)?r=new RegExp(r[0],r[1]):r instanceof RegExp||(r=new RegExp(r));else if("object"==typeof r)for(var n in r)"$regex"!==n&&"object"!=typeof r[n]||(r[n]=t(n,r[n]));return r}(l,c));var b=-1!==o.indexOf("."),w=!this.filterInitialized;w&&this.collection.binaryIndices[o]&&p[l]&&(!0!==this.collection.adaptiveBinaryIndices&&this.collection.ensureIndex(o),y=!0,m=this.collection.binaryIndices[o]);var x,I=d[l],O=this.collection.data,A=0,P=0,k=0;if(this.filterInitialized)if(x=this.filteredrows,P=x.length,b)for(o=o.split("."),A=0;A<P;A++)k=x[A],u(O[k],o,I,c)&&v.push(k);else for(A=0;A<P;A++)k=x[A],I(O[k][o],c)&&v.push(k);else if(y){var D=this.collection.calculateRange(l,o,c);if("$in"!==l){for(A=D[0];A<=D[1];A++)if(!0!==p[l]){if(p[l](e.getIn(O[m.values[A]],o,b),c)&&(v.push(m.values[A]),n))return this.filteredrows=v,this.filterInitialized=!0,this}else if(v.push(m.values[A]),n)return this.filteredrows=v,this.filterInitialized=!0,this}else for(A=0,P=D.length;A<P;A++)if(v.push(m.values[D[A]]),n)return this.filteredrows=v,this.filterInitialized=!0,this}else if(P=O.length,b){for(o=o.split("."),A=0;A<P;A++)if(u(O[A],o,I,c)&&(v.push(A),n))return this.filteredrows=v,this.filterInitialized=!0,this}else for(A=0;A<P;A++)if(I(O[A][o],c)&&(v.push(A),n))return this.filteredrows=v,this.filterInitialized=!0,this;return this.filteredrows=v,this.filterInitialized=!0,this},O.prototype.where=function(t){var e,r=[];if("function"!=typeof t)throw new TypeError("Argument is not a stored view or a function");e=t;try{if(this.filterInitialized){for(var n=this.filteredrows.length;n--;)!0===e(this.collection.data[this.filteredrows[n]])&&r.push(this.filteredrows[n]);return this.filteredrows=r,this}for(var i=this.collection.data.length;i--;)!0===e(this.collection.data[i])&&r.push(i);return this.filteredrows=r,this.filterInitialized=!0,this}catch(t){throw t}},O.prototype.count=function(){return this.filterInitialized?this.filteredrows.length:this.collection.count()},O.prototype.data=function(t){var e,r,n,i,o=[],s=this.collection.data;if((t=t||{}).removeMeta&&!t.forceClones&&(t.forceClones=!0,t.forceCloneMethod=t.forceCloneMethod||"shallow"),this.collection.disableDeltaChangesApi||(t.forceClones=!0,t.forceCloneMethod="parse-stringify"),!this.filterInitialized){if(0===this.filteredrows.length){if(this.collection.cloneObjects||t.forceClones){for(r=s.length,i=t.forceCloneMethod||this.collection.cloneMethod,n=0;n<r;n++)e=y(s[n],i),t.removeMeta&&(delete e.$loki,delete e.meta),o.push(e);return o}return s.slice()}this.filterInitialized=!0}var a=this.filteredrows;if(r=a.length,this.collection.cloneObjects||t.forceClones)for(i=t.forceCloneMethod||this.collection.cloneMethod,n=0;n<r;n++)e=y(s[a[n]],i),t.removeMeta&&(delete e.$loki,delete e.meta),o.push(e);else for(n=0;n<r;n++)o.push(s[a[n]]);return o},O.prototype.update=function(t){if("function"!=typeof t)throw new TypeError("Argument is not a function");this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex());for(var e,r=this.filteredrows.length,n=this.collection.data,i=0;i<r;i++)this.collection.cloneObjects||!this.collection.disableDeltaChangesApi?(e=y(n[this.filteredrows[i]],this.collection.cloneMethod),t(e),this.collection.update(e)):(t(n[this.filteredrows[i]]),this.collection.update(n[this.filteredrows[i]]));return this},O.prototype.remove=function(){return this.filterInitialized||0!==this.filteredrows.length||(this.filteredrows=this.collection.prepareFullDocIndex()),this.collection.removeBatchByPositions(this.filteredrows),this.filteredrows=[],this},O.prototype.mapReduce=function(t,e){try{return e(this.data().map(t))}catch(t){throw t}},O.prototype.eqJoin=function(t,e,r,n,i){var o,s,a,l=[],c=[],u=[],h="function"==typeof e,f="function"==typeof r,d={};if(l=this.data(i),o=l.length,t instanceof P)c=t.chain().data(i);else if(t instanceof O)c=t.data(i);else{if(!Array.isArray(t))throw new TypeError("joinData needs to be an array or result set");c=t}s=c.length;for(var p=0;p<s;p++)a=f?r(c[p]):c[p][r],d[a]=c[p];n||(n=function(t,e){return{left:t,right:e}});for(var y=0;y<o;y++)a=h?e(l[y]):l[y][e],u.push(n(l[y],d[a]||{}));return this.collection=new P("joinData"),this.collection.insert(u),this.filteredrows=[],this.filterInitialized=!1,this},O.prototype.map=function(t,e){var r=this.data(e).map(t);return this.collection=new P("mappedData"),this.collection.insert(r),this.filteredrows=[],this.filterInitialized=!1,this},A.prototype=new g,A.prototype.rematerialize=function(t){var e,r,n;if(t=t||{},this.resultdata=[],this.resultsdirty=!0,this.resultset=new O(this.collection),(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple)&&(this.sortDirty=!0),t.hasOwnProperty("removeWhereFilters"))for(e=this.filterPipeline.length,r=e;r--;)"where"===this.filterPipeline[r].type&&(r!==this.filterPipeline.length-1&&(this.filterPipeline[r]=this.filterPipeline[this.filterPipeline.length-1]),this.filterPipeline.length--);var i=this.filterPipeline;for(this.filterPipeline=[],e=i.length,n=0;n<e;n++)this.applyFind(i[n].val);return this.data(),this.emit("rebuild",this),this},A.prototype.branchResultset=function(t,e){var r=this.resultset.branch();return void 0===t?r:r.transform(t,e)},A.prototype.toJSON=function(){var t=new A(this.collection,this.name,this.options);return t.resultset=this.resultset,t.resultdata=[],t.resultsdirty=!0,t.filterPipeline=this.filterPipeline,t.sortFunction=this.sortFunction,t.sortCriteria=this.sortCriteria,t.sortCriteriaSimple=this.sortCriteriaSimple||null,t.sortDirty=this.sortDirty,t.collection=null,t},A.prototype.removeFilters=function(t){t=t||{},this.rebuildPending=!1,this.resultset.reset(),this.resultdata=[],this.resultsdirty=!0,this.cachedresultset=null,this.filterPipeline=[],this.sortFunction=null,this.sortCriteria=null,this.sortCriteriaSimple=null,this.sortDirty=!1,!0===t.queueSortPhase&&this.queueSortPhase()},A.prototype.applySort=function(t){return this.sortFunction=t,this.sortCriteria=null,this.sortCriteriaSimple=null,this.queueSortPhase(),this},A.prototype.applySimpleSort=function(t,e){return this.sortCriteriaSimple={propname:t,options:e||!1},this.sortCriteria=null,this.sortFunction=null,this.queueSortPhase(),this},A.prototype.applySortCriteria=function(t){return this.sortCriteria=t,this.sortCriteriaSimple=null,this.sortFunction=null,this.queueSortPhase(),this},A.prototype.startTransaction=function(){return this.cachedresultset=this.resultset.copy(),this},A.prototype.commit=function(){return this.cachedresultset=null,this},A.prototype.rollback=function(){return this.resultset=this.cachedresultset,this.options.persistent&&(this.resultdata=this.resultset.data(),this.emit("rebuild",this)),this},A.prototype._indexOfFilterWithId=function(t){if("string"==typeof t||"number"==typeof t)for(var e=0,r=this.filterPipeline.length;e<r;e+=1)if(t===this.filterPipeline[e].uid)return e;return-1},A.prototype._addFilter=function(t){this.filterPipeline.push(t),this.resultset[t.type](t.val)},A.prototype.reapplyFilters=function(){this.resultset.reset(),this.cachedresultset=null,this.options.persistent&&(this.resultdata=[],this.resultsdirty=!0);var t=this.filterPipeline;this.filterPipeline=[];for(var e=0,r=t.length;e<r;e+=1)this._addFilter(t[e]);return this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent(),this},A.prototype.applyFilter=function(t){var e=this._indexOfFilterWithId(t.uid);return e>=0?(this.filterPipeline[e]=t,this.reapplyFilters()):(this.cachedresultset=null,this.options.persistent&&(this.resultdata=[],this.resultsdirty=!0),this._addFilter(t),this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent(),this)},A.prototype.applyFind=function(t,e){return this.applyFilter({type:"find",val:t,uid:e}),this},A.prototype.applyWhere=function(t,e){return this.applyFilter({type:"where",val:t,uid:e}),this},A.prototype.removeFilter=function(t){var e=this._indexOfFilterWithId(t);if(e<0)throw new Error("Dynamic view does not contain a filter with ID: "+t);return this.filterPipeline.splice(e,1),this.reapplyFilters(),this},A.prototype.count=function(){return this.resultsdirty&&(this.resultdata=this.resultset.data()),this.resultset.count()},A.prototype.data=function(t){return(this.sortDirty||this.resultsdirty)&&this.performSortPhase({suppressRebuildEvent:!0}),this.options.persistent?this.resultdata:this.resultset.data(t)},A.prototype.queueRebuildEvent=function(){if(!this.rebuildPending){this.rebuildPending=!0;var t=this;setTimeout(function(){t.rebuildPending&&(t.rebuildPending=!1,t.emit("rebuild",t))},this.options.minRebuildInterval)}},A.prototype.queueSortPhase=function(){if(!this.sortDirty){this.sortDirty=!0;var t=this;"active"===this.options.sortPriority?setTimeout(function(){t.performSortPhase()},this.options.minRebuildInterval):this.queueRebuildEvent()}},A.prototype.performSortPhase=function(t){(this.sortDirty||this.resultsdirty)&&(t=t||{},this.sortDirty&&(this.sortFunction?this.resultset.sort(this.sortFunction):this.sortCriteria?this.resultset.compoundsort(this.sortCriteria):this.sortCriteriaSimple&&this.resultset.simplesort(this.sortCriteriaSimple.propname,this.sortCriteriaSimple.options),this.sortDirty=!1),this.options.persistent&&(this.resultdata=this.resultset.data(),this.resultsdirty=!1),t.suppressRebuildEvent||this.emit("rebuild",this))},A.prototype.evaluateDocument=function(t,e){if(!this.resultset.filterInitialized)return this.options.persistent&&(this.resultdata=this.resultset.data()),void(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent());var r,n=this.resultset.filteredrows,i=e?-1:n.indexOf(+t),o=n.length,s=new O(this.collection);s.filteredrows=[t],s.filterInitialized=!0;for(var a=0,l=this.filterPipeline.length;a<l;a++)r=this.filterPipeline[a],s[r.type](r.val);var c=0===s.filteredrows.length?-1:0;return-1!==i||-1!==c?-1===i&&-1!==c?(n.push(t),this.options.persistent&&this.resultdata.push(this.collection.data[t]),void(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent())):-1!==i&&-1===c?(i<o-1?(n.splice(i,1),this.options.persistent&&this.resultdata.splice(i,1)):(n.length=o-1,this.options.persistent&&(this.resultdata.length=o-1)),void(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent())):-1!==i&&-1!==c?(this.options.persistent&&(this.resultdata[i]=this.collection.data[t]),void(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent())):void 0:void 0},A.prototype.removeDocument=function(t){var e,r,n,i={},o={},s=[],a=this.resultset,l=this.resultset.filteredrows,c=l.length;if(!this.resultset.filterInitialized)return this.options.persistent&&(this.resultdata=this.resultset.data()),void(this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent());for(Array.isArray(t)||(t=[t]),n=t.length,r=0;r<n;r++)i[t[r]]=!0;for(e=0;e<c;e++)i[l[e]]&&(o[e]=!0);Object.keys(o).length>0&&(this.resultset.filteredrows=this.resultset.filteredrows.filter(function(t,e){return!o[e]}),this.options.persistent&&(this.resultdata=this.resultdata.filter(function(t,e){return!o[e]})),this.sortFunction||this.sortCriteria||this.sortCriteriaSimple?this.queueSortPhase():this.queueRebuildEvent());var u=function(t){return function(e){return e<a.filteredrows[t]}};for(c=a.filteredrows.length,e=0;e<c;e++)s=t.filter(u(e)),a.filteredrows[e]-=s.length},A.prototype.mapReduce=function(t,e){try{return e(this.data().map(t))}catch(t){throw t}},P.prototype=new g,P.prototype.createChange=function(t,e,r,n){this.changes.push({name:t,operation:e,obj:"U"!=e||this.disableDeltaChangesApi?JSON.parse(JSON.stringify(r)):this.getChangeDelta(r,n)})},P.prototype.insertMeta=function(t){var e,r;if(!this.disableMeta&&t)if(Array.isArray(t))for(e=t.length,r=0;r<e;r++)t[r].hasOwnProperty("meta")||(t[r].meta={}),t[r].meta.created=(new Date).getTime(),t[r].meta.revision=0;else t.meta||(t.meta={}),t.meta.created=(new Date).getTime(),t.meta.revision=0},P.prototype.updateMeta=function(t){!this.disableMeta&&t&&(t.meta.updated=(new Date).getTime(),t.meta.revision+=1)},P.prototype.createInsertChange=function(t){this.createChange(this.name,"I",t)},P.prototype.createUpdateChange=function(t,e){this.createChange(this.name,"U",t,e)},P.prototype.insertMetaWithChange=function(t){this.insertMeta(t),this.createInsertChange(t)},P.prototype.updateMetaWithChange=function(t,e){this.updateMeta(t),this.createUpdateChange(t,e)},P.prototype.console={log:function(){},warn:function(){},error:function(){}},P.prototype.addAutoUpdateObserver=function(t){this.autoupdate&&"function"==typeof Object.observe&&Object.observe(t,this.observerCallback,["add","update","delete","reconfigure","setPrototype"])},P.prototype.removeAutoUpdateObserver=function(t){this.autoupdate&&"function"==typeof Object.observe&&Object.unobserve(t,this.observerCallback)},P.prototype.addTransform=function(t,e){if(this.transforms.hasOwnProperty(t))throw new Error("a transform by that name already exists");this.transforms[t]=e},P.prototype.getTransform=function(t){return this.transforms[t]},P.prototype.setTransform=function(t,e){this.transforms[t]=e},P.prototype.removeTransform=function(t){delete this.transforms[t]},P.prototype.byExample=function(t){var e,r,n;for(e in n=[],t)t.hasOwnProperty(e)&&n.push(((r={})[e]=t[e],r));return{$and:n}},P.prototype.findObject=function(t){return this.findOne(this.byExample(t))},P.prototype.findObjects=function(t){return this.find(this.byExample(t))},P.prototype.ttlDaemonFuncGen=function(){var t=this,e=this.ttl.age;return function(){var r=Date.now(),n=t.chain().where(function(t){var n=t.meta.updated||t.meta.created,i=r-n;return e<i});n.remove()}},P.prototype.setTTL=function(t,e){t<0?clearInterval(this.ttl.daemon):(this.ttl.age=t,this.ttl.ttlInterval=e,this.ttl.daemon=setInterval(this.ttlDaemonFuncGen(),e))},P.prototype.prepareFullDocIndex=function(){for(var t=this.data.length,e=new Array(t),r=0;r<t;r+=1)e[r]=r;return e},P.prototype.configureOptions=function(t){(t=t||{}).hasOwnProperty("adaptiveBinaryIndices")&&(this.adaptiveBinaryIndices=t.adaptiveBinaryIndices,this.adaptiveBinaryIndices&&this.ensureAllIndexes())},P.prototype.ensureIndex=function(t,r){if(void 0===r&&(r=!1),null==t)throw new Error("Attempting to set index without an associated property");if((!this.binaryIndices[t]||r||this.binaryIndices[t].dirty)&&(!0!==this.adaptiveBinaryIndices||!this.binaryIndices.hasOwnProperty(t)||r)){var n={name:t,dirty:!0,values:this.prepareFullDocIndex()};this.binaryIndices[t]=n;var i,s,a,l,c,u=(i=t,s=this.data,function(t,r){if(~i.indexOf(".")?(c=i.split("."),a=e.getIn(s[t],c,!0),l=e.getIn(s[r],c,!0)):(a=s[t][i],l=s[r][i]),a!==l){if(o.lt(a,l,!1))return-1;if(o.gt(a,l,!1))return 1}return 0});n.values.sort(u),n.dirty=!1,this.dirty=!0}},P.prototype.checkAllIndexes=function(e){var r,n=this.binaryIndices,i=[];for(r in n)t.call(n,r)&&(this.checkIndex(r,e)||i.push(r));return i},P.prototype.checkIndex=function(t,r){(r=r||{}).randomSamplingFactor&&!1!==r.randomSampling&&(r.randomSampling=!0),r.randomSamplingFactor=r.randomSamplingFactor||.1,(r.randomSamplingFactor<0||r.randomSamplingFactor>1)&&(r.randomSamplingFactor=.1);var n,i,o,s,a,l=!0;if(!this.binaryIndices.hasOwnProperty(t))throw new Error("called checkIndex on property without an index: "+t);if(this.adaptiveBinaryIndices||this.ensureIndex(t),a=this.binaryIndices[t].values,(s=a.length)!==this.data.length)return r.repair&&this.ensureIndex(t,!0),!1;if(0===s)return!0;var c=-1!==t.indexOf(".");if(1===s)l=0===a[0];else if(r.randomSampling){if(d.$lte(e.getIn(this.data[a[0]],t,c),e.getIn(this.data[a[1]],t,c))||(l=!1),d.$lte(e.getIn(this.data[a[s-2]],t,c),e.getIn(this.data[a[s-1]],t,c))||(l=!1),l)for(i=Math.floor((s-1)*r.randomSamplingFactor),n=0;n<i-1;n++)if(o=Math.floor(Math.random()*(s-1)),!d.$lte(e.getIn(this.data[a[o]],t,c),e.getIn(this.data[a[o+1]],t,c))){l=!1;break}}else for(n=0;n<s-1;n++)if(!d.$lte(e.getIn(this.data[a[n]],t,c),e.getIn(this.data[a[n+1]],t,c))){l=!1;break}return!l&&r.repair&&this.ensureIndex(t,!0),l},P.prototype.getBinaryIndexValues=function(t){var r,n=this.binaryIndices[t].values,i=[];for(r=0;r<n.length;r++)i.push(e.getIn(this.data[n[r]],t,!0));return i},P.prototype.ensureUniqueIndex=function(t){var e=this.constraints.unique[t];return e||-1==this.uniqueNames.indexOf(t)&&this.uniqueNames.push(t),this.constraints.unique[t]=e=new F(t),this.data.forEach(function(t){e.set(t)}),e},P.prototype.ensureAllIndexes=function(e){var r,n=this.binaryIndices;for(r in n)t.call(n,r)&&this.ensureIndex(r,e)},P.prototype.flagBinaryIndexesDirty=function(){var e,r=this.binaryIndices;for(e in r)t.call(r,e)&&(r[e].dirty=!0)},P.prototype.flagBinaryIndexDirty=function(t){this.binaryIndices[t]&&(this.binaryIndices[t].dirty=!0)},P.prototype.count=function(t){return t?this.chain().find(t).filteredrows.length:this.data.length},P.prototype.ensureId=function(){var t=this.data.length,e=0;for(this.idIndex=[];e<t;e+=1)this.idIndex.push(this.data[e].$loki)},P.prototype.ensureIdAsync=function(t){this.async(function(){this.ensureId()},t)},P.prototype.addDynamicView=function(t,e){var r=new A(this,t,e);return this.DynamicViews.push(r),r},P.prototype.removeDynamicView=function(t){this.DynamicViews=this.DynamicViews.filter(function(e){return e.name!==t})},P.prototype.getDynamicView=function(t){for(var e=0;e<this.DynamicViews.length;e++)if(this.DynamicViews[e].name===t)return this.DynamicViews[e];return null},P.prototype.findAndUpdate=function(t,e){"function"==typeof t?this.updateWhere(t,e):this.chain().find(t).update(e)},P.prototype.findAndRemove=function(t){this.chain().find(t).remove()},P.prototype.insert=function(t){if(!Array.isArray(t))return this.insertOne(t);var e,r=[];this.emit("pre-insert",t);for(var n=0,i=t.length;n<i;n++){if(!(e=this.insertOne(t[n],!0)))return;r.push(e)}return this.emit("insert",r),1===(r=this.cloneObjects?y(r,this.cloneMethod):r).length?r[0]:r},P.prototype.insertOne=function(t,e){var r,n=null;if("object"!=typeof t?n=new TypeError("Document needs to be an object"):null===t&&(n=new TypeError("Object cannot be null")),null!==n)throw this.emit("error",n),n;var i=this.cloneObjects?y(t,this.cloneMethod):t;if(this.disableMeta||void 0!==i.meta||(i.meta={revision:0,created:0}),e||this.emit("pre-insert",i),this.add(i))return this.disableChangesApi?this.insertMeta(i):this.insertMetaWithChange(i),r=this.cloneObjects?y(i,this.cloneMethod):i,e||this.emit("insert",r),this.addAutoUpdateObserver(r),r},P.prototype.clear=function(t){var e=this;if(t=t||{},this.data=[],this.idIndex=[],this.cachedIndex=null,this.cachedBinaryIndex=null,this.cachedData=null,this.maxId=0,this.DynamicViews=[],this.dirty=!0,!0===t.removeIndices)this.binaryIndices={},this.constraints={unique:{},exact:{}},this.uniqueNames=[];else{var r=Object.keys(this.binaryIndices);r.forEach(function(t){e.binaryIndices[t].dirty=!1,e.binaryIndices[t].values=[]}),this.constraints={unique:{},exact:{}},this.uniqueNames.forEach(function(t){e.ensureUniqueIndex(t)})}},P.prototype.update=function(e){var r,n,i;if(Array.isArray(e)){i=e.length,(r=!this.cloneObjects&&this.adaptiveBinaryIndices&&Object.keys(this.binaryIndices).length>0)&&(this.adaptiveBinaryIndices=!1);try{for(n=0;n<i;n+=1)this.update(e[n])}finally{r&&(this.ensureAllIndexes(),this.adaptiveBinaryIndices=!0)}}else{if(!t.call(e,"$loki"))throw new Error("Trying to update unsynced document. Please save the document first by using insert() or addMany()");try{this.startTransaction();var o,s,a,l,c,u=this.get(e.$loki,!0),h=this;if(!u)throw new Error("Trying to update a document not in collection.");o=u[0],a=u[1],s=this.cloneObjects||!this.disableDeltaChangesApi?y(e,this.cloneMethod):e,this.emit("pre-update",e),Object.keys(this.constraints.unique).forEach(function(t){h.constraints.unique[t].update(o,s)}),this.data[a]=s,s!==e&&this.addAutoUpdateObserver(e);for(var f=0;f<this.DynamicViews.length;f++)this.DynamicViews[f].evaluateDocument(a,!1);if(this.adaptiveBinaryIndices){var d=this.binaryIndices;for(l in d)this.adaptiveBinaryIndexUpdate(a,l)}else this.flagBinaryIndexesDirty();return this.idIndex[a]=s.$loki,this.commit(),this.dirty=!0,this.disableChangesApi?this.updateMeta(s,null):this.updateMetaWithChange(s,o),c=this.cloneObjects?y(s,this.cloneMethod):s,this.emit("update",c,o),c}catch(t){throw this.rollback(),this.console.error(t.message),this.emit("error",t),t}}},P.prototype.add=function(e){if("object"!=typeof e)throw new TypeError("Object being added needs to be an object");if(void 0!==e.$loki)throw new Error("Document is already in collection, please use update()");try{this.startTransaction(),this.maxId++,isNaN(this.maxId)&&(this.maxId=this.data[this.data.length-1].$loki+1),e.$loki=this.maxId,this.disableMeta||(e.meta.version=0);var r,n=this.constraints.unique;for(r in n)t.call(n,r)&&n[r].set(e);this.idIndex.push(e.$loki),this.data.push(e);for(var i=this.data.length-1,o=this.DynamicViews.length,s=0;s<o;s++)this.DynamicViews[s].evaluateDocument(i,!0);if(this.adaptiveBinaryIndices){var a=this.binaryIndices;for(r in a)this.adaptiveBinaryIndexInsert(i,r)}else this.flagBinaryIndexesDirty();return this.commit(),this.dirty=!0,this.cloneObjects?y(e,this.cloneMethod):e}catch(t){throw this.rollback(),this.console.error(t.message),this.emit("error",t),t}},P.prototype.updateWhere=function(t,e){var r,n=this.where(t),i=0;try{for(;i<n.length;i++)r=e(n[i]),this.update(r)}catch(t){this.rollback(),this.console.error(t.message)}},P.prototype.removeWhere=function(t){var e;"function"==typeof t?(e=this.data.filter(t),this.remove(e)):this.chain().find(t).remove()},P.prototype.removeDataOnly=function(){this.remove(this.data.slice())},P.prototype.removeBatchByPositions=function(t){var e,r,n,i,o=t.length,s={},a=Object.keys(this.binaryIndices).length,l=Object.keys(this.constraints.unique).length,c=this.adaptiveBinaryIndices&&Object.keys(this.binaryIndices).length>0,u=this;try{for(this.startTransaction(),n=0;n<o;n++)s[this.idIndex[t[n]]]=!0;if((e=this.DynamicViews.length)>0||a>0||l>0){if(e>0)for(r=0;r<e;r++)this.DynamicViews[r].removeDocument(t);if(this.adaptiveBinaryIndices&&!c){var h,f=this.binaryIndices;for(h in f)this.adaptiveBinaryIndexRemove(t,h)}else this.flagBinaryIndexesDirty();l&&Object.keys(this.constraints.unique).forEach(function(e){for(n=0;n<o;n++)null!==(i=u.data[t[n]])[e]&&void 0!==i[e]&&u.constraints.unique[e].remove(i[e])})}if(!this.disableChangesApi||this.events.delete.length>1)for(n=0;n<o;n++)this.emit("delete",this.data[t[n]]);this.data=this.data.filter(function(t){return!s[t.$loki]}),this.idIndex=this.idIndex.filter(function(t){return!s[t]}),this.adaptiveBinaryIndices&&c&&(this.adaptiveBinaryIndices=!1,this.ensureAllIndexes(!0),this.adaptiveBinaryIndices=!0),this.commit(),this.dirty=!0}catch(t){return this.rollback(),c&&(this.adaptiveBinaryIndices=!0),this.console.error(t.message),this.emit("error",t),null}},P.prototype.removeBatch=function(t){var e,r=t.length,n=this.data.length,i={},o=[];for(e=0;e<n;e++)i[this.data[e].$loki]=e;for(e=0;e<r;e++)"object"==typeof t[e]?o.push(i[t[e].$loki]):o.push(i[t[e]]);this.removeBatchByPositions(o)},P.prototype.remove=function(e){if("number"==typeof e&&(e=this.get(e)),"object"!=typeof e)throw new Error("Parameter is not an object");if(Array.isArray(e))this.removeBatch(e);else{if(!t.call(e,"$loki"))throw new Error("Object is not a document stored in the collection");try{this.startTransaction();var r=this.get(e.$loki,!0),n=r[1],i=this;Object.keys(this.constraints.unique).forEach(function(t){null!==e[t]&&void 0!==e[t]&&i.constraints.unique[t].remove(e[t])});for(var o=0;o<this.DynamicViews.length;o++)this.DynamicViews[o].removeDocument(n);if(this.adaptiveBinaryIndices){var s,a=this.binaryIndices;for(s in a)this.adaptiveBinaryIndexRemove(n,s)}else this.flagBinaryIndexesDirty();return this.data.splice(n,1),this.removeAutoUpdateObserver(e),this.idIndex.splice(n,1),this.commit(),this.dirty=!0,this.emit("delete",r[0]),delete e.$loki,delete e.meta,e}catch(t){return this.rollback(),this.console.error(t.message),this.emit("error",t),null}}},P.prototype.get=function(t,e){var r=e||!1,n=this.idIndex,i=n.length-1,o=0,s=o+i>>1;if(t="number"==typeof t?t:parseInt(t,10),isNaN(t))throw new TypeError("Passed id is not an integer");for(;n[o]<n[i];)n[s=o+i>>1]<t?o=s+1:i=s;return i===o&&n[o]===t?r?[this.data[o],o]:this.data[o]:null},P.prototype.getBinaryIndexPosition=function(t,r){var n=e.getIn(this.data[t],r,!0),i=this.binaryIndices[r].values,o=this.calculateRange("$eq",r,n);if(0===o[0]&&-1===o[1])return null;for(var s=o[0],a=o[1],l=s;l<=a;l++)if(i[l]===t)return l;return null},P.prototype.adaptiveBinaryIndexInsert=function(t,r){var n=-1!==r.indexOf("."),i=this.binaryIndices[r].values,o=e.getIn(this.data[t],r,n);!0===this.serializableIndices&&o instanceof Date&&(this.data[t][r]=o.getTime(),o=e.getIn(this.data[t],r));var s=0===i.length?0:this.calculateRangeStart(r,o,!0,n);this.binaryIndices[r].values.splice(s,0,t)},P.prototype.adaptiveBinaryIndexUpdate=function(t,e){var r,n=this.binaryIndices[e].values,i=n.length;for(r=0;r<i&&n[r]!==t;r++);this.binaryIndices[e].values.splice(r,1),this.adaptiveBinaryIndexInsert(t,e)},P.prototype.adaptiveBinaryIndexRemove=function(t,e,r){var n,i,o,s,a,l,c,u=this.binaryIndices[e],h={};if(Array.isArray(t)){if(1!==(s=t.length)){for(o=0;o<s;o++)h[t[o]]=!0;if(u.values=u.values.filter(function(t){return!h[t]}),!0===r)return;var f=t.slice();for(f.sort(function(t,e){return t-e}),n=u.values.length,i=0;i<n;i++){for(a=u.values[i],l=0,o=0;o<s&&a>f[o];o++)l++;u.values[i]-=l}return}t=t[0]}if(null===(c=this.getBinaryIndexPosition(t,e)))return null;if(u.values.splice(c,1),!0!==r)for(n=u.values.length,i=0;i<n;i++)u.values[i]>t&&u.values[i]--},P.prototype.calculateRangeStart=function(t,r,n,i){var s=this.data,a=this.binaryIndices[t].values,l=0,c=a.length-1,u=0;if(0===a.length)return-1;for(e.getIn(s[a[l]],t,i),e.getIn(s[a[c]],t,i);l<c;)u=l+c>>1,o.lt(e.getIn(s[a[u]],t,i),r,!1)?l=u+1:c=u;var h=l;return o.aeq(r,e.getIn(s[a[h]],t,i))?h:o.lt(r,e.getIn(s[a[h]],t,i),!1)?n?h:h-1:n?h+1:h},P.prototype.calculateRangeEnd=function(t,r,n){var i=this.data,s=this.binaryIndices[t].values,a=0,l=s.length-1,c=0;if(0===s.length)return-1;for(e.getIn(i[s[a]],t,n),e.getIn(i[s[l]],t,n);a<l;)c=a+l>>1,o.lt(r,e.getIn(i[s[c]],t,n),!1)?l=c:a=c+1;var u=l;return o.aeq(r,e.getIn(i[s[u]],t,n))?u:o.gt(r,e.getIn(i[s[u]],t,n),!1)?u+1:o.aeq(r,e.getIn(i[s[u-1]],t,n))?u-1:u},P.prototype.calculateRange=function(t,r,n){var i,s,a,l=this.data,c=this.binaryIndices[r].values,u=c.length-1;if(0===l.length)return[0,-1];var h=-1!==r.indexOf("."),f=e.getIn(l[c[0]],r,h),d=e.getIn(l[c[u]],r,h);switch(t){case"$eq":case"$aeq":case"$dteq":if(o.lt(n,f,!1)||o.gt(n,d,!1))return[0,-1];break;case"$gt":if(o.gt(n,d,!0))return[0,-1];if(o.gt(f,n,!1))return[0,u];break;case"$gte":if(o.gt(n,d,!1))return[0,-1];if(o.gt(f,n,!0))return[0,u];break;case"$lt":if(o.lt(n,f,!0))return[0,-1];if(o.lt(d,n,!1))return[0,u];break;case"$lte":if(o.lt(n,f,!1))return[0,-1];if(o.lt(d,n,!0))return[0,u];break;case"$between":return o.gt(n[0],d,!1)?[0,-1]:o.lt(n[1],f,!1)?[0,-1]:(i=this.calculateRangeStart(r,n[0],!1,h),a=this.calculateRangeEnd(r,n[1],h),i<0&&i++,a>u&&a--,o.gt(e.getIn(l[c[i]],r,h),n[0],!0)||i++,o.lt(e.getIn(l[c[a]],r,h),n[1],!0)||a--,a<i?[0,-1]:[i,a]);case"$in":for(var p=[],y=[],v=0,g=n.length;v<g;v++)for(var m=this.calculateRange("$eq",r,n[v]),b=m[0];b<=m[1];b++)void 0===p[b]&&(p[b]=!0,y.push(b));return y}switch(t){case"$eq":case"$aeq":case"$dteq":case"$gte":case"$lt":i=this.calculateRangeStart(r,n,!1,h),s=e.getIn(l[c[i]],r,h)}switch(t){case"$eq":case"$aeq":case"$dteq":case"$lte":case"$gt":a=this.calculateRangeEnd(r,n,h),e.getIn(l[c[a]],r,h)}switch(t){case"$eq":case"$aeq":case"$dteq":return o.aeq(s,n)?[i,a]:[0,-1];case"$gt":return o.aeq(e.getIn(l[c[a]],r,h),n)?[a+1,u]:[a,u];case"$gte":return o.aeq(e.getIn(l[c[i]],r,h),n)?[i,u]:[i+1,u];case"$lt":return o.aeq(e.getIn(l[c[i]],r,h),n)?[0,i-1]:[0,i];case"$lte":return o.aeq(e.getIn(l[c[a]],r,h),n)?[0,a]:[0,a-1];default:return[0,l.length-1]}},P.prototype.by=function(t,e){var r;if(void 0===e)return r=this,function(e){return r.by(t,e)};var n=this.constraints.unique[t].get(e);return this.cloneObjects?y(n,this.cloneMethod):n},P.prototype.findOne=function(t){t=t||{};var e=this.chain().find(t,!0).data();return Array.isArray(e)&&0===e.length?null:this.cloneObjects?y(e[0],this.cloneMethod):e[0]},P.prototype.chain=function(t,e){var r=new O(this);return void 0===t?r:r.transform(t,e)},P.prototype.find=function(t){return this.chain().find(t).data()},P.prototype.findOneUnindexed=function(t,r){for(var n=this.data.length;n--;)if(e.getIn(this.data[n],t,!0)===r)return this.data[n];return null},P.prototype.startTransaction=function(){if(this.transactional){this.cachedData=y(this.data,this.cloneMethod),this.cachedIndex=this.idIndex,this.cachedBinaryIndex=this.binaryIndices;for(var t=0;t<this.DynamicViews.length;t++)this.DynamicViews[t].startTransaction()}},P.prototype.commit=function(){if(this.transactional){this.cachedData=null,this.cachedIndex=null,this.cachedBinaryIndex=null;for(var t=0;t<this.DynamicViews.length;t++)this.DynamicViews[t].commit()}},P.prototype.rollback=function(){if(this.transactional){null!==this.cachedData&&null!==this.cachedIndex&&(this.data=this.cachedData,this.idIndex=this.cachedIndex,this.binaryIndices=this.cachedBinaryIndex);for(var t=0;t<this.DynamicViews.length;t++)this.DynamicViews[t].rollback()}},P.prototype.async=function(t,e){setTimeout(function(){if("function"!=typeof t)throw new TypeError("Argument passed for async execution is not a function");t(),e()},0)},P.prototype.where=function(t){return this.chain().where(t).data()},P.prototype.mapReduce=function(t,e){try{return e(this.data.map(t))}catch(t){throw t}},P.prototype.eqJoin=function(t,e,r,n,i){return new O(this).eqJoin(t,e,r,n,i)},P.prototype.stages={},P.prototype.getStage=function(t){return this.stages[t]||(this.stages[t]={}),this.stages[t]},P.prototype.commitLog=[],P.prototype.stage=function(t,e){var r=JSON.parse(JSON.stringify(e));return this.getStage(t)[e.$loki]=r,r},P.prototype.commitStage=function(t,e){var r,n=this.getStage(t),i=(new Date).getTime();for(r in n)this.update(n[r]),this.commitLog.push({timestamp:i,message:e,data:JSON.parse(JSON.stringify(n[r]))});this.stages[t]={}},P.prototype.no_op=function(){},P.prototype.extract=function(t){for(var e=0,r=this.data.length,n=k(t),i=[];e<r;e+=1)i.push(j(this.data[e],t,n));return i},P.prototype.max=function(t){return Math.max.apply(null,this.extract(t))},P.prototype.min=function(t){return Math.min.apply(null,this.extract(t))},P.prototype.maxRecord=function(t){for(var e,r=0,n=this.data.length,i=k(t),o={index:0,value:void 0};r<n;r+=1)void 0!==e?e<j(this.data[r],t,i)&&(e=j(this.data[r],t,i),o.index=this.data[r].$loki):(e=j(this.data[r],t,i),o.index=this.data[r].$loki);return o.value=e,o},P.prototype.minRecord=function(t){for(var e,r=0,n=this.data.length,i=k(t),o={index:0,value:void 0};r<n;r+=1)void 0!==e?e>j(this.data[r],t,i)&&(e=j(this.data[r],t,i),o.index=this.data[r].$loki):(e=j(this.data[r],t,i),o.index=this.data[r].$loki);return o.value=e,o},P.prototype.extractNumerical=function(t){return this.extract(t).map(D).filter(Number).filter(function(t){return!isNaN(t)})},P.prototype.avg=function(t){return E(this.extractNumerical(t))},P.prototype.stdDev=function(t){return e=this.extractNumerical(t),r=E(e),n=E(e.map(function(t){var e=t-r,n=e*e;return n})),Math.sqrt(n);var e,r,n},P.prototype.mode=function(t){var e,r,n,i={},o=this.extract(t);for(r in o.forEach(function(t){i[t]?i[t]+=1:i[t]=1}),i)e?e<i[r]&&(n=r):(n=r,e=i[r]);return n},P.prototype.median=function(t){var e=this.extractNumerical(t);e.sort(C);var r=Math.floor(e.length/2);return e.length%2?e[r]:(e[r-1]+e[r])/2},$.prototype={keys:[],values:[],sort:function(t,e){return t<e?-1:t>e?1:0},setSort:function(t){this.bs=new N(t)},bs:function(){return new N(this.sort)},set:function(t,e){var r=this.bs(this.keys,t);r.found?this.values[r.index]=e:(this.keys.splice(r.index,0,t),this.values.splice(r.index,0,e))},get:function(t){return this.values[M(this.keys,t,this.sort).index]}},F.prototype.keyMap={},F.prototype.lokiMap={},F.prototype.set=function(t){var e=t[this.field];if(null!=e){if(this.keyMap[e])throw new Error("Duplicate key for property "+this.field+": "+e);this.keyMap[e]=t,this.lokiMap[t.$loki]=e}},F.prototype.get=function(t){return this.keyMap[t]},F.prototype.byId=function(t){return this.keyMap[this.lokiMap[t]]},F.prototype.update=function(t,e){if(this.lokiMap[t.$loki]!==e[this.field]){var r=this.lokiMap[t.$loki];this.set(e),this.keyMap[r]=void 0}else this.keyMap[t[this.field]]=e},F.prototype.remove=function(t){var e=this.keyMap[t];if(null==e)throw new Error("Key is not in unique index: "+this.field);this.keyMap[t]=void 0,this.lokiMap[e.$loki]=void 0},F.prototype.clear=function(){this.keyMap={},this.lokiMap={}},R.prototype={set:function(t,e){this.index[t]?this.index[t].push(e):this.index[t]=[e]},remove:function(t,e){var r=this.index[t];for(var n in r)r[n]==e&&r.splice(n,1);r.length<1&&(this.index[t]=void 0)},get:function(t){return this.index[t]},clear:function(t){this.index={}}},m.LokiOps=d,m.Collection=P,m.KeyValueStore=$,m.LokiMemoryAdapter=b,m.LokiPartitioningAdapter=w,m.LokiLocalStorageAdapter=I,m.LokiFsAdapter=x,m.persistenceAdapters={fs:x,localStorage:I},m.aeq=s,m.lt=a,m.gt=l,m.Comparators=o,m}()})?o.apply(e,s):o)||(t.exports=a)}).call(this,r(0),r(6))},function(t,e){var r,n,i=t.exports={};function o(){throw new Error("setTimeout has not been defined")}function s(){throw new Error("clearTimeout has not been defined")}function a(t){if(r===setTimeout)return setTimeout(t,0);if((r===o||!r)&&setTimeout)return r=setTimeout,setTimeout(t,0);try{return r(t,0)}catch(e){try{return r.call(null,t,0)}catch(e){return r.call(this,t,0)}}}!function(){try{r="function"==typeof setTimeout?setTimeout:o}catch(t){r=o}try{n="function"==typeof clearTimeout?clearTimeout:s}catch(t){n=s}}();var l,c=[],u=!1,h=-1;function f(){u&&l&&(u=!1,l.length?c=l.concat(c):h=-1,c.length&&d())}function d(){if(!u){var t=a(f);u=!0;for(var e=c.length;e;){for(l=c,c=[];++h<e;)l&&l[h].run();h=-1,e=c.length}l=null,u=!1,function(t){if(n===clearTimeout)return clearTimeout(t);if((n===s||!n)&&clearTimeout)return n=clearTimeout,clearTimeout(t);try{n(t)}catch(e){try{return n.call(null,t)}catch(e){return n.call(this,t)}}}(t)}}function p(t,e){this.fun=t,this.array=e}function y(){}i.nextTick=function(t){var e=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)e[r-1]=arguments[r];c.push(new p(t,e)),1!==c.length||u||a(d)},p.prototype.run=function(){this.fun.apply(null,this.array)},i.title="browser",i.browser=!0,i.env={},i.argv=[],i.version="",i.versions={},i.on=y,i.addListener=y,i.once=y,i.off=y,i.removeListener=y,i.removeAllListeners=y,i.emit=y,i.prependListener=y,i.prependOnceListener=y,i.listeners=function(t){return[]},i.binding=function(t){throw new Error("process.binding is not supported")},i.cwd=function(){return"/"},i.chdir=function(t){throw new Error("process.chdir is not supported")},i.umask=function(){return 0}},function(t,e){},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},i="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};var o,s,a,l=(o=function(t,e){try{return t()}catch(t){return e}},s=function(t,e,r){var n=e;e.includes(" as ")&&(n=(e=e.split(" as "))[0]);var i=o(function(){return Array.isArray(e)&&e[1].trim()},void 0),s=n.replace(/\[/g,".").replace(/]/g,"").split(".").filter(Boolean).map(function(t){return t.trim()});return{label:i||n,value:s.every(function(e){return!(e&&void 0===(t=t[e]))})?t:r}},a=function t(e,r,i,o,s){e&&(o=o||"",e.forEach(function(e){if(e){var a=e.columns&&Array.isArray(e.columns),l=e.rows&&Array.isArray(e.rows),c=e.components&&Array.isArray(e.components),u=!1,h=e.key?o?o+"."+e.key:e.key:"";s&&(e.parent=n({},s),delete e.parent.components,delete e.parent.componentMap,delete e.parent.columns,delete e.parent.rows),(i||e.tree||!a&&!l&&!c)&&(u=r(e,h));var f=function(){return e.key&&!["panel","table","well","columns","fieldset","tabs","form"].includes(e.type)&&(["datagrid","container","editgrid"].includes(e.type)||e.tree)?h:e.key&&"form"===e.type?h+".data":o};u||(a?e.columns.forEach(function(n){return t(n.components,r,i,f(),s?e:null)}):l?e.rows.forEach(function(n){Array.isArray(n)&&n.forEach(function(n){return t(n.components,r,i,f(),s?e:null)})}):c&&t(e.components,r,i,f(),s?e:null))}}))},Object.freeze({cloneDeep:function(t){return JSON.parse(JSON.stringify(t))},get:o,orderBy:function(){},isEmpty:function(t){if(!t)return!0;if(Array.isArray(t)||"string"==typeof t)return!t.length;for(var e in t)if(hasOwnProperty.call(t,e))return!1;return!0},debounce:function(t,e){var r=void 0;return function(){var n=this,i=arguments;clearTimeout(r),r=setTimeout(function(){return t.apply(n,i)},e)}},getFromPath:s,deleteNulls:function t(e){var r=e,n=r instanceof Array;for(var o in r)null===r[o]?n?r.splice(o,1):delete r[o]:"object"===i(r[o])&&t(r[o]);return r},eachComponent:a,findComponents:function(t,e){var r=[];return a(t,function(t,n){(function(t,e){if("string"==typeof e)return t.key===e;var r=!1;return Object.keys(e).forEach(function(n){if(!(r=s(t,n).value===e[n]))return!1}),r})(t,e)&&(t.path=n,r.push(t))},!0),r},unixDate:function(){return Math.round(+new Date/1e3)}}));e.default=l},function(t,e,r){var n=r(10),i=r(11);t.exports=function(t,e,r){var o=e&&r||0;"string"==typeof t&&(e="binary"===t?new Array(16):null,t=null);var s=(t=t||{}).random||(t.rng||n)();if(s[6]=15&s[6]|64,s[8]=63&s[8]|128,e)for(var a=0;a<16;++a)e[o+a]=s[a];return e||i(s)}},function(t,e){var r="undefined"!=typeof crypto&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto)||"undefined"!=typeof msCrypto&&"function"==typeof window.msCrypto.getRandomValues&&msCrypto.getRandomValues.bind(msCrypto);if(r){var n=new Uint8Array(16);t.exports=function(){return r(n),n}}else{var i=new Array(16);t.exports=function(){for(var t,e=0;e<16;e++)0==(3&e)&&(t=4294967296*Math.random()),i[e]=t>>>((3&e)<<3)&255;return i}}},function(t,e){for(var r=[],n=0;n<256;++n)r[n]=(n+256).toString(16).substr(1);t.exports=function(t,e){var n=e||0,i=r;return[i[t[n++]],i[t[n++]],i[t[n++]],i[t[n++]],"-",i[t[n++]],i[t[n++]],"-",i[t[n++]],i[t[n++]],"-",i[t[n++]],i[t[n++]],"-",i[t[n++]],i[t[n++]],i[t[n++]],i[t[n++]],i[t[n++]],i[t[n++]]].join("")}},function(t,e,r){"use strict";(function(t){var r,n,i,o,s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};o=function(){return function(t){var e={};function r(n){if(e[n])return e[n].exports;var i=e[n]={i:n,l:!1,exports:{}};return t[n].call(i.exports,i,i.exports,r),i.l=!0,i.exports}return r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n})},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.t=function(t,e){if(1&e&&(t=r(t)),8&e)return t;if(4&e&&"object"==(void 0===t?"undefined":s(t))&&t&&t.__esModule)return t;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var i in t)r.d(n,i,function(e){return t[e]}.bind(null,i));return n},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=13)}([function(t,e,r){var n=r(2),i=r(17),o=r(6),s=r(18),a=r(1),l=r(3),c=r(8),u=r(7),h=Array.prototype.concat;function f(){var t=h.apply([],arguments).filter(l);return 0===t.length?void 0:t}function d(t){if(!a(t))return t;var e=t.methods,r=t.properties,n=t.props,i=t.initializers,o=t.init,l=t.composers,h=t.deepProperties,d=t.deepProps,p=t.propertyDescriptors,y=t.staticProperties,v=t.statics,g=t.staticDeepProperties,m=t.deepStatics,b=t.configuration,w=t.conf,x=t.deepConfiguration,I=t.deepConf,O=a(n)||a(r)?u({},n,r):void 0,A=a(d)?c({},d):void 0;A=a(h)?c(A,h):A;var P=a(v)||a(y)?u({},v,y):void 0,k=a(m)?c({},m):void 0;k=a(g)?c(k,g):k;var D=t.staticPropertyDescriptors;s(t.name)&&(D=u({},D||{},{name:{value:t.name}}));var S=a(w)||a(b)?u({},w,b):void 0,C=a(I)?c({},I):void 0;C=a(x)?c(C,x):C;var E=f(o,i),j=f(l),M={};return e&&(M.methods=e),O&&(M.properties=O),E&&(M.initializers=E),j&&(M.composers=j),A&&(M.deepProperties=A),P&&(M.staticProperties=P),k&&(M.staticDeepProperties=k),p&&(M.propertyDescriptors=p),D&&(M.staticPropertyDescriptors=D),S&&(M.configuration=S),C&&(M.deepConfiguration=C),M}function p(){for(var t=arguments.length,e=[],r=0;r<t;r+=1){var i=arguments[r];e.push(o(i)?i:d(i))}return n.apply(this||y,e)}var y=i.compose({staticProperties:{create:function(){return this.apply(this,arguments)},compose:p}}),v=i.compose.staticProperties;for(var g in v)p[g]=v[g].bind(y);p.compose=p.bind(),t.exports=p},function(t,e){t.exports=function(t){var e=void 0===t?"undefined":s(t);return Boolean(t)&&("object"===e||"function"===e)}},function(t,e,r){var n=r(5),i=r(3),o=r(1),s=r(6),a=r(15),l=r(7),c=r(8),u=Array.prototype.slice;function h(t,e){var r=function t(e){var r=t.compose||{},n={__proto__:r.methods};if(c(n,r.deepProperties),l(n,r.properties),Object.defineProperties(n,r.propertyDescriptors||{}),!r.initializers||0===r.initializers.length)return n;void 0===e&&(e={});for(var o=r.initializers,s=o.length,a=0;a<s;a+=1){var h=o[a];if(i(h)){var f=h.call(n,e,{instance:n,stamp:t,args:u.apply(arguments)});n=void 0===f?n:f}}return n};t.staticDeepProperties&&c(r,t.staticDeepProperties),t.staticProperties&&l(r,t.staticProperties),t.staticPropertyDescriptors&&Object.defineProperties(r,t.staticPropertyDescriptors);var n=i(r.compose)?r.compose:e;return l(r.compose=function(){return n.apply(this,arguments)},t),r}function f(t,e,r){if(n(e)){var o=e.length,s=t[r]||[];t[r]=s;for(var a=0;a<o;a+=1){var l=e[a];i(l)&&s.indexOf(l)<0&&s.push(l)}}}function d(t,e,r,n){o(e[r])&&(o(t[r])||(t[r]={}),n(t[r],e[r]))}function p(t,e,r){d(t,e,r,c)}function y(t,e,r){d(t,e,r,l)}function v(t,e){var r=e&&e.compose||e;y(t,r,"methods"),y(t,r,"properties"),p(t,r,"deepProperties"),y(t,r,"propertyDescriptors"),y(t,r,"staticProperties"),p(t,r,"staticDeepProperties"),y(t,r,"staticPropertyDescriptors"),y(t,r,"configuration"),p(t,r,"deepConfiguration"),f(t,r.initializers,"initializers"),f(t,r.composers,"composers")}t.exports=function t(){var e={},r=[];a(this)&&(v(e,this),r.push(this));for(var i=0;i<arguments.length;i++){var o=arguments[i];a(o)&&(v(e,o),r.push(o))}var l=h(e,t),c=e.composers;if(n(c)&&c.length>0)for(var u=0;u<c.length;u+=1){var f=(0,c[u])({stamp:l,composables:r});l=s(f)?f:l}return l}},function(t,e){t.exports=function(t){return"function"==typeof t}},function(t,e){var r;r=function(){return this}();try{r=r||new Function("return this")()}catch(t){"object"==("undefined"==typeof window?"undefined":s(window))&&(r=window)}t.exports=r},function(t,e){t.exports=Array.isArray},function(t,e,r){var n=r(3);t.exports=function(t){return n(t)&&n(t.compose)}},function(t,e){t.exports=Object.assign},function(t,e,r){var n=r(16),i=r(1),o=r(5);function s(t,e){if(void 0===e)return t;if(o(e))return(o(t)?t:[]).concat(e);if(!n(e))return e;for(var r=i(t)?t:{},a=Object.keys(e),l=0;l<a.length;l+=1){var c=a[l],u=e[c];if(void 0!==u){var h=r[c],f=n(h)||o(u)?h:{};r[c]=s(f,u)}}return r}t.exports=function(t){for(var e=1;e<arguments.length;e++)t=s(t,arguments[e]);return t}},function(t,e,r){(function(t){Object.defineProperty(e,"__esModule",{value:!0});var n=o(r(0)),i=o(r(19));function o(t){return t&&t.__esModule?t:{default:t}}e.default=(0,n.default)({properties:{name:"baseModel",config:{remote:{path:void 0,token:void 0,pullForm:!1},local:{connector:"loki"},merge:{connector:"formio-loki"}}},methods:{getModelName:function(){return this.name},getFluentConfig:function(){var e=void 0;return"undefined"!=typeof window&&window&&window._FLUENT_?e=window._FLUENT_:t&&t._FLUENT_&&(e=t._FLUENT_),e},getConnector:function(t,e){var r=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return Array.isArray(t)?this.getConnectorFromArray(t,e,r):t instanceof Object?t:void 0},getConnectorFromArray:function(t,e){var r=this,n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];if(1===t.length)return t[0];if(this.config&&this.config[e]&&this.config[e].connector){var i=t.find(function(t){return t.name===r.config[e].connector});if(i instanceof Object)return i}if(n){var o=t.find(function(t){return t.name===n});if(o instanceof Object)return o}var s=t.find(function(t){return t.default});return s instanceof Object?s:void 0},remote:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=t.token,r=void 0===e?void 0:e,n=t.pullForm,i=void 0===n?void 0:n,o=t.connectorName,s=void 0===o?void 0:o,a=this.getFluentConfig(),l=a&&a.connectors&&a.connectors.remote;if(!l)throw new Error("No remote connector was defined. Please define it using Fluent.config()");var c=this.getConnector(l,"remote",s||!1);if(this.config.remote.token=r||this.config.remote.token,i&&(this.config.remote.pullForm=i||this.config.remote.pullForm),c)return c.connector({remoteConnection:this.config.remote,connector:c});throw new Error("No default remote connector found. Please assign one as your default in Fluent.config")},local:function(){var t=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}).connectorName,e=void 0===t?void 0:t,r=this.getFluentConfig(),n=r&&r.connectors&&r.connectors.local;if(!n)throw new Error("No local connector was defined. Please define it using Fluent.config()");var i=this.getConnector(n,"local",e||!1);if(i)return i.connector({name:this.name,connector:i});throw new Error("No default local connector found. Please assign one as your default in Fluent.config")},merged:function(){var t=this.local(),e=this.remote(),r=this.getFluentConfig(),n=r&&r.connectors&&r.connectors.merge;if(!n)throw new Error("No merge connector was defined. Please define it using Fluent.config()");var i=this.getConnector(n,"merge");if(i)return i.connector({local:t,remote:e,name:this.name,connector:i});throw new Error("No default merge connector found. Please assign one as your default in Fluent.config")}}}).compose(i.default)}).call(this,r(4))},function(t,e,r){Object.defineProperty(e,"__esModule",{value:!0});var n=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},i=s(r(0)),o=s(r(11));function s(t){return t&&t.__esModule?t:{default:t}}function a(t){if(Array.isArray(t)){for(var e=0,r=Array(t.length);e<t.length;e++)r[e]=t[e];return r}return Array.from(t)}e.default=(0,i.default)({init:function(t){if(!Array.isArray(t))throw new Error("Collect method only accepts arrays of data");this.data=t},properties:{data:[]},methods:{get:function(){return this.data},all:function(){return this.get()},avg:function(t){return this.average(t)},average:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",e=[].concat(a(this.data)),r=e.reduce(function(e,r){var n=r;if(r instanceof Object){var i=o.default.getFromPath(r,t,void 0);void 0!==i&&i.value&&(n=i.value)}return e+n},0);try{return r/e.length}catch(t){throw new Error('Division between "'+r+'" and "'+e.length+'" is not valid.')}},chunkApply:function(t,e){var r,n=this;return(r=regeneratorRuntime.mark(function r(){var i,o,s,a;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if(void 0!==e){r.next=2;break}throw new Error("Callback function not defined.");case 2:return i=n.data.length,o=0,n.chunks(t),s=function(r,n){return r.then(function(){return Promise.all(n.map(function(t){return e(t)}))}).then(function(){o=o+t>i?i:o+t,console.log("Processed "+o+"/"+i+" elements...")})},console.log("Processed "+o+"/"+i+" elements..."),a=n.data.reduce(s,Promise.resolve()),r.abrupt("return",a);case 9:case"end":return r.stop()}},r,n)}),function(){var t=r.apply(this,arguments);return new Promise(function(e,r){return function n(i,o){try{var s=t[i](o),a=s.value}catch(t){return void r(t)}if(!s.done)return Promise.resolve(a).then(function(t){n("next",t)},function(t){n("throw",t)});e(a)}("next")})})()},chunks:function(t){for(var e=[].concat(a(this.data)),r=[];e.length;)r.push(e.splice(0,t));return this.data=r,this},collapse:function(){var t=[].concat(a(this.data)),e=[];return t.forEach(function(t){Array.isArray(t)?t.forEach(function(t){e.push(t)}):e.push(t)}),this.data=e,this},unChunk:function(){return this.collapse()},combine:function(t){var e=[].concat(a(this.data)),r=void 0;return e.forEach(function(e,i){e instanceof Object?(r||(r=[]),r[i]=n({},e,{_value:t[i]})):(r||(r={}),r[e]=t[i])}),this.data=r,this},concat:function(t){return this.data=[].concat(a(this.data),a(t)),this},contains:function(){var t=void 0,e=void 0,r=void 0;return 1===arguments.length?(this.isFunction(arguments.length<=0?void 0:arguments[0])&&(r=arguments.length<=0?void 0:arguments[0]),t=arguments.length<=0?void 0:arguments[0]):(t=arguments.length<=1?void 0:arguments[1],e=arguments.length<=0?void 0:arguments[0]),[].concat(a(this.data)).some(function(n,i){if(r)return!!r(n,i);var s=n;if(n instanceof Object){var a=o.default.getFromPath(n,e,void 0);a.value&&(s=a.value)}return s===t})},duplicatesBy:function(t){var e=[].concat(a(this.data)),r=[];return e.reduce(function(e,n){var i=t.reduce(function(t,e){return t+o.default.getFromPath(n,e,"").value},"");return e.hasOwnProperty(i)?r.push(n):e[i]=!0,e},{}),this.data=r,this},count:function(){return this.data.length},isFunction:function(t){return t&&"[object Function]"==={}.toString.call(t)}}})},function(t,e,r){Object.defineProperty(e,"__esModule",{value:!0});var n,i=(n=function(t,e){try{return t()}catch(t){return e}},Object.freeze({get:n,getFromPath:function(t,e,r){var i=e;e.includes(" as ")&&(i=(e=e.split(" as "))[0]);var o=n(function(){return Array.isArray(e)&&e[1].trim()},void 0),s=i.replace(/\[/g,".").replace(/]/g,"").split(".").filter(Boolean).map(function(t){return t.trim()});return{label:o||i,value:s.every(function(e){return!(e&&void 0===(t=t[e]))})?t:r}}}));e.default=i},function(t,e,r){Object.defineProperty(e,"__esModule",{value:!0});var n="function"==typeof Symbol&&"symbol"==s(Symbol.iterator)?function(t){return void 0===t?"undefined":s(t)}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":void 0===t?"undefined":s(t)},i=l(r(0)),o=l(r(11)),a=l(r(10));function l(t){return t&&t.__esModule?t:{default:t}}function c(t){if(Array.isArray(t)){for(var e=0,r=Array(t.length);e<t.length;e++)r[e]=t[e];return r}return Array.from(t)}function u(t){return function(){var e=t.apply(this,arguments);return new Promise(function(t,r){return function n(i,o){try{var s=e[i](o),a=s.value}catch(t){return void r(t)}if(!s.done)return Promise.resolve(a).then(function(t){n("next",t)},function(t){n("throw",t)});t(a)}("next")})}}e.default=(0,i.default)({init:function(t){var e=t.name,r=t.remoteConnection,n=t.connector;if(!e&&!r)throw new Error("Model must have a name or path");if(!n)throw new Error("Model must have a connector. Please register one using Fluent.config");this.name=e||this.name,this.remoteConnection=r||this.remoteConnection,this.connector=n||this.connector,this.chainReference=[],this.whereArray=[],this.orWhereArray=[],this.selectArray=[],this.orderByArray=[],this.limitNumber=void 0,this.offsetNumber=void 0,this.populate=[],this.chunk=null,this.pullSize=null,this.ownerId=void 0,this.paginator=void 0,this.rawQuery=void 0},properties:{operators:["=","<",">","<=",">=","<>","!=","in","nin","like","regexp","startsWith","endsWith","contains"]},methods:{get:function(){throw new Error("get() method not implemented")},all:function(){throw new Error("all() method not implemented")},find:function(t){throw new Error("find() method not implemented")},findOne:function(){throw new Error("findOne() method not implemented")},remove:function(){throw new Error("remove() method not implemented")},softDelete:function(){throw new Error("softDelete() method not implemented")},insert:function(){throw new Error("insert() method not implemented")},update:function(){throw new Error("update() method not implemented")},clear:function(){throw new Error("clear() method not implemented")},updateOrCreate:function(){throw new Error("updateOrCreate() method not implemented")},findAndRemove:function(){throw new Error("findAndRemove() method not implemented")},paginate:function(){throw new Error("paginate() method not implemented")},tableView:function(){throw new Error("tableView() method not implemented")},raw:function(){throw new Error("raw() method not implemented")},owner:function(t){return this.chainReference.push({method:"owner",args:t}),this.ownerId=t,this},own:function(t){return this.owner(t)},first:function(){var t=this;return u(regeneratorRuntime.mark(function e(){var r;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,t.get();case 2:return r=e.sent,e.abrupt("return",o.default.get(function(){return r[0]},[]));case 4:case"end":return e.stop()}},e,t)}))()},collect:function(){var t=this;return u(regeneratorRuntime.mark(function e(){var r;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,t.get();case 2:if(r=e.sent,Array.isArray(r)){e.next=5;break}throw new Error("Collect method only accepts arrays of data");case 5:return e.abrupt("return",(0,a.default)(r));case 6:case"end":return e.stop()}},e,t)}))()},select:function(){for(var t=arguments.length,e=Array(t),r=0;r<t;r++)e[r]=arguments[r];return e=this.prepareInput(e),this.chainReference.push({method:"select",args:e}),this.selectArray=this.selectArray.concat(e).filter(function(t,e,r){return r.indexOf(t)===e}),this},jsApplySelect:function(t){var e=this,r=Array.isArray(t)?[].concat(c(t)):[t];return this.selectArray.length>0&&(r=r.map(function(t){var r={};return e.selectArray.forEach(function(e){var i=o.default.getFromPath(t,e,void 0),s=o.default.get(function(){return i.value},void 0);void 0!==s&&("object"===(void 0===s?"undefined":n(s))&&s.hasOwnProperty("data")&&s.data.hasOwnProperty("name")?r[i.label]=s.data.name:r[i.label]=s)}),r})),r},offset:function(t){return this.chainReference.push({method:"offset",args:t}),this.offsetNumber=t,this},skip:function(t){return this.offset(t)},where:function(){for(var t=this,e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];return this.chainReference.push({method:"where",args:r}),this.whereArray=[],(r=Array.isArray(r[0])?r:[r]).forEach(function(e){if(3!==e.length)throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(e)+'" ');t.whereArray.push(e)}),this},andWhere:function(){for(var t=this,e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];return this.chainReference.push({method:"andWhere",args:r}),(r=Array.isArray(r[0])?r:[r]).forEach(function(e){if(3!==e.length)throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(e)+'" ');t.whereArray.push(e)}),this},orWhere:function(){for(var t=this,e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];return this.chainReference.push({method:"orWhere",args:r}),(r=Array.isArray(r[0])?r:[r]).forEach(function(e){if(3!==e.length)throw new Error('There orWhere clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(e)+'" ');t.orWhereArray.push(e)}),this},limit:function(t){return this.chainReference.push({method:"limit",args:t}),this.limitNumber=t,this},take:function(t){return this.limit(t)},pluck:function(t){var e=this;return u(regeneratorRuntime.mark(function r(){var n;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return e.chainReference.push({method:"pluck",args:t}),r.next=3,e.get();case 3:return n=(n=r.sent).map(function(e){var r=o.default.getFromPath(e,t,void 0);if(void 0!==r.value)return r.value}),r.abrupt("return",n);case 6:case"end":return r.stop()}},r,e)}))()},orderBy:function(){for(var t=arguments.length,e=Array(t),r=0;r<t;r++)e[r]=arguments[r];return this.chainReference.push({method:"orderBy",args:e}),this.orderByArray=e,this},jsApplyOrderBy:function(t){var e=[].concat(c(t));if(0===this.orderByArray.length)return e;var r=this.orderByArray[0];if(this.selectArray.length>0&&(r.includes(".")||r.includes("[")))throw new Error('Cannot orderBy nested attribute "'+r+'" when using Select. You must rename the attribute');var n=this.orderByArray[1],i=this.orderByArray[2];return i||(i="string"),e.sort(function(t,e){var s=o.default.getFromPath(t,r,void 0).value,a=o.default.getFromPath(e,r,void 0).value;if(void 0===s||void 0===a)throw new Error('Cannot order by property "'+r+'" not all values have this property');return i.includes("string")||i.includes("number")?"asc"===n?s>a?1:s<a?-1:0:s>a?-1:s<a?1:0:i.includes("date")?"asc"===n?new Date(s)-new Date(a):new Date(a)-new Date(s):void 0})},prepareInput:function(t){var e=[];return t.forEach(function(t){var r=Array.isArray(t)?t:t.split(",");r=r.map(function(t){return t.trim()}),e=e.concat(r)}),e.filter(function(t,e,r){return r.indexOf(t)===e}),e},ArrayInsert:function(t,e){var r=this;return u(regeneratorRuntime.mark(function n(){var i,o,s,a,l,c,u,h;return regeneratorRuntime.wrap(function(n){for(;;)switch(n.prev=n.next){case 0:i=1,o=t.length,s=!0,a=!1,l=void 0,n.prev=5,c=t[Symbol.iterator]();case 7:if(s=(u=c.next()).done){n.next=26;break}return h=u.value,e&&e.showProgress&&console.log("Inserting "+i+" of "+o),n.prev=10,n.next=13,r.insert(h,e);case 13:n.sent,e&&e.showProgress&&console.log("Element "+i+" inserted"),i++,n.next=23;break;case 18:n.prev=18,n.t0=n.catch(10),console.log("ERROR - Element "+i+" - "+JSON.stringify(h)+" could not be inserted"),console.log(n.t0),i++;case 23:s=!0,n.next=7;break;case 26:n.next=32;break;case 28:n.prev=28,n.t1=n.catch(5),a=!0,l=n.t1;case 32:n.prev=32,n.prev=33,!s&&c.return&&c.return();case 35:if(n.prev=35,!a){n.next=38;break}throw l;case 38:return n.finish(35);case 39:return n.finish(32);case 40:case"end":return n.stop()}},n,r,[[5,28,32,40],[10,18],[33,,35,39]])}))()}}})},function(t,e,r){Object.defineProperty(e,"__esModule",{value:!0}),e.MergeConnector=e.Interface=e.Fluent=e.Model=void 0;var n=a(r(14)),i=a(r(9)),o=a(r(12)),s=a(r(20));function a(t){return t&&t.__esModule?t:{default:t}}e.Model=i.default,e.Fluent=n.default,e.Interface=o.default,e.MergeConnector=s.default},function(t,e,r){(function(t){Object.defineProperty(e,"__esModule",{value:!0});var n=s(r(0)),i=s(r(9)),o=s(r(10));function s(t){return t&&t.__esModule?t:{default:t}}function a(t){if(Array.isArray(t)){for(var e=0,r=Array(t.length);e<t.length;e++)r[e]=t[e];return r}return Array.from(t)}var l=(0,n.default)({init:function(){this.registerGlobalVariable()},properties:{},methods:{model:function(){for(var t=arguments.length,e=Array(t),r=0;r<t;r++)e[r]=arguments[r];return this.registerModel(e),i.default.compose.apply(i.default,a(e))},extend:function(){for(var t=arguments.length,e=Array(t),r=0;r<t;r++)e[r]=arguments[r];return this.registerModel(e),i.default.compose.apply(i.default,a(e))},compose:function(){for(var t=arguments.length,e=Array(t),r=0;r<t;r++)e[r]=arguments[r];return this.registerModel(e),i.default.compose.apply(i.default,a(e))},collect:function(t){return(0,o.default)(t)},registerGlobalVariable:function(){"undefined"!=typeof window&&window&&!window._FLUENT_&&(window._FLUENT_={connectors:{},models:{}}),t&&!t._FLUENT_&&(t._FLUENT_={connectors:{},models:{}})},registerModel:function(e){var r=e&&e[0]&&e[0].properties&&e[0].properties.name?e[0].properties.name:void 0;if(r&&"baseModel"!==r){if("string"!=typeof r)throw new Error("You must assign a name to your Model when using Fluent.compose");"undefined"==typeof window?t._FLUENT_.models[r]=!0:window._FLUENT_.models[r]=!0}},config:function(e){var r=e.REMOTE_CONNECTORS,n=void 0===r?void 0:r,i=e.LOCAL_CONNECTORS,o=void 0===i?void 0:i,s=e.MERGE_CONNECTORS,a=void 0===s?void 0:s;"undefined"!=typeof window&&window&&(window._FLUENT_.connectors={local:o,remote:n,merge:a}),void 0!==t&&t&&(t._FLUENT_.connectors={local:o,remote:n,merge:a})},getConfig:function(){return"undefined"!=typeof window&&window?window._FLUENT_:void 0!==t&&t?t._FLUENT_:void 0}}})();e.default=l}).call(this,r(4))},function(t,e,r){t.exports=r(1)},function(t,e){t.exports=function(t){return Boolean(t)&&"object"==(void 0===t?"undefined":s(t))&&Object.getPrototypeOf(t)===Object.prototype}},function(t,e,r){var n=r(2);function i(t){return function(e){var r={};return r[t]=e,this&&this.compose?this.compose(r):n(r)}}var o=i("properties"),s=i("staticProperties"),a=i("configuration"),l=i("deepProperties"),c=i("staticDeepProperties"),u=i("deepConfiguration"),h=i("initializers");t.exports=n({staticProperties:{methods:i("methods"),props:o,properties:o,statics:s,staticProperties:s,conf:a,configuration:a,deepProps:l,deepProperties:l,deepStatics:c,staticDeepProperties:c,deepConf:u,deepConfiguration:u,init:h,initializers:h,composers:i("composers"),propertyDescriptors:i("propertyDescriptors"),staticPropertyDescriptors:i("staticPropertyDescriptors")}})},function(t,e){t.exports=function(t){return"string"==typeof t}},function(t,e,r){var n=r(2),i=new WeakMap,o=function(t,e){function r(){var e=i.get(this);return t.apply(e,arguments)}return Object.defineProperty(r,"name",{value:e,configurable:!0}),r};function s(t,e){var r=e.stamp.compose,n=r.deepConfiguration.Privatize.methods,s={};i.set(s,this);var a=r.methods;if(!a)return s;for(var l=Object.keys(a),c=0;c<l.length;c++){var u=l[c];n.indexOf(u)<0&&(s[u]=o(a[u],u))}if("undefined"!=typeof Symbol){var h=Symbol.for("stamp");a[h]&&(s[h]=e.stamp)}return s}var a=n({initializers:[s],deepConfiguration:{Privatize:{methods:[]}},staticProperties:{privatizeMethods:function(){for(var t=[],e=0;e<arguments.length;e++){var r=arguments[e];"string"==typeof r&&r.length>0&&t.push(r)}return(this&&this.compose?this:a).compose({deepConfiguration:{Privatize:{methods:t}}})}},composers:[function(t){var e=t.stamp.compose.initializers;e.splice(e.indexOf(s),1),e.push(s)}]});t.exports=a},function(t,e,r){Object.defineProperty(e,"__esModule",{value:!0});var n,i=(n=r(12))&&n.__esModule?n:{default:n};e.default=i.default.compose({properties:{localFx:void 0,remoteFx:void 0},init:function(t){this.connectors=t},methods:{get:function(){var t,e=this;return(t=regeneratorRuntime.mark(function t(){var r,n;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return e.prepareMergedFunctions(),t.next=3,e.localFx.get();case 3:return r=t.sent,t.next=6,e.remoteFx.get();case 6:return n=t.sent,t.abrupt("return",r.concat(n));case 8:case"end":return t.stop()}},t,e)}),function(){var e=t.apply(this,arguments);return new Promise(function(t,r){return function n(i,o){try{var s=e[i](o),a=s.value}catch(t){return void r(t)}if(!s.done)return Promise.resolve(a).then(function(t){n("next",t)},function(t){n("throw",t)});t(a)}("next")})})()},prepareMergedFunctions:function(){var t=this;this.localFx=this.connectors.local,this.remoteFx=this.connectors.remote,this.chainReference.forEach(function(e){var r=e.method,n=e.args;t.localFx=t.localFx[r](n),t.remoteFx=t.remoteFx[r](n)})}}})}])},"object"==s(e)&&"object"==s(t)?t.exports=o():(n=[],void 0===(i="function"==typeof(r=o)?r.apply(e,n):r)||(t.exports=i))}).call(this,r(13)(t))},function(t,e){t.exports=function(t){return t.webpackPolyfill||(t.deprecate=function(){},t.paths=[],t.children||(t.children=[]),Object.defineProperty(t,"loaded",{enumerable:!0,get:function(){return t.l}}),Object.defineProperty(t,"id",{enumerable:!0,get:function(){return t.i}}),t.webpackPolyfill=1),t}}])});
//# sourceMappingURL=fluent-loki.min.js.map

/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

!function(e,t){ true?module.exports=t():undefined}(this,function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=8)}([function(e,t,r){"use strict";var n=r(3),o=r(18),i=Object.prototype.toString;function a(e){return"[object Array]"===i.call(e)}function u(e){return null!==e&&"object"==typeof e}function s(e){return"[object Function]"===i.call(e)}function c(e,t){if(null!=e)if("object"!=typeof e&&(e=[e]),a(e))for(var r=0,n=e.length;r<n;r++)t.call(null,e[r],r,e);else for(var o in e)Object.prototype.hasOwnProperty.call(e,o)&&t.call(null,e[o],o,e)}e.exports={isArray:a,isArrayBuffer:function(e){return"[object ArrayBuffer]"===i.call(e)},isBuffer:o,isFormData:function(e){return"undefined"!=typeof FormData&&e instanceof FormData},isArrayBufferView:function(e){return"undefined"!=typeof ArrayBuffer&&ArrayBuffer.isView?ArrayBuffer.isView(e):e&&e.buffer&&e.buffer instanceof ArrayBuffer},isString:function(e){return"string"==typeof e},isNumber:function(e){return"number"==typeof e},isObject:u,isUndefined:function(e){return void 0===e},isDate:function(e){return"[object Date]"===i.call(e)},isFile:function(e){return"[object File]"===i.call(e)},isBlob:function(e){return"[object Blob]"===i.call(e)},isFunction:s,isStream:function(e){return u(e)&&s(e.pipe)},isURLSearchParams:function(e){return"undefined"!=typeof URLSearchParams&&e instanceof URLSearchParams},isStandardBrowserEnv:function(){return("undefined"==typeof navigator||"ReactNative"!==navigator.product)&&"undefined"!=typeof window&&"undefined"!=typeof document},forEach:c,merge:function e(){var t={};function r(r,n){"object"==typeof t[n]&&"object"==typeof r?t[n]=e(t[n],r):t[n]=r}for(var n=0,o=arguments.length;n<o;n++)c(arguments[n],r);return t},extend:function(e,t,r){return c(t,function(t,o){e[o]=r&&"function"==typeof t?n(t,r):t}),e},trim:function(e){return e.replace(/^\s*/,"").replace(/\s*$/,"")}}},function(e,t,r){"use strict";(function(t){var n=r(0),o=r(21),i={"Content-Type":"application/x-www-form-urlencoded"};function a(e,t){!n.isUndefined(e)&&n.isUndefined(e["Content-Type"])&&(e["Content-Type"]=t)}var u,s={adapter:("undefined"!=typeof XMLHttpRequest?u=r(4):void 0!==t&&(u=r(4)),u),transformRequest:[function(e,t){return o(t,"Content-Type"),n.isFormData(e)||n.isArrayBuffer(e)||n.isBuffer(e)||n.isStream(e)||n.isFile(e)||n.isBlob(e)?e:n.isArrayBufferView(e)?e.buffer:n.isURLSearchParams(e)?(a(t,"application/x-www-form-urlencoded;charset=utf-8"),e.toString()):n.isObject(e)?(a(t,"application/json;charset=utf-8"),JSON.stringify(e)):e}],transformResponse:[function(e){if("string"==typeof e)try{e=JSON.parse(e)}catch(e){}return e}],timeout:0,xsrfCookieName:"XSRF-TOKEN",xsrfHeaderName:"X-XSRF-TOKEN",maxContentLength:-1,validateStatus:function(e){return e>=200&&e<300}};s.headers={common:{Accept:"application/json, text/plain, */*"}},n.forEach(["delete","get","head"],function(e){s.headers[e]={}}),n.forEach(["post","put","patch"],function(e){s.headers[e]=n.merge(i)}),e.exports=s}).call(this,r(20))},function(e,t,r){e.exports=r(17)},function(e,t,r){"use strict";e.exports=function(e,t){return function(){for(var r=new Array(arguments.length),n=0;n<r.length;n++)r[n]=arguments[n];return e.apply(t,r)}}},function(e,t,r){"use strict";var n=r(0),o=r(22),i=r(24),a=r(25),u=r(26),s=r(5),c="undefined"!=typeof window&&window.btoa&&window.btoa.bind(window)||r(27);e.exports=function(e){return new Promise(function(t,f){var l=e.data,d=e.headers;n.isFormData(l)&&delete d["Content-Type"];var p=new XMLHttpRequest,h="onreadystatechange",m=!1;if("undefined"==typeof window||!window.XDomainRequest||"withCredentials"in p||u(e.url)||(p=new window.XDomainRequest,h="onload",m=!0,p.onprogress=function(){},p.ontimeout=function(){}),e.auth){var v=e.auth.username||"",g=e.auth.password||"";d.Authorization="Basic "+c(v+":"+g)}if(p.open(e.method.toUpperCase(),i(e.url,e.params,e.paramsSerializer),!0),p.timeout=e.timeout,p[h]=function(){if(p&&(4===p.readyState||m)&&(0!==p.status||p.responseURL&&0===p.responseURL.indexOf("file:"))){var r="getAllResponseHeaders"in p?a(p.getAllResponseHeaders()):null,n={data:e.responseType&&"text"!==e.responseType?p.response:p.responseText,status:1223===p.status?204:p.status,statusText:1223===p.status?"No Content":p.statusText,headers:r,config:e,request:p};o(t,f,n),p=null}},p.onerror=function(){f(s("Network Error",e,null,p)),p=null},p.ontimeout=function(){f(s("timeout of "+e.timeout+"ms exceeded",e,"ECONNABORTED",p)),p=null},n.isStandardBrowserEnv()){var y=r(28),w=(e.withCredentials||u(e.url))&&e.xsrfCookieName?y.read(e.xsrfCookieName):void 0;w&&(d[e.xsrfHeaderName]=w)}if("setRequestHeader"in p&&n.forEach(d,function(e,t){void 0===l&&"content-type"===t.toLowerCase()?delete d[t]:p.setRequestHeader(t,e)}),e.withCredentials&&(p.withCredentials=!0),e.responseType)try{p.responseType=e.responseType}catch(t){if("json"!==e.responseType)throw t}"function"==typeof e.onDownloadProgress&&p.addEventListener("progress",e.onDownloadProgress),"function"==typeof e.onUploadProgress&&p.upload&&p.upload.addEventListener("progress",e.onUploadProgress),e.cancelToken&&e.cancelToken.promise.then(function(e){p&&(p.abort(),f(e),p=null)}),void 0===l&&(l=null),p.send(l)})}},function(e,t,r){"use strict";var n=r(23);e.exports=function(e,t,r,o,i){var a=new Error(e);return n(a,t,r,o,i)}},function(e,t,r){"use strict";e.exports=function(e){return!(!e||!e.__CANCEL__)}},function(e,t,r){"use strict";function n(e){this.message=e}n.prototype.toString=function(){return"Cancel"+(this.message?": "+this.message:"")},n.prototype.__CANCEL__=!0,e.exports=n},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n,o=r(9),i=(n=o)&&n.__esModule?n:{default:n};t.default=i.default},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},o=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,o=!1,i=void 0;try{for(var a,u=e[Symbol.iterator]();!(n=(a=u.next()).done)&&(r.push(a.value),!t||r.length!==t);n=!0);}catch(e){o=!0,i=e}finally{try{!n&&u.return&&u.return()}finally{if(o)throw i}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),i=h(r(10)),a=h(r(11)),u=h(r(12)),s=h(r(13)),c=h(r(16)),f=h(r(2)),l=r(36),d=h(r(38)),p=h(r(40));function h(e){return e&&e.__esModule?e:{default:e}}function m(e){return function(){var t=e.apply(this,arguments);return new Promise(function(e,r){return function n(o,i){try{var a=t[o](i),u=a.value}catch(e){return void r(e)}if(!a.done)return Promise.resolve(u).then(function(e){n("next",e)},function(e){n("throw",e)});e(u)}("next")})}}a.default.extend(u.default),t.default=l.Interface.compose({methods:{getToken:function(){if("undefined"!=typeof localStorage){var e=localStorage.getItem("formioToken");if(!e||"x-token"===this.getTokenType(e))return e;var t=(0,s.default)(e),r=a.default.unix(t.exp);if((0,a.default)().isSameOrAfter(r))throw new p.default("Token has expired.");return e}},baseUrl:function(){var e=this.connector,t=e.baseUrl,r=e.name;if(!t)throw new Error('You did not provide a baseUrl for the "'+r+'" connector');return t.replace(/\/+$/,"")},get:function(){var e=this;return m(regeneratorRuntime.mark(function t(){var r,n,a,u;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return e.ownerId&&e.andWhere("owner","=",e.ownerId),r=void 0,n=void 0,t.next=5,(0,i.default)(e.httpGET());case 5:if(a=t.sent,u=o(a,2),r=u[0],n=u[1],!r){t.next=12;break}throw console.log(r),new Error("Error while getting submissions");case 12:return n=e.jsApplySelect(n&&n.data),n=e.jsApplyOrderBy(n),t.abrupt("return",n);case 15:case"end":return t.stop()}},t,e)}))()},all:function(){var e=this;return m(regeneratorRuntime.mark(function t(){return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return t.abrupt("return",e.get());case 1:case"end":return t.stop()}},t,e)}))()},numberOfRows:function(){var e=this;return m(regeneratorRuntime.mark(function t(){var r,n,o,i,a,u,s;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return r=e.getUrl(),n=e.getHeaders(),o=e.getFilters(),"?limit=1",i=e.getSkip(),a=e.getOrder(),u=e.getSelect(),"",r+="?limit=1",r=o?r+e.getSpacer(r)+o:r,r=i?r+e.getSpacer(r)+i:r,r=a?r+e.getSpacer(r)+a:r,r=u?r+e.getSpacer(r)+u:r,t.next=15,d.default.isOnline();case 15:if(t.sent){t.next=18;break}throw new Error("Cannot make get request to "+r+".You are not online");case 18:return t.next=20,f.default.get(r,{headers:n});case 20:return s=t.sent,t.abrupt("return",s.headers["content-range"].split("/")[1]);case 22:case"end":return t.stop()}},t,e)}))()},paginate:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var n,o;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return r.next=2,t.numberOfRows();case 2:return n=r.sent,t.offset((e.page-1)*e.rowsPerPage).take(e.rowsPerPage),o={},r.next=7,t.get();case 7:return o.data=r.sent,o.paginator={page:e.page,rowsPerPage:e.rowsPerPage,rowsNumber:n},console.log("paginator",o),r.abrupt("return",o);case 11:case"end":return r.stop()}},r,t)}))()},insert:function(e,t){var r=this;return m(regeneratorRuntime.mark(function n(){var a,u,s,c;return regeneratorRuntime.wrap(function(n){for(;;)switch(n.prev=n.next){case 0:if(!Array.isArray(e)){n.next=2;break}return n.abrupt("return",r.ArrayInsert(e,t));case 2:return n.next=4,(0,i.default)(r.httpPOST(e));case 4:if(a=n.sent,u=o(a,2),s=u[0],c=u[1],!s){n.next=10;break}throw new Error("Cannot insert data");case 10:return n.abrupt("return",c.data);case 11:case"end":return n.stop()}},n,r)}))()},update:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var n,a,u,s;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if(e._id){r.next=2;break}throw new Error("Formio connector error. Cannot update a Model without _id key");case 2:if(!e._id.includes("_local")){r.next=4;break}throw new Error("Formio connector error. Cannot update a local document");case 4:return r.next=6,(0,i.default)(t.httpPUT(e));case 6:if(n=r.sent,a=o(n,2),u=a[0],s=a[1],!u){r.next=13;break}throw console.log(u),new Error("Cannot insert data");case 13:return r.abrupt("return",s.data);case 14:case"end":return r.stop()}},r,t)}))()},clear:function(){var e=this;return m(regeneratorRuntime.mark(function t(){var r,n,a,u,s,c=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}).sure;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:if(c&&!0===c){t.next=2;break}throw new Error('Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue');case 2:return r=[],t.next=5,(0,i.default)(e.select("_id").pluck("_id"));case 5:if(n=t.sent,a=o(n,2),u=a[0],s=a[1],!u){t.next=12;break}throw console.log(u),new Error("Cannot get remote Model");case 12:return s.forEach(function(t){r.push(e.httpDelete(t))}),t.abrupt("return",f.default.all(r));case 14:case"end":return t.stop()}},t,e)}))()},remove:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var n,a,u,s;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return r.next=2,(0,i.default)(t.httpDelete(e));case 2:if(n=r.sent,a=o(n,2),u=a[0],s=a[1],!u){r.next=9;break}throw console.log(u),new Error("FormioConnector: Could not delete "+e);case 9:return r.abrupt("return",s);case 10:case"end":return r.stop()}},r,t)}))()},find:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var a,u,s,c;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if("string"==typeof e){r.next=2;break}throw new Error('Formio connector find() method only accepts strings "'+(void 0===e?"undefined":n(e))+'" given "'+e+'"');case 2:return r.next=4,(0,i.default)(t.where("_id","=",e).first());case 4:if(a=r.sent,u=o(a,2),s=u[0],c=u[1],!s){r.next=11;break}throw console.log(s),new Error("Find() could not get remote data");case 11:return r.abrupt("return",c);case 12:case"end":return r.stop()}},r,t)}))()},getUrl:function(){var e=this,t=this&&this.baseUrl()?this.baseUrl():void 0,r=c.default.get(function(){return e.remoteConnection.path},void 0),n=c.default.get(function(){return e.remoteConnection.id},void 0);if(!c.default.get(function(){return e.remoteConnection.pullForm},void 0)&&r&&(r=n?r+"/submission/"+n:r+"/submission"),!t)throw new Error("Cannot get remote model. baseUrl not defined");return r?t+"/"+r:t},getHeaders:function(){var e={},t={};return"undefined"!=typeof localStorage&&(t=this.getToken()),(this.remoteConnection.token||""===this.remoteConnection.token)&&(t=this.remoteConnection.token),t?(e[this.getTokenType(t)]=t,e):e},getSpacer:function(e){return"&"===e.substr(e.length-1)?"":"&"},httpGET:function(){var e=this;return m(regeneratorRuntime.mark(function t(){var r,n,o,i,a,u,s;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return r=e.getUrl(),n=e.getHeaders(),o=e.getFilters(),i=e.getLimit(),a=e.getSkip(),u=e.getOrder(),s=e.getSelect(),"",r=r+""+i,r=o?r+e.getSpacer(r)+o:r,r=a?r+e.getSpacer(r)+a:r,r=u?r+e.getSpacer(r)+u:r,r=s?r+e.getSpacer(r)+s:r,t.next=15,d.default.isOnline();case 15:if(t.sent){t.next=18;break}throw new Error("Cannot make get request to "+r+".You are not online");case 18:return t.abrupt("return",f.default.get(r,{headers:n}));case 19:case"end":return t.stop()}},t,e)}))()},httpPOST:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var n,o;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return n=t.getUrl(),o=t.getHeaders(),r.next=4,d.default.isOnline();case 4:if(r.sent){r.next=7;break}throw new Error("Cannot make request post to "+n+".You are not online");case 7:return r.abrupt("return",f.default.post(n,e,{headers:o}));case 8:case"end":return r.stop()}},r,t)}))()},httpPUT:function(e){var t=this;return m(regeneratorRuntime.mark(function r(){var n,o,i;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return r.next=2,d.default.isOnline();case 2:if(n=r.sent,o=t.getUrl()+"/"+e._id,i=t.getHeaders(),n){r.next=7;break}throw new Error("Cannot make request post to "+o+".You are not online");case 7:return r.abrupt("return",f.default.put(o,e,{headers:i}));case 8:case"end":return r.stop()}},r,t)}))()},httpDelete:function(e){var t=this.getHeaders(),r=this.getUrl()+"/"+e;return f.default.delete(r,{headers:t})},getTokenType:function(e){return e.length>32?"x-jwt-token":"x-token"},getFilters:function(){var e=this.whereArray;if(e&&0!==e.length){var t="";return e.forEach(function(e){var r="",n=e[0],o=e[1],i=e[2];switch(o){case"=":t=t+n+"="+i+"&";break;case"!=":t=t+n+"__ne="+i+"&";break;case">":t=t+n+"__gt="+i+"&";break;case">=":t=t+n+"__gte="+i+"&";break;case"<":t=t+n+"__lt="+i+"&";break;case"<=":t=t+n+"__lte="+i+"&";break;case"in":r="",i.forEach(function(e,t,n){r=t===n.length-1?r+e:r+e+","}),t=t+n+"__in="+r+"&";break;case"nin":r="",i.forEach(function(e,t,n){r=t===n.length-1?r+e:r+e+","}),t=t+n+"__nin="+r+"&";break;case"exists":t=t+n+"__exists="+!0+"&";break;case"!exists":t=t+n+"__exists="+!1+"&";break;case"regex":t=t+n+"__regex="+i+"&"}}),t.substring(0,t.length-1)}},getLimit:function(){return this.limitNumber&&0!==this.limitNumber||(this.limitNumber=50),"?limit="+this.limitNumber},getSkip:function(){return this.offsetNumber||(this.offsetNumber=0),"skip="+this.offsetNumber},getOrder:function(){return"sort="+("DESC"===this.orderByArray[1]?"-":"")+this.orderByArray[0]},getSelect:function(){var e=this.selectArray;if(e=e.map(function(e){return e.split(" as ")[0]}))return"select="+e.join(",")}}})},function(e,t,r){"use strict";function n(e,t){return e.then(function(e){return[null,e]}).catch(function(e){return t&&Object.assign(e,t),[e,void 0]})}r.r(t),r.d(t,"to",function(){return n}),t.default=n},function(e,t,r){e.exports=function(){"use strict";var e="millisecond",t="second",r="minute",n="hour",o="day",i="week",a="month",u="quarter",s="year",c=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,l=function(e,t,r){var n=String(e);return!n||n.length>=t?e:""+Array(t+1-n.length).join(r)+e},d={s:l,z:function(e){var t=-e.utcOffset(),r=Math.abs(t),n=Math.floor(r/60),o=r%60;return(t<=0?"+":"-")+l(n,2,"0")+":"+l(o,2,"0")},m:function(e,t){var r=12*(t.year()-e.year())+(t.month()-e.month()),n=e.clone().add(r,a),o=t-n<0,i=e.clone().add(r+(o?-1:1),a);return Number(-(r+(t-n)/(o?n-i:i-n))||0)},a:function(e){return e<0?Math.ceil(e)||0:Math.floor(e)},p:function(c){return{M:a,y:s,w:i,d:o,h:n,m:r,s:t,ms:e,Q:u}[c]||String(c||"").toLowerCase().replace(/s$/,"")},u:function(e){return void 0===e}},p={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},h="en",m={};m[h]=p;var v=function(e){return e instanceof b},g=function(e,t,r){var n;if(!e)return null;if("string"==typeof e)m[e]&&(n=e),t&&(m[e]=t,n=e);else{var o=e.name;m[o]=e,n=o}return r||(h=n),n},y=function(e,t,r){if(v(e))return e.clone();var n=t?"string"==typeof t?{format:t,pl:r}:t:{};return n.date=e,new b(n)},w=d;w.l=g,w.i=v,w.w=function(e,t){return y(e,{locale:t.$L,utc:t.$u})};var b=function(){function l(e){this.$L=this.$L||g(e.locale,null,!0)||h,this.parse(e)}var d=l.prototype;return d.parse=function(e){this.$d=function(e){var t=e.date,r=e.utc;if(null===t)return new Date(NaN);if(w.u(t))return new Date;if(t instanceof Date)return new Date(t);if("string"==typeof t&&!/Z$/i.test(t)){var n=t.match(c);if(n)return r?new Date(Date.UTC(n[1],n[2]-1,n[3]||1,n[4]||0,n[5]||0,n[6]||0,n[7]||0)):new Date(n[1],n[2]-1,n[3]||1,n[4]||0,n[5]||0,n[6]||0,n[7]||0)}return new Date(t)}(e),this.init()},d.init=function(){var e=this.$d;this.$y=e.getFullYear(),this.$M=e.getMonth(),this.$D=e.getDate(),this.$W=e.getDay(),this.$H=e.getHours(),this.$m=e.getMinutes(),this.$s=e.getSeconds(),this.$ms=e.getMilliseconds()},d.$utils=function(){return w},d.isValid=function(){return!("Invalid Date"===this.$d.toString())},d.isSame=function(e,t){var r=y(e);return this.startOf(t)<=r&&r<=this.endOf(t)},d.isAfter=function(e,t){return y(e)<this.startOf(t)},d.isBefore=function(e,t){return this.endOf(t)<y(e)},d.$g=function(e,t,r){return w.u(e)?this[t]:this.set(r,e)},d.year=function(e){return this.$g(e,"$y",s)},d.month=function(e){return this.$g(e,"$M",a)},d.day=function(e){return this.$g(e,"$W",o)},d.date=function(e){return this.$g(e,"$D","date")},d.hour=function(e){return this.$g(e,"$H",n)},d.minute=function(e){return this.$g(e,"$m",r)},d.second=function(e){return this.$g(e,"$s",t)},d.millisecond=function(t){return this.$g(t,"$ms",e)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(e,u){var c=this,f=!!w.u(u)||u,l=w.p(e),d=function(e,t){var r=w.w(c.$u?Date.UTC(c.$y,t,e):new Date(c.$y,t,e),c);return f?r:r.endOf(o)},p=function(e,t){return w.w(c.toDate()[e].apply(c.toDate(),(f?[0,0,0,0]:[23,59,59,999]).slice(t)),c)},h=this.$W,m=this.$M,v=this.$D,g="set"+(this.$u?"UTC":"");switch(l){case s:return f?d(1,0):d(31,11);case a:return f?d(1,m):d(0,m+1);case i:var y=this.$locale().weekStart||0,b=(h<y?h+7:h)-y;return d(f?v-b:v+(6-b),m);case o:case"date":return p(g+"Hours",0);case n:return p(g+"Minutes",1);case r:return p(g+"Seconds",2);case t:return p(g+"Milliseconds",3);default:return this.clone()}},d.endOf=function(e){return this.startOf(e,!1)},d.$set=function(i,u){var c,f=w.p(i),l="set"+(this.$u?"UTC":""),d=(c={},c[o]=l+"Date",c.date=l+"Date",c[a]=l+"Month",c[s]=l+"FullYear",c[n]=l+"Hours",c[r]=l+"Minutes",c[t]=l+"Seconds",c[e]=l+"Milliseconds",c)[f],p=f===o?this.$D+(u-this.$W):u;if(f===a||f===s){var h=this.clone().set("date",1);h.$d[d](p),h.init(),this.$d=h.set("date",Math.min(this.$D,h.daysInMonth())).toDate()}else d&&this.$d[d](p);return this.init(),this},d.set=function(e,t){return this.clone().$set(e,t)},d.get=function(e){return this[w.p(e)]()},d.add=function(e,u){var c,f=this;e=Number(e);var l=w.p(u),d=function(t){var r=new Date(f.$d);return r.setDate(r.getDate()+Math.round(t*e)),w.w(r,f)};if(l===a)return this.set(a,this.$M+e);if(l===s)return this.set(s,this.$y+e);if(l===o)return d(1);if(l===i)return d(7);var p=(c={},c[r]=6e4,c[n]=36e5,c[t]=1e3,c)[l]||1,h=this.valueOf()+e*p;return w.w(h,this)},d.subtract=function(e,t){return this.add(-1*e,t)},d.format=function(e){var t=this;if(!this.isValid())return"Invalid Date";var r=e||"YYYY-MM-DDTHH:mm:ssZ",n=w.z(this),o=this.$locale(),i=this.$H,a=this.$m,u=this.$M,s=o.weekdays,c=o.months,l=function(e,n,o,i){return e&&(e[n]||e(t,r))||o[n].substr(0,i)},d=function(e){return w.s(i%12||12,e,"0")},p=o.meridiem||function(e,t,r){var n=e<12?"AM":"PM";return r?n.toLowerCase():n},h={YY:String(this.$y).slice(-2),YYYY:this.$y,M:u+1,MM:w.s(u+1,2,"0"),MMM:l(o.monthsShort,u,c,3),MMMM:c[u]||c(this,r),D:this.$D,DD:w.s(this.$D,2,"0"),d:this.$W,dd:l(o.weekdaysMin,this.$W,s,2),ddd:l(o.weekdaysShort,this.$W,s,3),dddd:s[this.$W],H:i,HH:w.s(i,2,"0"),h:d(1),hh:d(2),a:p(i,a,!0),A:p(i,a,!1),m:a,mm:w.s(a,2,"0"),s:this.$s,ss:w.s(this.$s,2,"0"),SSS:w.s(this.$ms,3,"0"),Z:n};return String(r.replace(f,function(e,t){return t||h[e]||n.replace(":","")}))},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(e,c,f){var l,d=w.p(c),p=y(e),h=6e4*(p.utcOffset()-this.utcOffset()),m=this-p,v=w.m(this,p);return v=(l={},l[s]=v/12,l[a]=v,l[u]=v/3,l[i]=(m-h)/6048e5,l[o]=(m-h)/864e5,l[n]=m/36e5,l[r]=m/6e4,l[t]=m/1e3,l)[d]||m,f?v:w.a(v)},d.daysInMonth=function(){return this.endOf(a).$D},d.$locale=function(){return m[this.$L]},d.locale=function(e,t){if(!e)return this.$L;var r=this.clone();return r.$L=g(e,t,!0),r},d.clone=function(){return w.w(this.toDate(),this)},d.toDate=function(){return new Date(this.$d)},d.toJSON=function(){return this.toISOString()},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},l}();return y.prototype=b.prototype,y.extend=function(e,t){return e(t,b,y),y},y.locale=g,y.isDayjs=v,y.unix=function(e){return y(1e3*e)},y.en=m[h],y.Ls=m,y}()},function(e,t,r){e.exports=function(){"use strict";return function(e,t){t.prototype.isSameOrAfter=function(e,t){return this.isSame(e,t)||this.isAfter(e,t)}}}()},function(e,t,r){"use strict";var n=r(14);function o(e){this.message=e}o.prototype=new Error,o.prototype.name="InvalidTokenError",e.exports=function(e,t){if("string"!=typeof e)throw new o("Invalid token specified");var r=!0===(t=t||{}).header?0:1;try{return JSON.parse(n(e.split(".")[r]))}catch(e){throw new o("Invalid token specified: "+e.message)}},e.exports.InvalidTokenError=o},function(e,t,r){var n=r(15);e.exports=function(e){var t=e.replace(/-/g,"+").replace(/_/g,"/");switch(t.length%4){case 0:break;case 2:t+="==";break;case 3:t+="=";break;default:throw"Illegal base64url string!"}try{return function(e){return decodeURIComponent(n(e).replace(/(.)/g,function(e,t){var r=t.charCodeAt(0).toString(16).toUpperCase();return r.length<2&&(r="0"+r),"%"+r}))}(t)}catch(e){return n(t)}}},function(e,t){var r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";function n(e){this.message=e}n.prototype=new Error,n.prototype.name="InvalidCharacterError",e.exports="undefined"!=typeof window&&window.atob&&window.atob.bind(window)||function(e){var t=String(e).replace(/=+$/,"");if(t.length%4==1)throw new n("'atob' failed: The string to be decoded is not correctly encoded.");for(var o,i,a=0,u=0,s="";i=t.charAt(u++);~i&&(o=a%4?64*o+i:i,a++%4)?s+=String.fromCharCode(255&o>>(-2*a&6)):0)i=r.indexOf(i);return s}},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};var i,a,u,s=(i=function(e,t){try{return e()}catch(e){return t}},a=function(e,t,r){var n=t;t.includes(" as ")&&(n=(t=t.split(" as "))[0]);var o=i(function(){return Array.isArray(t)&&t[1].trim()},void 0),a=n.replace(/\[/g,".").replace(/]/g,"").split(".").filter(Boolean).map(function(e){return e.trim()});return{label:o||n,value:a.every(function(t){return!(t&&void 0===(e=e[t]))})?e:r}},u=function e(t,r,o,i,a){t&&(i=i||"",t.forEach(function(t){if(t){var u=t.columns&&Array.isArray(t.columns),s=t.rows&&Array.isArray(t.rows),c=t.components&&Array.isArray(t.components),f=!1,l=t.key?i?i+"."+t.key:t.key:"";a&&(t.parent=n({},a),delete t.parent.components,delete t.parent.componentMap,delete t.parent.columns,delete t.parent.rows),(o||t.tree||!u&&!s&&!c)&&(f=r(t,l));var d=function(){return t.key&&!["panel","table","well","columns","fieldset","tabs","form"].includes(t.type)&&(["datagrid","container","editgrid"].includes(t.type)||t.tree)?l:t.key&&"form"===t.type?l+".data":i};f||(u?t.columns.forEach(function(n){return e(n.components,r,o,d(),a?t:null)}):s?t.rows.forEach(function(n){Array.isArray(n)&&n.forEach(function(n){return e(n.components,r,o,d(),a?t:null)})}):c&&e(t.components,r,o,d(),a?t:null))}}))},Object.freeze({cloneDeep:function(e){return JSON.parse(JSON.stringify(e))},get:i,orderBy:function(){},isEmpty:function(e){if(!e)return!0;if(Array.isArray(e)||"string"==typeof e)return!e.length;for(var t in e)if(hasOwnProperty.call(e,t))return!1;return!0},debounce:function(e,t){var r=void 0;return function(){var n=this,o=arguments;clearTimeout(r),r=setTimeout(function(){return e.apply(n,o)},t)}},getFromPath:a,deleteNulls:function e(t){var r=t,n=r instanceof Array;for(var i in r)null===r[i]?n?r.splice(i,1):delete r[i]:"object"===o(r[i])&&e(r[i]);return r},eachComponent:u,findComponents:function(e,t){var r=[];return u(e,function(e,n){(function(e,t){if("string"==typeof t)return e.key===t;var r=!1;return Object.keys(t).forEach(function(n){if(!(r=a(e,n).value===t[n]))return!1}),r})(e,t)&&(e.path=n,r.push(e))},!0),r},unixDate:function(){return Math.round(+new Date/1e3)}}));t.default=s},function(e,t,r){"use strict";var n=r(0),o=r(3),i=r(19),a=r(1);function u(e){var t=new i(e),r=o(i.prototype.request,t);return n.extend(r,i.prototype,t),n.extend(r,t),r}var s=u(a);s.Axios=i,s.create=function(e){return u(n.merge(a,e))},s.Cancel=r(7),s.CancelToken=r(34),s.isCancel=r(6),s.all=function(e){return Promise.all(e)},s.spread=r(35),e.exports=s,e.exports.default=s},function(e,t){function r(e){return!!e.constructor&&"function"==typeof e.constructor.isBuffer&&e.constructor.isBuffer(e)}
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
e.exports=function(e){return null!=e&&(r(e)||function(e){return"function"==typeof e.readFloatLE&&"function"==typeof e.slice&&r(e.slice(0,0))}(e)||!!e._isBuffer)}},function(e,t,r){"use strict";var n=r(1),o=r(0),i=r(29),a=r(30);function u(e){this.defaults=e,this.interceptors={request:new i,response:new i}}u.prototype.request=function(e){"string"==typeof e&&(e=o.merge({url:arguments[0]},arguments[1])),(e=o.merge(n,{method:"get"},this.defaults,e)).method=e.method.toLowerCase();var t=[a,void 0],r=Promise.resolve(e);for(this.interceptors.request.forEach(function(e){t.unshift(e.fulfilled,e.rejected)}),this.interceptors.response.forEach(function(e){t.push(e.fulfilled,e.rejected)});t.length;)r=r.then(t.shift(),t.shift());return r},o.forEach(["delete","get","head","options"],function(e){u.prototype[e]=function(t,r){return this.request(o.merge(r||{},{method:e,url:t}))}}),o.forEach(["post","put","patch"],function(e){u.prototype[e]=function(t,r,n){return this.request(o.merge(n||{},{method:e,url:t,data:r}))}}),e.exports=u},function(e,t){var r,n,o=e.exports={};function i(){throw new Error("setTimeout has not been defined")}function a(){throw new Error("clearTimeout has not been defined")}function u(e){if(r===setTimeout)return setTimeout(e,0);if((r===i||!r)&&setTimeout)return r=setTimeout,setTimeout(e,0);try{return r(e,0)}catch(t){try{return r.call(null,e,0)}catch(t){return r.call(this,e,0)}}}!function(){try{r="function"==typeof setTimeout?setTimeout:i}catch(e){r=i}try{n="function"==typeof clearTimeout?clearTimeout:a}catch(e){n=a}}();var s,c=[],f=!1,l=-1;function d(){f&&s&&(f=!1,s.length?c=s.concat(c):l=-1,c.length&&p())}function p(){if(!f){var e=u(d);f=!0;for(var t=c.length;t;){for(s=c,c=[];++l<t;)s&&s[l].run();l=-1,t=c.length}s=null,f=!1,function(e){if(n===clearTimeout)return clearTimeout(e);if((n===a||!n)&&clearTimeout)return n=clearTimeout,clearTimeout(e);try{n(e)}catch(t){try{return n.call(null,e)}catch(t){return n.call(this,e)}}}(e)}}function h(e,t){this.fun=e,this.array=t}function m(){}o.nextTick=function(e){var t=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];c.push(new h(e,t)),1!==c.length||f||u(p)},h.prototype.run=function(){this.fun.apply(null,this.array)},o.title="browser",o.browser=!0,o.env={},o.argv=[],o.version="",o.versions={},o.on=m,o.addListener=m,o.once=m,o.off=m,o.removeListener=m,o.removeAllListeners=m,o.emit=m,o.prependListener=m,o.prependOnceListener=m,o.listeners=function(e){return[]},o.binding=function(e){throw new Error("process.binding is not supported")},o.cwd=function(){return"/"},o.chdir=function(e){throw new Error("process.chdir is not supported")},o.umask=function(){return 0}},function(e,t,r){"use strict";var n=r(0);e.exports=function(e,t){n.forEach(e,function(r,n){n!==t&&n.toUpperCase()===t.toUpperCase()&&(e[t]=r,delete e[n])})}},function(e,t,r){"use strict";var n=r(5);e.exports=function(e,t,r){var o=r.config.validateStatus;r.status&&o&&!o(r.status)?t(n("Request failed with status code "+r.status,r.config,null,r.request,r)):e(r)}},function(e,t,r){"use strict";e.exports=function(e,t,r,n,o){return e.config=t,r&&(e.code=r),e.request=n,e.response=o,e}},function(e,t,r){"use strict";var n=r(0);function o(e){return encodeURIComponent(e).replace(/%40/gi,"@").replace(/%3A/gi,":").replace(/%24/g,"$").replace(/%2C/gi,",").replace(/%20/g,"+").replace(/%5B/gi,"[").replace(/%5D/gi,"]")}e.exports=function(e,t,r){if(!t)return e;var i;if(r)i=r(t);else if(n.isURLSearchParams(t))i=t.toString();else{var a=[];n.forEach(t,function(e,t){null!=e&&(n.isArray(e)?t+="[]":e=[e],n.forEach(e,function(e){n.isDate(e)?e=e.toISOString():n.isObject(e)&&(e=JSON.stringify(e)),a.push(o(t)+"="+o(e))}))}),i=a.join("&")}return i&&(e+=(-1===e.indexOf("?")?"?":"&")+i),e}},function(e,t,r){"use strict";var n=r(0),o=["age","authorization","content-length","content-type","etag","expires","from","host","if-modified-since","if-unmodified-since","last-modified","location","max-forwards","proxy-authorization","referer","retry-after","user-agent"];e.exports=function(e){var t,r,i,a={};return e?(n.forEach(e.split("\n"),function(e){if(i=e.indexOf(":"),t=n.trim(e.substr(0,i)).toLowerCase(),r=n.trim(e.substr(i+1)),t){if(a[t]&&o.indexOf(t)>=0)return;a[t]="set-cookie"===t?(a[t]?a[t]:[]).concat([r]):a[t]?a[t]+", "+r:r}}),a):a}},function(e,t,r){"use strict";var n=r(0);e.exports=n.isStandardBrowserEnv()?function(){var e,t=/(msie|trident)/i.test(navigator.userAgent),r=document.createElement("a");function o(e){var n=e;return t&&(r.setAttribute("href",n),n=r.href),r.setAttribute("href",n),{href:r.href,protocol:r.protocol?r.protocol.replace(/:$/,""):"",host:r.host,search:r.search?r.search.replace(/^\?/,""):"",hash:r.hash?r.hash.replace(/^#/,""):"",hostname:r.hostname,port:r.port,pathname:"/"===r.pathname.charAt(0)?r.pathname:"/"+r.pathname}}return e=o(window.location.href),function(t){var r=n.isString(t)?o(t):t;return r.protocol===e.protocol&&r.host===e.host}}():function(){return!0}},function(e,t,r){"use strict";var n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";function o(){this.message="String contains an invalid character"}o.prototype=new Error,o.prototype.code=5,o.prototype.name="InvalidCharacterError",e.exports=function(e){for(var t,r,i=String(e),a="",u=0,s=n;i.charAt(0|u)||(s="=",u%1);a+=s.charAt(63&t>>8-u%1*8)){if((r=i.charCodeAt(u+=.75))>255)throw new o;t=t<<8|r}return a}},function(e,t,r){"use strict";var n=r(0);e.exports=n.isStandardBrowserEnv()?{write:function(e,t,r,o,i,a){var u=[];u.push(e+"="+encodeURIComponent(t)),n.isNumber(r)&&u.push("expires="+new Date(r).toGMTString()),n.isString(o)&&u.push("path="+o),n.isString(i)&&u.push("domain="+i),!0===a&&u.push("secure"),document.cookie=u.join("; ")},read:function(e){var t=document.cookie.match(new RegExp("(^|;\\s*)("+e+")=([^;]*)"));return t?decodeURIComponent(t[3]):null},remove:function(e){this.write(e,"",Date.now()-864e5)}}:{write:function(){},read:function(){return null},remove:function(){}}},function(e,t,r){"use strict";var n=r(0);function o(){this.handlers=[]}o.prototype.use=function(e,t){return this.handlers.push({fulfilled:e,rejected:t}),this.handlers.length-1},o.prototype.eject=function(e){this.handlers[e]&&(this.handlers[e]=null)},o.prototype.forEach=function(e){n.forEach(this.handlers,function(t){null!==t&&e(t)})},e.exports=o},function(e,t,r){"use strict";var n=r(0),o=r(31),i=r(6),a=r(1),u=r(32),s=r(33);function c(e){e.cancelToken&&e.cancelToken.throwIfRequested()}e.exports=function(e){return c(e),e.baseURL&&!u(e.url)&&(e.url=s(e.baseURL,e.url)),e.headers=e.headers||{},e.data=o(e.data,e.headers,e.transformRequest),e.headers=n.merge(e.headers.common||{},e.headers[e.method]||{},e.headers||{}),n.forEach(["delete","get","head","post","put","patch","common"],function(t){delete e.headers[t]}),(e.adapter||a.adapter)(e).then(function(t){return c(e),t.data=o(t.data,t.headers,e.transformResponse),t},function(t){return i(t)||(c(e),t&&t.response&&(t.response.data=o(t.response.data,t.response.headers,e.transformResponse))),Promise.reject(t)})}},function(e,t,r){"use strict";var n=r(0);e.exports=function(e,t,r){return n.forEach(r,function(r){e=r(e,t)}),e}},function(e,t,r){"use strict";e.exports=function(e){return/^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e)}},function(e,t,r){"use strict";e.exports=function(e,t){return t?e.replace(/\/+$/,"")+"/"+t.replace(/^\/+/,""):e}},function(e,t,r){"use strict";var n=r(7);function o(e){if("function"!=typeof e)throw new TypeError("executor must be a function.");var t;this.promise=new Promise(function(e){t=e});var r=this;e(function(e){r.reason||(r.reason=new n(e),t(r.reason))})}o.prototype.throwIfRequested=function(){if(this.reason)throw this.reason},o.source=function(){var e;return{token:new o(function(t){e=t}),cancel:e}},e.exports=o},function(e,t,r){"use strict";e.exports=function(e){return function(t){return e.apply(null,t)}}},function(e,t,r){"use strict";(function(e){var r,n,o,i,a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};i=function(){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==(void 0===e?"undefined":a(e))&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=13)}([function(e,t,r){var n=r(2),o=r(17),i=r(6),a=r(18),u=r(1),s=r(3),c=r(8),f=r(7),l=Array.prototype.concat;function d(){var e=l.apply([],arguments).filter(s);return 0===e.length?void 0:e}function p(e){if(!u(e))return e;var t=e.methods,r=e.properties,n=e.props,o=e.initializers,i=e.init,s=e.composers,l=e.deepProperties,p=e.deepProps,h=e.propertyDescriptors,m=e.staticProperties,v=e.statics,g=e.staticDeepProperties,y=e.deepStatics,w=e.configuration,b=e.conf,x=e.deepConfiguration,E=e.deepConf,O=u(n)||u(r)?f({},n,r):void 0,_=u(p)?c({},p):void 0;_=u(l)?c(_,l):_;var A=u(v)||u(m)?f({},v,m):void 0,S=u(y)?c({},y):void 0;S=u(g)?c(S,g):S;var k=e.staticPropertyDescriptors;a(e.name)&&(k=f({},k||{},{name:{value:e.name}}));var P=u(b)||u(w)?f({},b,w):void 0,C=u(E)?c({},E):void 0;C=u(x)?c(C,x):C;var j=d(i,o),T=d(s),M={};return t&&(M.methods=t),O&&(M.properties=O),j&&(M.initializers=j),T&&(M.composers=T),_&&(M.deepProperties=_),A&&(M.staticProperties=A),S&&(M.staticDeepProperties=S),h&&(M.propertyDescriptors=h),k&&(M.staticPropertyDescriptors=k),P&&(M.configuration=P),C&&(M.deepConfiguration=C),M}function h(){for(var e=arguments.length,t=[],r=0;r<e;r+=1){var o=arguments[r];t.push(i(o)?o:p(o))}return n.apply(this||m,t)}var m=o.compose({staticProperties:{create:function(){return this.apply(this,arguments)},compose:h}}),v=o.compose.staticProperties;for(var g in v)h[g]=v[g].bind(m);h.compose=h.bind(),e.exports=h},function(e,t){e.exports=function(e){var t=void 0===e?"undefined":a(e);return Boolean(e)&&("object"===t||"function"===t)}},function(e,t,r){var n=r(5),o=r(3),i=r(1),a=r(6),u=r(15),s=r(7),c=r(8),f=Array.prototype.slice;function l(e,t){var r=function e(t){var r=e.compose||{},n={__proto__:r.methods};if(c(n,r.deepProperties),s(n,r.properties),Object.defineProperties(n,r.propertyDescriptors||{}),!r.initializers||0===r.initializers.length)return n;void 0===t&&(t={});for(var i=r.initializers,a=i.length,u=0;u<a;u+=1){var l=i[u];if(o(l)){var d=l.call(n,t,{instance:n,stamp:e,args:f.apply(arguments)});n=void 0===d?n:d}}return n};e.staticDeepProperties&&c(r,e.staticDeepProperties),e.staticProperties&&s(r,e.staticProperties),e.staticPropertyDescriptors&&Object.defineProperties(r,e.staticPropertyDescriptors);var n=o(r.compose)?r.compose:t;return s(r.compose=function(){return n.apply(this,arguments)},e),r}function d(e,t,r){if(n(t)){var i=t.length,a=e[r]||[];e[r]=a;for(var u=0;u<i;u+=1){var s=t[u];o(s)&&a.indexOf(s)<0&&a.push(s)}}}function p(e,t,r,n){i(t[r])&&(i(e[r])||(e[r]={}),n(e[r],t[r]))}function h(e,t,r){p(e,t,r,c)}function m(e,t,r){p(e,t,r,s)}function v(e,t){var r=t&&t.compose||t;m(e,r,"methods"),m(e,r,"properties"),h(e,r,"deepProperties"),m(e,r,"propertyDescriptors"),m(e,r,"staticProperties"),h(e,r,"staticDeepProperties"),m(e,r,"staticPropertyDescriptors"),m(e,r,"configuration"),h(e,r,"deepConfiguration"),d(e,r.initializers,"initializers"),d(e,r.composers,"composers")}e.exports=function e(){var t={},r=[];u(this)&&(v(t,this),r.push(this));for(var o=0;o<arguments.length;o++){var i=arguments[o];u(i)&&(v(t,i),r.push(i))}var s=l(t,e),c=t.composers;if(n(c)&&c.length>0)for(var f=0;f<c.length;f+=1){var d=(0,c[f])({stamp:s,composables:r});s=a(d)?d:s}return s}},function(e,t){e.exports=function(e){return"function"==typeof e}},function(e,t){var r;r=function(){return this}();try{r=r||new Function("return this")()}catch(e){"object"==("undefined"==typeof window?"undefined":a(window))&&(r=window)}e.exports=r},function(e,t){e.exports=Array.isArray},function(e,t,r){var n=r(3);e.exports=function(e){return n(e)&&n(e.compose)}},function(e,t){e.exports=Object.assign},function(e,t,r){var n=r(16),o=r(1),i=r(5);function a(e,t){if(void 0===t)return e;if(i(t))return(i(e)?e:[]).concat(t);if(!n(t))return t;for(var r=o(e)?e:{},u=Object.keys(t),s=0;s<u.length;s+=1){var c=u[s],f=t[c];if(void 0!==f){var l=r[c],d=n(l)||i(f)?l:{};r[c]=a(d,f)}}return r}e.exports=function(e){for(var t=1;t<arguments.length;t++)e=a(e,arguments[t]);return e}},function(e,t,r){(function(e){Object.defineProperty(t,"__esModule",{value:!0});var n=i(r(0)),o=i(r(19));function i(e){return e&&e.__esModule?e:{default:e}}t.default=(0,n.default)({properties:{name:"baseModel",config:{remote:{path:void 0,token:void 0,pullForm:!1},local:{connector:"loki"},merge:{connector:"formio-loki"}}},methods:{getModelName:function(){return this.name},getFluentConfig:function(){var t=void 0;return"undefined"!=typeof window&&window&&window._FLUENT_?t=window._FLUENT_:e&&e._FLUENT_&&(t=e._FLUENT_),t},getConnector:function(e,t){var r=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return Array.isArray(e)?this.getConnectorFromArray(e,t,r):e instanceof Object?e:void 0},getConnectorFromArray:function(e,t){var r=this,n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];if(1===e.length)return e[0];if(this.config&&this.config[t]&&this.config[t].connector){var o=e.find(function(e){return e.name===r.config[t].connector});if(o instanceof Object)return o}if(n){var i=e.find(function(e){return e.name===n});if(i instanceof Object)return i}var a=e.find(function(e){return e.default});return a instanceof Object?a:void 0},remote:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.token,r=void 0===t?void 0:t,n=e.pullForm,o=void 0===n?void 0:n,i=e.connectorName,a=void 0===i?void 0:i,u=this.getFluentConfig(),s=u&&u.connectors&&u.connectors.remote;if(!s)throw new Error("No remote connector was defined. Please define it using Fluent.config()");var c=this.getConnector(s,"remote",a||!1);if(this.config.remote.token=r||this.config.remote.token,o&&(this.config.remote.pullForm=o||this.config.remote.pullForm),c)return c.connector({remoteConnection:this.config.remote,connector:c});throw new Error("No default remote connector found. Please assign one as your default in Fluent.config")},local:function(){var e=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}).connectorName,t=void 0===e?void 0:e,r=this.getFluentConfig(),n=r&&r.connectors&&r.connectors.local;if(!n)throw new Error("No local connector was defined. Please define it using Fluent.config()");var o=this.getConnector(n,"local",t||!1);if(o)return o.connector({name:this.name,connector:o});throw new Error("No default local connector found. Please assign one as your default in Fluent.config")},merged:function(){var e=this.local(),t=this.remote(),r=this.getFluentConfig(),n=r&&r.connectors&&r.connectors.merge;if(!n)throw new Error("No merge connector was defined. Please define it using Fluent.config()");var o=this.getConnector(n,"merge");if(o)return o.connector({local:e,remote:t,name:this.name,connector:o});throw new Error("No default merge connector found. Please assign one as your default in Fluent.config")}}}).compose(o.default)}).call(this,r(4))},function(e,t,r){Object.defineProperty(t,"__esModule",{value:!0});var n=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},o=a(r(0)),i=a(r(11));function a(e){return e&&e.__esModule?e:{default:e}}function u(e){if(Array.isArray(e)){for(var t=0,r=Array(e.length);t<e.length;t++)r[t]=e[t];return r}return Array.from(e)}t.default=(0,o.default)({init:function(e){if(!Array.isArray(e))throw new Error("Collect method only accepts arrays of data");this.data=e},properties:{data:[]},methods:{get:function(){return this.data},all:function(){return this.get()},avg:function(e){return this.average(e)},average:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=[].concat(u(this.data)),r=t.reduce(function(t,r){var n=r;if(r instanceof Object){var o=i.default.getFromPath(r,e,void 0);void 0!==o&&o.value&&(n=o.value)}return t+n},0);try{return r/t.length}catch(e){throw new Error('Division between "'+r+'" and "'+t.length+'" is not valid.')}},chunkApply:function(e,t){var r,n=this;return(r=regeneratorRuntime.mark(function r(){var o,i,a,u;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:if(void 0!==t){r.next=2;break}throw new Error("Callback function not defined.");case 2:return o=n.data.length,i=0,n.chunks(e),a=function(r,n){return r.then(function(){return Promise.all(n.map(function(e){return t(e)}))}).then(function(){i=i+e>o?o:i+e,console.log("Processed "+i+"/"+o+" elements...")})},console.log("Processed "+i+"/"+o+" elements..."),u=n.data.reduce(a,Promise.resolve()),r.abrupt("return",u);case 9:case"end":return r.stop()}},r,n)}),function(){var e=r.apply(this,arguments);return new Promise(function(t,r){return function n(o,i){try{var a=e[o](i),u=a.value}catch(e){return void r(e)}if(!a.done)return Promise.resolve(u).then(function(e){n("next",e)},function(e){n("throw",e)});t(u)}("next")})})()},chunks:function(e){for(var t=[].concat(u(this.data)),r=[];t.length;)r.push(t.splice(0,e));return this.data=r,this},collapse:function(){var e=[].concat(u(this.data)),t=[];return e.forEach(function(e){Array.isArray(e)?e.forEach(function(e){t.push(e)}):t.push(e)}),this.data=t,this},unChunk:function(){return this.collapse()},combine:function(e){var t=[].concat(u(this.data)),r=void 0;return t.forEach(function(t,o){t instanceof Object?(r||(r=[]),r[o]=n({},t,{_value:e[o]})):(r||(r={}),r[t]=e[o])}),this.data=r,this},concat:function(e){return this.data=[].concat(u(this.data),u(e)),this},contains:function(){var e=void 0,t=void 0,r=void 0;return 1===arguments.length?(this.isFunction(arguments.length<=0?void 0:arguments[0])&&(r=arguments.length<=0?void 0:arguments[0]),e=arguments.length<=0?void 0:arguments[0]):(e=arguments.length<=1?void 0:arguments[1],t=arguments.length<=0?void 0:arguments[0]),[].concat(u(this.data)).some(function(n,o){if(r)return!!r(n,o);var a=n;if(n instanceof Object){var u=i.default.getFromPath(n,t,void 0);u.value&&(a=u.value)}return a===e})},duplicatesBy:function(e){var t=[].concat(u(this.data)),r=[];return t.reduce(function(t,n){var o=e.reduce(function(e,t){return e+i.default.getFromPath(n,t,"").value},"");return t.hasOwnProperty(o)?r.push(n):t[o]=!0,t},{}),this.data=r,this},count:function(){return this.data.length},isFunction:function(e){return e&&"[object Function]"==={}.toString.call(e)}}})},function(e,t,r){Object.defineProperty(t,"__esModule",{value:!0});var n,o=(n=function(e,t){try{return e()}catch(e){return t}},Object.freeze({get:n,getFromPath:function(e,t,r){var o=t;t.includes(" as ")&&(o=(t=t.split(" as "))[0]);var i=n(function(){return Array.isArray(t)&&t[1].trim()},void 0),a=o.replace(/\[/g,".").replace(/]/g,"").split(".").filter(Boolean).map(function(e){return e.trim()});return{label:i||o,value:a.every(function(t){return!(t&&void 0===(e=e[t]))})?e:r}}}));t.default=o},function(e,t,r){Object.defineProperty(t,"__esModule",{value:!0});var n="function"==typeof Symbol&&"symbol"==a(Symbol.iterator)?function(e){return void 0===e?"undefined":a(e)}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":void 0===e?"undefined":a(e)},o=s(r(0)),i=s(r(11)),u=s(r(10));function s(e){return e&&e.__esModule?e:{default:e}}function c(e){if(Array.isArray(e)){for(var t=0,r=Array(e.length);t<e.length;t++)r[t]=e[t];return r}return Array.from(e)}function f(e){return function(){var t=e.apply(this,arguments);return new Promise(function(e,r){return function n(o,i){try{var a=t[o](i),u=a.value}catch(e){return void r(e)}if(!a.done)return Promise.resolve(u).then(function(e){n("next",e)},function(e){n("throw",e)});e(u)}("next")})}}t.default=(0,o.default)({init:function(e){var t=e.name,r=e.remoteConnection,n=e.connector;if(!t&&!r)throw new Error("Model must have a name or path");if(!n)throw new Error("Model must have a connector. Please register one using Fluent.config");this.name=t||this.name,this.remoteConnection=r||this.remoteConnection,this.connector=n||this.connector,this.chainReference=[],this.whereArray=[],this.orWhereArray=[],this.selectArray=[],this.orderByArray=[],this.limitNumber=void 0,this.offsetNumber=void 0,this.populate=[],this.chunk=null,this.pullSize=null,this.ownerId=void 0,this.paginator=void 0,this.rawQuery=void 0},properties:{operators:["=","<",">","<=",">=","<>","!=","in","nin","like","regexp","startsWith","endsWith","contains"]},methods:{get:function(){throw new Error("get() method not implemented")},all:function(){throw new Error("all() method not implemented")},find:function(e){throw new Error("find() method not implemented")},findOne:function(){throw new Error("findOne() method not implemented")},remove:function(){throw new Error("remove() method not implemented")},softDelete:function(){throw new Error("softDelete() method not implemented")},insert:function(){throw new Error("insert() method not implemented")},update:function(){throw new Error("update() method not implemented")},clear:function(){throw new Error("clear() method not implemented")},updateOrCreate:function(){throw new Error("updateOrCreate() method not implemented")},findAndRemove:function(){throw new Error("findAndRemove() method not implemented")},paginate:function(){throw new Error("paginate() method not implemented")},tableView:function(){throw new Error("tableView() method not implemented")},raw:function(){throw new Error("raw() method not implemented")},owner:function(e){return this.chainReference.push({method:"owner",args:e}),this.ownerId=e,this},own:function(e){return this.owner(e)},first:function(){var e=this;return f(regeneratorRuntime.mark(function t(){var r;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,e.get();case 2:return r=t.sent,t.abrupt("return",i.default.get(function(){return r[0]},[]));case 4:case"end":return t.stop()}},t,e)}))()},collect:function(){var e=this;return f(regeneratorRuntime.mark(function t(){var r;return regeneratorRuntime.wrap(function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,e.get();case 2:if(r=t.sent,Array.isArray(r)){t.next=5;break}throw new Error("Collect method only accepts arrays of data");case 5:return t.abrupt("return",(0,u.default)(r));case 6:case"end":return t.stop()}},t,e)}))()},select:function(){for(var e=arguments.length,t=Array(e),r=0;r<e;r++)t[r]=arguments[r];return t=this.prepareInput(t),this.chainReference.push({method:"select",args:t}),this.selectArray=this.selectArray.concat(t).filter(function(e,t,r){return r.indexOf(e)===t}),this},jsApplySelect:function(e){var t=this,r=Array.isArray(e)?[].concat(c(e)):[e];return this.selectArray.length>0&&(r=r.map(function(e){var r={};return t.selectArray.forEach(function(t){var o=i.default.getFromPath(e,t,void 0),a=i.default.get(function(){return o.value},void 0);void 0!==a&&("object"===(void 0===a?"undefined":n(a))&&a.hasOwnProperty("data")&&a.data.hasOwnProperty("name")?r[o.label]=a.data.name:r[o.label]=a)}),r})),r},offset:function(e){return this.chainReference.push({method:"offset",args:e}),this.offsetNumber=e,this},skip:function(e){return this.offset(e)},where:function(){for(var e=this,t=arguments.length,r=Array(t),n=0;n<t;n++)r[n]=arguments[n];return this.chainReference.push({method:"where",args:r}),this.whereArray=[],(r=Array.isArray(r[0])?r:[r]).forEach(function(t){if(3!==t.length)throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(t)+'" ');e.whereArray.push(t)}),this},andWhere:function(){for(var e=this,t=arguments.length,r=Array(t),n=0;n<t;n++)r[n]=arguments[n];return this.chainReference.push({method:"andWhere",args:r}),(r=Array.isArray(r[0])?r:[r]).forEach(function(t){if(3!==t.length)throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(t)+'" ');e.whereArray.push(t)}),this},orWhere:function(){for(var e=this,t=arguments.length,r=Array(t),n=0;n<t;n++)r[n]=arguments[n];return this.chainReference.push({method:"orWhere",args:r}),(r=Array.isArray(r[0])?r:[r]).forEach(function(t){if(3!==t.length)throw new Error('There orWhere clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "'+JSON.stringify(t)+'" ');e.orWhereArray.push(t)}),this},limit:function(e){return this.chainReference.push({method:"limit",args:e}),this.limitNumber=e,this},take:function(e){return this.limit(e)},pluck:function(e){var t=this;return f(regeneratorRuntime.mark(function r(){var n;return regeneratorRuntime.wrap(function(r){for(;;)switch(r.prev=r.next){case 0:return t.chainReference.push({method:"pluck",args:e}),r.next=3,t.get();case 3:return n=(n=r.sent).map(function(t){var r=i.default.getFromPath(t,e,void 0);if(void 0!==r.value)return r.value}),r.abrupt("return",n);case 6:case"end":return r.stop()}},r,t)}))()},orderBy:function(){for(var e=arguments.length,t=Array(e),r=0;r<e;r++)t[r]=arguments[r];return this.chainReference.push({method:"orderBy",args:t}),this.orderByArray=t,this},jsApplyOrderBy:function(e){var t=[].concat(c(e));if(0===this.orderByArray.length)return t;var r=this.orderByArray[0];if(this.selectArray.length>0&&(r.includes(".")||r.includes("[")))throw new Error('Cannot orderBy nested attribute "'+r+'" when using Select. You must rename the attribute');var n=this.orderByArray[1],o=this.orderByArray[2];return o||(o="string"),t.sort(function(e,t){var a=i.default.getFromPath(e,r,void 0).value,u=i.default.getFromPath(t,r,void 0).value;if(void 0===a||void 0===u)throw new Error('Cannot order by property "'+r+'" not all values have this property');return o.includes("string")||o.includes("number")?"asc"===n?a>u?1:a<u?-1:0:a>u?-1:a<u?1:0:o.includes("date")?"asc"===n?new Date(a)-new Date(u):new Date(u)-new Date(a):void 0})},prepareInput:function(e){var t=[];return e.forEach(function(e){var r=Array.isArray(e)?e:e.split(",");r=r.map(function(e){return e.trim()}),t=t.concat(r)}),t.filter(function(e,t,r){return r.indexOf(e)===t}),t},ArrayInsert:function(e,t){var r=this;return f(regeneratorRuntime.mark(function n(){var o,i,a,u,s,c,f,l;return regeneratorRuntime.wrap(function(n){for(;;)switch(n.prev=n.next){case 0:o=1,i=e.length,a=!0,u=!1,s=void 0,n.prev=5,c=e[Symbol.iterator]();case 7:if(a=(f=c.next()).done){n.next=26;break}return l=f.value,t&&t.showProgress&&console.log("Inserting "+o+" of "+i),n.prev=10,n.next=13,r.insert(l,t);case 13:n.sent,t&&t.showProgress&&console.log("Element "+o+" inserted"),o++,n.next=23;break;case 18:n.prev=18,n.t0=n.catch(10),console.log("ERROR - Element "+o+" - "+JSON.stringify(l)+" could not be inserted"),console.log(n.t0),o++;case 23:a=!0,n.next=7;break;case 26:n.next=32;break;case 28:n.prev=28,n.t1=n.catch(5),u=!0,s=n.t1;case 32:n.prev=32,n.prev=33,!a&&c.return&&c.return();case 35:if(n.prev=35,!u){n.next=38;break}throw s;case 38:return n.finish(35);case 39:return n.finish(32);case 40:case"end":return n.stop()}},n,r,[[5,28,32,40],[10,18],[33,,35,39]])}))()}}})},function(e,t,r){Object.defineProperty(t,"__esModule",{value:!0}),t.MergeConnector=t.Interface=t.Fluent=t.Model=void 0;var n=u(r(14)),o=u(r(9)),i=u(r(12)),a=u(r(20));function u(e){return e&&e.__esModule?e:{default:e}}t.Model=o.default,t.Fluent=n.default,t.Interface=i.default,t.MergeConnector=a.default},function(e,t,r){(function(e){Object.defineProperty(t,"__esModule",{value:!0});var n=a(r(0)),o=a(r(9)),i=a(r(10));function a(e){return e&&e.__esModule?e:{default:e}}function u(e){if(Array.isArray(e)){for(var t=0,r=Array(e.length);t<e.length;t++)r[t]=e[t];return r}return Array.from(e)}var s=(0,n.default)({init:function(){this.registerGlobalVariable()},properties:{},methods:{model:function(){for(var e=arguments.length,t=Array(e),r=0;r<e;r++)t[r]=arguments[r];return this.registerModel(t),o.default.compose.apply(o.default,u(t))},extend:function(){for(var e=arguments.length,t=Array(e),r=0;r<e;r++)t[r]=arguments[r];return this.registerModel(t),o.default.compose.apply(o.default,u(t))},compose:function(){for(var e=arguments.length,t=Array(e),r=0;r<e;r++)t[r]=arguments[r];return this.registerModel(t),o.default.compose.apply(o.default,u(t))},collect:function(e){return(0,i.default)(e)},registerGlobalVariable:function(){"undefined"!=typeof window&&window&&!window._FLUENT_&&(window._FLUENT_={connectors:{},models:{}}),e&&!e._FLUENT_&&(e._FLUENT_={connectors:{},models:{}})},registerModel:function(t){var r=t&&t[0]&&t[0].properties&&t[0].properties.name?t[0].properties.name:void 0;if(r&&"baseModel"!==r){if("string"!=typeof r)throw new Error("You must assign a name to your Model when using Fluent.compose");"undefined"==typeof window?e._FLUENT_.models[r]=!0:window._FLUENT_.models[r]=!0}},config:function(t){var r=t.REMOTE_CONNECTORS,n=void 0===r?void 0:r,o=t.LOCAL_CONNECTORS,i=void 0===o?void 0:o,a=t.MERGE_CONNECTORS,u=void 0===a?void 0:a;"undefined"!=typeof window&&window&&(window._FLUENT_.connectors={local:i,remote:n,merge:u}),void 0!==e&&e&&(e._FLUENT_.connectors={local:i,remote:n,merge:u})},getConfig:function(){return"undefined"!=typeof window&&window?window._FLUENT_:void 0!==e&&e?e._FLUENT_:void 0}}})();t.default=s}).call(this,r(4))},function(e,t,r){e.exports=r(1)},function(e,t){e.exports=function(e){return Boolean(e)&&"object"==(void 0===e?"undefined":a(e))&&Object.getPrototypeOf(e)===Object.prototype}},function(e,t,r){var n=r(2);function o(e){return function(t){var r={};return r[e]=t,this&&this.compose?this.compose(r):n(r)}}var i=o("properties"),a=o("staticProperties"),u=o("configuration"),s=o("deepProperties"),c=o("staticDeepProperties"),f=o("deepConfiguration"),l=o("initializers");e.exports=n({staticProperties:{methods:o("methods"),props:i,properties:i,statics:a,staticProperties:a,conf:u,configuration:u,deepProps:s,deepProperties:s,deepStatics:c,staticDeepProperties:c,deepConf:f,deepConfiguration:f,init:l,initializers:l,composers:o("composers"),propertyDescriptors:o("propertyDescriptors"),staticPropertyDescriptors:o("staticPropertyDescriptors")}})},function(e,t){e.exports=function(e){return"string"==typeof e}},function(e,t,r){var n=r(2),o=new WeakMap,i=function(e,t){function r(){var t=o.get(this);return e.apply(t,arguments)}return Object.defineProperty(r,"name",{value:t,configurable:!0}),r};function a(e,t){var r=t.stamp.compose,n=r.deepConfiguration.Privatize.methods,a={};o.set(a,this);var u=r.methods;if(!u)return a;for(var s=Object.keys(u),c=0;c<s.length;c++){var f=s[c];n.indexOf(f)<0&&(a[f]=i(u[f],f))}if("undefined"!=typeof Symbol){var l=Symbol.for("stamp");u[l]&&(a[l]=t.stamp)}return a}var u=n({initializers:[a],deepConfiguration:{Privatize:{methods:[]}},staticProperties:{privatizeMethods:function(){for(var e=[],t=0;t<arguments.length;t++){var r=arguments[t];"string"==typeof r&&r.length>0&&e.push(r)}return(this&&this.compose?this:u).compose({deepConfiguration:{Privatize:{methods:e}}})}},composers:[function(e){var t=e.stamp.compose.initializers;t.splice(t.indexOf(a),1),t.push(a)}]});e.exports=u},function(e,t,r){Object.defineProperty(t,"__esModule",{value:!0});var n,o=(n=r(12))&&n.__esModule?n:{default:n};t.default=o.default.compose({properties:{localFx:void 0,remoteFx:void 0},init:function(e){this.connectors=e},methods:{get:function(){var e,t=this;return(e=regeneratorRuntime.mark(function e(){var r,n;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return t.prepareMergedFunctions(),e.next=3,t.localFx.get();case 3:return r=e.sent,e.next=6,t.remoteFx.get();case 6:return n=e.sent,e.abrupt("return",r.concat(n));case 8:case"end":return e.stop()}},e,t)}),function(){var t=e.apply(this,arguments);return new Promise(function(e,r){return function n(o,i){try{var a=t[o](i),u=a.value}catch(e){return void r(e)}if(!a.done)return Promise.resolve(u).then(function(e){n("next",e)},function(e){n("throw",e)});e(u)}("next")})})()},prepareMergedFunctions:function(){var e=this;this.localFx=this.connectors.local,this.remoteFx=this.connectors.remote,this.chainReference.forEach(function(t){var r=t.method,n=t.args;e.localFx=e.localFx[r](n),e.remoteFx=e.remoteFx[r](n)})}}})}])},"object"==a(t)&&"object"==a(e)?e.exports=i():(n=[],void 0===(o="function"==typeof(r=i)?r.apply(t,n):r)||(e.exports=o))}).call(this,r(37)(e))},function(e,t){e.exports=function(e){return e.webpackPolyfill||(e.deprecate=function(){},e.paths=[],e.children||(e.children=[]),Object.defineProperty(e,"loaded",{enumerable:!0,get:function(){return e.l}}),Object.defineProperty(e,"id",{enumerable:!0,get:function(){return e.i}}),e.webpackPolyfill=1),e}},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=i(r(39)),o=i(r(2));function i(e){return e&&e.__esModule?e:{default:e}}var a=function(){var e="undefined"==typeof window||!window||!window.navigator||window.navigator.onLine;return Object.freeze({isOnline:function(){return new Promise(function(e,t){o.default.get("https://yesno.wtf/api").then(function(t){e(!0)}).catch(function(t){e(!1)})})},initEventListeners:function(){n.default.listen({name:"online",callback:function(){console.log("App is now online"),e||(e=!0,n.default.emit({name:"FAST:CONNECTION:ONLINE",data:e,text:"Application is now online"}))}}),n.default.listen({name:"offline",callback:function(){console.log("App is now offline"),e&&(e=!1,n.default.emit({name:"FAST:CONNECTION:OFFLINE",data:e,text:"Application is now offline"}))}})}})}();t.default=a},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=function(){var e=function(e,t){var r=document.createEvent("CustomEvent");return t=t||{bubbles:!1,cancelable:!1,detail:void 0},r.initCustomEvent(e,t.bubbles,t.cancelable,t.detail),r};return Object.freeze({emit:function(t){var r=t.name,n=t.data,o=t.text;if(!r)throw new Error("Event must have a name.");if(!n)throw new Error("Event must have data.");if(!o)throw new Error("Event must have a text.");var i=e(r,{detail:{data:n,text:o}});window.dispatchEvent(i)},listen:function(e){var t=e.name,r=e.callback;if(!t)throw new Error("Listener must have a name.");if(!r)throw new Error("Listener must have a callback.");window.addEventListener(t,r)},remove:function(e){var t=e.name,r=e.callback;if(!t)throw new Error("Listener must have a name to detach");if(!r)throw new Error("Listener must have a callback to detach");window.removeEventListener(t,r)}})}();t.default=n},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});var n=function(e){function t(e){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t);var r=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(t.__proto__||Object.getPrototypeOf(t)).call(this,e));return r.name="AuthenticationError",r}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}(t,Error),t}();t.default=n}])});
//# sourceMappingURL=fluent-formio.min.js.map

/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(module) {var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;

var _typeof3 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function webpackUniversalModuleDefinition(root, factory) {
  if (( false ? undefined : _typeof3(exports)) === 'object' && ( false ? undefined : _typeof3(module)) === 'object') module.exports = factory();else if (true) !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));else {}
})(undefined, function () {
  return (/******/function (modules) {
      // webpackBootstrap
      /******/ // The module cache
      /******/var installedModules = {};
      /******/
      /******/ // The require function
      /******/function __webpack_require__(moduleId) {
        /******/
        /******/ // Check if module is in cache
        /******/if (installedModules[moduleId]) {
          /******/return installedModules[moduleId].exports;
          /******/
        }
        /******/ // Create a new module (and put it into the cache)
        /******/var module = installedModules[moduleId] = {
          /******/i: moduleId,
          /******/l: false,
          /******/exports: {}
          /******/ };
        /******/
        /******/ // Execute the module function
        /******/modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        /******/
        /******/ // Flag the module as loaded
        /******/module.l = true;
        /******/
        /******/ // Return the exports of the module
        /******/return module.exports;
        /******/
      }
      /******/
      /******/
      /******/ // expose the modules object (__webpack_modules__)
      /******/__webpack_require__.m = modules;
      /******/
      /******/ // expose the module cache
      /******/__webpack_require__.c = installedModules;
      /******/
      /******/ // define getter function for harmony exports
      /******/__webpack_require__.d = function (exports, name, getter) {
        /******/if (!__webpack_require__.o(exports, name)) {
          /******/Object.defineProperty(exports, name, { enumerable: true, get: getter });
          /******/
        }
        /******/
      };
      /******/
      /******/ // define __esModule on exports
      /******/__webpack_require__.r = function (exports) {
        /******/if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
          /******/Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
          /******/
        }
        /******/Object.defineProperty(exports, '__esModule', { value: true });
        /******/
      };
      /******/
      /******/ // create a fake namespace object
      /******/ // mode & 1: value is a module id, require it
      /******/ // mode & 2: merge all properties of value into the ns
      /******/ // mode & 4: return value when already ns object
      /******/ // mode & 8|1: behave like require
      /******/__webpack_require__.t = function (value, mode) {
        /******/if (mode & 1) value = __webpack_require__(value);
        /******/if (mode & 8) return value;
        /******/if (mode & 4 && (typeof value === 'undefined' ? 'undefined' : _typeof3(value)) === 'object' && value && value.__esModule) return value;
        /******/var ns = Object.create(null);
        /******/__webpack_require__.r(ns);
        /******/Object.defineProperty(ns, 'default', { enumerable: true, value: value });
        /******/if (mode & 2 && typeof value != 'string') for (var key in value) {
          __webpack_require__.d(ns, key, function (key) {
            return value[key];
          }.bind(null, key));
        } /******/return ns;
        /******/
      };
      /******/
      /******/ // getDefaultExport function for compatibility with non-harmony modules
      /******/__webpack_require__.n = function (module) {
        /******/var getter = module && module.__esModule ?
        /******/function getDefault() {
          return module['default'];
        } :
        /******/function getModuleExports() {
          return module;
        };
        /******/__webpack_require__.d(getter, 'a', getter);
        /******/return getter;
        /******/
      };
      /******/
      /******/ // Object.prototype.hasOwnProperty.call
      /******/__webpack_require__.o = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
      };
      /******/
      /******/ // __webpack_public_path__
      /******/__webpack_require__.p = "";
      /******/
      /******/
      /******/ // Load entry module and return exports
      /******/return __webpack_require__(__webpack_require__.s = 8);
      /******/
    }(
    /************************************************************************/
    /******/[
    /* 0 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var bind = __webpack_require__(3);
      var isBuffer = __webpack_require__(13);

      /*global toString:true*/

      // utils is a library of generic helper functions non-specific to axios

      var toString = Object.prototype.toString;

      /**
       * Determine if a value is an Array
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is an Array, otherwise false
       */
      function isArray(val) {
        return toString.call(val) === '[object Array]';
      }

      /**
       * Determine if a value is an ArrayBuffer
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is an ArrayBuffer, otherwise false
       */
      function isArrayBuffer(val) {
        return toString.call(val) === '[object ArrayBuffer]';
      }

      /**
       * Determine if a value is a FormData
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is an FormData, otherwise false
       */
      function isFormData(val) {
        return typeof FormData !== 'undefined' && val instanceof FormData;
      }

      /**
       * Determine if a value is a view on an ArrayBuffer
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
       */
      function isArrayBufferView(val) {
        var result;
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
          result = ArrayBuffer.isView(val);
        } else {
          result = val && val.buffer && val.buffer instanceof ArrayBuffer;
        }
        return result;
      }

      /**
       * Determine if a value is a String
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a String, otherwise false
       */
      function isString(val) {
        return typeof val === 'string';
      }

      /**
       * Determine if a value is a Number
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a Number, otherwise false
       */
      function isNumber(val) {
        return typeof val === 'number';
      }

      /**
       * Determine if a value is undefined
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if the value is undefined, otherwise false
       */
      function isUndefined(val) {
        return typeof val === 'undefined';
      }

      /**
       * Determine if a value is an Object
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is an Object, otherwise false
       */
      function isObject(val) {
        return val !== null && (typeof val === 'undefined' ? 'undefined' : _typeof3(val)) === 'object';
      }

      /**
       * Determine if a value is a Date
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a Date, otherwise false
       */
      function isDate(val) {
        return toString.call(val) === '[object Date]';
      }

      /**
       * Determine if a value is a File
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a File, otherwise false
       */
      function isFile(val) {
        return toString.call(val) === '[object File]';
      }

      /**
       * Determine if a value is a Blob
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a Blob, otherwise false
       */
      function isBlob(val) {
        return toString.call(val) === '[object Blob]';
      }

      /**
       * Determine if a value is a Function
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a Function, otherwise false
       */
      function isFunction(val) {
        return toString.call(val) === '[object Function]';
      }

      /**
       * Determine if a value is a Stream
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a Stream, otherwise false
       */
      function isStream(val) {
        return isObject(val) && isFunction(val.pipe);
      }

      /**
       * Determine if a value is a URLSearchParams object
       *
       * @param {Object} val The value to test
       * @returns {boolean} True if value is a URLSearchParams object, otherwise false
       */
      function isURLSearchParams(val) {
        return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
      }

      /**
       * Trim excess whitespace off the beginning and end of a string
       *
       * @param {String} str The String to trim
       * @returns {String} The String freed of excess whitespace
       */
      function trim(str) {
        return str.replace(/^\s*/, '').replace(/\s*$/, '');
      }

      /**
       * Determine if we're running in a standard browser environment
       *
       * This allows axios to run in a web worker, and react-native.
       * Both environments support XMLHttpRequest, but not fully standard globals.
       *
       * web workers:
       *  typeof window -> undefined
       *  typeof document -> undefined
       *
       * react-native:
       *  navigator.product -> 'ReactNative'
       */
      function isStandardBrowserEnv() {
        if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
          return false;
        }
        return typeof window !== 'undefined' && typeof document !== 'undefined';
      }

      /**
       * Iterate over an Array or an Object invoking a function for each item.
       *
       * If `obj` is an Array callback will be called passing
       * the value, index, and complete array for each item.
       *
       * If 'obj' is an Object callback will be called passing
       * the value, key, and complete object for each property.
       *
       * @param {Object|Array} obj The object to iterate
       * @param {Function} fn The callback to invoke for each item
       */
      function forEach(obj, fn) {
        // Don't bother if no value provided
        if (obj === null || typeof obj === 'undefined') {
          return;
        }

        // Force an array if not already something iterable
        if ((typeof obj === 'undefined' ? 'undefined' : _typeof3(obj)) !== 'object') {
          /*eslint no-param-reassign:0*/
          obj = [obj];
        }

        if (isArray(obj)) {
          // Iterate over array values
          for (var i = 0, l = obj.length; i < l; i++) {
            fn.call(null, obj[i], i, obj);
          }
        } else {
          // Iterate over object keys
          for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              fn.call(null, obj[key], key, obj);
            }
          }
        }
      }

      /**
       * Accepts varargs expecting each argument to be an object, then
       * immutably merges the properties of each object and returns result.
       *
       * When multiple objects contain the same key the later object in
       * the arguments list will take precedence.
       *
       * Example:
       *
       * ```js
       * var result = merge({foo: 123}, {foo: 456});
       * console.log(result.foo); // outputs 456
       * ```
       *
       * @param {Object} obj1 Object to merge
       * @returns {Object} Result of all merge properties
       */
      function merge() /* obj1, obj2, obj3, ... */{
        var result = {};
        function assignValue(val, key) {
          if (_typeof3(result[key]) === 'object' && (typeof val === 'undefined' ? 'undefined' : _typeof3(val)) === 'object') {
            result[key] = merge(result[key], val);
          } else {
            result[key] = val;
          }
        }

        for (var i = 0, l = arguments.length; i < l; i++) {
          forEach(arguments[i], assignValue);
        }
        return result;
      }

      /**
       * Extends object a by mutably adding to it the properties of object b.
       *
       * @param {Object} a The object to be extended
       * @param {Object} b The object to copy properties from
       * @param {Object} thisArg The object to bind function to
       * @return {Object} The resulting value of object a
       */
      function extend(a, b, thisArg) {
        forEach(b, function assignValue(val, key) {
          if (thisArg && typeof val === 'function') {
            a[key] = bind(val, thisArg);
          } else {
            a[key] = val;
          }
        });
        return a;
      }

      module.exports = {
        isArray: isArray,
        isArrayBuffer: isArrayBuffer,
        isBuffer: isBuffer,
        isFormData: isFormData,
        isArrayBufferView: isArrayBufferView,
        isString: isString,
        isNumber: isNumber,
        isObject: isObject,
        isUndefined: isUndefined,
        isDate: isDate,
        isFile: isFile,
        isBlob: isBlob,
        isFunction: isFunction,
        isStream: isStream,
        isURLSearchParams: isURLSearchParams,
        isStandardBrowserEnv: isStandardBrowserEnv,
        forEach: forEach,
        merge: merge,
        extend: extend,
        trim: trim
      };

      /***/
    },
    /* 1 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";
      /* WEBPACK VAR INJECTION */
      (function (process) {

        var utils = __webpack_require__(0);
        var normalizeHeaderName = __webpack_require__(16);

        var DEFAULT_CONTENT_TYPE = {
          'Content-Type': 'application/x-www-form-urlencoded'
        };

        function setContentTypeIfUnset(headers, value) {
          if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
            headers['Content-Type'] = value;
          }
        }

        function getDefaultAdapter() {
          var adapter;
          if (typeof XMLHttpRequest !== 'undefined') {
            // For browsers use XHR adapter
            adapter = __webpack_require__(4);
          } else if (typeof process !== 'undefined') {
            // For node use HTTP adapter
            adapter = __webpack_require__(4);
          }
          return adapter;
        }

        var defaults = {
          adapter: getDefaultAdapter(),

          transformRequest: [function transformRequest(data, headers) {
            normalizeHeaderName(headers, 'Content-Type');
            if (utils.isFormData(data) || utils.isArrayBuffer(data) || utils.isBuffer(data) || utils.isStream(data) || utils.isFile(data) || utils.isBlob(data)) {
              return data;
            }
            if (utils.isArrayBufferView(data)) {
              return data.buffer;
            }
            if (utils.isURLSearchParams(data)) {
              setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
              return data.toString();
            }
            if (utils.isObject(data)) {
              setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
              return JSON.stringify(data);
            }
            return data;
          }],

          transformResponse: [function transformResponse(data) {
            /*eslint no-param-reassign:0*/
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch (e) {/* Ignore */}
            }
            return data;
          }],

          /**
           * A timeout in milliseconds to abort a request. If set to 0 (default) a
           * timeout is not created.
           */
          timeout: 0,

          xsrfCookieName: 'XSRF-TOKEN',
          xsrfHeaderName: 'X-XSRF-TOKEN',

          maxContentLength: -1,

          validateStatus: function validateStatus(status) {
            return status >= 200 && status < 300;
          }
        };

        defaults.headers = {
          common: {
            'Accept': 'application/json, text/plain, */*'
          }
        };

        utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
          defaults.headers[method] = {};
        });

        utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
          defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
        });

        module.exports = defaults;

        /* WEBPACK VAR INJECTION */
      }).call(this, __webpack_require__(15));

      /***/
    },
    /* 2 */
    /***/function (module, exports, __webpack_require__) {

      module.exports = __webpack_require__(12);

      /***/
    },
    /* 3 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      module.exports = function bind(fn, thisArg) {
        return function wrap() {
          var args = new Array(arguments.length);
          for (var i = 0; i < args.length; i++) {
            args[i] = arguments[i];
          }
          return fn.apply(thisArg, args);
        };
      };

      /***/
    },
    /* 4 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);
      var settle = __webpack_require__(17);
      var buildURL = __webpack_require__(19);
      var parseHeaders = __webpack_require__(20);
      var isURLSameOrigin = __webpack_require__(21);
      var createError = __webpack_require__(5);
      var btoa = typeof window !== 'undefined' && window.btoa && window.btoa.bind(window) || __webpack_require__(22);

      module.exports = function xhrAdapter(config) {
        return new Promise(function dispatchXhrRequest(resolve, reject) {
          var requestData = config.data;
          var requestHeaders = config.headers;

          if (utils.isFormData(requestData)) {
            delete requestHeaders['Content-Type']; // Let the browser set it
          }

          var request = new XMLHttpRequest();
          var loadEvent = 'onreadystatechange';
          var xDomain = false;

          // For IE 8/9 CORS support
          // Only supports POST and GET calls and doesn't returns the response headers.
          // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
          if ( true && typeof window !== 'undefined' && window.XDomainRequest && !('withCredentials' in request) && !isURLSameOrigin(config.url)) {
            request = new window.XDomainRequest();
            loadEvent = 'onload';
            xDomain = true;
            request.onprogress = function handleProgress() {};
            request.ontimeout = function handleTimeout() {};
          }

          // HTTP basic authentication
          if (config.auth) {
            var username = config.auth.username || '';
            var password = config.auth.password || '';
            requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
          }

          request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

          // Set the request timeout in MS
          request.timeout = config.timeout;

          // Listen for ready state
          request[loadEvent] = function handleLoad() {
            if (!request || request.readyState !== 4 && !xDomain) {
              return;
            }

            // The request errored out and we didn't get a response, this will be
            // handled by onerror instead
            // With one exception: request that using file: protocol, most browsers
            // will return status as 0 even though it's a successful request
            if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
              return;
            }

            // Prepare the response
            var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
            var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
            var response = {
              data: responseData,
              // IE sends 1223 instead of 204 (https://github.com/axios/axios/issues/201)
              status: request.status === 1223 ? 204 : request.status,
              statusText: request.status === 1223 ? 'No Content' : request.statusText,
              headers: responseHeaders,
              config: config,
              request: request
            };

            settle(resolve, reject, response);

            // Clean up request
            request = null;
          };

          // Handle low level network errors
          request.onerror = function handleError() {
            // Real errors are hidden from us by the browser
            // onerror should only fire if it's a network error
            reject(createError('Network Error', config, null, request));

            // Clean up request
            request = null;
          };

          // Handle timeout
          request.ontimeout = function handleTimeout() {
            reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED', request));

            // Clean up request
            request = null;
          };

          // Add xsrf header
          // This is only done if running in a standard browser environment.
          // Specifically not if we're in a web worker, or react-native.
          if (utils.isStandardBrowserEnv()) {
            var cookies = __webpack_require__(23);

            // Add xsrf header
            var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ? cookies.read(config.xsrfCookieName) : undefined;

            if (xsrfValue) {
              requestHeaders[config.xsrfHeaderName] = xsrfValue;
            }
          }

          // Add headers to the request
          if ('setRequestHeader' in request) {
            utils.forEach(requestHeaders, function setRequestHeader(val, key) {
              if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
                // Remove Content-Type if data is undefined
                delete requestHeaders[key];
              } else {
                // Otherwise add header to the request
                request.setRequestHeader(key, val);
              }
            });
          }

          // Add withCredentials to request if needed
          if (config.withCredentials) {
            request.withCredentials = true;
          }

          // Add responseType to request if needed
          if (config.responseType) {
            try {
              request.responseType = config.responseType;
            } catch (e) {
              // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
              // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
              if (config.responseType !== 'json') {
                throw e;
              }
            }
          }

          // Handle progress if needed
          if (typeof config.onDownloadProgress === 'function') {
            request.addEventListener('progress', config.onDownloadProgress);
          }

          // Not all browsers support upload events
          if (typeof config.onUploadProgress === 'function' && request.upload) {
            request.upload.addEventListener('progress', config.onUploadProgress);
          }

          if (config.cancelToken) {
            // Handle cancellation
            config.cancelToken.promise.then(function onCanceled(cancel) {
              if (!request) {
                return;
              }

              request.abort();
              reject(cancel);
              // Clean up request
              request = null;
            });
          }

          if (requestData === undefined) {
            requestData = null;
          }

          // Send the request
          request.send(requestData);
        });
      };

      /***/
    },
    /* 5 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var enhanceError = __webpack_require__(18);

      /**
       * Create an Error with the specified message, config, error code, request and response.
       *
       * @param {string} message The error message.
       * @param {Object} config The config.
       * @param {string} [code] The error code (for example, 'ECONNABORTED').
       * @param {Object} [request] The request.
       * @param {Object} [response] The response.
       * @returns {Error} The created error.
       */
      module.exports = function createError(message, config, code, request, response) {
        var error = new Error(message);
        return enhanceError(error, config, code, request, response);
      };

      /***/
    },
    /* 6 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      module.exports = function isCancel(value) {
        return !!(value && value.__CANCEL__);
      };

      /***/
    },
    /* 7 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      /**
       * A `Cancel` is an object that is thrown when an operation is canceled.
       *
       * @class
       * @param {string=} message The message.
       */

      function Cancel(message) {
        this.message = message;
      }

      Cancel.prototype.toString = function toString() {
        return 'Cancel' + (this.message ? ': ' + this.message : '');
      };

      Cancel.prototype.__CANCEL__ = true;

      module.exports = Cancel;

      /***/
    },
    /* 8 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _LoopbackConnector = __webpack_require__(9);

      var _LoopbackConnector2 = _interopRequireDefault(_LoopbackConnector);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      exports.default = _LoopbackConnector2.default;

      /***/
    },
    /* 9 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _extends = Object.assign || function (target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }return target;
      };

      var _slicedToArray = function () {
        function sliceIterator(arr, i) {
          var _arr = [];var _n = true;var _d = false;var _e = undefined;try {
            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
              _arr.push(_s.value);if (i && _arr.length === i) break;
            }
          } catch (err) {
            _d = true;_e = err;
          } finally {
            try {
              if (!_n && _i["return"]) _i["return"]();
            } finally {
              if (_d) throw _e;
            }
          }return _arr;
        }return function (arr, i) {
          if (Array.isArray(arr)) {
            return arr;
          } else if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
          } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
          }
        };
      }();

      var _awaitToJs = __webpack_require__(10);

      var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

      var _Utilities = __webpack_require__(11);

      var _Utilities2 = _interopRequireDefault(_Utilities);

      var _axios = __webpack_require__(2);

      var _axios2 = _interopRequireDefault(_axios);

      var _goatFluent = __webpack_require__(31);

      var _Connection = __webpack_require__(33);

      var _Connection2 = _interopRequireDefault(_Connection);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      function _defineProperty(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });
        } else {
          obj[key] = value;
        }return obj;
      }

      function _toConsumableArray(arr) {
        if (Array.isArray(arr)) {
          for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
          }return arr2;
        } else {
          return Array.from(arr);
        }
      }

      function _asyncToGenerator(fn) {
        return function () {
          var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
            function step(key, arg) {
              try {
                var info = gen[key](arg);var value = info.value;
              } catch (error) {
                reject(error);return;
              }if (info.done) {
                resolve(value);
              } else {
                return Promise.resolve(value).then(function (value) {
                  step("next", value);
                }, function (err) {
                  step("throw", err);
                });
              }
            }return step("next");
          });
        };
      }

      exports.default = _goatFluent.Interface.compose({
        methods: {
          baseUrl: function baseUrl() {
            var _connector = this.connector,
                baseUrl = _connector.baseUrl,
                name = _connector.name;

            if (!baseUrl) {
              throw new Error("You did not provide a baseUrl for the \"" + name + "\" connector");
            }
            return baseUrl.replace(/\/+$/, "");
          },
          get: function get() {
            var _this = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
              var error, result, _ref, _ref2;

              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      if (_this.ownerId) {
                        _this.andWhere("owner", "=", _this.ownerId);
                      }
                      error = void 0;
                      result = void 0;
                      _context.next = 5;
                      return (0, _awaitToJs2.default)(_this.httpGET());

                    case 5:
                      _ref = _context.sent;
                      _ref2 = _slicedToArray(_ref, 2);
                      error = _ref2[0];
                      result = _ref2[1];

                      if (!error) {
                        _context.next = 12;
                        break;
                      }

                      console.log(error);
                      throw new Error("Error while getting submissions");

                    case 12:
                      if (!(result && result.data && result.data.hasOwnProperty("meta") && _this.selectArray.length > 0)) {
                        _context.next = 15;
                        break;
                      }

                      result.data.data = _this.jsApplySelect(result.data.data);
                      return _context.abrupt("return", [result.data]);

                    case 15:
                      return _context.abrupt("return", _this.jsApplySelect(result && result.data));

                    case 16:
                    case "end":
                      return _context.stop();
                  }
                }
              }, _callee, _this);
            }))();
          },
          all: function all() {
            var _this2 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
              return regeneratorRuntime.wrap(function _callee2$(_context2) {
                while (1) {
                  switch (_context2.prev = _context2.next) {
                    case 0:
                      return _context2.abrupt("return", _this2.get());

                    case 1:
                    case "end":
                      return _context2.stop();
                  }
                }
              }, _callee2, _this2);
            }))();
          },
          paginate: function paginate(paginator) {
            var _this3 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
              var results, response;
              return regeneratorRuntime.wrap(function _callee3$(_context3) {
                while (1) {
                  switch (_context3.prev = _context3.next) {
                    case 0:
                      if (paginator) {
                        _context3.next = 2;
                        break;
                      }

                      throw new Error("Paginator cannot be empty");

                    case 2:
                      _this3.paginator = paginator;
                      results = {};
                      _context3.next = 6;
                      return _this3.get();

                    case 6:
                      response = _context3.sent;

                      if (response[0]) {
                        _context3.next = 9;
                        break;
                      }

                      throw new Error("The query was not paginated");

                    case 9:
                      results.data = response[0].data;
                      results.paginator = {
                        page: response[0].meta.currentPage,
                        rowsPerPage: response[0].meta.itemsPerPage,
                        rowsNumber: response[0].meta.totalItemCount
                      };

                      return _context3.abrupt("return", results);

                    case 12:
                    case "end":
                      return _context3.stop();
                  }
                }
              }, _callee3, _this3);
            }))();
          },
          raw: function raw(query) {
            if (!query) throw new Error("No query was received");
            this.rawQuery = query;
            return this;
          },
          insert: function insert(data) {
            var _this4 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
              var baseUrl, remotePath, form, headers, postData, _ref3, _ref4, error, result;

              return regeneratorRuntime.wrap(function _callee4$(_context4) {
                while (1) {
                  switch (_context4.prev = _context4.next) {
                    case 0:
                      if (Array.isArray(data)) {
                        _context4.next = 3;
                        break;
                      }

                      _context4.next = 3;
                      return _this4.validate(data);

                    case 3:
                      baseUrl = _this4 && _this4.baseUrl() ? _this4.baseUrl() : undefined;
                      remotePath = _Utilities2.default.get(function () {
                        return _this4.remoteConnection.path;
                      }, undefined);
                      _context4.next = 7;
                      return _this4.getForm(baseUrl, remotePath);

                    case 7:
                      form = _context4.sent;
                      headers = _this4.getHeaders();
                      postData = _extends({ data: data, form: form._id }, headers);
                      _context4.next = 12;
                      return (0, _awaitToJs2.default)(_this4.httpPOST(postData));

                    case 12:
                      _ref3 = _context4.sent;
                      _ref4 = _slicedToArray(_ref3, 2);
                      error = _ref4[0];
                      result = _ref4[1];

                      if (!error) {
                        _context4.next = 18;
                        break;
                      }

                      throw new Error("Cannot insert data");

                    case 18:
                      return _context4.abrupt("return", result.data);

                    case 19:
                    case "end":
                      return _context4.stop();
                  }
                }
              }, _callee4, _this4);
            }))();
          },
          tableView: function tableView(paginator) {
            var _this5 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
              var baseUrl, remotePath, form, components, finalComponents;
              return regeneratorRuntime.wrap(function _callee5$(_context5) {
                while (1) {
                  switch (_context5.prev = _context5.next) {
                    case 0:
                      baseUrl = _this5 && _this5.baseUrl() ? _this5.baseUrl() : undefined;
                      remotePath = _Utilities2.default.get(function () {
                        return _this5.remoteConnection.path;
                      }, undefined);
                      _context5.next = 4;
                      return _this5.getForm(baseUrl, remotePath);

                    case 4:
                      form = _context5.sent;

                      if (form) {
                        _context5.next = 7;
                        break;
                      }

                      throw new Error("Could not find form");

                    case 7:
                      components = form.components;
                      finalComponents = _this5.getTableViewComponents(components);

                      finalComponents = [].concat(_toConsumableArray(finalComponents), ["id as _id", "modified as HumanUpdated"]);
                      _this5.select(finalComponents);

                      return _context5.abrupt("return", _this5.paginate(paginator));

                    case 12:
                    case "end":
                      return _context5.stop();
                  }
                }
              }, _callee5, _this5);
            }))();
          },
          getTableViewComponents: function getTableViewComponents(components) {
            return _Utilities2.default.findComponents(components, {
              input: true,
              tableView: true
            }).filter(function (c) {
              return !!(c.label !== "");
            }).map(function (c) {
              return "data." + c.key + " as " + c.key;
            });
          },

          /* async update(data) {
            if (!data._id) {
              throw new Error(
                "Formio connector error. Cannot update a Model without _id key"
              );
            }
            if (data._id.includes("_local")) {
              throw new Error(
                "Formio connector error. Cannot update a local document"
              );
            }
             let [error, result] = await to(this.httpPUT(data));
             if (error) {
              console.log(error);
              throw new Error("Cannot insert data");
            }
            return result.data;
          }, */
          /* async clear({ sure } = {}) {
            if (!sure || sure !== true) {
              throw new Error(
                'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
              );
            }
            let promises = [];
             let [error, data] = await to(this.select("_id").pluck("_id"));
             if (error) {
              console.log(error);
              throw new Error("Cannot get remote Model");
            }
             data.forEach(_id => {
              promises.push(this.httpDelete(_id));
            });
             return axios.all(promises);
          }, */
          /* async remove(_id) {
            let [error, removed] = await to(this.httpDelete(_id));
             if (error) {
              console.log(error);
              throw new Error(`FormioConnector: Could not delete ${_id}`);
            }
             return removed;
          }, */
          /* async find(_id) {
            if (typeof _id !== "string") {
              throw new Error(
                'Formio connector find() method only accepts strings "' +
                  typeof _id +
                  '" given "' +
                  _id +
                  '"'
              );
            }
            let [error, data] = await to(this.where("_id", "=", _id).first());
             if (error) {
              console.log(error);
              throw new Error("Find() could not get remote data");
            }
             return data;
          }, */
          getForm: function getForm(baseUrl, path) {
            var _this6 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
              var Forms, form;
              return regeneratorRuntime.wrap(function _callee6$(_context6) {
                while (1) {
                  switch (_context6.prev = _context6.next) {
                    case 0:
                      Forms = _goatFluent.Fluent.model({
                        properties: {
                          name: "Form",
                          config: {
                            remote: {
                              path: "forms"
                            }
                          }
                        }
                      })();
                      _context6.next = 3;
                      return Forms.remote({ token: _this6.remoteConnection.token }).where("path", "=", path).first();

                    case 3:
                      form = _context6.sent;
                      return _context6.abrupt("return", form);

                    case 5:
                    case "end":
                      return _context6.stop();
                  }
                }
              }, _callee6, _this6);
            }))();
          },
          getUrl: function getUrl() {
            var baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;

            return baseUrl;
          },
          getHeaders: function getHeaders() {
            var headers = {};
            var token = {};
            if (typeof localStorage !== "undefined") {
              token = localStorage.getItem("formioToken");
            }

            if (this.remoteConnection.token || this.remoteConnection.token === "") {
              token = this.remoteConnection.token;
            }

            if (!token) {
              return headers;
            }

            var type = this.getTokenType(token);
            headers[type] = token;
            headers['Authorization'] = "Bearer " + token;
            return headers;
          },
          getPage: function getPage() {
            var page = "page=";
            if (this.paginator && this.paginator.page) {
              return page + this.paginator.page + "&";
            }

            return "";
          },
          getPaginatorLimit: function getPaginatorLimit(filter) {
            if (this.paginator && this.paginator.rowsPerPage) {
              return _extends({}, filter, { limit: this.paginator.rowsPerPage });
            }

            return filter;
          },
          httpGET: function httpGET() {
            var _this7 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
              var filter, url, headers, page, remotePath, isOnline;
              return regeneratorRuntime.wrap(function _callee7$(_context7) {
                while (1) {
                  switch (_context7.prev = _context7.next) {
                    case 0:
                      filter = {};
                      url = _this7.getUrl();
                      headers = _this7.getHeaders();
                      _context7.next = 5;
                      return _this7.getFilters(filter);

                    case 5:
                      filter = _context7.sent;

                      filter = _this7.getLimit(filter);
                      filter = _this7.getSkip(filter);
                      filter = _this7.getSelect(filter);
                      filter = _this7.getOrderBy(filter);
                      filter = _this7.getPaginatorLimit(filter);
                      page = _this7.getPage();

                      if (_this7.rawQuery) {
                        filter.limit = filter.limit || _this7.rawQuery.limit;
                        filter.skip = filter.skip || _this7.rawQuery.skip;
                        filter.order = filter.order || _this7.rawQuery.order;
                        filter.fields = _extends({}, filter.fields, _this7.rawQuery.fields);
                        filter.where = _extends({}, filter.where.and[0], _this7.rawQuery.where);
                      }

                      filter.where = _extends({}, filter.where, { deleted: null });

                      remotePath = _Utilities2.default.get(function () {
                        return _this7.remoteConnection.path;
                      }, undefined);

                      // Always limit the amount of request

                      url = url + "/" + remotePath + "?" + page + "filter=" + encodeURI(JSON.stringify(filter));

                      _context7.t0 = true;

                      if (_context7.t0) {
                        _context7.next = 21;
                        break;
                      }

                      _context7.next = 20;
                      return _Connection2.default.isOnline();

                    case 20:
                      _context7.t0 = _context7.sent;

                    case 21:
                      isOnline = _context7.t0;

                      if (isOnline) {
                        _context7.next = 24;
                        break;
                      }

                      throw new Error("Cannot make get request to " + url + ".You are not online");

                    case 24:
                      return _context7.abrupt("return", _axios2.default.get(url, { headers: headers }));

                    case 25:
                    case "end":
                      return _context7.stop();
                  }
                }
              }, _callee7, _this7);
            }))();
          },
          httpPOST: function httpPOST(data) {
            var _this8 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
              var url, headers, isOnline;
              return regeneratorRuntime.wrap(function _callee8$(_context8) {
                while (1) {
                  switch (_context8.prev = _context8.next) {
                    case 0:
                      url = _this8.getUrl();
                      headers = _this8.getHeaders();
                      _context8.t0 = true;

                      if (_context8.t0) {
                        _context8.next = 7;
                        break;
                      }

                      _context8.next = 6;
                      return _Connection2.default.isOnline();

                    case 6:
                      _context8.t0 = _context8.sent;

                    case 7:
                      isOnline = _context8.t0;

                      if (isOnline) {
                        _context8.next = 10;
                        break;
                      }

                      throw new Error("Cannot make request post to " + url + ".You are not online");

                    case 10:
                      return _context8.abrupt("return", _axios2.default.post(url, data, { headers: headers }));

                    case 11:
                    case "end":
                      return _context8.stop();
                  }
                }
              }, _callee8, _this8);
            }))();
          },

          /* async httpPUT(data) {
            const isOnline = true || await Connection.isOnline();
            let url = `${this.getUrl()}/${data._id}`;
            let headers = this.getHeaders();
             if (!isOnline) {
              throw new Error(
                `Cannot make request post to ${url}.You are not online`
              );
            }
            return axios.put(url, data, { headers });
          }, */
          /* httpDelete(_id) {
            let headers = this.getHeaders();
            let url = `${this.getUrl()}/${_id}`;
             return axios.delete(url, { headers });
          }, */
          getTokenType: function getTokenType(token) {
            if (token.length > 32) {
              return "x-jwt-token";
            }
            return "x-token";
          },
          getFilters: function getFilters(filters) {
            var _this9 = this;

            return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
              var filter;
              return regeneratorRuntime.wrap(function _callee9$(_context9) {
                while (1) {
                  switch (_context9.prev = _context9.next) {
                    case 0:
                      filter = _this9.whereArray;

                      if (!(!filter || filter.length === 0)) {
                        _context9.next = 3;
                        break;
                      }

                      return _context9.abrupt("return", filters);

                    case 3:

                      filters["where"] = { and: [] };

                      filter.forEach(function (condition) {
                        var element = condition[0];
                        var operator = condition[1];
                        var value = condition[2];

                        switch (operator) {
                          case "=":
                            filters.where.and.push(_defineProperty({}, element, value));
                            break;
                          case "!=":
                            filters.where.and.push(_defineProperty({}, element, { neq: value }));
                            break;
                          case ">":
                            filters.where.and.push(_defineProperty({}, element, { gt: value }));
                            break;
                          case ">=":
                            filters.where.and.push(_defineProperty({}, element, { gte: value }));
                            break;
                          case "<":
                            filters.where.and.push(_defineProperty({}, element, { lt: value }));
                            break;
                          case "<=":
                            filters.where.and.push(_defineProperty({}, element, { lte: value }));
                            break;
                          case "in":
                            filters.where.and.push(_defineProperty({}, element, { inq: value }));
                            break;
                          case "nin":
                            filters.where.and.push(_defineProperty({}, element, { nin: value }));
                            break;
                          case "exists":
                            filters.where.and.push(_defineProperty({}, element, { exists: true }));
                            break;
                          case "!exists":
                            filters.where.and.push(_defineProperty({}, element, { exists: false }));
                            break;
                          case "regex":
                            filters.where.and.push(_defineProperty({}, "data." + element, { regexp: value }));
                            break;
                        }
                      });

                      return _context9.abrupt("return", filters);

                    case 6:
                    case "end":
                      return _context9.stop();
                  }
                }
              }, _callee9, _this9);
            }))();
          },
          getOrderBy: function getOrderBy(filter) {
            if (!this.orderByArray || this.orderByArray.length === 0) {
              return filter;
            }

            return _extends({}, filter, {
              order: this.orderByArray[0] + " " + this.orderByArray[1].toUpperCase()
            });
          },
          getLimit: function getLimit(filter) {
            if (!this.limitNumber || this.limitNumber === 0) {
              this.limitNumber = this.rawQuery && this.rawQuery.limit || 50;
            }

            return _extends({}, filter, { limit: this.limitNumber });
          },
          getSkip: function getSkip(filter) {
            if (!this.offsetNumber) {
              this.offsetNumber = this.rawQuery && this.rawQuery.skip || 0;
            }

            return _extends({}, filter, { skip: this.offsetNumber });
          },
          getSelect: function getSelect(filter) {
            var select = this.selectArray;

            select = select.map(function (s) {
              s = s.split(" as ")[0];
              s = s.includes("_id") ? "id" : s;
              return s;
            });

            if (select.find(function (e) {
              return e.startsWith("data.");
            })) {
              select.unshift("data");
            }

            if (!select) {
              return filter;
            }

            var fields = {};

            select.forEach(function (e) {
              fields[e] = true;
            });

            return _extends({}, filter, { fields: fields });
          }
        }
      });

      /***/
    },
    /* 10 */
    /***/function (module, __webpack_exports__, __webpack_require__) {

      "use strict";

      __webpack_require__.r(__webpack_exports__);
      /* harmony export (binding) */__webpack_require__.d(__webpack_exports__, "to", function () {
        return to;
      });
      /**
       * @param { Promise } promise
       * @param { Object= } errorExt - Additional Information you can pass to the err object
       * @return { Promise }
       */
      function to(promise, errorExt) {
        return promise.then(function (data) {
          return [null, data];
        }).catch(function (err) {
          if (errorExt) {
            Object.assign(err, errorExt);
          }
          return [err, undefined];
        });
      }

      /* harmony default export */__webpack_exports__["default"] = to;
      //# sourceMappingURL=await-to-js.es5.js.map


      /***/
    },
    /* 11 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _extends = Object.assign || function (target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }return target;
      };

      var _typeof = typeof Symbol === "function" && _typeof3(Symbol.iterator) === "symbol" ? function (obj) {
        return typeof obj === 'undefined' ? 'undefined' : _typeof3(obj);
      } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === 'undefined' ? 'undefined' : _typeof3(obj);
      };

      function _toConsumableArray(arr) {
        if (Array.isArray(arr)) {
          for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i];
          }return arr2;
        } else {
          return Array.from(arr);
        }
      }

      /* eslint-disable no-unused-vars */
      var Utilities = function () {
        /**
         * Deep clones a JS object using JSON.parse
         * This function will not clone object
         * functions
         * @param {Object} object
         */
        var cloneDeep = function cloneDeep(object) {
          return JSON.parse(JSON.stringify(object));
        };
        /**
         * Given an Object and its path, if exisits it will
         * return the value of it, if not the default
         * @param {Object} obj
         * @param {String} path
         * @param {*} def
         */
        var get = function get(fn, def) {
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
        var getFromPath = function getFromPath(obj, path, def) {
          var _path = path;

          if (path.includes(' as ')) {
            path = path.split(' as ');
            _path = path[0];
          }

          var assignedName = get(function () {
            return Array.isArray(path) && path[1].trim();
          }, undefined);

          var fullPath = _path.replace(/\[/g, '.').replace(/]/g, '').split('.').filter(Boolean).map(function (e) {
            return e.trim();
          });

          function everyFunc(step) {
            return !(step && (obj = obj[step]) === undefined);
          }

          var result = fullPath.every(everyFunc) ? obj : def;

          return { label: assignedName || _path, value: result };
        };
        /**
         *
         * @param {*} arr
         * @param {*} predicate
         */
        var uniqBy = function uniqBy(arr, predicate) {
          var cb = typeof predicate === 'function' ? predicate : function (o) {
            return o[predicate];
          };

          return [].concat(_toConsumableArray(arr.reduce(function (map, item) {
            var key = cb(item);

            map.has(key) || map.set(key, item);

            return map;
          }, new Map()).values()));
        };
        /**
         *
         */
        var orderBy = function orderBy() {};
        /**
         *
         * @param {*} value
         */
        var isEmpty = function isEmpty(value) {
          if (!value) {
            return true;
          }
          if (Array.isArray(value) || typeof value === 'string') {
            return !value.length;
          }
          for (var key in value) {
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
        var debounce = function debounce(fn, time) {
          var timeout = void 0;

          return function () {
            var _this = this,
                _arguments = arguments;

            var functionCall = function functionCall() {
              return fn.apply(_this, _arguments);
            };

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
        var deleteNulls = function deleteNulls(object) {
          var obj = object;
          var isArray = obj instanceof Array;

          for (var k in obj) {
            if (obj[k] === null) isArray ? obj.splice(k, 1) : delete obj[k];else if (_typeof(obj[k]) === 'object') deleteNulls(obj[k]);
          }
          return obj;
        };

        var eachComponent = function eachComponent(components, fn, includeAll, path, parent) {
          if (!components) return;
          path = path || '';
          components.forEach(function (component) {
            if (!component) {
              return;
            }
            var hasColumns = component.columns && Array.isArray(component.columns);
            var hasRows = component.rows && Array.isArray(component.rows);
            var hasComps = component.components && Array.isArray(component.components);
            var noRecurse = false;
            var newPath = component.key ? path ? path + '.' + component.key : component.key : '';

            // Keep track of parent references.
            if (parent) {
              // Ensure we don't create infinite JSON structures.
              component.parent = _extends({}, parent);
              delete component.parent.components;
              delete component.parent.componentMap;
              delete component.parent.columns;
              delete component.parent.rows;
            }

            if (includeAll || component.tree || !hasColumns && !hasRows && !hasComps) {
              noRecurse = fn(component, newPath);
            }

            var subPath = function subPath() {
              if (component.key && !['panel', 'table', 'well', 'columns', 'fieldset', 'tabs', 'form'].includes(component.type) && (['datagrid', 'container', 'editgrid'].includes(component.type) || component.tree)) {
                return newPath;
              } else if (component.key && component.type === 'form') {
                return newPath + '.data';
              }
              return path;
            };

            if (!noRecurse) {
              if (hasColumns) {
                component.columns.forEach(function (column) {
                  return eachComponent(column.components, fn, includeAll, subPath(), parent ? component : null);
                });
              } else if (hasRows) {
                component.rows.forEach(function (row) {
                  if (Array.isArray(row)) {
                    row.forEach(function (column) {
                      return eachComponent(column.components, fn, includeAll, subPath(), parent ? component : null);
                    });
                  }
                });
              } else if (hasComps) {
                eachComponent(component.components, fn, includeAll, subPath(), parent ? component : null);
              }
            }
          });
        };

        var matchComponent = function matchComponent(component, query) {
          if (typeof query === 'string') {
            return component.key === query;
          }
          var matches = false;

          Object.keys(query).forEach(function (path) {
            matches = getFromPath(component, path).value === query[path];
            if (!matches) {
              return false;
            }
          });
          return matches;
        };

        var findComponents = function findComponents(components, query) {
          var results = [];

          eachComponent(components, function (component, path) {
            if (matchComponent(component, query)) {
              component.path = path;
              results.push(component);
            }
          }, true);
          return results;
        };

        var unixDate = function unixDate() {
          return Math.round(+new Date() / 1000);
        };

        return Object.freeze({
          cloneDeep: cloneDeep,
          get: get,
          orderBy: orderBy,
          isEmpty: isEmpty,
          debounce: debounce,
          getFromPath: getFromPath,
          deleteNulls: deleteNulls,
          eachComponent: eachComponent,
          findComponents: findComponents,
          unixDate: unixDate
        });
      }();

      exports.default = Utilities;

      /***/
    },
    /* 12 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);
      var bind = __webpack_require__(3);
      var Axios = __webpack_require__(14);
      var defaults = __webpack_require__(1);

      /**
       * Create an instance of Axios
       *
       * @param {Object} defaultConfig The default config for the instance
       * @return {Axios} A new instance of Axios
       */
      function createInstance(defaultConfig) {
        var context = new Axios(defaultConfig);
        var instance = bind(Axios.prototype.request, context);

        // Copy axios.prototype to instance
        utils.extend(instance, Axios.prototype, context);

        // Copy context to instance
        utils.extend(instance, context);

        return instance;
      }

      // Create the default instance to be exported
      var axios = createInstance(defaults);

      // Expose Axios class to allow class inheritance
      axios.Axios = Axios;

      // Factory for creating new instances
      axios.create = function create(instanceConfig) {
        return createInstance(utils.merge(defaults, instanceConfig));
      };

      // Expose Cancel & CancelToken
      axios.Cancel = __webpack_require__(7);
      axios.CancelToken = __webpack_require__(29);
      axios.isCancel = __webpack_require__(6);

      // Expose all/spread
      axios.all = function all(promises) {
        return Promise.all(promises);
      };
      axios.spread = __webpack_require__(30);

      module.exports = axios;

      // Allow use of default import syntax in TypeScript
      module.exports.default = axios;

      /***/
    },
    /* 13 */
    /***/function (module, exports) {

      /*!
       * Determine if an object is a Buffer
       *
       * @author   Feross Aboukhadijeh <https://feross.org>
       * @license  MIT
       */

      // The _isBuffer check is for Safari 5-7 support, because it's missing
      // Object.prototype.constructor. Remove this eventually
      module.exports = function (obj) {
        return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer);
      };

      function isBuffer(obj) {
        return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj);
      }

      // For Node v0.10 support. Remove this eventually.
      function isSlowBuffer(obj) {
        return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0));
      }

      /***/
    },
    /* 14 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var defaults = __webpack_require__(1);
      var utils = __webpack_require__(0);
      var InterceptorManager = __webpack_require__(24);
      var dispatchRequest = __webpack_require__(25);

      /**
       * Create a new instance of Axios
       *
       * @param {Object} instanceConfig The default config for the instance
       */
      function Axios(instanceConfig) {
        this.defaults = instanceConfig;
        this.interceptors = {
          request: new InterceptorManager(),
          response: new InterceptorManager()
        };
      }

      /**
       * Dispatch a request
       *
       * @param {Object} config The config specific for this request (merged with this.defaults)
       */
      Axios.prototype.request = function request(config) {
        /*eslint no-param-reassign:0*/
        // Allow for axios('example/url'[, config]) a la fetch API
        if (typeof config === 'string') {
          config = utils.merge({
            url: arguments[0]
          }, arguments[1]);
        }

        config = utils.merge(defaults, { method: 'get' }, this.defaults, config);
        config.method = config.method.toLowerCase();

        // Hook up interceptors middleware
        var chain = [dispatchRequest, undefined];
        var promise = Promise.resolve(config);

        this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
          chain.unshift(interceptor.fulfilled, interceptor.rejected);
        });

        this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
          chain.push(interceptor.fulfilled, interceptor.rejected);
        });

        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      };

      // Provide aliases for supported request methods
      utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
        /*eslint func-names:0*/
        Axios.prototype[method] = function (url, config) {
          return this.request(utils.merge(config || {}, {
            method: method,
            url: url
          }));
        };
      });

      utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
        /*eslint func-names:0*/
        Axios.prototype[method] = function (url, data, config) {
          return this.request(utils.merge(config || {}, {
            method: method,
            url: url,
            data: data
          }));
        };
      });

      module.exports = Axios;

      /***/
    },
    /* 15 */
    /***/function (module, exports) {

      // shim for using process in browser
      var process = module.exports = {};

      // cached from whatever global is present so that test runners that stub it
      // don't break things.  But we need to wrap it in a try catch in case it is
      // wrapped in strict mode code which doesn't define any globals.  It's inside a
      // function because try/catches deoptimize in certain engines.

      var cachedSetTimeout;
      var cachedClearTimeout;

      function defaultSetTimout() {
        throw new Error('setTimeout has not been defined');
      }
      function defaultClearTimeout() {
        throw new Error('clearTimeout has not been defined');
      }
      (function () {
        try {
          if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
          } else {
            cachedSetTimeout = defaultSetTimout;
          }
        } catch (e) {
          cachedSetTimeout = defaultSetTimout;
        }
        try {
          if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
          } else {
            cachedClearTimeout = defaultClearTimeout;
          }
        } catch (e) {
          cachedClearTimeout = defaultClearTimeout;
        }
      })();
      function runTimeout(fun) {
        if (cachedSetTimeout === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
        }
        // if setTimeout wasn't available but was latter defined
        if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
        }
        try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout(fun, 0);
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
          } catch (e) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
          }
        }
      }
      function runClearTimeout(marker) {
        if (cachedClearTimeout === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
        }
        // if clearTimeout wasn't available but was latter defined
        if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
        }
        try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout(marker);
        } catch (e) {
          try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
          } catch (e) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
          }
        }
      }
      var queue = [];
      var draining = false;
      var currentQueue;
      var queueIndex = -1;

      function cleanUpNextTick() {
        if (!draining || !currentQueue) {
          return;
        }
        draining = false;
        if (currentQueue.length) {
          queue = currentQueue.concat(queue);
        } else {
          queueIndex = -1;
        }
        if (queue.length) {
          drainQueue();
        }
      }

      function drainQueue() {
        if (draining) {
          return;
        }
        var timeout = runTimeout(cleanUpNextTick);
        draining = true;

        var len = queue.length;
        while (len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
            if (currentQueue) {
              currentQueue[queueIndex].run();
            }
          }
          queueIndex = -1;
          len = queue.length;
        }
        currentQueue = null;
        draining = false;
        runClearTimeout(timeout);
      }

      process.nextTick = function (fun) {
        var args = new Array(arguments.length - 1);
        if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
          }
        }
        queue.push(new Item(fun, args));
        if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
        }
      };

      // v8 likes predictible objects
      function Item(fun, array) {
        this.fun = fun;
        this.array = array;
      }
      Item.prototype.run = function () {
        this.fun.apply(null, this.array);
      };
      process.title = 'browser';
      process.browser = true;
      process.env = {};
      process.argv = [];
      process.version = ''; // empty string to avoid regexp issues
      process.versions = {};

      function noop() {}

      process.on = noop;
      process.addListener = noop;
      process.once = noop;
      process.off = noop;
      process.removeListener = noop;
      process.removeAllListeners = noop;
      process.emit = noop;
      process.prependListener = noop;
      process.prependOnceListener = noop;

      process.listeners = function (name) {
        return [];
      };

      process.binding = function (name) {
        throw new Error('process.binding is not supported');
      };

      process.cwd = function () {
        return '/';
      };
      process.chdir = function (dir) {
        throw new Error('process.chdir is not supported');
      };
      process.umask = function () {
        return 0;
      };

      /***/
    },
    /* 16 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      module.exports = function normalizeHeaderName(headers, normalizedName) {
        utils.forEach(headers, function processHeader(value, name) {
          if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
            headers[normalizedName] = value;
            delete headers[name];
          }
        });
      };

      /***/
    },
    /* 17 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var createError = __webpack_require__(5);

      /**
       * Resolve or reject a Promise based on response status.
       *
       * @param {Function} resolve A function that resolves the promise.
       * @param {Function} reject A function that rejects the promise.
       * @param {object} response The response.
       */
      module.exports = function settle(resolve, reject, response) {
        var validateStatus = response.config.validateStatus;
        // Note: status is not exposed by XDomainRequest
        if (!response.status || !validateStatus || validateStatus(response.status)) {
          resolve(response);
        } else {
          reject(createError('Request failed with status code ' + response.status, response.config, null, response.request, response));
        }
      };

      /***/
    },
    /* 18 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      /**
       * Update an Error with the specified config, error code, and response.
       *
       * @param {Error} error The error to update.
       * @param {Object} config The config.
       * @param {string} [code] The error code (for example, 'ECONNABORTED').
       * @param {Object} [request] The request.
       * @param {Object} [response] The response.
       * @returns {Error} The error.
       */

      module.exports = function enhanceError(error, config, code, request, response) {
        error.config = config;
        if (code) {
          error.code = code;
        }
        error.request = request;
        error.response = response;
        return error;
      };

      /***/
    },
    /* 19 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      function encode(val) {
        return encodeURIComponent(val).replace(/%40/gi, '@').replace(/%3A/gi, ':').replace(/%24/g, '$').replace(/%2C/gi, ',').replace(/%20/g, '+').replace(/%5B/gi, '[').replace(/%5D/gi, ']');
      }

      /**
       * Build a URL by appending params to the end
       *
       * @param {string} url The base of the url (e.g., http://www.google.com)
       * @param {object} [params] The params to be appended
       * @returns {string} The formatted url
       */
      module.exports = function buildURL(url, params, paramsSerializer) {
        /*eslint no-param-reassign:0*/
        if (!params) {
          return url;
        }

        var serializedParams;
        if (paramsSerializer) {
          serializedParams = paramsSerializer(params);
        } else if (utils.isURLSearchParams(params)) {
          serializedParams = params.toString();
        } else {
          var parts = [];

          utils.forEach(params, function serialize(val, key) {
            if (val === null || typeof val === 'undefined') {
              return;
            }

            if (utils.isArray(val)) {
              key = key + '[]';
            } else {
              val = [val];
            }

            utils.forEach(val, function parseValue(v) {
              if (utils.isDate(v)) {
                v = v.toISOString();
              } else if (utils.isObject(v)) {
                v = JSON.stringify(v);
              }
              parts.push(encode(key) + '=' + encode(v));
            });
          });

          serializedParams = parts.join('&');
        }

        if (serializedParams) {
          url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
        }

        return url;
      };

      /***/
    },
    /* 20 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      // Headers whose duplicates are ignored by node
      // c.f. https://nodejs.org/api/http.html#http_message_headers
      var ignoreDuplicateOf = ['age', 'authorization', 'content-length', 'content-type', 'etag', 'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since', 'last-modified', 'location', 'max-forwards', 'proxy-authorization', 'referer', 'retry-after', 'user-agent'];

      /**
       * Parse headers into an object
       *
       * ```
       * Date: Wed, 27 Aug 2014 08:58:49 GMT
       * Content-Type: application/json
       * Connection: keep-alive
       * Transfer-Encoding: chunked
       * ```
       *
       * @param {String} headers Headers needing to be parsed
       * @returns {Object} Headers parsed into an object
       */
      module.exports = function parseHeaders(headers) {
        var parsed = {};
        var key;
        var val;
        var i;

        if (!headers) {
          return parsed;
        }

        utils.forEach(headers.split('\n'), function parser(line) {
          i = line.indexOf(':');
          key = utils.trim(line.substr(0, i)).toLowerCase();
          val = utils.trim(line.substr(i + 1));

          if (key) {
            if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
              return;
            }
            if (key === 'set-cookie') {
              parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
            } else {
              parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
            }
          }
        });

        return parsed;
      };

      /***/
    },
    /* 21 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      module.exports = utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
      function standardBrowserEnv() {
        var msie = /(msie|trident)/i.test(navigator.userAgent);
        var urlParsingNode = document.createElement('a');
        var originURL;

        /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
        function resolveURL(url) {
          var href = url;

          if (msie) {
            // IE needs attribute set twice to normalize properties
            urlParsingNode.setAttribute('href', href);
            href = urlParsingNode.href;
          }

          urlParsingNode.setAttribute('href', href);

          // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
          return {
            href: urlParsingNode.href,
            protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
            host: urlParsingNode.host,
            search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
            hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
            hostname: urlParsingNode.hostname,
            port: urlParsingNode.port,
            pathname: urlParsingNode.pathname.charAt(0) === '/' ? urlParsingNode.pathname : '/' + urlParsingNode.pathname
          };
        }

        originURL = resolveURL(window.location.href);

        /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
        return function isURLSameOrigin(requestURL) {
          var parsed = utils.isString(requestURL) ? resolveURL(requestURL) : requestURL;
          return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
        };
      }() :

      // Non standard browser envs (web workers, react-native) lack needed support.
      function nonStandardBrowserEnv() {
        return function isURLSameOrigin() {
          return true;
        };
      }();

      /***/
    },
    /* 22 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      // btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

      function E() {
        this.message = 'String contains an invalid character';
      }
      E.prototype = new Error();
      E.prototype.code = 5;
      E.prototype.name = 'InvalidCharacterError';

      function btoa(input) {
        var str = String(input);
        var output = '';
        for (
        // initialize result and counter
        var block, charCode, idx = 0, map = chars;
        // if the next str index does not exist:
        //   change the mapping table to "="
        //   check if d has no fractional digits
        str.charAt(idx | 0) || (map = '=', idx % 1);
        // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
          charCode = str.charCodeAt(idx += 3 / 4);
          if (charCode > 0xFF) {
            throw new E();
          }
          block = block << 8 | charCode;
        }
        return output;
      }

      module.exports = btoa;

      /***/
    },
    /* 23 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      module.exports = utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
      function standardBrowserEnv() {
        return {
          write: function write(name, value, expires, path, domain, secure) {
            var cookie = [];
            cookie.push(name + '=' + encodeURIComponent(value));

            if (utils.isNumber(expires)) {
              cookie.push('expires=' + new Date(expires).toGMTString());
            }

            if (utils.isString(path)) {
              cookie.push('path=' + path);
            }

            if (utils.isString(domain)) {
              cookie.push('domain=' + domain);
            }

            if (secure === true) {
              cookie.push('secure');
            }

            document.cookie = cookie.join('; ');
          },

          read: function read(name) {
            var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            return match ? decodeURIComponent(match[3]) : null;
          },

          remove: function remove(name) {
            this.write(name, '', Date.now() - 86400000);
          }
        };
      }() :

      // Non standard browser env (web workers, react-native) lack needed support.
      function nonStandardBrowserEnv() {
        return {
          write: function write() {},
          read: function read() {
            return null;
          },
          remove: function remove() {}
        };
      }();

      /***/
    },
    /* 24 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      function InterceptorManager() {
        this.handlers = [];
      }

      /**
       * Add a new interceptor to the stack
       *
       * @param {Function} fulfilled The function to handle `then` for a `Promise`
       * @param {Function} rejected The function to handle `reject` for a `Promise`
       *
       * @return {Number} An ID used to remove interceptor later
       */
      InterceptorManager.prototype.use = function use(fulfilled, rejected) {
        this.handlers.push({
          fulfilled: fulfilled,
          rejected: rejected
        });
        return this.handlers.length - 1;
      };

      /**
       * Remove an interceptor from the stack
       *
       * @param {Number} id The ID that was returned by `use`
       */
      InterceptorManager.prototype.eject = function eject(id) {
        if (this.handlers[id]) {
          this.handlers[id] = null;
        }
      };

      /**
       * Iterate over all the registered interceptors
       *
       * This method is particularly useful for skipping over any
       * interceptors that may have become `null` calling `eject`.
       *
       * @param {Function} fn The function to call for each interceptor
       */
      InterceptorManager.prototype.forEach = function forEach(fn) {
        utils.forEach(this.handlers, function forEachHandler(h) {
          if (h !== null) {
            fn(h);
          }
        });
      };

      module.exports = InterceptorManager;

      /***/
    },
    /* 25 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);
      var transformData = __webpack_require__(26);
      var isCancel = __webpack_require__(6);
      var defaults = __webpack_require__(1);
      var isAbsoluteURL = __webpack_require__(27);
      var combineURLs = __webpack_require__(28);

      /**
       * Throws a `Cancel` if cancellation has been requested.
       */
      function throwIfCancellationRequested(config) {
        if (config.cancelToken) {
          config.cancelToken.throwIfRequested();
        }
      }

      /**
       * Dispatch a request to the server using the configured adapter.
       *
       * @param {object} config The config that is to be used for the request
       * @returns {Promise} The Promise to be fulfilled
       */
      module.exports = function dispatchRequest(config) {
        throwIfCancellationRequested(config);

        // Support baseURL config
        if (config.baseURL && !isAbsoluteURL(config.url)) {
          config.url = combineURLs(config.baseURL, config.url);
        }

        // Ensure headers exist
        config.headers = config.headers || {};

        // Transform request data
        config.data = transformData(config.data, config.headers, config.transformRequest);

        // Flatten headers
        config.headers = utils.merge(config.headers.common || {}, config.headers[config.method] || {}, config.headers || {});

        utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'], function cleanHeaderConfig(method) {
          delete config.headers[method];
        });

        var adapter = config.adapter || defaults.adapter;

        return adapter(config).then(function onAdapterResolution(response) {
          throwIfCancellationRequested(config);

          // Transform response data
          response.data = transformData(response.data, response.headers, config.transformResponse);

          return response;
        }, function onAdapterRejection(reason) {
          if (!isCancel(reason)) {
            throwIfCancellationRequested(config);

            // Transform response data
            if (reason && reason.response) {
              reason.response.data = transformData(reason.response.data, reason.response.headers, config.transformResponse);
            }
          }

          return Promise.reject(reason);
        });
      };

      /***/
    },
    /* 26 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var utils = __webpack_require__(0);

      /**
       * Transform the data for a request or a response
       *
       * @param {Object|String} data The data to be transformed
       * @param {Array} headers The headers for the request or response
       * @param {Array|Function} fns A single function or Array of functions
       * @returns {*} The resulting transformed data
       */
      module.exports = function transformData(data, headers, fns) {
        /*eslint no-param-reassign:0*/
        utils.forEach(fns, function transform(fn) {
          data = fn(data, headers);
        });

        return data;
      };

      /***/
    },
    /* 27 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      /**
       * Determines whether the specified URL is absolute
       *
       * @param {string} url The URL to test
       * @returns {boolean} True if the specified URL is absolute, otherwise false
       */

      module.exports = function isAbsoluteURL(url) {
        // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
        // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
        // by any combination of letters, digits, plus, period, or hyphen.
        return (/^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url)
        );
      };

      /***/
    },
    /* 28 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      /**
       * Creates a new URL by combining the specified URLs
       *
       * @param {string} baseURL The base URL
       * @param {string} relativeURL The relative URL
       * @returns {string} The combined URL
       */

      module.exports = function combineURLs(baseURL, relativeURL) {
        return relativeURL ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '') : baseURL;
      };

      /***/
    },
    /* 29 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      var Cancel = __webpack_require__(7);

      /**
       * A `CancelToken` is an object that can be used to request cancellation of an operation.
       *
       * @class
       * @param {Function} executor The executor function.
       */
      function CancelToken(executor) {
        if (typeof executor !== 'function') {
          throw new TypeError('executor must be a function.');
        }

        var resolvePromise;
        this.promise = new Promise(function promiseExecutor(resolve) {
          resolvePromise = resolve;
        });

        var token = this;
        executor(function cancel(message) {
          if (token.reason) {
            // Cancellation has already been requested
            return;
          }

          token.reason = new Cancel(message);
          resolvePromise(token.reason);
        });
      }

      /**
       * Throws a `Cancel` if cancellation has been requested.
       */
      CancelToken.prototype.throwIfRequested = function throwIfRequested() {
        if (this.reason) {
          throw this.reason;
        }
      };

      /**
       * Returns an object that contains a new `CancelToken` and a function that, when called,
       * cancels the `CancelToken`.
       */
      CancelToken.source = function source() {
        var cancel;
        var token = new CancelToken(function executor(c) {
          cancel = c;
        });
        return {
          token: token,
          cancel: cancel
        };
      };

      module.exports = CancelToken;

      /***/
    },
    /* 30 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      /**
       * Syntactic sugar for invoking a function and expanding an array for arguments.
       *
       * Common use case would be to use `Function.prototype.apply`.
       *
       *  ```js
       *  function f(x, y, z) {}
       *  var args = [1, 2, 3];
       *  f.apply(null, args);
       *  ```
       *
       * With `spread` this example can be re-written.
       *
       *  ```js
       *  spread(function(x, y, z) {})([1, 2, 3]);
       *  ```
       *
       * @param {Function} callback
       * @returns {Function}
       */

      module.exports = function spread(callback) {
        return function wrap(arr) {
          return callback.apply(null, arr);
        };
      };

      /***/
    },
    /* 31 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";
      /* WEBPACK VAR INJECTION */
      (function (module) {
        var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;

        var _typeof2 = typeof Symbol === "function" && _typeof3(Symbol.iterator) === "symbol" ? function (obj) {
          return typeof obj === 'undefined' ? 'undefined' : _typeof3(obj);
        } : function (obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === 'undefined' ? 'undefined' : _typeof3(obj);
        };

        (function webpackUniversalModuleDefinition(root, factory) {
          if ((false ? undefined : _typeof2(exports)) === 'object' && (false ? undefined : _typeof2(module)) === 'object') module.exports = factory();else if (true) !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = factory, __WEBPACK_AMD_DEFINE_RESULT__ = typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? __WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__) : __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));else {}
        })(undefined, function () {
          return (/******/function (modules) {
              // webpackBootstrap
              /******/ // The module cache
              /******/var installedModules = {};
              /******/
              /******/ // The require function
              /******/function __webpack_require__(moduleId) {
                /******/
                /******/ // Check if module is in cache
                /******/if (installedModules[moduleId]) {
                  /******/return installedModules[moduleId].exports;
                  /******/
                }
                /******/ // Create a new module (and put it into the cache)
                /******/var module = installedModules[moduleId] = {
                  /******/i: moduleId,
                  /******/l: false,
                  /******/exports: {}
                  /******/ };
                /******/
                /******/ // Execute the module function
                /******/modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
                /******/
                /******/ // Flag the module as loaded
                /******/module.l = true;
                /******/
                /******/ // Return the exports of the module
                /******/return module.exports;
                /******/
              }
              /******/
              /******/
              /******/ // expose the modules object (__webpack_modules__)
              /******/__webpack_require__.m = modules;
              /******/
              /******/ // expose the module cache
              /******/__webpack_require__.c = installedModules;
              /******/
              /******/ // define getter function for harmony exports
              /******/__webpack_require__.d = function (exports, name, getter) {
                /******/if (!__webpack_require__.o(exports, name)) {
                  /******/Object.defineProperty(exports, name, { enumerable: true, get: getter });
                  /******/
                }
                /******/
              };
              /******/
              /******/ // define __esModule on exports
              /******/__webpack_require__.r = function (exports) {
                /******/if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
                  /******/Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                  /******/
                }
                /******/Object.defineProperty(exports, '__esModule', { value: true });
                /******/
              };
              /******/
              /******/ // create a fake namespace object
              /******/ // mode & 1: value is a module id, require it
              /******/ // mode & 2: merge all properties of value into the ns
              /******/ // mode & 4: return value when already ns object
              /******/ // mode & 8|1: behave like require
              /******/__webpack_require__.t = function (value, mode) {
                /******/if (mode & 1) value = __webpack_require__(value);
                /******/if (mode & 8) return value;
                /******/if (mode & 4 && (typeof value === 'undefined' ? 'undefined' : _typeof2(value)) === 'object' && value && value.__esModule) return value;
                /******/var ns = Object.create(null);
                /******/__webpack_require__.r(ns);
                /******/Object.defineProperty(ns, 'default', { enumerable: true, value: value });
                /******/if (mode & 2 && typeof value != 'string') for (var key in value) {
                  __webpack_require__.d(ns, key, function (key) {
                    return value[key];
                  }.bind(null, key));
                } /******/return ns;
                /******/
              };
              /******/
              /******/ // getDefaultExport function for compatibility with non-harmony modules
              /******/__webpack_require__.n = function (module) {
                /******/var getter = module && module.__esModule ?
                /******/function getDefault() {
                  return module['default'];
                } :
                /******/function getModuleExports() {
                  return module;
                };
                /******/__webpack_require__.d(getter, 'a', getter);
                /******/return getter;
                /******/
              };
              /******/
              /******/ // Object.prototype.hasOwnProperty.call
              /******/__webpack_require__.o = function (object, property) {
                return Object.prototype.hasOwnProperty.call(object, property);
              };
              /******/
              /******/ // __webpack_public_path__
              /******/__webpack_require__.p = "";
              /******/
              /******/
              /******/ // Load entry module and return exports
              /******/return __webpack_require__(__webpack_require__.s = 13);
              /******/
            }(
            /************************************************************************/
            /******/[
            /* 0 */
            /***/function (module, exports, __webpack_require__) {

              var compose = __webpack_require__(2);
              var Shortcut = __webpack_require__(17);
              var isStamp = __webpack_require__(6);
              var isString = __webpack_require__(18);
              var isObject = __webpack_require__(1);
              var isFunction = __webpack_require__(3);
              var merge = __webpack_require__(8);
              var assign = __webpack_require__(7);

              var concat = Array.prototype.concat;
              function extractFunctions() {
                var fns = concat.apply([], arguments).filter(isFunction);
                return fns.length === 0 ? undefined : fns;
              }

              function standardiseDescriptor(descr) {
                if (!isObject(descr)) return descr;

                var methods = descr.methods;
                var properties = descr.properties;
                var props = descr.props;
                var initializers = descr.initializers;
                var init = descr.init;
                var composers = descr.composers;
                var deepProperties = descr.deepProperties;
                var deepProps = descr.deepProps;
                var pd = descr.propertyDescriptors;
                var staticProperties = descr.staticProperties;
                var statics = descr.statics;
                var staticDeepProperties = descr.staticDeepProperties;
                var deepStatics = descr.deepStatics;
                var configuration = descr.configuration;
                var conf = descr.conf;
                var deepConfiguration = descr.deepConfiguration;
                var deepConf = descr.deepConf;

                var p = isObject(props) || isObject(properties) ? assign({}, props, properties) : undefined;

                var dp = isObject(deepProps) ? merge({}, deepProps) : undefined;
                dp = isObject(deepProperties) ? merge(dp, deepProperties) : dp;

                var sp = isObject(statics) || isObject(staticProperties) ? assign({}, statics, staticProperties) : undefined;

                var sdp = isObject(deepStatics) ? merge({}, deepStatics) : undefined;
                sdp = isObject(staticDeepProperties) ? merge(sdp, staticDeepProperties) : sdp;

                var spd = descr.staticPropertyDescriptors;
                if (isString(descr.name)) spd = assign({}, spd || {}, { name: { value: descr.name } });

                var c = isObject(conf) || isObject(configuration) ? assign({}, conf, configuration) : undefined;

                var dc = isObject(deepConf) ? merge({}, deepConf) : undefined;
                dc = isObject(deepConfiguration) ? merge(dc, deepConfiguration) : dc;

                var ii = extractFunctions(init, initializers);

                var cc = extractFunctions(composers);

                var descriptor = {};
                if (methods) descriptor.methods = methods;
                if (p) descriptor.properties = p;
                if (ii) descriptor.initializers = ii;
                if (cc) descriptor.composers = cc;
                if (dp) descriptor.deepProperties = dp;
                if (sp) descriptor.staticProperties = sp;
                if (sdp) descriptor.staticDeepProperties = sdp;
                if (pd) descriptor.propertyDescriptors = pd;
                if (spd) descriptor.staticPropertyDescriptors = spd;
                if (c) descriptor.configuration = c;
                if (dc) descriptor.deepConfiguration = dc;

                return descriptor;
              }

              function stampit() {
                'use strict'; // to make sure `this` is not pointing to `global` or `window`

                var length = arguments.length,
                    args = [];
                for (var i = 0; i < length; i += 1) {
                  var arg = arguments[i];
                  args.push(isStamp(arg) ? arg : standardiseDescriptor(arg));
                }

                return compose.apply(this || baseStampit, args); // jshint ignore:line
              }

              var baseStampit = Shortcut.compose({
                staticProperties: {
                  create: function create() {
                    return this.apply(this, arguments);
                  },
                  compose: stampit // infecting
                }
              });

              var shortcuts = Shortcut.compose.staticProperties;
              for (var prop in shortcuts) {
                stampit[prop] = shortcuts[prop].bind(baseStampit);
              }stampit.compose = stampit.bind();

              module.exports = stampit;

              /***/
            },
            /* 1 */
            /***/function (module, exports) {

              module.exports = function isObject(arg) {
                var type = typeof arg === 'undefined' ? 'undefined' : _typeof2(arg);
                return Boolean(arg) && (type === 'object' || type === 'function');
              };

              /***/
            },
            /* 2 */
            /***/function (module, exports, __webpack_require__) {

              var isArray = __webpack_require__(5);
              var isFunction = __webpack_require__(3);
              var isObject = __webpack_require__(1);
              var isStamp = __webpack_require__(6);
              var isComposable = __webpack_require__(15);

              var assign = __webpack_require__(7);
              var merge = __webpack_require__(8);

              var slice = Array.prototype.slice;

              /**
               * Creates new factory instance.
               * @returns {Function} The new factory function.
               */
              function createFactory() {
                return function Stamp(options) {
                  var descriptor = Stamp.compose || {};
                  // Next line was optimized for most JS VMs. Please, be careful here!
                  var obj = { __proto__: descriptor.methods }; // jshint ignore:line

                  merge(obj, descriptor.deepProperties);
                  assign(obj, descriptor.properties);
                  Object.defineProperties(obj, descriptor.propertyDescriptors || {});

                  if (!descriptor.initializers || descriptor.initializers.length === 0) return obj;

                  if (options === undefined) options = {};
                  var inits = descriptor.initializers;
                  var length = inits.length;
                  for (var i = 0; i < length; i += 1) {
                    var initializer = inits[i];
                    if (isFunction(initializer)) {
                      var returnedValue = initializer.call(obj, options, { instance: obj, stamp: Stamp, args: slice.apply(arguments) });
                      obj = returnedValue === undefined ? obj : returnedValue;
                    }
                  }

                  return obj;
                };
              }

              /**
               * Returns a new stamp given a descriptor and a compose function implementation.
               * @param {Descriptor} [descriptor={}] The information about the object the stamp will be creating.
               * @param {Compose} composeFunction The "compose" function implementation.
               * @returns {Stamp}
               */
              function createStamp(descriptor, composeFunction) {
                var Stamp = createFactory();

                if (descriptor.staticDeepProperties) {
                  merge(Stamp, descriptor.staticDeepProperties);
                }
                if (descriptor.staticProperties) {
                  assign(Stamp, descriptor.staticProperties);
                }
                if (descriptor.staticPropertyDescriptors) {
                  Object.defineProperties(Stamp, descriptor.staticPropertyDescriptors);
                }

                var composeImplementation = isFunction(Stamp.compose) ? Stamp.compose : composeFunction;
                Stamp.compose = function _compose() {
                  'use strict'; // to make sure `this` is not pointing to `global` or `window`

                  return composeImplementation.apply(this, arguments);
                };
                assign(Stamp.compose, descriptor);

                return Stamp;
              }

              function concatAssignFunctions(dstObject, srcArray, propName) {
                if (!isArray(srcArray)) return;

                var length = srcArray.length;
                var dstArray = dstObject[propName] || [];
                dstObject[propName] = dstArray;
                for (var i = 0; i < length; i += 1) {
                  var fn = srcArray[i];
                  if (isFunction(fn) && dstArray.indexOf(fn) < 0) {
                    dstArray.push(fn);
                  }
                }
              }

              function combineProperties(dstObject, srcObject, propName, action) {
                if (!isObject(srcObject[propName])) return;
                if (!isObject(dstObject[propName])) dstObject[propName] = {};
                action(dstObject[propName], srcObject[propName]);
              }

              function deepMergeAssign(dstObject, srcObject, propName) {
                combineProperties(dstObject, srcObject, propName, merge);
              }
              function mergeAssign(dstObject, srcObject, propName) {
                combineProperties(dstObject, srcObject, propName, assign);
              }

              /**
               * Mutates the dstDescriptor by merging the srcComposable data into it.
               * @param {Descriptor} dstDescriptor The descriptor object to merge into.
               * @param {Composable} [srcComposable] The composable
               * (either descriptor or stamp) to merge data form.
               */
              function mergeComposable(dstDescriptor, srcComposable) {
                var srcDescriptor = srcComposable && srcComposable.compose || srcComposable;

                mergeAssign(dstDescriptor, srcDescriptor, 'methods');
                mergeAssign(dstDescriptor, srcDescriptor, 'properties');
                deepMergeAssign(dstDescriptor, srcDescriptor, 'deepProperties');
                mergeAssign(dstDescriptor, srcDescriptor, 'propertyDescriptors');
                mergeAssign(dstDescriptor, srcDescriptor, 'staticProperties');
                deepMergeAssign(dstDescriptor, srcDescriptor, 'staticDeepProperties');
                mergeAssign(dstDescriptor, srcDescriptor, 'staticPropertyDescriptors');
                mergeAssign(dstDescriptor, srcDescriptor, 'configuration');
                deepMergeAssign(dstDescriptor, srcDescriptor, 'deepConfiguration');
                concatAssignFunctions(dstDescriptor, srcDescriptor.initializers, 'initializers');
                concatAssignFunctions(dstDescriptor, srcDescriptor.composers, 'composers');
              }

              /**
               * Given the list of composables (stamp descriptors and stamps) returns
               * a new stamp (composable factory function).
               * @typedef {Function} Compose
               * @param {...(Composable)} [arguments] The list of composables.
               * @returns {Stamp} A new stamp (aka composable factory function)
               */
              module.exports = function compose() {
                'use strict'; // to make sure `this` is not pointing to `global` or `window`

                var descriptor = {};
                var composables = [];
                if (isComposable(this)) {
                  mergeComposable(descriptor, this);
                  composables.push(this);
                }

                for (var i = 0; i < arguments.length; i++) {
                  var arg = arguments[i];
                  if (isComposable(arg)) {
                    mergeComposable(descriptor, arg);
                    composables.push(arg);
                  }
                }

                var stamp = createStamp(descriptor, compose);

                var composers = descriptor.composers;
                if (isArray(composers) && composers.length > 0) {
                  for (var j = 0; j < composers.length; j += 1) {
                    var composer = composers[j];
                    var returnedValue = composer({ stamp: stamp, composables: composables });
                    stamp = isStamp(returnedValue) ? returnedValue : stamp;
                  }
                }

                return stamp;
              };

              /**
               * The Stamp Descriptor
               * @typedef {Function|Object} Descriptor
               * @returns {Stamp} A new stamp based on this Stamp
               * @property {Object} [methods] Methods or other data used as object instances' prototype
               * @property {Array<Function>} [initializers] List of initializers called for each object instance
               * @property {Array<Function>} [composers] List of callbacks called each time a composition happens
               * @property {Object} [properties] Shallow assigned properties of object instances
               * @property {Object} [deepProperties] Deeply merged properties of object instances
               * @property {Object} [staticProperties] Shallow assigned properties of Stamps
               * @property {Object} [staticDeepProperties] Deeply merged properties of Stamps
               * @property {Object} [configuration] Shallow assigned properties of Stamp arbitrary metadata
               * @property {Object} [deepConfiguration] Deeply merged properties of Stamp arbitrary metadata
               * @property {Object} [propertyDescriptors] ES5 Property Descriptors applied to object instances
               * @property {Object} [staticPropertyDescriptors] ES5 Property Descriptors applied to Stamps
               */

              /**
               * The Stamp factory function
               * @typedef {Function} Stamp
               * @returns {*} Instantiated object
               * @property {Descriptor} compose - The Stamp descriptor and composition function
               */

              /**
               * A composable object - stamp or descriptor
               * @typedef {Stamp|Descriptor} Composable
               */

              /***/
            },
            /* 3 */
            /***/function (module, exports) {

              module.exports = function isFunction(arg) {
                return typeof arg === 'function';
              };

              /***/
            },
            /* 4 */
            /***/function (module, exports) {

              var g;

              // This works in non-strict mode
              g = function () {
                return this;
              }();

              try {
                // This works if eval is allowed (see CSP)
                g = g || new Function("return this")();
              } catch (e) {
                // This works if the window reference is available
                if ((typeof window === 'undefined' ? 'undefined' : _typeof2(window)) === "object") g = window;
              }

              // g can still be undefined, but nothing to do about it...
              // We return undefined, instead of nothing here, so it's
              // easier to handle this case. if(!global) { ...}

              module.exports = g;

              /***/
            },
            /* 5 */
            /***/function (module, exports) {

              module.exports = Array.isArray;

              /***/
            },
            /* 6 */
            /***/function (module, exports, __webpack_require__) {

              var isFunction = __webpack_require__(3);

              module.exports = function isStamp(arg) {
                return isFunction(arg) && isFunction(arg.compose);
              };

              /***/
            },
            /* 7 */
            /***/function (module, exports) {

              module.exports = Object.assign;

              /***/
            },
            /* 8 */
            /***/function (module, exports, __webpack_require__) {

              var isPlainObject = __webpack_require__(16);
              var isObject = __webpack_require__(1);
              var isArray = __webpack_require__(5);

              /**
               * The 'src' argument plays the command role.
               * The returned values is always of the same type as the 'src'.
               * @param dst The object to merge into
               * @param src The object to merge from
               * @returns {*}
               */
              function mergeOne(dst, src) {
                if (src === undefined) return dst;

                // According to specification arrays must be concatenated.
                // Also, the '.concat' creates a new array instance. Overrides the 'dst'.
                if (isArray(src)) return (isArray(dst) ? dst : []).concat(src);

                // Now deal with non plain 'src' object. 'src' overrides 'dst'
                // Note that functions are also assigned! We do not deep merge functions.
                if (!isPlainObject(src)) return src;

                // See if 'dst' is allowed to be mutated.
                // If not - it's overridden with a new plain object.
                var returnValue = isObject(dst) ? dst : {};

                var keys = Object.keys(src);
                for (var i = 0; i < keys.length; i += 1) {
                  var key = keys[i];

                  var srcValue = src[key];
                  // Do not merge properties with the 'undefined' value.
                  if (srcValue !== undefined) {
                    var dstValue = returnValue[key];
                    // Recursive calls to mergeOne() must allow only plain objects or arrays in dst
                    var newDst = isPlainObject(dstValue) || isArray(srcValue) ? dstValue : {};

                    // deep merge each property. Recursion!
                    returnValue[key] = mergeOne(newDst, srcValue);
                  }
                }

                return returnValue;
              }

              module.exports = function (dst) {
                for (var i = 1; i < arguments.length; i++) {
                  dst = mergeOne(dst, arguments[i]);
                }
                return dst;
              };

              /***/
            },
            /* 9 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";
              /* WEBPACK VAR INJECTION */

              (function (global) {

                Object.defineProperty(exports, "__esModule", {
                  value: true
                });

                var _it = __webpack_require__(0);

                var _it2 = _interopRequireDefault(_it);

                var _privatize = __webpack_require__(19);

                var _privatize2 = _interopRequireDefault(_privatize);

                function _interopRequireDefault(obj) {
                  return obj && obj.__esModule ? obj : { default: obj };
                }

                exports.default = (0, _it2.default)({
                  properties: {
                    name: 'baseModel',
                    config: {
                      remote: {
                        path: undefined,
                        token: undefined,
                        pullForm: false
                      },
                      local: {
                        connector: 'loki'
                      },
                      merge: {
                        connector: 'formio-loki'
                      }
                    }
                  },
                  methods: {
                    /**
                     * 
                     */
                    getModelName: function getModelName() {
                      return this.name;
                    },

                    /**
                     * 
                     */
                    getFluentConfig: function getFluentConfig() {
                      var FLUENT = void 0;
                      if (typeof window !== 'undefined' && window && window._FLUENT_) {
                        FLUENT = window._FLUENT_;
                      } else if (global && global._FLUENT_) {
                        FLUENT = global._FLUENT_;
                      }

                      return FLUENT;
                    },

                    /**
                     * 
                     * @param {*} connectors 
                     * @param {*} type 
                     */
                    getConnector: function getConnector(connectors, type) {
                      var connectorName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

                      if (Array.isArray(connectors)) {
                        return this.getConnectorFromArray(connectors, type, connectorName);
                      }

                      if (connectors instanceof Object) {
                        return connectors;
                      }

                      return undefined;
                    },

                    /**
                     * 
                     * @param {*} connectors 
                     * @param {*} type 
                     */
                    getConnectorFromArray: function getConnectorFromArray(connectors, type) {
                      var _this = this;

                      var connectorName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

                      // Default case
                      if (connectors.length === 1) return connectors[0];

                      // If the model assigns specific one
                      if (this.config && this.config[type] && this.config[type].connector) {
                        var Lcon = connectors.find(function (c) {
                          return c.name === _this.config[type].connector;
                        });

                        if (Lcon instanceof Object) return Lcon;
                      }

                      // If connectorName is specified
                      if (connectorName) {
                        var _Lcon = connectors.find(function (c) {
                          return c.name === connectorName;
                        });

                        if (_Lcon instanceof Object) return _Lcon;
                      }

                      var base = connectors.find(function (c) {
                        return c.default;
                      });

                      if (base instanceof Object) return base;

                      return undefined;
                    },

                    /**
                     * [remote description]
                     * @return {[type]} [description]
                     */
                    remote: function remote() {
                      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                          _ref$token = _ref.token,
                          token = _ref$token === undefined ? undefined : _ref$token,
                          _ref$pullForm = _ref.pullForm,
                          pullForm = _ref$pullForm === undefined ? undefined : _ref$pullForm,
                          _ref$connectorName = _ref.connectorName,
                          connectorName = _ref$connectorName === undefined ? undefined : _ref$connectorName,
                          _ref$path = _ref.path,
                          path = _ref$path === undefined ? undefined : _ref$path;

                      var FLUENT = this.getFluentConfig();
                      var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.remote;

                      if (!connectors) {
                        throw new Error('No remote connector was defined. Please define it using Fluent.config()');
                      }

                      var remoteConnector = this.getConnector(connectors, 'remote', connectorName || false);

                      this.config.remote.token = token || this.config.remote.token;
                      this.config.remote.path = path || this.config.remote.path;

                      console.log('aaaa');

                      if (pullForm) {
                        this.config.remote.pullForm = pullForm || this.config.remote.pullForm;
                      }

                      if (remoteConnector) {
                        return remoteConnector.connector({
                          remoteConnection: this.config.remote,
                          connector: remoteConnector
                        });
                      }

                      throw new Error('No default remote connector found. Please assign one as your default in Fluent.config');
                    },

                    /**
                     * [local description]
                     * @return {[type]} [description]
                     */
                    local: function local() {
                      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                          _ref2$connectorName = _ref2.connectorName,
                          connectorName = _ref2$connectorName === undefined ? undefined : _ref2$connectorName;

                      var FLUENT = this.getFluentConfig();
                      var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.local;

                      if (!connectors) throw new Error('No local connector was defined. Please define it using Fluent.config()');

                      var localConnector = this.getConnector(connectors, 'local', connectorName || false);

                      if (localConnector) return localConnector.connector({ name: this.name, connector: localConnector });

                      throw new Error('No default local connector found. Please assign one as your default in Fluent.config');
                    },

                    /**
                    * [local description]
                    * @return {[type]} [description]
                    */
                    merged: function merged() {
                      var local = this.local();
                      var remote = this.remote();

                      var FLUENT = this.getFluentConfig();
                      var connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.merge;

                      if (!connectors) {
                        throw new Error('No merge connector was defined. Please define it using Fluent.config()');
                      }

                      var mergeConnector = this.getConnector(connectors, 'merge');

                      if (mergeConnector) {
                        return mergeConnector.connector({ local: local, remote: remote, name: this.name, connector: mergeConnector });
                      }

                      throw new Error('No default merge connector found. Please assign one as your default in Fluent.config');
                    }
                  }
                }).compose(_privatize2.default);
                /* WEBPACK VAR INJECTION */
              }).call(this, __webpack_require__(4));

              /***/
            },
            /* 10 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";

              Object.defineProperty(exports, "__esModule", {
                value: true
              });

              var _extends = Object.assign || function (target) {
                for (var i = 1; i < arguments.length; i++) {
                  var source = arguments[i];for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                      target[key] = source[key];
                    }
                  }
                }return target;
              };

              var _it = __webpack_require__(0);

              var _it2 = _interopRequireDefault(_it);

              var _utilities = __webpack_require__(11);

              var _utilities2 = _interopRequireDefault(_utilities);

              function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : { default: obj };
              }

              function _asyncToGenerator(fn) {
                return function () {
                  var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
                    function step(key, arg) {
                      try {
                        var info = gen[key](arg);var value = info.value;
                      } catch (error) {
                        reject(error);return;
                      }if (info.done) {
                        resolve(value);
                      } else {
                        return Promise.resolve(value).then(function (value) {
                          step("next", value);
                        }, function (err) {
                          step("throw", err);
                        });
                      }
                    }return step("next");
                  });
                };
              }

              function _toConsumableArray(arr) {
                if (Array.isArray(arr)) {
                  for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
                    arr2[i] = arr[i];
                  }return arr2;
                } else {
                  return Array.from(arr);
                }
              }

              exports.default = (0, _it2.default)({
                init: function init(data) {
                  if (!Array.isArray(data)) {
                    throw new Error('Collect method only accepts arrays of data');
                  }
                  this.data = data;
                },

                properties: {
                  data: []
                },
                methods: {
                  /**
                   * 
                   */
                  get: function get() {
                    return this.data;
                  },

                  /**
                   * Alias for the "get" method
                   * @return function
                   */
                  all: function all() {
                    return this.get();
                  },

                  /**
                   * Alias for the "average" method.
                   *
                   * @param  {String}  path Path of the key
                   * @return function
                   */
                  avg: function avg(path) {
                    return this.average(path);
                  },

                  /**
                   * Get the average value of a given key.
                   *
                   * @param  {String}  path Path of the key
                   * @return static
                   */
                  average: function average() {
                    var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

                    var data = [].concat(_toConsumableArray(this.data));
                    var sum = data.reduce(function (acc, element) {
                      var value = element;

                      if (element instanceof Object) {
                        var extract = _utilities2.default.getFromPath(element, path, undefined);
                        if (typeof extract !== 'undefined' && extract.value) {
                          value = extract.value;
                        }
                      }
                      return acc + value;
                    }, 0);

                    try {
                      var avg = sum / data.length;
                      return avg;
                    } catch (e) {
                      throw new Error('Division between "' + sum + '" and "' + data.length + '" is not valid.');
                    }
                  },
                  chunkApply: function chunkApply(size, callback) {
                    var _this = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
                      var totalSize, count, reducer, promiseChain;
                      return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                          switch (_context.prev = _context.next) {
                            case 0:
                              if (!(callback === undefined)) {
                                _context.next = 2;
                                break;
                              }

                              throw new Error('Callback function not defined.');

                            case 2:
                              totalSize = _this.data.length;
                              count = 0;

                              _this.chunks(size);

                              // console.log(`Processed ${count}/${totalSize} elements...`);

                              /* for (const chunk of this.data) {
                                const promises = [];
                                 chunk.forEach((element) => {
                                  promises.push(callback(element, count));
                                  count = count + 1;
                                });
                                 await Promise.all(promises);
                                 // count = (count + size) > totalSize ? totalSize : count + size;
                                console.log(`Processed ${count}/${totalSize} elements...`);
                              } */

                              reducer = function reducer(chain, batch) {
                                return chain.then(function () {
                                  return Promise.all(batch.map(function (d) {
                                    return callback(d);
                                  }));
                                }).then(function () {
                                  count = count + size > totalSize ? totalSize : count + size;
                                  console.log('Processed ' + count + '/' + totalSize + ' elements...');
                                });
                              };

                              console.log('Processed ' + count + '/' + totalSize + ' elements...');
                              promiseChain = _this.data.reduce(reducer, Promise.resolve());
                              return _context.abrupt('return', promiseChain);

                            case 9:
                            case 'end':
                              return _context.stop();
                          }
                        }
                      }, _callee, _this);
                    }))();
                  },

                  /**
                   * Chunks the given array
                   *
                   * @param {Int} size
                   * @return static
                   */
                  chunks: function chunks(size) {
                    var data = [].concat(_toConsumableArray(this.data));
                    var results = [];

                    while (data.length) {
                      results.push(data.splice(0, size));
                    }

                    this.data = results;
                    return this;
                  },

                  /**
                   * 
                   */
                  collapse: function collapse() {
                    var data = [].concat(_toConsumableArray(this.data));
                    var results = [];

                    data.forEach(function (chunk) {
                      if (Array.isArray(chunk)) {
                        chunk.forEach(function (element) {
                          results.push(element);
                        });
                      } else {
                        results.push(chunk);
                      }
                    });
                    this.data = results;

                    return this;
                  },
                  unChunk: function unChunk() {
                    return this.collapse();
                  },
                  combine: function combine(array) {
                    var data = [].concat(_toConsumableArray(this.data));
                    var result = void 0;
                    data.forEach(function (e, index) {
                      if (!(e instanceof Object)) {
                        if (!result) {
                          result = {};
                        }
                        result[e] = array[index];
                      } else {
                        if (!result) {
                          result = [];
                        }
                        result[index] = _extends({}, e, { _value: array[index] });
                      }
                    });

                    this.data = result;
                    return this;
                  },
                  concat: function concat(array) {
                    this.data = [].concat(_toConsumableArray(this.data), _toConsumableArray(array));
                    return this;
                  },
                  contains: function contains() {
                    var value = void 0;
                    var path = void 0;
                    var Fx = void 0;
                    if (arguments.length === 1) {
                      if (this.isFunction(arguments.length <= 0 ? undefined : arguments[0])) {
                        Fx = arguments.length <= 0 ? undefined : arguments[0];
                      }
                      value = arguments.length <= 0 ? undefined : arguments[0];
                    } else {
                      value = arguments.length <= 1 ? undefined : arguments[1];
                      path = arguments.length <= 0 ? undefined : arguments[0];
                    }
                    var data = [].concat(_toConsumableArray(this.data));

                    return data.some(function (e, index) {
                      if (Fx) {
                        return !!Fx(e, index);
                      }
                      var val = e;
                      if (e instanceof Object) {
                        var extract = _utilities2.default.getFromPath(e, path, undefined);
                        if (extract.value) {
                          val = extract.value;
                        }
                      }
                      return val === value;
                    });
                  },

                  /**
                   * Returns an array of duplicate submissions, based on an array of keys.
                   * @param {Array} keys - Keys where the function compares an object to evaluate its similarity. 
                   */
                  duplicatesBy: function duplicatesBy(keys) {
                    var data = [].concat(_toConsumableArray(this.data));
                    var duplicates = [];

                    data.reduce(function (object, submission) {
                      var finalKey = keys.reduce(function (string, key) {
                        return string + _utilities2.default.getFromPath(submission, key, '').value;
                      }, '');

                      if (object.hasOwnProperty(finalKey)) {
                        duplicates.push(submission);
                      } else {
                        object[finalKey] = true;
                      }

                      return object;
                    }, {});

                    this.data = duplicates;

                    return this;
                  },
                  count: function count() {
                    return this.data.length;
                  },
                  isFunction: function isFunction(functionToCheck) {
                    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
                  }
                }
              });

              /***/
            },
            /* 11 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";

              Object.defineProperty(exports, "__esModule", {
                value: true
              });
              /* eslint-disable no-unused-vars */
              var Utilities = function () {
                /**
                 * Given an Object and its path, if exisits it will
                 * return the value of it, if not the default
                 * @param {Object} obj
                 * @param {String} path
                 * @param {*} def
                 */
                var get = function get(fn, def) {
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
                var getFromPath = function getFromPath(obj, path, def) {
                  var _path = path;

                  if (path.includes(' as ')) {
                    path = path.split(' as ');
                    _path = path[0];
                  }

                  var assignedName = get(function () {
                    return Array.isArray(path) && path[1].trim();
                  }, undefined);

                  var fullPath = _path.replace(/\[/g, '.').replace(/]/g, '').split('.').filter(Boolean).map(function (e) {
                    return e.trim();
                  });

                  function everyFunc(step) {
                    return !(step && (obj = obj[step]) === undefined);
                  }

                  var result = fullPath.every(everyFunc) ? obj : def;

                  return { label: assignedName || _path, value: result };
                };

                return Object.freeze({
                  get: get,
                  getFromPath: getFromPath
                });
              }();

              exports.default = Utilities;

              /***/
            },
            /* 12 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";

              Object.defineProperty(exports, "__esModule", {
                value: true
              });

              var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? function (obj) {
                return typeof obj === 'undefined' ? 'undefined' : _typeof2(obj);
              } : function (obj) {
                return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === 'undefined' ? 'undefined' : _typeof2(obj);
              };

              var _it = __webpack_require__(0);

              var _it2 = _interopRequireDefault(_it);

              var _utilities = __webpack_require__(11);

              var _utilities2 = _interopRequireDefault(_utilities);

              var _Collection = __webpack_require__(10);

              var _Collection2 = _interopRequireDefault(_Collection);

              function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : { default: obj };
              }

              function _toConsumableArray(arr) {
                if (Array.isArray(arr)) {
                  for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
                    arr2[i] = arr[i];
                  }return arr2;
                } else {
                  return Array.from(arr);
                }
              }

              function _asyncToGenerator(fn) {
                return function () {
                  var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
                    function step(key, arg) {
                      try {
                        var info = gen[key](arg);var value = info.value;
                      } catch (error) {
                        reject(error);return;
                      }if (info.done) {
                        resolve(value);
                      } else {
                        return Promise.resolve(value).then(function (value) {
                          step("next", value);
                        }, function (err) {
                          step("throw", err);
                        });
                      }
                    }return step("next");
                  });
                };
              }

              exports.default = (0, _it2.default)({
                init: function init(_ref) {
                  var name = _ref.name,
                      remoteConnection = _ref.remoteConnection,
                      connector = _ref.connector;

                  if (!name && !remoteConnection) {
                    throw new Error("Model must have a name or path");
                  }

                  if (!connector) {
                    throw new Error("Model must have a connector. Please register one using Fluent.config");
                  }
                  this.name = name || this.name;
                  this.remoteConnection = remoteConnection || this.remoteConnection;
                  this.connector = connector || this.connector;
                  this.chainReference = [];
                  this.whereArray = [];
                  this.orWhereArray = [];
                  this.selectArray = [];
                  this.orderByArray = [];
                  this.limitNumber = undefined;
                  this.offsetNumber = undefined;
                  this.populate = [];
                  this.chunk = null;
                  this.pullSize = null;
                  this.ownerId = undefined;
                  this.paginator = undefined;
                  this.rawQuery = undefined;
                },

                properties: {
                  operators: ["=", "<", ">", "<=", ">=", "<>", "!=", "in", "nin", "like", "regexp", "startsWith", "endsWith", "contains"]
                },
                methods: {
                  /**
                   *
                   */
                  get: function get() {
                    throw new Error("get() method not implemented");
                  },

                  /**
                   *
                   */
                  all: function all() {
                    throw new Error("all() method not implemented");
                  },

                  /**
                   *
                   */
                  find: function find(id) {
                    throw new Error("find() method not implemented");
                  },

                  /**
                   *
                   */
                  findOne: function findOne() {
                    throw new Error("findOne() method not implemented");
                  },

                  /**
                   *
                   */
                  remove: function remove() {
                    throw new Error("remove() method not implemented");
                  },

                  /**
                   *
                   */
                  softDelete: function softDelete() {
                    throw new Error("softDelete() method not implemented");
                  },

                  /**
                   *
                   */
                  insert: function insert() {
                    throw new Error("insert() method not implemented");
                  },

                  /**
                   *
                   */
                  update: function update() {
                    throw new Error("update() method not implemented");
                  },

                  /**
                   *
                   */
                  clear: function clear() {
                    throw new Error("clear() method not implemented");
                  },

                  /**
                   *
                   */
                  updateOrCreate: function updateOrCreate() {
                    throw new Error("updateOrCreate() method not implemented");
                  },

                  /**
                   *
                   */
                  findAndRemove: function findAndRemove() {
                    throw new Error("findAndRemove() method not implemented");
                  },

                  /**
                   *
                   * @param {*} paginator
                   */
                  paginate: function paginate() {
                    throw new Error("paginate() method not implemented");
                  },

                  /**
                   * @param {*} tableView
                   */
                  tableView: function tableView() {
                    throw new Error("tableView() method not implemented");
                  },

                  /**
                   * @param {*} raw
                   */
                  raw: function raw() {
                    throw new Error("raw() method not implemented");
                  },
                  owner: function owner(user) {
                    this.chainReference.push({ method: "owner", args: user });
                    this.ownerId = user;
                    return this;
                  },
                  own: function own(user) {
                    return this.owner(user);
                  },

                  /**
                   * Executes the Get() method and
                   * returns the its first result
                   *
                   * @return {Object} First result
                   */
                  first: function first() {
                    var _this = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
                      var data;
                      return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                          switch (_context.prev = _context.next) {
                            case 0:
                              _context.next = 2;
                              return _this.get();

                            case 2:
                              data = _context.sent;
                              return _context.abrupt("return", _utilities2.default.get(function () {
                                return data[0];
                              }, []));

                            case 4:
                            case "end":
                              return _context.stop();
                          }
                        }
                      }, _callee, _this);
                    }))();
                  },

                  /**
                   *
                   * Gets the data in the current query and
                   * transforms it into a collection
                   * @returns {Collection} Fluent Collection
                   */
                  collect: function collect() {
                    var _this2 = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
                      var data;
                      return regeneratorRuntime.wrap(function _callee2$(_context2) {
                        while (1) {
                          switch (_context2.prev = _context2.next) {
                            case 0:
                              _context2.next = 2;
                              return _this2.get();

                            case 2:
                              data = _context2.sent;

                              if (Array.isArray(data)) {
                                _context2.next = 5;
                                break;
                              }

                              throw new Error("Collect method only accepts arrays of data");

                            case 5:
                              return _context2.abrupt("return", (0, _Collection2.default)(data));

                            case 6:
                            case "end":
                              return _context2.stop();
                          }
                        }
                      }, _callee2, _this2);
                    }))();
                  },

                  /**
                   * Adds the given columns to the SelectArray
                   * to use as column filter for the data
                   *
                   * @param {Array|String} columns The columns to select
                   * @returns {Model} Fluent Model
                   */
                  select: function select() {
                    for (var _len = arguments.length, columns = Array(_len), _key = 0; _key < _len; _key++) {
                      columns[_key] = arguments[_key];
                    }

                    columns = this.prepareInput(columns);
                    this.chainReference.push({ method: "select", args: columns });
                    this.selectArray = this.selectArray.concat(columns).filter(function (elem, pos, arr) {
                      return arr.indexOf(elem) === pos;
                    });

                    return this;
                  },

                  /**
                   * Maps the given Data to show only those fields
                   * explicitly detailed on the Select function
                   *
                   * @param {Array} data Data from local or remote DB
                   * @returns {Array} Formatted data with the selected columns
                   */
                  jsApplySelect: function jsApplySelect(data) {
                    var _this3 = this;

                    var _data = Array.isArray(data) ? [].concat(_toConsumableArray(data)) : [data];

                    if (this.selectArray.length > 0) {
                      _data = _data.map(function (element) {
                        var newElement = {};

                        _this3.selectArray.forEach(function (attribute) {
                          var extract = _utilities2.default.getFromPath(element, attribute, undefined);

                          var value = _utilities2.default.get(function () {
                            return extract.value;
                          }, undefined);

                          if (typeof value !== "undefined") {
                            if ((typeof value === "undefined" ? "undefined" : _typeof(value)) === "object" && value.hasOwnProperty("data") && value.data.hasOwnProperty("name")) {
                              newElement[extract.label] = value.data.name;
                            } else {
                              newElement[extract.label] = value;
                            }
                          }
                        });

                        return newElement;
                      });
                    }

                    return _data;
                  },

                  /**
                   *  Sets the offset number for
                   *  the given query
                   *
                   * @param {int} offset The given offset
                   * @returns {Model} Fluent Model
                   */
                  offset: function offset(_offset) {
                    this.chainReference.push({ method: "offset", args: _offset });
                    this.offsetNumber = _offset;
                    return this;
                  },

                  /**
                   *  Alias for the offset method
                   *
                   * @param {int} offset the given offset
                   */
                  skip: function skip(offset) {
                    return this.offset(offset);
                  },

                  /**
                   *  Adds where filters to the query
                   *  whereArray
                   * @param {String|Array} args Where filters
                   * @returns {Model} Fluent Model
                   */
                  where: function where() {
                    var _this4 = this;

                    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                      args[_key2] = arguments[_key2];
                    }

                    this.chainReference.push({ method: "where", args: args });
                    this.whereArray = [];
                    args = Array.isArray(args[0]) ? args : [args];
                    args.forEach(function (arg) {
                      if (arg.length !== 3) {
                        throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
                      }
                      _this4.whereArray.push(arg);
                    });
                    return this;
                  },

                  /**
                   * Pushes where filters with AND condition
                   * to the whereArray
                   *
                   * @param {String|Array} args Where filters
                   * @returns {Model} Fluent Model
                   */
                  andWhere: function andWhere() {
                    var _this5 = this;

                    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                      args[_key3] = arguments[_key3];
                    }

                    this.chainReference.push({ method: "andWhere", args: args });
                    args = Array.isArray(args[0]) ? args : [args];
                    args.forEach(function (arg) {
                      if (arg.length !== 3) {
                        throw new Error('There where clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
                      }
                      _this5.whereArray.push(arg);
                    });
                    return this;
                  },

                  /**
                   * Pushes where filter with OR condition
                   * to the orWhereArray
                   *
                   * @param {String|Array} args OR where filters
                   * @returns {Model} Fluent Model
                   */
                  orWhere: function orWhere() {
                    var _this6 = this;

                    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
                      args[_key4] = arguments[_key4];
                    }

                    this.chainReference.push({ method: "orWhere", args: args });
                    args = Array.isArray(args[0]) ? args : [args];
                    args.forEach(function (arg) {
                      if (arg.length !== 3) {
                        throw new Error('There orWhere clouse is not properly formatted, expecting: ["attribute", "operator","value"] but got "' + JSON.stringify(arg) + '" ');
                      }
                      _this6.orWhereArray.push(arg);
                    });
                    return this;
                  },

                  /**
                   * Limits the number of results for the
                   * given query
                   * @param {int} limit limit number
                   * @returns {Model} Fluent Model
                   */
                  limit: function limit(_limit) {
                    this.chainReference.push({ method: "limit", args: _limit });
                    this.limitNumber = _limit;
                    return this;
                  },

                  /**
                   * Alias for the limit method
                   *
                   * @param {*} limit limit number
                   * @returns {Model} Fluent Model
                   */
                  take: function take(limit) {
                    return this.limit(limit);
                  },

                  /**
                   * Gets all values for a given KEY
                   * @param {String} keyPath The path to the key
                   * @returns {Array}
                   */
                  pluck: function pluck(keyPath) {
                    var _this7 = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
                      var data;
                      return regeneratorRuntime.wrap(function _callee3$(_context3) {
                        while (1) {
                          switch (_context3.prev = _context3.next) {
                            case 0:
                              _this7.chainReference.push({ method: "pluck", args: keyPath });
                              _context3.next = 3;
                              return _this7.get();

                            case 3:
                              data = _context3.sent;

                              data = data.map(function (e) {
                                var extracted = _utilities2.default.getFromPath(e, keyPath, undefined);

                                if (typeof extracted.value !== "undefined") {
                                  return extracted.value;
                                }
                              });
                              return _context3.abrupt("return", data);

                            case 6:
                            case "end":
                              return _context3.stop();
                          }
                        }
                      }, _callee3, _this7);
                    }))();
                  },

                  /**
                   *
                   * @param {*} args
                   */
                  orderBy: function orderBy() {
                    for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
                      args[_key5] = arguments[_key5];
                    }

                    this.chainReference.push({ method: "orderBy", args: args });
                    this.orderByArray = args;
                    return this;
                  },

                  /**
                   *
                   * @param {*} data
                   */
                  jsApplyOrderBy: function jsApplyOrderBy(data) {
                    var _data = [].concat(_toConsumableArray(data));

                    if (this.orderByArray.length === 0) {
                      return _data;
                    }
                    var field = this.orderByArray[0];

                    if (this.selectArray.length > 0 && (field.includes(".") || field.includes("["))) {
                      throw new Error('Cannot orderBy nested attribute "' + field + '" when using Select. You must rename the attribute');
                    }

                    var order = this.orderByArray[1];
                    var type = this.orderByArray[2];

                    if (!type) {
                      type = "string";
                    }

                    _data = _data.sort(function (a, b) {
                      var A = _utilities2.default.getFromPath(a, field, undefined).value;
                      var B = _utilities2.default.getFromPath(b, field, undefined).value;

                      if (typeof A === "undefined" || typeof B === "undefined") {
                        throw new Error('Cannot order by property "' + field + '" not all values have this property');
                      }
                      // For default order and numbers
                      if (type.includes("string") || type.includes("number")) {
                        if (order === "asc") {
                          return A > B ? 1 : A < B ? -1 : 0;
                        }
                        return A > B ? -1 : A < B ? 1 : 0;
                      } else if (type.includes("date")) {
                        if (order === "asc") {
                          return new Date(A) - new Date(B);
                        }
                        return new Date(B) - new Date(A);
                      }
                    });
                    return _data;
                  },

                  /**
                   *
                   * @param {*} input
                   */
                  prepareInput: function prepareInput(input) {
                    var cols = [];

                    input.forEach(function (item) {
                      var value = Array.isArray(item) ? item : item.split(",");

                      value = value.map(function (e) {
                        return e.trim();
                      });
                      cols = cols.concat(value);
                    });

                    cols.filter(function (elem, pos, arr) {
                      return arr.indexOf(elem) === pos;
                    });

                    return cols;
                  },
                  ArrayInsert: function ArrayInsert(dataArray, options) {
                    var _this8 = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
                      var initial, length, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, element, a;

                      return regeneratorRuntime.wrap(function _callee4$(_context4) {
                        while (1) {
                          switch (_context4.prev = _context4.next) {
                            case 0:
                              initial = 1;
                              length = dataArray.length;
                              _iteratorNormalCompletion = true;
                              _didIteratorError = false;
                              _iteratorError = undefined;
                              _context4.prev = 5;
                              _iterator = dataArray[Symbol.iterator]();

                            case 7:
                              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                                _context4.next = 26;
                                break;
                              }

                              element = _step.value;

                              if (options && options.showProgress) {
                                console.log("Inserting " + initial + " of " + length);
                              }
                              _context4.prev = 10;
                              _context4.next = 13;
                              return _this8.insert(element, options);

                            case 13:
                              a = _context4.sent;

                              if (options && options.showProgress) {
                                console.log("Element " + initial + " inserted");
                              }
                              initial++;
                              _context4.next = 23;
                              break;

                            case 18:
                              _context4.prev = 18;
                              _context4.t0 = _context4["catch"](10);

                              console.log("ERROR - Element " + initial + " - " + JSON.stringify(element) + " could not be inserted");
                              console.log(_context4.t0);
                              initial++;

                            case 23:
                              _iteratorNormalCompletion = true;
                              _context4.next = 7;
                              break;

                            case 26:
                              _context4.next = 32;
                              break;

                            case 28:
                              _context4.prev = 28;
                              _context4.t1 = _context4["catch"](5);
                              _didIteratorError = true;
                              _iteratorError = _context4.t1;

                            case 32:
                              _context4.prev = 32;
                              _context4.prev = 33;

                              if (!_iteratorNormalCompletion && _iterator.return) {
                                _iterator.return();
                              }

                            case 35:
                              _context4.prev = 35;

                              if (!_didIteratorError) {
                                _context4.next = 38;
                                break;
                              }

                              throw _iteratorError;

                            case 38:
                              return _context4.finish(35);

                            case 39:
                              return _context4.finish(32);

                            case 40:
                            case "end":
                              return _context4.stop();
                          }
                        }
                      }, _callee4, _this8, [[5, 28, 32, 40], [10, 18], [33,, 35, 39]]);
                    }))();
                  }
                }
              });

              /***/
            },
            /* 13 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";

              Object.defineProperty(exports, "__esModule", {
                value: true
              });
              exports.MergeConnector = exports.Interface = exports.Fluent = exports.Model = undefined;

              var _Fluent = __webpack_require__(14);

              var _Fluent2 = _interopRequireDefault(_Fluent);

              var _Model = __webpack_require__(9);

              var _Model2 = _interopRequireDefault(_Model);

              var _Interface = __webpack_require__(12);

              var _Interface2 = _interopRequireDefault(_Interface);

              var _MergeConnector = __webpack_require__(20);

              var _MergeConnector2 = _interopRequireDefault(_MergeConnector);

              function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : { default: obj };
              }

              exports.Model = _Model2.default;
              exports.Fluent = _Fluent2.default;
              exports.Interface = _Interface2.default;
              exports.MergeConnector = _MergeConnector2.default;

              /***/
            },
            /* 14 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";
              /* WEBPACK VAR INJECTION */

              (function (global) {

                Object.defineProperty(exports, "__esModule", {
                  value: true
                });

                var _extends = Object.assign || function (target) {
                  for (var i = 1; i < arguments.length; i++) {
                    var source = arguments[i];for (var key in source) {
                      if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                      }
                    }
                  }return target;
                };

                var _it = __webpack_require__(0);

                var _it2 = _interopRequireDefault(_it);

                var _Model = __webpack_require__(9);

                var _Model2 = _interopRequireDefault(_Model);

                var _Collection = __webpack_require__(10);

                var _Collection2 = _interopRequireDefault(_Collection);

                function _interopRequireDefault(obj) {
                  return obj && obj.__esModule ? obj : { default: obj };
                }

                function _toConsumableArray(arr) {
                  if (Array.isArray(arr)) {
                    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
                      arr2[i] = arr[i];
                    }return arr2;
                  } else {
                    return Array.from(arr);
                  }
                }

                var Fluent = (0, _it2.default)({
                  init: function init() {
                    this.registerGlobalVariable();
                  },

                  properties: {},
                  methods: {
                    model: function model() {
                      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                        args[_key] = arguments[_key];
                      }

                      this.registerModel(args);
                      return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
                    },
                    extend: function extend() {
                      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                        args[_key2] = arguments[_key2];
                      }

                      this.registerModel(args);
                      return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
                    },
                    compose: function compose() {
                      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                        args[_key3] = arguments[_key3];
                      }

                      this.registerModel(args);
                      return _Model2.default.compose.apply(_Model2.default, _toConsumableArray(args));
                    },
                    collect: function collect(args) {
                      return (0, _Collection2.default)(args);
                    },
                    registerGlobalVariable: function registerGlobalVariable() {
                      if (typeof window !== "undefined" && window && !window._FLUENT_) {
                        window._FLUENT_ = {
                          connectors: {},
                          models: {}
                        };
                      }

                      if (global && !global._FLUENT_) {
                        global._FLUENT_ = {
                          connectors: {},
                          models: {}
                        };
                      }
                    },
                    registerModel: function registerModel(args) {
                      var name = args && args[0] && args[0].properties && args[0].properties.name ? args[0].properties.name : undefined;

                      if (!name || name === "baseModel") {
                        return;
                      }

                      if (!(typeof name === "string")) {
                        throw new Error("You must assign a name to your Model when using Fluent.compose");
                      }

                      if (typeof window !== "undefined") {
                        window._FLUENT_.models[name] = true;
                        return;
                      }
                      global._FLUENT_.models[name] = true;
                    },
                    config: function config(_ref) {
                      var _ref$REMOTE_CONNECTOR = _ref.REMOTE_CONNECTORS,
                          REMOTE_CONNECTORS = _ref$REMOTE_CONNECTOR === undefined ? undefined : _ref$REMOTE_CONNECTOR,
                          _ref$LOCAL_CONNECTORS = _ref.LOCAL_CONNECTORS,
                          LOCAL_CONNECTORS = _ref$LOCAL_CONNECTORS === undefined ? undefined : _ref$LOCAL_CONNECTORS,
                          _ref$MERGE_CONNECTORS = _ref.MERGE_CONNECTORS,
                          MERGE_CONNECTORS = _ref$MERGE_CONNECTORS === undefined ? undefined : _ref$MERGE_CONNECTORS;

                      if (typeof window !== "undefined" && window) {
                        window._FLUENT_.connectors = {
                          local: LOCAL_CONNECTORS,
                          remote: REMOTE_CONNECTORS,
                          merge: MERGE_CONNECTORS
                        };
                      }

                      if (typeof global !== "undefined" && global) {
                        global._FLUENT_.connectors = {
                          local: LOCAL_CONNECTORS,
                          remote: REMOTE_CONNECTORS,
                          merge: MERGE_CONNECTORS
                        };
                      }
                    },
                    getConfig: function getConfig() {
                      if (typeof window !== "undefined" && window) {
                        return window._FLUENT_;
                      }

                      if (typeof global !== "undefined" && global) {
                        return global._FLUENT_;
                      }
                    },
                    registerConnector: function registerConnector(_ref2) {
                      var type = _ref2.type,
                          connector = _ref2.connector;

                      if (!type || !connector) throw new Error('type and connector must be defined');
                      if (!['local', 'remote', 'merge'].includes(type)) throw new Error('type must be either local, remote or merge');

                      var ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_;
                      var connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : [];

                      if (connectors.length === 0) {
                        connector = _extends({}, connector, {
                          default: true
                        });

                        connectors.push(connector);
                        ctx.connectors[type] = connectors;
                        return;
                      }

                      if (connectors.find(function (o) {
                        return o.name === connector.name;
                      })) {
                        console.log("A " + type + " connector with the name '" + connector.name + "' already exists");
                        return;
                      }

                      connectors.push(connector);
                      ctx.connectors[type] = connectors;
                    },
                    deregisterConnector: function deregisterConnector(_ref3) {
                      var type = _ref3.type,
                          name = _ref3.name;

                      if (!type || !name) throw new Error('type and name must be defined');
                      if (!['local', 'remote', 'merge'].includes(type)) throw new Error('type must be either local, remote or merge');

                      var ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_;
                      var connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : [];

                      if (connectors.length === 0) return;

                      var filteredConnectors = connectors.filter(function (o) {
                        return o.name !== name;
                      });
                      ctx.connectors[type] = filteredConnectors;
                    }
                  }
                })();

                exports.default = Fluent;
                /* WEBPACK VAR INJECTION */
              }).call(this, __webpack_require__(4));

              /***/
            },
            /* 15 */
            /***/function (module, exports, __webpack_require__) {

              // More proper implementation would be
              // isDescriptor(obj) || isStamp(obj)
              // but there is no sense since stamp is function and function is object.
              module.exports = __webpack_require__(1);

              /***/
            },
            /* 16 */
            /***/function (module, exports) {

              module.exports = function isPlainObject(value) {
                return Boolean(value) && (typeof value === 'undefined' ? 'undefined' : _typeof2(value)) === 'object' && Object.getPrototypeOf(value) === Object.prototype;
              };

              /***/
            },
            /* 17 */
            /***/function (module, exports, __webpack_require__) {

              var compose = __webpack_require__(2);

              function createShortcut(propName) {
                return function (arg) {
                  'use strict';

                  var param = {};
                  param[propName] = arg;
                  return this && this.compose ? this.compose(param) : compose(param);
                };
              }

              var properties = createShortcut('properties');
              var staticProperties = createShortcut('staticProperties');
              var configuration = createShortcut('configuration');
              var deepProperties = createShortcut('deepProperties');
              var staticDeepProperties = createShortcut('staticDeepProperties');
              var deepConfiguration = createShortcut('deepConfiguration');
              var initializers = createShortcut('initializers');

              module.exports = compose({
                staticProperties: {
                  methods: createShortcut('methods'),

                  props: properties,
                  properties: properties,

                  statics: staticProperties,
                  staticProperties: staticProperties,

                  conf: configuration,
                  configuration: configuration,

                  deepProps: deepProperties,
                  deepProperties: deepProperties,

                  deepStatics: staticDeepProperties,
                  staticDeepProperties: staticDeepProperties,

                  deepConf: deepConfiguration,
                  deepConfiguration: deepConfiguration,

                  init: initializers,
                  initializers: initializers,

                  composers: createShortcut('composers'),

                  propertyDescriptors: createShortcut('propertyDescriptors'),

                  staticPropertyDescriptors: createShortcut('staticPropertyDescriptors')
                }
              });

              /***/
            },
            /* 18 */
            /***/function (module, exports) {

              module.exports = function isString(arg) {
                return typeof arg === 'string';
              };

              /***/
            },
            /* 19 */
            /***/function (module, exports, __webpack_require__) {

              var compose = __webpack_require__(2);
              var privates = new WeakMap(); // WeakMap works in IE11, node 0.12

              var makeProxyFunction = function makeProxyFunction(fn, name) {
                function proxiedFn() {
                  'use strict';

                  var fields = privates.get(this); // jshint ignore:line
                  return fn.apply(fields, arguments);
                }

                Object.defineProperty(proxiedFn, 'name', {
                  value: name,
                  configurable: true
                });

                return proxiedFn;
              };

              function initializer(_, opts) {
                var descriptor = opts.stamp.compose;
                var privateMethodNames = descriptor.deepConfiguration.Privatize.methods;

                var newObject = {}; // our proxy object
                privates.set(newObject, this);

                var methods = descriptor.methods;
                if (!methods) {
                  return newObject;
                }

                var methodNames = Object.keys(methods);
                for (var i = 0; i < methodNames.length; i++) {
                  var name = methodNames[i];
                  if (privateMethodNames.indexOf(name) < 0) {
                    // not private, thus wrap
                    newObject[name] = makeProxyFunction(methods[name], name);
                  }
                }

                // Integration with @stamp/instanceof
                if (typeof Symbol !== "undefined") {
                  var stampSymbol = Symbol.for('stamp');
                  if (methods[stampSymbol]) {
                    newObject[stampSymbol] = opts.stamp;
                  }
                }

                return newObject;
              }

              var Privatize = compose({
                initializers: [initializer],
                deepConfiguration: { Privatize: { methods: [] } },
                staticProperties: {
                  privatizeMethods: function privatizeMethods() {
                    'use strict';

                    var methodNames = [];
                    for (var i = 0; i < arguments.length; i++) {
                      var arg = arguments[i];
                      if (typeof arg === 'string' && arg.length > 0) {
                        methodNames.push(arg);
                      }
                    }
                    var Stamp = this && this.compose ? this : Privatize;
                    return Stamp.compose({
                      deepConfiguration: {
                        Privatize: {
                          methods: methodNames
                        }
                      }
                    });
                  }
                },
                composers: [function (opts) {
                  var initializers = opts.stamp.compose.initializers;
                  // Keep our initializer the last to return proxy object
                  initializers.splice(initializers.indexOf(initializer), 1);
                  initializers.push(initializer);
                }]
              });

              module.exports = Privatize;

              /***/
            },
            /* 20 */
            /***/function (module, exports, __webpack_require__) {

              "use strict";

              Object.defineProperty(exports, "__esModule", {
                value: true
              });

              var _Interface = __webpack_require__(12);

              var _Interface2 = _interopRequireDefault(_Interface);

              function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : { default: obj };
              }

              function _asyncToGenerator(fn) {
                return function () {
                  var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {
                    function step(key, arg) {
                      try {
                        var info = gen[key](arg);var value = info.value;
                      } catch (error) {
                        reject(error);return;
                      }if (info.done) {
                        resolve(value);
                      } else {
                        return Promise.resolve(value).then(function (value) {
                          step("next", value);
                        }, function (err) {
                          step("throw", err);
                        });
                      }
                    }return step("next");
                  });
                };
              }

              exports.default = _Interface2.default.compose({
                properties: {
                  localFx: undefined,
                  remoteFx: undefined
                },
                init: function init(connectors) {
                  this.connectors = connectors;
                },

                methods: {
                  get: function get() {
                    var _this = this;

                    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
                      var localData, remoteData;
                      return regeneratorRuntime.wrap(function _callee$(_context) {
                        while (1) {
                          switch (_context.prev = _context.next) {
                            case 0:
                              _this.prepareMergedFunctions();
                              _context.next = 3;
                              return _this.localFx.get();

                            case 3:
                              localData = _context.sent;
                              _context.next = 6;
                              return _this.remoteFx.get();

                            case 6:
                              remoteData = _context.sent;
                              return _context.abrupt("return", localData.concat(remoteData));

                            case 8:
                            case "end":
                              return _context.stop();
                          }
                        }
                      }, _callee, _this);
                    }))();
                  },
                  prepareMergedFunctions: function prepareMergedFunctions() {
                    var _this2 = this;

                    this.localFx = this.connectors.local;
                    this.remoteFx = this.connectors.remote;

                    this.chainReference.forEach(function (chain) {
                      var method = chain.method;
                      var args = chain.args;

                      _this2.localFx = _this2.localFx[method](args);
                      _this2.remoteFx = _this2.remoteFx[method](args);
                    });
                  }
                }
              });

              /***/
            }]
            /******/)
          );
        });
        //# sourceMappingURL=goat-fluent.js.map
        /* WEBPACK VAR INJECTION */
      }).call(this, __webpack_require__(32)(module));

      /***/
    },
    /* 32 */
    /***/function (module, exports) {

      module.exports = function (module) {
        if (!module.webpackPolyfill) {
          module.deprecate = function () {};
          module.paths = [];
          // module.parent = undefined by default
          if (!module.children) module.children = [];
          Object.defineProperty(module, "loaded", {
            enumerable: true,
            get: function get() {
              return module.l;
            }
          });
          Object.defineProperty(module, "id", {
            enumerable: true,
            get: function get() {
              return module.i;
            }
          });
          module.webpackPolyfill = 1;
        }
        return module;
      };

      /***/
    },
    /* 33 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });

      var _Event = __webpack_require__(34);

      var _Event2 = _interopRequireDefault(_Event);

      var _axios = __webpack_require__(2);

      var _axios2 = _interopRequireDefault(_axios);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
      }

      /* eslint-disable no-unused-vars */
      var Connection = function () {
        var online = typeof window !== 'undefined' && window && window.navigator ? window.navigator.onLine : true;

        function setOnline() {
          if (!online) {
            online = true;
            _Event2.default.emit({
              name: 'FAST:CONNECTION:ONLINE',
              data: online,
              text: 'Application is now online'
            });
          }
        }

        function setOffline() {
          if (online) {
            online = false;
            _Event2.default.emit({
              name: 'FAST:CONNECTION:OFFLINE',
              data: online,
              text: 'Application is now offline'
            });
          }
        }

        /**
         * [status description]
         * @return {Promise} [description]
         */
        function initEventListeners() {
          _Event2.default.listen({
            name: 'online',
            callback: function callback() {
              console.log('App is now online');
              setOnline();
            }
          });
          _Event2.default.listen({
            name: 'offline',
            callback: function callback() {
              console.log('App is now offline');
              setOffline();
            }
          });
        }

        function isOnline() {
          return new Promise(function (resolve, reject) {
            _axios2.default.get('https://yesno.wtf/api').then(function (res) {
              resolve(true);
            }).catch(function (err) {
              resolve(false);
            });
          });
        }

        return Object.freeze({
          isOnline: isOnline,
          initEventListeners: initEventListeners
        });
      }();
      // import Promise from 'bluebird';
      exports.default = Connection;

      /***/
    },
    /* 34 */
    /***/function (module, exports, __webpack_require__) {

      "use strict";

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      var Event = function () {
        var CustomEvent = function CustomEvent(event, params) {
          var evt = document.createEvent('CustomEvent');

          params = params || { bubbles: false, cancelable: false, detail: undefined };

          evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
          return evt;
        };

        function emit(_ref) {
          var name = _ref.name,
              data = _ref.data,
              text = _ref.text;

          if (!name) throw new Error('Event must have a name.');
          if (!data) throw new Error('Event must have data.');
          if (!text) throw new Error('Event must have a text.');
          var customEvent = CustomEvent(name, {
            detail: {
              data: data,
              text: text
            }
          });

          window.dispatchEvent(customEvent);
        }
        function listen(_ref2) {
          var name = _ref2.name,
              callback = _ref2.callback;

          if (!name) throw new Error('Listener must have a name.');
          if (!callback) throw new Error('Listener must have a callback.');
          window.addEventListener(name, callback);
        }

        function remove(_ref3) {
          var name = _ref3.name,
              callback = _ref3.callback;

          if (!name) throw new Error('Listener must have a name to detach');
          if (!callback) throw new Error('Listener must have a callback to detach');
          window.removeEventListener(name, callback);
        }
        return Object.freeze({
          emit: emit,
          listen: listen,
          remove: remove
        });
      }();

      exports.default = Event;

      /***/
    }]
    /******/)
  );
});
//# sourceMappingURL=fluent-loopback.js.map
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(20)(module)))

/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _axios = __webpack_require__(7);

var _axios2 = _interopRequireDefault(_axios);

var _Event = __webpack_require__(9);

var _Event2 = _interopRequireDefault(_Event);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var ErrorHandler = function () {
  var parse = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(error) {
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.t0 = error.response.status;
              _context.next = _context.t0 === 400 ? 3 : _context.t0 === 440 ? 6 : 8;
              break;

            case 3:
              console.log("Bad request");
              _Event2.default.emit({
                name: "GOAT:SESSION:BADREQUEST",
                data: error,
                text: "Bad request"
              });
              return _context.abrupt("break", 10);

            case 6:
              _Event2.default.emit({
                name: "GOAT:SESSION:EXPIRED",
                data: error,
                text: "Session Expired"
              });
              return _context.abrupt("break", 10);

            case 8:
              console.log(error);
              return _context.abrupt("break", 10);

            case 10:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, undefined);
    }));

    return function parse(_x) {
      return _ref.apply(this, arguments);
    };
  }();
  var interceptAxios = function interceptAxios() {
    _axios2.default.interceptors.response.use(function (response) {
      return response;
    }, function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(error) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return parse(error);

              case 2:
                return _context2.abrupt("return", Promise.reject(error));

              case 3:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, undefined);
      }));

      return function (_x2) {
        return _ref2.apply(this, arguments);
      };
    }());
  };
  return Object.freeze({
    interceptAxios: interceptAxios
  });
}();

exports.default = ErrorHandler;

/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dayjs = __webpack_require__(4);

var _dayjs2 = _interopRequireDefault(_dayjs);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// import 'moment/min/locales';

var Moment = function () {
  function Moment() {
    _classCallCheck(this, Moment);
  }

  _createClass(Moment, null, [{
    key: "setLocales",
    value: function setLocales() {
      _dayjs2.default.locale(Moment.getLanguage());
    }
  }, {
    key: "changeLanguage",
    value: function changeLanguage(code) {
      _dayjs2.default.locale(code);
    }
  }, {
    key: "getLanguage",
    value: function getLanguage() {
      return _utilities2.default.getLanguage();
    }
  }]);

  return Moment;
}();

exports.default = Moment;

/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _v = __webpack_require__(86);

var _v2 = _interopRequireDefault(_v);

var _utilities = __webpack_require__(0);

var _utilities2 = _interopRequireDefault(_utilities);

var _Submission = __webpack_require__(10);

var _Submission2 = _interopRequireDefault(_Submission);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// import Promise from "bluebird";

var ParallelSurvey = function () {
  /**
   * Creates the Wizard object to have new user or new group
   * @param {*} param0
   */
  var createWizard = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_ref) {
      var submission = _ref.submission,
          vm = _ref.vm;
      var groupId;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              groupId = getGroupId(submission);

              if (!submissionHasGroup(groupId)) {
                _context.next = 3;
                break;
              }

              return _context.abrupt("return", Object.assign({}, getNewUserWizard(vm), { groupId: groupId }));

            case 3:
              return _context.abrupt("return", Object.assign({}, getNewGroupWizard(vm), { groupId: groupId }));

            case 4:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function createWizard(_x) {
      return _ref2.apply(this, arguments);
    };
  }();

  var createNewSurvey = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(_ref5) {
      var submission = _ref5.submission,
          vm = _ref5.vm,
          info = _ref5.info;
      var groupId;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              groupId = getGroupId(submission);

              if (!submissionHasGroup(groupId)) {
                _context2.next = 3;
                break;
              }

              return _context2.abrupt("return", prepareNewUserObject({ submission: submission, vm: vm, info: info }));

            case 3:
              return _context2.abrupt("return", prepareNewGroupObject({ submission: submission, vm: vm, info: info }));

            case 4:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    return function createNewSurvey(_x2) {
      return _ref6.apply(this, arguments);
    };
  }();

  var assignSelfId = function () {
    var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(created) {
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              console.log(created);

            case 1:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    return function assignSelfId(_x3) {
      return _ref7.apply(this, arguments);
    };
  }();

  function getNewGroupWizard(vm) {
    var progressSteps = ["1", "2", "3"];
    var steps = [{
      title: vm.$t("Group Name"),
      text: vm.$t("Give the group a name"),
      inputValidator: function inputValidator(value) {
        return new Promise(function (resolve, reject) {
          if (value !== "") {
            resolve();
          } else {
            var error = new Error(vm.$t("The group name is already taken"));

            reject(error);
          }
        });
      }
    }, {
      title: vm.$t("Current Participant Name"),
      text: vm.$t("Give the current participant a name")
    }, {
      title: vm.$t("Next participant Name"),
      text: vm.$t("Give the next participant a name")
    }];

    return { progressSteps: progressSteps, steps: steps };
  }

  function getNewUserWizard(vm) {
    var progressSteps = ["1"];
    var steps = [{
      title: vm.$t("Participant Name"),
      text: vm.$t("Give the next participant a name")
    }];

    return { progressSteps: progressSteps, steps: steps };
  }

  function getGroupId(submission) {
    var groupId = _utilities2.default.get(function () {
      return (0, _Submission2.default)().getParallelSurvey(submission).groupId;
    });

    return groupId;
  }

  function submissionHasGroup(groupId) {
    return !!groupId;
  }
  function prepareNewGroupObject(_ref3) {
    var submission = _ref3.submission,
        vm = _ref3.vm,
        info = _ref3.info;

    var groupName = info[0];
    var participantName = info[1];
    var nextParticipant = info[2];
    // Format the parallelSurvey object
    var parallelSurvey = {
      groupId: (0, _v2.default)(),
      groupName: groupName,
      participantName: participantName,
      submissionId: submission._id
    };

    // Store information of the parallelSurvey on the current submission
    vm.currentSubmission.parallelSurvey = (0, _Submission2.default)().setParallelSurvey(parallelSurvey);

    // New survey Information
    var surveyData = {
      parallelSurvey: (0, _Submission2.default)().setParallelSurvey(_extends({}, parallelSurvey, {
        participantName: nextParticipant
      }))
    };

    return surveyData;
  }

  function prepareNewUserObject(_ref4) {
    var submission = _ref4.submission,
        info = _ref4.info;

    var participantName = info[0];
    var parallelsurveyInfo = (0, _Submission2.default)().getParallelSurvey(submission);

    parallelsurveyInfo.participantName = participantName;
    // New survey Information
    var surveyData = {
      parallelSurvey: (0, _Submission2.default)().setParallelSurvey(parallelsurveyInfo)
    };

    return surveyData;
  }

  return Object.freeze({
    createWizard: createWizard,
    createNewSurvey: createNewSurvey,
    assignSelfId: assignSelfId
  });
}();

exports.default = ParallelSurvey;

/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

var rng = __webpack_require__(87);
var bytesToUuid = __webpack_require__(88);

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;


/***/ }),
/* 87 */
/***/ (function(module, exports) {

// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto
// implementation. Also, find the complete implementation of crypto on IE11.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}


/***/ }),
/* 88 */
/***/ (function(module, exports) {

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([bth[buf[i++]], bth[buf[i++]], 
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]]]).join('');
}

module.exports = bytesToUuid;


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // import Formio from 'formiojs/Formio';
// import offlinePlugin from 'offlinePlugin/offlinePlugin';


var _Submission = __webpack_require__(10);

var _Submission2 = _interopRequireDefault(_Submission);

var _Event = __webpack_require__(9);

var _Event2 = _interopRequireDefault(_Event);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// import Promise from 'bluebird';
var Import = function () {
  function Import() {
    _classCallCheck(this, Import);
  }

  _createClass(Import, null, [{
    key: "fromJsonFile",

    /**
     *
     * @param {*} file
     * @param {*} vm
     */
    value: function fromJsonFile(file, vm) {
      var reader = new FileReader();
      // Closure to capture the file information.

      reader.onload = function (theFile) {
        return function (e) {
          var json = void 0;

          try {
            json = JSON.parse(e.target.result);
          } catch (ex) {
            throw new Error("The Json file could not be parsed");
          }
          Import.parseJson(json, vm);
        };
      }(file);
      reader.readAsText(file);
    }
    /**
     *
     * @param {*} json
     * @param {*} vm
     */

  }, {
    key: "parseJson",
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(json, vm) {
        var formio;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                // let totalSubmissions = json.length;
                formio = Import.getFormIOInstance(vm);

                // Loading.show({ message: 'Importing ' + totalSubmissions + ' submissions' });
                // json = json.slice(151, 200);

                Promise.each(json, function () {
                  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(row, index) {
                    var submission;
                    return regeneratorRuntime.wrap(function _callee$(_context) {
                      while (1) {
                        switch (_context.prev = _context.next) {
                          case 0:
                            // await Uploader.sendDataToFormIO(row)
                            submission = Import.prepareSubmission(row);
                            _context.next = 3;
                            return Import.saveSubmission(submission, formio, vm);

                          case 3:
                          case "end":
                            return _context.stop();
                        }
                      }
                    }, _callee, this);
                  }));

                  return function (_x3, _x4) {
                    return _ref2.apply(this, arguments);
                  };
                }()).then(function () {
                  _Event2.default.emit({
                    name: "FAST:DATA:IMPORTED",
                    data: { imported: true },
                    text: "Data was imported"
                  });
                }).catch(function (error) {
                  // Loading.hide(error);
                  console.log(error);
                  vm.$swal(vm.$t("Import Error!"), vm.$t("Your submission could not be Imported. Please check the format of your Json file."), "error");
                });

              case 2:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function parseJson(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return parseJson;
    }()
  }, {
    key: "emitNotification",
    value: function emitNotification(vm) {
      vm.$eventHub.emit("FAST-DATA_IMPORTED");
    }
    /**
     *
     * @param {*} row
     */

  }, {
    key: "prepareSubmission",
    value: function prepareSubmission(row) {
      if (row.id || row._id) {
        delete row.id;
        delete row._id;
      }
      if (row.modified) {
        delete row.modified;
      }
      if (row.owner) {
        delete row.owner;
      }
      var data = row.data ? row.data : row;
      var formSubmission = {
        data: data,
        redirect: false,
        syncError: false,
        draft: true,
        trigger: "importSubmission"
      };

      return formSubmission;
    }
    /**
     *
     * @param {*} vm
     */
    /*
    static getFormIOInstance (vm) {
      Formio.deregisterPlugin('offline');
      Formio.registerPlugin(offlinePlugin.getPlugin(vm.form.data.path, undefined, false), 'offline');
      let APP_URL = vm.$FAST_CONFIG.APP_URL;
      let formUrl = APP_URL + '/' + vm.form.data.path;
      let formio = new Formio(formUrl);
       return formio;
    }
    */
    /**
     *
     * @param {*} vm
     */

  }, {
    key: "saveSubmission",
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(submission, formio, vm) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return (0, _Submission2.default)("*").add({ submission: submission, formio: formio });

              case 2:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function saveSubmission(_x5, _x6, _x7) {
        return _ref3.apply(this, arguments);
      }

      return saveSubmission;
    }()
  }]);

  return Import;
}();

exports.default = Import;

/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _getRequest = __webpack_require__(91);

var _getRequest2 = _interopRequireDefault(_getRequest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var OFFLINE_PLUGIN = function () {
  function OFFLINE_PLUGIN() {
    _classCallCheck(this, OFFLINE_PLUGIN);
  }

  _createClass(OFFLINE_PLUGIN, null, [{
    key: 'get',
    value: function get() {
      var _this = this;

      var plugin = {
        priority: 0,
        preRequest: function () {
          var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(args) {
            return regeneratorRuntime.wrap(function _callee$(_context) {
              while (1) {
                switch (_context.prev = _context.next) {
                  case 0:
                    if (!(args.method === 'GET')) {
                      _context.next = 2;
                      break;
                    }

                    return _context.abrupt('return', _getRequest2.default.handle(args));

                  case 2:
                  case 'end':
                    return _context.stop();
                }
              }
            }, _callee, _this);
          }));

          function preRequest(_x) {
            return _ref.apply(this, arguments);
          }

          return preRequest;
        }(),
        request: function () {
          var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(args) {
            return regeneratorRuntime.wrap(function _callee2$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    if (!(args.method === 'GET')) {
                      _context2.next = 2;
                      break;
                    }

                    return _context2.abrupt('return', _getRequest2.default.handle(args));

                  case 2:
                  case 'end':
                    return _context2.stop();
                }
              }
            }, _callee2, _this);
          }));

          function request(_x2) {
            return _ref2.apply(this, arguments);
          }

          return request;
        }(),
        staticRequest: function () {
          var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(args) {
            return regeneratorRuntime.wrap(function _callee3$(_context3) {
              while (1) {
                switch (_context3.prev = _context3.next) {
                  case 0:
                    if (!(args.method === 'GET')) {
                      _context3.next = 2;
                      break;
                    }

                    return _context3.abrupt('return', _getRequest2.default.handle(args));

                  case 2:
                  case 'end':
                    return _context3.stop();
                }
              }
            }, _callee3, _this);
          }));

          function staticRequest(_x3) {
            return _ref3.apply(this, arguments);
          }

          return staticRequest;
        }()
      };

      return plugin;
    }
  }]);

  return OFFLINE_PLUGIN;
}();

exports.default = OFFLINE_PLUGIN;

/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Form = __webpack_require__(5);

var _Form2 = _interopRequireDefault(_Form);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GetRequest = function () {
  function GetRequest() {
    _classCallCheck(this, GetRequest);
  }

  _createClass(GetRequest, null, [{
    key: 'handle',

    /**
     *
     * @param {*} args
     */
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(args) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!(args.url.indexOf('form.io') === -1)) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt('return', GetRequest.handleExternalAPI(args));

              case 2:
                if (!(args.type === 'form')) {
                  _context.next = 4;
                  break;
                }

                return _context.abrupt('return', GetRequest.handleLocalForm(args));

              case 4:
                if (!(args.type === 'select' && args.url.indexOf('form.io') !== -1)) {
                  _context.next = 6;
                  break;
                }

                return _context.abrupt('return', GetRequest.handleInternalResource(args));

              case 6:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function handle(_x) {
        return _ref.apply(this, arguments);
      }

      return handle;
    }()
    /**
     *
     */

  }, {
    key: 'handleExternalAPI',
    value: function handleExternalAPI() {
      // TODO
      return null;
    }
    /**
     *
     * @param {*} args
     */

  }, {
    key: 'handleLocalForm',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(args) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return _Form2.default.local().where('data.path', '=', args.formio.formId).first();

              case 2:
                return _context2.abrupt('return', _context2.sent);

              case 3:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function handleLocalForm(_x2) {
        return _ref2.apply(this, arguments);
      }

      return handleLocalForm;
    }()
    /**
     *
     * @param {*} args
     */

  }, {
    key: 'handleInternalResource',
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(args) {
        var formID, form;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                return _context3.abrupt('return', null);

              case 4:
                form = _context3.sent;


                form = form.filter(function (f) {
                  return f.data._id === formID;
                })[0];

                if (form) {
                  _context3.next = 8;
                  break;
                }

                return _context3.abrupt('return');

              case 8:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function handleInternalResource(_x3) {
        return _ref3.apply(this, arguments);
      }

      return handleInternalResource;
    }()
  }]);

  return GetRequest;
}();

exports.default = GetRequest;

/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _md = __webpack_require__(34);

var _md2 = _interopRequireDefault(_md);

var _Configuration = __webpack_require__(2);

var _Configuration2 = _interopRequireDefault(_Configuration);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Hash = function () {
  function Hash() {
    _classCallCheck(this, Hash);
  }

  _createClass(Hash, null, [{
    key: 'string',
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_string) {
        var config, hashed;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return _Configuration2.default.local().first();

              case 2:
                config = _context.sent;
                hashed = '';


                hashed = (0, _md2.default)(_string, config.MD5_KEY);
                return _context.abrupt('return', hashed);

              case 6:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function string(_x) {
        return _ref.apply(this, arguments);
      }

      return string;
    }()
  }]);

  return Hash;
}();

exports.default = Hash;

/***/ })
/******/ ]);
});
//# sourceMappingURL=goatjs.js.map