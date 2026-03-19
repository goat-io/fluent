import { blue } from 'kleur/colors'
import type { Format } from 'logform'
import type { LoggerOptions } from 'winston'
import { format, transports } from 'winston'
import Transport from 'winston-transport'
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

// ── ANSI strip ──────────────────────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '')

// ── Cloud Run Structured JSON Transport ─────────────────────────────────────
// Writes one JSON object per line to stdout. Cloud Run automatically parses
// JSON on stdout into jsonPayload with proper severity and trace correlation.
// @see https://cloud.google.com/run/docs/logging#writing_structured_logs

const WINSTON_TO_CLOUD_SEVERITY: Record<string, string> = {
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  http: 'INFO',
  verbose: 'DEBUG',
  debug: 'DEBUG',
  silly: 'DEBUG',
}

export interface CloudRunJsonTransportOptions
  extends Transport.TransportStreamOptions {
  appName?: string
  appVersion?: string
  environment?: string
}

export class CloudRunJsonTransport extends Transport {
  private appName: string
  private appVersion: string
  private environment: string

  constructor(opts: CloudRunJsonTransportOptions = {}) {
    super(opts)
    this.appName = opts.appName || 'unknown'
    this.appVersion = opts.appVersion || 'unknown'
    this.environment = opts.environment || 'unknown'
  }

  log(info: Record<string, unknown>, callback: () => void) {
    const severity =
      WINSTON_TO_CLOUD_SEVERITY[info.level as string] ?? 'DEFAULT'
    const message = stripAnsi(String(info.message ?? ''))

    // Build structured log entry
    const entry: Record<string, unknown> = {
      severity,
      message,
      time: new Date().toISOString(),
      'logging.googleapis.com/labels': {
        service: this.appName,
        environment: this.environment,
        version: this.appVersion,
      },
    }

    // Structured context fields
    const structuredFields = [
      'tenantId',
      'requestId',
      'trpcPath',
      'httpStatus',
      'durationMs',
      'httpMethod',
      'url',
    ]
    for (const field of structuredFields) {
      if (info[field] !== undefined) {
        entry[field] = info[field]
      }
    }

    // Trace correlation from Cloud-Trace-Context header
    if (info['logging.googleapis.com/trace']) {
      entry['logging.googleapis.com/trace'] =
        info['logging.googleapis.com/trace']
    }
    if (info['logging.googleapis.com/spanId']) {
      entry['logging.googleapis.com/spanId'] =
        info['logging.googleapis.com/spanId']
    }

    // Stack trace for errors
    if (info.stack) {
      entry.stack = info.stack
    }

    // Error details
    if (info.error && typeof info.error === 'object') {
      entry.error = info.error
    }

    // Extra metadata (excluding standard/known fields)
    const excluded = new Set([
      'level',
      'message',
      'timestamp',
      'service',
      'severity',
      'stack',
      'error',
      'logging.googleapis.com/trace',
      'logging.googleapis.com/spanId',
      ...structuredFields,
    ])
    const metadata: Record<string, unknown> = {}
    let hasMetadata = false
    for (const [key, value] of Object.entries(info)) {
      if (
        !excluded.has(key) &&
        typeof key === 'string' &&
        !key.startsWith('Symbol')
      ) {
        metadata[key] = value
        hasMetadata = true
      }
    }
    if (hasMetadata) {
      entry.metadata = metadata
    }

    // Write single JSON line to stdout — Cloud Run parses this as jsonPayload
    process.stdout.write(`${JSON.stringify(entry)}\n`)
    callback()
  }
}

/**
 * Creates Winston config optimized for Cloud Run structured logging.
 *
 * - **Local:** Colorized console output at debug level
 * - **Production:** Structured JSON to stdout at info level (parsed by Cloud
 *   Logging as `jsonPayload` with proper severity, labels, and trace correlation)
 * - **Non-local non-prod (dev/staging):** Structured JSON at debug level
 */
export function getWinstonCloudRunConfig({
  appName,
  appVersion,
  production,
  environment,
  getTrace,
  getLabels,
}: WinstonCloudRunConfig): LoggerOptions {
  const logTransports: Transport[] = []

  if (environment === 'local') {
    const consoleLogger = new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(
          info =>
            `[${blue(getCurrentTimeFormatted())}] ${info.level}: ${
              info.message
            }`,
        ),
      ),
      level: 'debug',
    })
    logTransports.push(consoleLogger)
  } else {
    logTransports.push(
      new CloudRunJsonTransport({
        level: production ? 'info' : 'debug',
        appName,
        appVersion,
        environment,
      }),
    )
  }

  return {
    // Production logs at 'info' — request logs and warnings are critical
    // for debugging. Only 'debug'/'verbose' are suppressed.
    level: production ? 'info' : 'debug',
    format: getCloudLoggingFormat({ getTrace, getLabels, environment }),
    transports: logTransports,
    handleRejections: true,
    handleExceptions: true,
  }
}

/**
 * Creates Winston format that specifies time and renames level to severity
 */
export function getCloudLoggingFormat(
  {
    getTrace,
    getLabels,
    environment,
  }: Pick<WinstonCloudRunConfig, 'getLabels' | 'getTrace' | 'environment'> = {
    environment: 'local',
  },
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
          'logging.googleapis.com/labels': getLabels(),
        }),
      } as never
    })(),
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
        'logging.googleapis.com/trace_sampled': traceSampled,
      }
    : {}
}
