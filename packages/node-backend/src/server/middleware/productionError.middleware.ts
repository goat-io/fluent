import type { HttpError, HttpErrorData } from '@goatlab/js-utils'
import { Errors } from '@goatlab/js-utils'
import type { NextFunction, Request, Response } from 'express'
import type { Environment } from '../types/Envinronment'

/**
 * Sanitize error messages for production environment
 * Prevents leaking sensitive information in error responses
 */
export function sanitizeErrorForProduction(
  error: HttpError<HttpErrorData>
): HttpError<HttpErrorData> {
  const isProduction = (process.env.NODE_ENV as Environment) === 'prod'

  if (!isProduction) {
    return error // In development, return full error details
  }

  // Clone the error to avoid mutating the original
  const sanitizedError = { ...error }

  // For 5xx errors, hide internal details
  if (error.data?.httpStatusCode && error.data.httpStatusCode >= 500) {
    sanitizedError.message = 'Internal Server Error'
    sanitizedError.stack = undefined

    // Keep only safe data
    sanitizedError.data = {
      httpStatusCode: error.data.httpStatusCode,
      errorId: error.data.errorId,
      timestamp: new Date().toISOString()
    }
  } else if (error.data?.httpStatusCode && error.data.httpStatusCode >= 400) {
    // For 4xx errors, keep the message but remove stack traces
    sanitizedError.stack = undefined

    // Remove any potentially sensitive data
    if (sanitizedError.data) {
      const { httpStatusCode, errorId, message, code } = sanitizedError.data
      sanitizedError.data = {
        httpStatusCode,
        errorId,
        message: message || sanitizedError.message,
        code,
        timestamp: new Date().toISOString()
      }
    }
  }

  return sanitizedError
}

/**
 * Production-ready error handler middleware
 * Ensures no sensitive information is leaked in error responses
 */
export function productionErrorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // If headers are already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(err)
    }

    // Convert to error object
    const error = Errors.anyToError(err)
    const httpError = error as HttpError<HttpErrorData>

    // Sanitize the error for production
    const sanitizedError = sanitizeErrorForProduction(httpError)

    // Set default status code if not provided
    const statusCode = sanitizedError.data?.httpStatusCode || 500

    // Log the original error (for debugging)
    if (statusCode >= 500) {
      console.error('Server error:', {
        error: err,
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('user-agent')
        }
      })
    }

    // Send sanitized response
    res.status(statusCode).json({
      error: {
        message: sanitizedError.message,
        code: sanitizedError.data?.code,
        errorId: sanitizedError.data?.errorId,
        timestamp: sanitizedError.data?.timestamp || new Date().toISOString()
      }
    })
  }
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncErrorHandler(
  fn: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<unknown> | unknown
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
