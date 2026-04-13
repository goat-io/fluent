import { Time } from '../Time'
import { inspectAny } from './inspectAny'
import type {
  BeforeErrorHook,
  BeforeRequestHook,
  BeforeRetryHook,
  KyInstance,
} from './ky'
import Ky from './ky'
import type { GetKyOptions, KyRequestContext } from './ky.model'

/**
 * Returns instance of Ky with "reasonable defaults":
 *
 * 1. Error handler hook that prints helpful errors.
 * 2. Hooks that log start/end of request (optional, false by default).
 * 3. Reasonable defaults(tm), e.g non-infinite Timeout
 */
export function getKy(opt: GetKyOptions = {}): KyInstance {
  if (opt.debug) {
    opt.logStart = opt.logFinished = opt.logResponse = opt.logRequest = true
  }

  return Ky.extend({
    timeout: 60_000,
    ...opt,
    hooks: {
      ...opt.hooks,
      beforeError: [
        ...(opt.hooks?.beforeError || []),
        // User hooks go BEFORE
        gotErrorHook(opt),
      ],
      beforeRequest: [
        gotBeforeRequestHook(opt),
        // User hooks go AFTER
        ...(opt.hooks?.beforeRequest || []),
      ],
      beforeRetry: [
        gotBeforeRetryHook(opt),
        // User hooks go AFTER
        ...(opt.hooks?.beforeRetry || []),
      ],
      afterResponse: [
        ...(opt.hooks?.afterResponse || []),
        // User hooks go BEFORE
        //keyAfterResponseHook(opt)
      ],
    },
  })
}

function gotErrorHook(opt: GetKyOptions = {}): BeforeErrorHook {
  const { maxResponseLength = 10_000, logger = console } = opt

  return err => {
    // Defensive Programming
    if (!err || !err.options) {
      logger.error('Unexpected error:', err)
      return err
    }

    const statusCode = err.response?.status || 0
    const { method, prefixUrl } = err.options
    const url = err.request.url as any

    let shortUrl: string

    // Error Handling
    try {
      shortUrl = getShortUrl(
        opt,
        url instanceof URL ? url : new URL(url),
        (prefixUrl as any) instanceof URL ? prefixUrl.toString() : prefixUrl,
      )
    } catch (_e) {
      logger.error('Invalid URL:', url)
      shortUrl = url
    }

    const context = (err.options.context || {
      started: Date.now(),
    }) as KyRequestContext
    const { started, retryCount } = context

    const body = err.response?.body
      ? inspectAny(err.response.body, {
          maxLen: maxResponseLength,
        })
      : err.message

    // We don't include Response/Body/Message in the log, because it's included in the Error thrown from here
    logger.log(
      [
        ' <<',
        statusCode,
        method,
        shortUrl,
        retryCount && `(retry ${retryCount})`,
        'error',
        started && `in ${Time.since(started)}`,
      ]
        .filter(Boolean)
        .join(' '),
    )

    // timings are not part of err.message to allow automatic error grouping in Sentry
    // Colors are not used, because there's high chance that this Error will be propagated all the way to the Frontend
    err.message = [
      [statusCode, method, shortUrl].filter(Boolean).join(' '),
      body,
    ]
      .filter(Boolean)
      .join('\n')

    const stack = err.stack

    if (stack) {
      const originalStack = err.stack.split('\n')
      let originalStackIndex = originalStack.findIndex(line =>
        line.includes(' at '),
      )
      if (originalStackIndex === -1) {
        originalStackIndex = originalStack.length - 1
      }

      // Skipping first line as it has RequestError: ...
      // Skipping second line as it's known to be from e.g at got_1.default.extend.handlers
      const syntheticStack = stack.split('\n').slice(2)
      let firstNonNodeModulesIndex = syntheticStack.findIndex(
        line => !line.includes('node_modules'),
      )
      if (firstNonNodeModulesIndex === -1) {
        firstNonNodeModulesIndex = 0
      }

      err.stack = [
        // First lines of original error
        ...originalStack.slice(0, originalStackIndex),
        // Other lines from "Synthetic error"
        ...syntheticStack.slice(firstNonNodeModulesIndex),
      ].join('\n')
      // err.stack += '\n    --' + stack.replace('Error: RequestError', '')
    }

    return err
  }
}

function gotBeforeRequestHook(opt: GetKyOptions): BeforeRequestHook {
  const { logger = console } = opt

  return (request, options) => {
    if (!options.context.started) {
      options.context.started = Date.now()
    }

    if (opt.logStart) {
      const { retryCount } = options.context as KyRequestContext

      let shortUrl: string

      // Error Handling
      try {
        shortUrl = getShortUrl(
          opt,
          (request.url as any) instanceof URL
            ? (request.url as any)
            : new URL(request.url),
          (options.prefixUrl as any) instanceof URL
            ? options.prefixUrl.toString()
            : options.prefixUrl,
        )
      } catch (_e) {
        logger.error('Invalid URL:', request.url)
        shortUrl = request.url
      }

      logger.log(
        [' >>', options.method, shortUrl, retryCount && `(retry ${retryCount})`]
          .filter(Boolean)
          .join(' '),
      )
    }

    if (opt.logRequest) {
      const body = request.body

      if (body) {
        logger.log(body)
      }
    }

    return undefined
  }
}

