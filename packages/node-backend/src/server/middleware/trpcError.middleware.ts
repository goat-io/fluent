import type { HttpError } from '@goatlab/js-utils'
import { Errors, Inspect } from '@goatlab/js-utils'
import { magenta, red } from 'kleur/colors'
import type { SentryService } from '../sentry/sentry.service'

// dist/@trpc/server/http
const reportOnly5xx = false

export function trpcErrorMiddleware({
  error,
  sentryService,
}: { sentryService: SentryService } & any): void {
  const originalError = Errors.anyToError(error, Error, {
    stringifyFn: Inspect.anyStringifyFn,
  })

  let errorId: string | undefined

  if (sentryService && shouldReportToSentry(originalError)) {
    errorId = sentryService.captureException(originalError, false)
  }

  console.log(errorId)

  const errorMessage = `${magenta('Error')}: ${red(error.code)} | ${
    error.message
  }`

  console.log(originalError)
  console.error(errorMessage)
  console.log(error.cause)
}

function shouldReportToSentry(error: Error): boolean {
  const e = error as HttpError

  // By default - report
  if (!e.data) {
    return true
  }

  // If `report` is set - do as it says
  if (e.data.report === true) {
    return true
  }
  if (e.data.report === false) {
    return false
  }

  // Report if http 5xx, otherwise not
  // If no httpCode - report
  // if httpCode >= 500 - report
  // Otherwise - report, unless !reportOnly5xx is set
  return (
    !reportOnly5xx || !e.data.httpStatusCode || e.data.httpStatusCode >= 500
  )
}
