(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("@goatlab/fluent-loopback", [], factory);
	else if(typeof exports === 'object')
		exports["@goatlab/fluent-loopback"] = factory();
	else
		root["@goatlab/fluent-loopback"] = factory();
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
/******/ 	return __webpack_require__(__webpack_require__.s = 8);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

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
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

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

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(15)))

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(12);

/***/ }),
/* 3 */
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
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(0);
var settle = __webpack_require__(17);
var buildURL = __webpack_require__(19);
var parseHeaders = __webpack_require__(20);
var isURLSameOrigin = __webpack_require__(21);
var createError = __webpack_require__(5);
var btoa = (typeof window !== 'undefined' && window.btoa && window.btoa.bind(window)) || __webpack_require__(22);

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
      var cookies = __webpack_require__(23);

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
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};


/***/ }),
/* 7 */
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
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _LoopbackConnector = __webpack_require__(9);

var _LoopbackConnector2 = _interopRequireDefault(_LoopbackConnector);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _LoopbackConnector2.default;

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _awaitToJs = __webpack_require__(10);

var _awaitToJs2 = _interopRequireDefault(_awaitToJs);

var _Utilities = __webpack_require__(11);

var _Utilities2 = _interopRequireDefault(_Utilities);

var _axios = __webpack_require__(2);

var _axios2 = _interopRequireDefault(_axios);

var _goatFluent = __webpack_require__(31);

var _Connection = __webpack_require__(33);

var _Connection2 = _interopRequireDefault(_Connection);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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

/***/ }),
/* 10 */
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
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


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

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 13 */
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
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

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
/* 15 */
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
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

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
/* 18 */
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
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(0);

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
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(0);

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
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(0);

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
/* 22 */
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
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var utils = __webpack_require__(0);

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
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

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
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 27 */
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
/* 28 */
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
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 30 */
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
/* 31 */
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
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(32)(module)))

/***/ }),
/* 32 */
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
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Event = __webpack_require__(34);

var _Event2 = _interopRequireDefault(_Event);

var _axios = __webpack_require__(2);

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

/***/ }),
/* 34 */
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

/***/ })
/******/ ]);
});
//# sourceMappingURL=fluent-loopback.js.map