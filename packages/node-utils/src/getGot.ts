import { URL } from 'url'
import { Time } from '@goatlab/js-utils'
import { got } from 'got-cjs'
import type {
  Got,
  AfterResponseHook,
  BeforeErrorHook,
  BeforeRequestHook,
  BeforeRetryHook
} from 'got-cjs'
import { inspectAny } from './Got/inspectAny'
import { GetGotOptions, GotRequestContext } from './Got/got.model'

/**
 * Returns instance of Got with "reasonable defaults":
 *
 * 1. Error handler hook that prints helpful errors.
 * 2. Hooks that log start/end of request (optional, false by default).
 * 3. Reasonable defaults(tm), e.g non-infinite Timeout
 * 4. Preserves error stack traces (!) (experimental!)
 */
export function getGot(opt: GetGotOptions = {}): Got {
  if (opt.debug) {
    opt.logStart = opt.logFinished = opt.logResponse = opt.logRequest = true
  }

  return got.extend({
    // Most-important is to set to anything non-empty (so, requests don't "hang" by default).
    // Should be long enough to handle for slow responses from scaled cloud APIs in times of spikes
    // Ideally should be LESS than default Request timeout in backend-lib (so, it has a chance to error
    // before server times out with 503).
    //
    // UPD 2021-11-27
    // There are 2 types/strategies for requests:
    // 1. Optimized to get result no matter what. E.g in Cron jobs, where otherwise there'll be a job failure
    // 2. Part of the Backend request, where we better retry quickly and fail on timeout before Backend aborts it with "503 Request timeout"
    //
    // Here it's hard to set the default timeout right for both use-cases.
    // So, if it's important, you should override it according to your use-cases:
    // - set it longer for Type 1 (e.g 120 seconds)
    // - set it shorter for Type 2 (e.g 10/20 seconds)
    // Please beware of default Retry strategy of Got:
    // by default it will retry 2 times (after first try)
    // First delay between tries will be ~1 second, then ~2 seconds
    // Each retry it'll wait up to `timeout` (so, up to 60 seconds by default).
    // So, for 3 tries it multiplies your timeout by 3 (+3 seconds between the tries).
    // So, e.g 60 seconds timeout with 2 retries becomes up to 183 seconds.
    // Which definitely doesn't fit into default "RequestTimeout"
    timeout: {
      response: 60_000
    },
    ...opt,
    handlers: [
      (options, next) => {
        options.context = {
          ...options.context,
          started: Date.now(),
          // This is to preserve original stack trace
          // https://github.com/sindresorhus/got/blob/main/documentation/async-stack-traces.md
          err: new Error('RequestError')
        } as GotRequestContext

        return next(options)
      }
    ],
    hooks: {
      ...opt.hooks,
      beforeError: [
        ...(opt.hooks?.beforeError || []),
        // User hooks go BEFORE
        gotErrorHook(opt)
      ],
      beforeRequest: [
        gotBeforeRequestHook(opt),
        // User hooks go AFTER
        ...(opt.hooks?.beforeRequest || [])
      ],
      beforeRetry: [
        gotBeforeRetryHook(opt),
        // User hooks go AFTER
        ...(opt.hooks?.beforeRetry || [])
      ],
      afterResponse: [
        ...(opt.hooks?.afterResponse || []),
        // User hooks go BEFORE
        gotAfterResponseHook(opt)
      ]
    }
  })
}

function gotErrorHook(opt: GetGotOptions = {}): BeforeErrorHook {
  const { maxResponseLength = 10_000 } = opt

  return err => {
    // Defensive Programming
    if (!err || !err.options) {
      console.error('Unexpected error:', err)
      return err
    }

    const statusCode = err.response?.statusCode || 0
    const { method, url, prefixUrl } = err.options

    let shortUrl

    // Error Handling
    try {
      shortUrl = getShortUrl(
        opt,
        url instanceof URL ? url : new URL(url),
        prefixUrl instanceof URL ? prefixUrl.toString() : prefixUrl
      )
    } catch (e) {
      console.error('Invalid URL:', url)
      shortUrl = url
    }

    const context = err.request?.options?.context || {}
    const { started, retryCount } = context as GotRequestContext
    if (!context) {
      console.error(
        'Context is not defined in the request options:',
        err.request?.options
      )
      return err
    }

    const body = err.response?.body
      ? inspectAny(err.response.body, {
          maxLen: maxResponseLength,
          colors: false
        })
      : err.message

    // We don't include Response/Body/Message in the log, because it's included in the Error thrown from here
    console.log(
      [
        ' <<',
        statusCode,
        method,
        shortUrl,
        retryCount && `(retry ${retryCount})`,
        'error',
        started && 'in ' + Time.since(started)
      ]
        .filter(Boolean)
        .join(' ')
    )

    // timings are not part of err.message to allow automatic error grouping in Sentry
    // Colors are not used, because there's high chance that this Error will be propagated all the way to the Frontend
    err.message = [
      [statusCode, method, shortUrl].filter(Boolean).join(' '),
      body
    ]
      .filter(Boolean)
      .join('\n')

    const stack = (err.options.context as GotRequestContext)?.err?.stack
    if (stack) {
      const originalStack = err.stack.split('\n')
      let originalStackIndex = originalStack.findIndex(line =>
        line.includes(' at ')
      )
      if (originalStackIndex === -1)
        originalStackIndex = originalStack.length - 1

      // Skipping first line as it has RequestError: ...
      // Skipping second line as it's known to be from e.g at got_1.default.extend.handlers
      const syntheticStack = stack.split('\n').slice(2)
      let firstNonNodeModulesIndex = syntheticStack.findIndex(
        line => !line.includes('node_modules')
      )
      if (firstNonNodeModulesIndex === -1) firstNonNodeModulesIndex = 0

      err.stack = [
        // First lines of original error
        ...originalStack.slice(0, originalStackIndex),
        // Other lines from "Synthetic error"
        ...syntheticStack.slice(firstNonNodeModulesIndex)
      ].join('\n')
      // err.stack += '\n    --' + stack.replace('Error: RequestError', '')
    }

    return err
  }
}

