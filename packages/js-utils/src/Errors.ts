import {
  anyToError,
  anyToErrorObject,
  errorDataAppend,
  errorObjectToAppError,
  errorObjectToError,
  errorToErrorObject,
  isErrorObject,
  isHttpErrorObject,
  isHttpErrorResponse
} from './Errors/error.util'

class ErrorsClass {
  anyToError = anyToError

  anyToErrorObject = anyToErrorObject

  errorToErrorObject = errorToErrorObject

  errorObjectToAppError = errorObjectToAppError

  errorObjectToError = errorObjectToError

  isHttpErrorResponse = isHttpErrorResponse

  isHttpErrorObject = isHttpErrorObject

  isErrorObject = isErrorObject

  errorDataAppend = errorDataAppend
}

export const Errors = new ErrorsClass()
