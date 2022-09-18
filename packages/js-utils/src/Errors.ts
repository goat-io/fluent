import {
  _anyToError,
  _anyToErrorObject,
  _errorDataAppend,
  _errorObjectToAppError,
  _errorObjectToError,
  _errorToErrorObject,
  _isErrorObject,
  _isHttpErrorObject,
  _isHttpErrorResponse
} from './Errors/error.util'

class ErrorsClass {
  anyToError = _anyToError

  anyToErrorObject = _anyToErrorObject

  errorToErrorObject = _errorToErrorObject

  errorObjectToAppError = _errorObjectToAppError

  errorObjectToError = _errorObjectToError

  isHttpErrorResponse = _isHttpErrorResponse

  isHttpErrorObject = _isHttpErrorObject

  isErrorObject = _isErrorObject

  errorDataAppend = _errorDataAppend
}

export const Errors = new ErrorsClass()
