import {
  CommonLogger,
  CommonLogLevel,
  Errors,
  Inspect
  // Memo,
} from '@goatlab/js-utils'
import type * as SentryLib from '@sentry/node'
// eslint-disable-next-line import/named
import { Breadcrumb, NodeOptions, SeverityLevel } from '@sentry/node'

export type SentryServiceConfig = Record<string, unknown> &
  NodeOptions & { logger?: CommonLogger }

const sentrySeverityMap: Record<SeverityLevel, CommonLogLevel> = {
  debug: 'log',
  info: 'log',
  log: 'log',
  warning: 'warn',
  error: 'error',
  fatal: 'error'
}

export class SentryService {
  constructor(private readonly config: SentryServiceConfig) {}

  //@Memo.syncMethod()
  sentry(): typeof SentryLib {
    // Lazy-loading `@sentry/node`
    const sentry = require('@sentry/node') as typeof SentryLib

    if (!this.config.dsn) {
      return sentry
    }

    console.log('SentryService init...')

    sentry.init({
      maxValueLength: 2000, // Default is 250 characters
      ...this.config
    })

    return sentry
  }

  init(): void {
    this.sentry()
  }

  /**
   * For GDPR reasons we never send more information than just User ID.
   */
  setUserId(id: string): void {
    this.sentry().getCurrentScope().setUser({
      id
    })
  }

  /**
   * Does console.error(err)
   * Returns "eventId" or undefined (if error was not reported).
   */
  captureException(error: any, logError = true): string | undefined {
    // Console.error(err)
    // Using request-aware logger here
    if (logError) {
      this.config.logger?.error('captureException:', error)
    }

    if (error?.data?.report === false) {
      // Skip reporting the error
      return
    }

    // This is to avoid Sentry cutting err.message to 253 characters
    // It will log additional "breadcrumb object" before the error
    // It's a Breadcrumb, not a console.log, because console.log are NOT automatically attached as Breadcrumbs in cron-job environments (outside of Express)
    this.sentry().addBreadcrumb({
      message: Inspect.any(error, {
        includeErrorData: true,
        colors: false
      })
      // Data: (err as AppError).data, // included in message
    })

    return this.sentry().captureException(
      Errors.anyToError(error, Error, {
        stringifyFn: Inspect.anyStringifyFn
      })
    )
  }

  /**
   * Returns "eventId"
   */
  captureMessage(message: string, level?: SeverityLevel): string {
    this.config.logger?.[sentrySeverityMap[level || 'error'] || 'log'](
      'captureMessage:',
      message
    )
    return this.sentry().captureMessage(message, level)
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.sentry().addBreadcrumb(breadcrumb)
  }

  /**
   * Currently it will only use `logger.error` ("error" level) and ignore `log` and `warn`.
   *
   * For each `logger.error` - it'll do a captureException.
   *
   * @experimental
   */
  getCommonLogger(): CommonLogger {
    return {
      log() {}, // Noop
      warn() {}, // Noop
      error: (...args) => {
        const message = args
          .map(arg =>
            Inspect.any(arg, {
              includeErrorData: true,
              colors: false
            })
          )
          .join(' ')

        this.sentry().addBreadcrumb({
          message
        })

        this.sentry().captureException(
          Errors.anyToError(args.length === 1 ? args[0] : args, Error, {
            stringifyFn: Inspect.anyStringifyFn
          })
        )
      }
    }
  }
}
