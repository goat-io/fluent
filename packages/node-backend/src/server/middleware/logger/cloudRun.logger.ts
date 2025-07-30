import { LoggingWinston } from '@google-cloud/logging-winston'
import { blue } from 'kleur/colors'
import type { Format } from 'logform'
import type { LoggerOptions } from 'winston'
import { format, transports } from 'winston'
import { Environment } from '../../types/Envinronment'
import { getCurrentTimeFormatted } from '../logs.middleware'

export type GetTraceFn = () => {
  traceId: string
  spanId: string
  traceSampled?: boolean
}
export type GetLabelsFn = () => Record<string, string | undefined>
export interface WinstonCloudRunConfig {
  appName: string
  appVersion: string
  environment: Environment
  production: boolean
  getTrace?: GetTraceFn
  getLabels?: GetLabelsFn
}

/**
 * Creates simple winston config for Cloud Run
 *
 * Log level is set like this: ```production ? 'error' : 'debug'```
 */
export function getWinstonCloudRunConfig({
  appName,
  appVersion,
  production,
  environment,
  getTrace,
  getLabels
}: WinstonCloudRunConfig): LoggerOptions {
  const logTransports: (typeof transports.Console | LoggingWinston)[] = []

  if (environment === 'local') {
    const consoleLogger = new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          info =>
            `[${blue(getCurrentTimeFormatted())}] ${info.level}: ${
              info.message
            }`
        )
      ),
      level: 'debug'
    })
    logTransports.push(consoleLogger)
  } else {
    logTransports.push(
      new LoggingWinston({
        serviceContext: {
          service: appName,
          version: appVersion
        },
        labels: {
          environment,
          service: appName
        },
        defaultCallback: err => {
          if (err) {
            console.error('Logging failed:', err)
          }
        },
        level: 'error',
        redirectToStdout: true
      })
    )
  }

  return {
    level: production ? 'error' : 'debug',
    format: getCloudLoggingFormat({ getTrace, getLabels, environment }),
    transports: logTransports,
    handleRejections: true,
    handleExceptions: true
  }
}

/**
 * Creates Winston format that specifies time and renames level to severity
 */
export function getCloudLoggingFormat(
  {
    getTrace,
    getLabels,
    environment
  }: Pick<WinstonCloudRunConfig, 'getLabels' | 'getTrace' | 'environment'> = {
    environment: 'local'
  }
): Format {
  const traceInfo = getTrace ? getTraceInfo(getTrace) : {}

  const logFormat = [
    format.errors({ stack: true }),
    format(info => {
      const { level } = info
      return {
        ...info,
        ...traceInfo,
        severity: environment === 'local' ? undefined : level.toUpperCase(),
        time: environment === 'local' ? undefined : new Date().toISOString(),
        ...(getLabels && {
          'logging.googleapis.com/labels': getLabels()
        })
      } as never
    })()
  ]

  if (environment !== 'local') {
    logFormat.push(format.json())
  }

  return format.combine(...logFormat)
}

function getTraceInfo(getTrace: GetTraceFn) {
  const { traceId, spanId, traceSampled = true } = getTrace() || {}
  return traceId && spanId
    ? {
        'logging.googleapis.com/trace': traceId,
        'logging.googleapis.com/spanId': spanId,
        'logging.googleapis.com/trace_sampled': traceSampled
      }
    : {}
}
