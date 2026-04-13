import { CommonLogger, Time } from '@goatlab/js-utils'
import type { NextFunction, Request, Response } from 'express'
import { bgBlack, cyan, green, magenta, red, yellow } from 'kleur/colors'

/**
 * Optional function to extract a log prefix from the request.
 * Useful for multi-tenant apps to prepend tenant ID to log lines.
 */
export type RequestLogPrefixFn = (req: Request) => string | undefined

/**
 * Options for the Express request logger.
 */
export interface RequestLoggerOptions {
  /**
   * Paths to suppress from request logs (e.g. health checks).
   * Only suppresses successful (< 400) responses on these paths.
   * @example ['/livez', '/readyz', '/health']
   */
  suppressedPaths?: string[]

  /**
   * Extract trace context from the request for structured logging.
   * Returns trace/span IDs for Cloud Logging correlation.
   */
  getTraceContext?: (req: Request) => {
    traceId?: string
    spanId?: string
  }
}

// Adds color to HTTP status codes based on their range
export const httpResponseCodeColor = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 400) {
    return green(statusCode.toString())
  }
  if (statusCode >= 400 && statusCode < 500) {
    return yellow(statusCode.toString())
  }
  return red(statusCode.toString())
}

// Adds color to response time based on duration
export const httpResponseTimeColor = (msTime: number): string => {
  if (msTime >= 0 && msTime < 500) {
    return green(Time.ms(msTime))
  }
  if (msTime >= 500 && msTime < 1000) {
    return yellow(Time.ms(msTime))
  }
  return red(Time.ms(msTime))
}

// Utility function to log based on status code with optional structured metadata
const logMessage = (
  message: string,
  statusCode: number,
  logger: CommonLogger,
  meta?: Record<string, unknown>,
) => {
  const args = meta ? [message, meta] : [message]

  if (statusCode >= 500) {
    logger.error(...args)
  } else if (statusCode >= 400) {
    logger.warn(...args)
  } else {
    logger.log(...args)
  }
}

export const getActualRequestDurationInMilliseconds = (
  start: [number, number],
): number => {
  const NS_PER_SEC = 1e9 // Convert to nanoseconds
  const NS_TO_MS = 1e6 // Convert to milliseconds
  const diff = process.hrtime(start)
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS
}

export const getCurrentTimeFormatted = (): string => new Date().toISOString()

const formatRequestLog = ({
  prefix,
  method,
  url,
  statusCode,
  statusMessage,
  durationInMilliseconds,
}: {
  prefix?: string
  method: string
  url: string
  statusCode: number
  statusMessage: string
  durationInMilliseconds: number
}) => {
  const prefixStr = prefix ? `[${cyan(prefix)}] ` : ''
  return `${prefixStr}${magenta(method)}: ${bgBlack(url)} | Response: ${httpResponseCodeColor(
    statusCode,
  )} (${statusMessage}) ${httpResponseTimeColor(durationInMilliseconds)}`
}

function logBatchRequests({
  prefix,
  date,
  method,
  url,
  statusCode,
  statusMessage,
  durationInMilliseconds,
  logger,
  traceMeta,
}: {
  prefix?: string
  date: string
  method: string
  url: string
  statusCode: number
  statusMessage: string
  durationInMilliseconds: number
  logger: CommonLogger
  traceMeta?: Record<string, unknown>
}) {
  const baseMeta: Record<string, unknown> = {
    ...(prefix && { tenantId: prefix }),
    httpMethod: method,
    httpStatus: statusCode,
    durationMs: Math.round(durationInMilliseconds),
    ...traceMeta,
  }

  const decodedUrl = decodeURIComponent(url)
  const urlParts = decodedUrl.split('?')
  const baseUrl = urlParts[0] || ''

  if (urlParts[1]) {
    const queryParams = new URLSearchParams(urlParts[1])
    const input = queryParams.get('input')
    const batch = queryParams.get('batch')

    if (input && batch) {
      try {
        const parsedInput = JSON.parse(input)
        const endpointString = baseUrl.split('/trpc/')[1]
        const endpoints = endpointString ? endpointString.split(',') : []

        if (endpoints.length > 1) {
          logger.log(
            `Batch Requests: ${yellow(`${endpoints.length} endpoints`)} \n\n${method.toUpperCase()} ${baseUrl} \n\n`,
          )
        }

        endpoints.forEach((endpoint, index) => {
          const params = parsedInput[index]
          const message = ` ${formatRequestLog({
            prefix,
            method,
            url: endpoint,
            statusCode,
            statusMessage,
            durationInMilliseconds,
          })} | ${yellow('Batch Params')}: ${JSON.stringify(params, null, 2)}`
          logMessage(message, statusCode, logger, {
            ...baseMeta,
            url: endpoint,
            trpcPath: endpoint,
          })
        })
      } catch (err: any) {
        logger.error(
          `[${date}] Error parsing batch input: ${err.message || 'unknown error'}`,
        )
      }
    } else {
      const cleanUrl = `${baseUrl}?${queryParams.toString()}`
      const message = formatRequestLog({
        prefix,
        method,
        url: cleanUrl,
        statusCode,
        statusMessage,
        durationInMilliseconds,
      })
      const trpcPath = baseUrl.split('/trpc/')[1]
      logMessage(message, statusCode, logger, {
        ...baseMeta,
        url: cleanUrl,
        ...(trpcPath && { trpcPath }),
      })
    }
  } else {
    const message = formatRequestLog({
      prefix,
      method,
      url: baseUrl,
      statusCode,
      statusMessage,
      durationInMilliseconds,
    })
    const trpcPath = baseUrl.split('/trpc/')[1]
    logMessage(message, statusCode, logger, {
      ...baseMeta,
      url: baseUrl,
      ...(trpcPath && { trpcPath }),
    })
  }
}

export const expressRequestLogger = (
  request: Request,
  response: Response,
  next: NextFunction,
  logger: CommonLogger,
  getLogPrefix?: RequestLogPrefixFn,
  options?: RequestLoggerOptions,
): void => {
  const formattedDate = getCurrentTimeFormatted()
  const start = process.hrtime()

  response.on('finish', () => {
    const { method, originalUrl } = request
    const { statusCode, statusMessage } = response
    const durationInMilliseconds = getActualRequestDurationInMilliseconds(start)

    // Suppress noisy paths (e.g. health checks) for successful responses
    if (options?.suppressedPaths?.length) {
      const basePath = originalUrl.split('?')[0]
      if (
        basePath &&
        options.suppressedPaths.includes(basePath) &&
        statusCode < 400
      ) {
        return
      }
    }

    const prefix = getLogPrefix?.(request)

    // Build trace context for structured logging
    const traceMeta: Record<string, unknown> = {}
    if (options?.getTraceContext) {
      const { traceId, spanId } = options.getTraceContext(request)
      if (traceId) {
        traceMeta['logging.googleapis.com/trace'] = traceId
      }
      if (spanId) {
        traceMeta['logging.googleapis.com/spanId'] = spanId
      }
    }

    logBatchRequests({
      prefix,
      date: formattedDate,
      method,
      url: originalUrl,
      statusCode,
      statusMessage,
      durationInMilliseconds,
      logger,
      traceMeta,
    })
  })

  next()
}
