import { CommonLogger, Time } from '@goatlab/js-utils'
import type { NextFunction, Request, Response } from 'express'
import { bgBlack, green, magenta, red, yellow } from 'kleur/colors'

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

// Utility function to log based on status code
const logMessage = (
  message: string,
  statusCode: number,
  logger: CommonLogger
) => {
  if (statusCode >= 500) {
    logger.error(message)
  } else if (statusCode >= 400) {
    logger.warn(message)
  } else {
    logger.warn(message)
  }
}

export const getActualRequestDurationInMilliseconds = (
  start: [number, number]
): number => {
  const NS_PER_SEC = 1e9 // Convert to nanoseconds
  const NS_TO_MS = 1e6 // Convert to milliseconds
  const diff = process.hrtime(start)
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS
}

export const getCurrentTimeFormatted = (): string => new Date().toISOString()

const formatRequestLog = ({
  method,
  url,
  statusCode,
  statusMessage,
  durationInMilliseconds
}: {
  method: string
  url: string
  statusCode: number
  statusMessage: string
  durationInMilliseconds: number
}) => {
  return `${magenta(method)}: ${bgBlack(url)} | Response: ${httpResponseCodeColor(
    statusCode
  )} (${statusMessage}) ${httpResponseTimeColor(durationInMilliseconds)}`
}

function logBatchRequests({
  date,
  method,
  url,
  statusCode,
  statusMessage,
  durationInMilliseconds,
  logger
}: {
  date: string
  method: string
  url: string
  statusCode: number
  statusMessage: string
  durationInMilliseconds: number
  logger: CommonLogger
}) {
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
          logger.warn(
            `Batch Requests: ${yellow(`${endpoints.length} endpoints`)} \n\n${method.toUpperCase()} ${baseUrl} \n\n`
          )
        }

        endpoints.forEach((endpoint, index) => {
          const params = parsedInput[index]
          const message = ` ${formatRequestLog({
            method,
            url: endpoint,
            statusCode,
            statusMessage,
            durationInMilliseconds
          })} | ${yellow('Batch Params')}: ${JSON.stringify(params, null, 2)}`
          logMessage(message, statusCode, logger)
        })
      } catch (err: any) {
        logger.error(
          `[${date}] Error parsing batch input: ${err.message || 'unknown error'}`
        )
      }
    } else {
      const message = formatRequestLog({
        method,
        url: `${baseUrl}?${queryParams.toString()}`,
        statusCode,
        statusMessage,
        durationInMilliseconds
      })
      logMessage(message, statusCode, logger)
    }
  } else {
    const message = formatRequestLog({
      method,
      url: baseUrl,
      statusCode,
      statusMessage,
      durationInMilliseconds
    })
    logMessage(message, statusCode, logger)
  }
}

export const expressRequestLogger = (
  request: Request,
  response: Response,
  next: NextFunction,
  logger: CommonLogger
): void => {
  const formattedDate = getCurrentTimeFormatted()
  const start = process.hrtime()

  response.on('finish', () => {
    const { method, originalUrl } = request
    const { statusCode, statusMessage } = response
    const durationInMilliseconds = getActualRequestDurationInMilliseconds(start)

    logBatchRequests({
      date: formattedDate,
      method,
      url: originalUrl,
      statusCode,
      statusMessage,
      durationInMilliseconds,
      logger
    })
  })

  next()
}
