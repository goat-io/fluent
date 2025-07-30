import { jsonParseIfPossible } from '../Strings/json.util'
import { _stringifyAny } from '../Strings/stringifyAny'
import { StringifyAnyOptions } from '../Strings/stringifyOptions.model'
import type { Class } from '../types'
import { AppError } from './app.error'
import type {
  ErrorData,
  ErrorObject,
  HttpErrorData,
  HttpErrorResponse
} from './error.model'

/**
 * Useful to ensure that error in `catch (err) { ... }`
 * is indeed an Error (and not e.g `string` or `undefined`).
 * 99% of the cases it will be Error already.
 * Becomes more useful since TypeScript 4.4 made `err` of type `unknown` by default.
 *
 * Alternatively, if you're sure it's Error - you can use `_assertIsError(err)`.
 */
export function anyToError<ErrorType extends Error = Error>(
  o: any,
  errorClass: Class<ErrorType> = Error as any,
  opt?: StringifyAnyOptions
): ErrorType {
  if (o instanceof errorClass) {
    return o
  }

  // If it's an instance of Error, but ErrorClass is something else (e.g AppError) - it'll be "repacked" into AppError

  const errorObject = isErrorObject(o) ? o : anyToErrorObject(o, opt)
  return errorObjectToError(errorObject, errorClass)
}

/**
 * Converts "anything" to ErrorObject.
 * Detects if it's HttpErrorResponse, HttpErrorObject, ErrorObject, Error, etc..
 * If object is Error - Error.message will be used.
 * Objects (not Errors) get converted to prettified JSON string (via `_stringifyAny`).
 */
export function anyToErrorObject<DataType extends ErrorData = ErrorData>(
  o: any,
  opt?: StringifyAnyOptions
): ErrorObject<DataType> {
  if (o instanceof Error) {
    return errorToErrorObject<DataType>(o, opt?.includeErrorStack ?? true)
  }

  const parsed = jsonParseIfPossible(o)

  if (isHttpErrorResponse(parsed)) {
    return parsed.error as any
  }

  if (isErrorObject(parsed)) {
    return parsed as ErrorObject<DataType>
  }

  // Here we are sure it has no `data` property,
  // so, fair to return `data: {}` in the end
  // Also we're sure it includes no "error name", e.g no `Error: ...`,
  // so, fair to include `name: 'Error'`

  const message = _stringifyAny(parsed, {
    includeErrorData: true, // cause we're returning an ErrorObject, not a stringified error (yet)
    ...opt
  })

  return {
    name: 'Error',
    message,
    data: {} as DataType // empty
  }
}

export function errorToErrorObject<DataType extends ErrorData = ErrorData>(
  e: AppError<DataType> | Error,
  includeErrorStack = true
): ErrorObject<DataType> {
  const obj: ErrorObject<DataType> = {
    name: e.name,
    message: e.message,
    data: { ...(e as any).data } // empty by default
  }

  if (includeErrorStack) {
    obj.stack = e.stack
  }

  return obj
}

export function errorObjectToAppError<DataType extends ErrorData>(
  o: ErrorObject<DataType>
): AppError<DataType> {
  return errorObjectToError(o, AppError)
}

export function errorObjectToError<
  DataType extends ErrorData,
  ErrorType extends Error
>(
  o: ErrorObject<DataType>,
  errorClass: Class<ErrorType> = Error as any
): ErrorType {
  if (o instanceof errorClass) {
    return o
  }

  const err = new errorClass(o.message)
  // name: err.name, // cannot be assigned to a readonly property like this
  // stack: o.stack, // also readonly e.g in Firefox

  Object.defineProperty(err, 'name', {
    value: o.name,
    configurable: true
  })

  Object.defineProperty(err, 'data', {
    value: o.data,
    writable: true,
    configurable: true,
    enumerable: false
  })

  if (o.stack) {
    Object.defineProperty(err, 'stack', {
      value: o.stack
    })
  }

  return err
}

export function isHttpErrorResponse(o: any): o is HttpErrorResponse {
  return isHttpErrorObject(o?.error)
}

export function isHttpErrorObject(o: any): o is ErrorObject<HttpErrorData> {
  return (
    !!o &&
    typeof o.name === 'string' &&
    typeof o.message === 'string' &&
    typeof o.data?.httpStatusCode === 'number'
  )
}

/**
 * Note: any instance of AppError is also automatically an ErrorObject
 */
export function isErrorObject(o: any): o is ErrorObject {
  return (
    !!o &&
    typeof o.name === 'string' &&
    typeof o.message === 'string' &&
    typeof o.data === 'object'
  )
}

/**
 * Convenience function to safely add properties to Error's `data` object
 * (even if it wasn't previously existing)
 *
 * @example
 *
 * try {} catch (err) {
 *   _errorDataAppend(err, {
 *     httpStatusCode: 401,
 *   })
 * }
 */
export function errorDataAppend(err: any, data: ErrorData): void {
  err.data = {
    ...err.data,
    ...data
  }
}