function gotBeforeRequestHook(opt: GetGotOptions): BeforeRequestHook {
  return options => {
    // If options or options.context are not defined, log an error and exit early.
    if (!options || !options.context) {
      console.error('Unexpected options:', options)
      return
    }

    if (opt.logStart) {
      const { retryCount } = options.context as GotRequestContext

      let shortUrl

      // Error Handling
      try {
        shortUrl = getShortUrl(
          opt,
          options.url instanceof URL ? options.url : new URL(options.url),
          options.prefixUrl instanceof URL
            ? options.prefixUrl.toString()
            : options.prefixUrl
        )
      } catch (e) {
        console.error('Invalid URL:', options.url)
        shortUrl = options.url
      }

      console.log(
        [' >>', options.method, shortUrl, retryCount && `(retry ${retryCount})`]
          .filter(Boolean)
          .join(' ')
      )
    }

    if (opt.logRequest) {
      const body = options.json || options.body

      if (body) {
        console.log(body)
      }
    }
  }
}

/**
 * Returns a before retry hook for 'got' HTTP client library.
 *
 * @param opt - The options for the got HTTP client
 * @returns The before retry hook
 */
function gotBeforeRetryHook(opt: GetGotOptions): BeforeRetryHook {
  const { maxResponseLength = 10_000 } = opt

  return async (err, retryCount) => {
    const statusCode = err?.response?.statusCode || 0

    // Skip hook for successful status codes
    if (statusCode && statusCode < 300) {
      return
    }

    const { method, url, prefixUrl } = opt
    let shortUrl

    // Safely construct shortUrl
    try {
      const urlObject = url instanceof URL ? url : new URL(url)
      const prefixUrlString =
        prefixUrl instanceof URL ? prefixUrl.toString() : prefixUrl
      shortUrl = getShortUrl(opt, urlObject, prefixUrlString)
    } catch (e) {
      console.error('Invalid URL:', url)
      shortUrl = url
    }

    // Ensure opt.context exists
    if (!opt.context) {
      opt.context = {}
    }
    const { started } = opt.context as GotRequestContext
    opt.context = { ...opt.context, retryCount }

    // Construct body message
    const body = err?.response?.body
      ? inspectAny(err.response.body, {
          maxLen: maxResponseLength,
          colors: false
        })
      : err?.message

    // Construct and log the warning message
    const messageParts = [
      ' <<',
      statusCode,
      method,
      shortUrl,
      retryCount && retryCount > 1
        ? `(retry ${retryCount - 1})`
        : '(first try)',
      'error',
      started && 'in ' + Time.since(started),
      body
    ]
    const message = messageParts.filter(Boolean).join(' ')

    console.warn(message)
  }
}

/**
 * Returns an after response hook for 'got' HTTP client library.
 *
 * @param opt - The options for the got HTTP client
 * @returns The after response hook
 */
function gotAfterResponseHook(opt: GetGotOptions = {}): AfterResponseHook {
  return resp => {
    const success = resp.statusCode >= 200 && resp.statusCode < 400

    // Errors are not logged here, as they're logged by gotErrorHook
    if (opt.logFinished && success) {
      const requestOptions = resp.request.options

      // Ensure context exists
      if (!requestOptions.context) {
        requestOptions.context = {}
      }

      const { started, retryCount } =
        requestOptions.context as GotRequestContext
      const { url, prefixUrl, method } = requestOptions
      let shortUrl

      try {
        const urlObject = url instanceof URL ? url : new URL(url)
        const prefixUrlString =
          prefixUrl instanceof URL ? prefixUrl.toString() : prefixUrl
        shortUrl = getShortUrl(opt, urlObject, prefixUrlString)
      } catch (e) {
        console.error('Invalid URL:', url)
        shortUrl = url
      }

      const logParts = [
        ' <<',
        resp.statusCode,
        method,
        shortUrl,
        retryCount && `(retry ${retryCount - 1})`,
        started && 'in ' + Time.since(started)
      ]
      const logMessage = logParts.filter(Boolean).join(' ')

      console.log(logMessage)
    }

    // Error responses are not logged, cause they're included in Error message already
    if (opt.logResponse && success) {
      console.log(inspectAny(resp.body, { maxLen: opt.maxResponseLength }))
    }

    return resp
  }
}

/**
 * Returns a shortened URL based on given options.
 *
 * @param opt - The options for getting the shortened URL
 * @param url - The URL to be shortened
 * @param prefixUrl - The prefix URL to be removed if option is set
 * @returns The shortened URL as a string
 */
function getShortUrl(opt: GetGotOptions, url: URL, prefixUrl?: string): string {
  // Copy the URL and redact password if it exists
  if (url.password) {
    const redactedUrl = new URL(url.toString())
    redactedUrl.password = '[redacted]'
    url = redactedUrl
  }

  // Remove search params if the option is set
  let shortUrl =
    opt.logWithSearchParams === false
      ? url.toString().split('?')[0]!
      : url.toString()

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