/**
 * Returns a before retry hook for 'got' HTTP client library.
 *
 * @param opt - The options for the got HTTP client
 * @returns The before retry hook
 */
function gotBeforeRetryHook(opt: GetKyOptions): BeforeRetryHook {
  const { maxResponseLength = 10_000, logger = console } = opt

  return async ({ error, request, retryCount, options }) => {
    const url = request.url
    const { method, prefixUrl } = options

    let shortUrl: string

    // Safely construct shortUrl
    try {
      const urlObject = new URL(url)
      const prefixUrlString = prefixUrl
      shortUrl = getShortUrl(opt, urlObject, prefixUrlString)
    } catch (_e) {
      logger.error('Invalid URL:', url)
      shortUrl = url
    }

    // Ensure started exists in context
    if (!options.context.started) {
      options.context.started = Date.now()
    }

    const { started } = options.context as KyRequestContext

    // Update context with retry count
    options.context.retryCount = retryCount

    // Construct body message
    const body = error.message
      ? inspectAny(error, {
          maxLen: maxResponseLength,
        })
      : error.message

    // Construct and log the warning message
    const messageParts = [
      ' <<',
      method,
      shortUrl,
      retryCount && retryCount > 1
        ? `(retry ${retryCount - 1})`
        : '(first try)',
      'error',
      started && `in ${Time.since(started)}`,
      body,
    ]
    const message = messageParts.filter(Boolean).join(' ')

    logger.warn(message)

    // BeforeRetryHook should return undefined or ky.stop symbol
    return undefined
  }
}

/**
 * Returns an after response hook for 'got' HTTP client library.
 *
 * @param opt - The options for the got HTTP client
 * @returns The after response hook
 */
// function keyAfterResponseHook(opt: GetKyOptions = {}): AfterResponseHook {
//   return (request, options, resp ) => {
//     const success = resp.status >= 200 && resp.status < 400

//     // Errors are not logged here, as they're logged by kyErrorHook
//     if (opt.logFinished && success) {
//       const requestOptions = options
//       options.
//       // Ensure context exists
//       if (!requestOptions.context) {
//         requestOptions.context = {}
//       }

//       const { started, retryCount } = requestOptions.context as KyRequestContext
//       const { url, prefixUrl, method } = requestOptions
//       let shortUrl: string

//       try {
//         const urlObject = url instanceof URL ? url : new URL(url)
//         const prefixUrlString =
//           prefixUrl instanceof URL ? prefixUrl.toString() : prefixUrl
//         shortUrl = getShortUrl(opt, urlObject, prefixUrlString)
//       } catch (e) {
//         console.error('Invalid URL:', url)
//         shortUrl = url
//       }

//       const logParts = [
//         ' <<',
//         resp.status,
//         method,
//         shortUrl,
//         retryCount && `(retry ${retryCount - 1})`,
//         started && 'in ' + Time.since(started)
//       ]
//       const logMessage = logParts.filter(Boolean).join(' ')

//       console.log(logMessage)
//     }

//     // Error responses are not logged, cause they're included in Error message already
//     if (opt.logResponse && success) {
//       console.log(inspectAny(resp.body, { maxLen: opt.maxResponseLength }))
//     }

//     return resp
//   }
// }

/**
 * Returns a shortened URL based on given options.
 *
 * @param opt - The options for getting the shortened URL
 * @param url - The URL to be shortened
 * @param prefixUrl - The prefix URL to be removed if option is set
 * @returns The shortened URL as a string
 */
export function getShortUrl(
  opt: GetKyOptions,
  url: URL,
  prefixUrl?: string,
): string {
  // Copy the URL and redact password if it exists
  let urlToUse = url
  if (url.password) {
    const redactedUrl = new URL(url.toString())
    redactedUrl.password = '[redacted]'
    urlToUse = redactedUrl
  }

  // Remove search params if the option is set
  let shortUrl: string =
    opt.logWithSearchParams === false
      ? urlToUse.toString().split('?')[0]!
      : urlToUse.toString()

  // Remove prefix if the option is set and the URL starts with the prefix
  if (
    opt.logWithPrefixUrl === false &&
    prefixUrl &&
    shortUrl.startsWith(prefixUrl)
  ) {
    shortUrl = shortUrl.slice(prefixUrl.length)
  }

  return shortUrl
}
