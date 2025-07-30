import type {
  HttpError,
  HttpErrorData,
  HttpErrorResponse,
} from '@goatlab/js-utils'
import type Express from 'express'
import { Errors, Inspect, Objects } from '@goatlab/js-utils'
import type { SentryService } from '../sentry/sentry.service'

export interface GenericErrorMiddlewareCfg {
  sentryService?: SentryService

  /**
   * Defaults to false.
   * So, by default, it will report ALL errors, not only 5xx.
   */
  reportOnly5xx?: boolean
}

const { APP_ENV } = process.env
const includeErrorStack = APP_ENV !== 'prod' && APP_ENV !== 'test'

// Hacky way to store the sentryService, so it's available to `respondWithError` function
let sentryService: SentryService | undefined
let reportOnly5xx = false

/**
 * Generic error handler.
 * Returns HTTP code based on err.data.httpStatusCode (default to 500).
 * Sends json payload as ErrorResponse, transformed via errorSharedUtil.
 */
export function genericErrorMiddleware(
  cfg: GenericErrorMiddlewareCfg = {},
): any {
  sentryService ||= cfg.sentryService
  reportOnly5xx = cfg.reportOnly5xx ?? false

  return (
    error: Error,
    request: Express.Request,
    res: Express.Response,
    _next: Express.NextFunction,
  ) => {
    respondWithError(request, res, error)
  }
}

export function respondWithError(
  request: Express.Request,
  res: Express.Response,
  error: any,
): void {
  const { headersSent } = res
  if (headersSent) {
    console.error(`after headersSent`, error)
  } else {
    console.error(error)
  }

  const originalError = Errors.anyToError(error, Error, {
    stringifyFn: Inspect.anyStringifyFn,
  })

  let errorId: string | undefined

  if (sentryService && shouldReportToSentry(originalError)) {
    errorId = sentryService.captureException(originalError, false)
  }

  if (res.headersSent) return

  const httpError = Errors.errorToErrorObject<HttpErrorData>(
    originalError,
    includeErrorStack,
  )

  httpError.data.errorId = errorId
  // Check if error has a status or statusCode property (from Express errors like PayloadTooLargeError)
  if (!httpError.data.httpStatusCode && originalError) {
    httpError.data.httpStatusCode = (originalError as any).status || (originalError as any).statusCode
  }
  httpError.data.httpStatusCode ||= 500 // Default to 500
  httpError.data.headersSent = headersSent || undefined
  httpError.data.report ||= undefined // Set to undefined if false
  Objects.filterUndefinedValues(httpError.data, true)

  res.status(httpError.data.httpStatusCode).json({
    error: httpError,
  } as HttpErrorResponse)
}

function shouldReportToSentry(error: Error): boolean {
  const e = error as HttpError

  // By default - report
  if (!e.data) return true

  // If `report` is set - do as it says
  if (e.data.report === true) return true
  if (e.data.report === false) return false

  // Report if http 5xx, otherwise not
  // If no httpCode - report
  // if httpCode >= 500 - report
  // Otherwise - report, unless !reportOnly5xx is set
  return (
    !reportOnly5xx || !e.data.httpStatusCode || e.data.httpStatusCode >= 500
  )
}
