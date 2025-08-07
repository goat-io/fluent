/**
 * OpenTelemetry tracing configuration for Delphi pipeline
 */

import { Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

let sdk: NodeSDK | null = null
const tracer = trace.getTracer('delphi-pipeline', '1.0.0')

export interface TracingConfig {
  enabled?: boolean
  serviceName?: string
  otlpEndpoint?: string
  consoleExport?: boolean
}

export async function initializeTracing(config: TracingConfig = {}) {
  const {
    enabled = process.env.OTEL_ENABLED === 'true',
    serviceName = 'delphi-pipeline',
    otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://localhost:4318'
    // consoleExport = process.env.OTEL_CONSOLE_EXPORT === 'true' // Not used
  } = config

  if (!enabled) {
    console.log('🔇 OpenTelemetry tracing disabled')
    return
  }

  try {
    // Configure resource
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      })
    )

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`
    })

    // Configure SDK
    sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(traceExporter) as any,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false // Too noisy for our use case
          }
        })
      ],
      metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 30000
      }) as any
    })

    // Initialize SDK
    await sdk.start()
    console.log('📊 OpenTelemetry tracing initialized')
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error)
  }
}

export async function shutdownTracing() {
  if (sdk) {
    try {
      await sdk.shutdown()
      console.log('📊 OpenTelemetry tracing shut down')
    } catch (error) {
      console.error('❌ Error shutting down OpenTelemetry:', error)
    }
  }
}

/**
 * Wrapper to trace async functions
 */
export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      kind: SpanKind.INTERNAL,
      attributes
    },
    async span => {
      try {
        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        })
        span.recordException(error as Error)
        throw error
      } finally {
        span.end()
      }
    }
  )
}

/**
 * Trace a graph node execution
 */
export async function traceNode<T>(
  nodeName: string,
  state: any,
  fn: () => Promise<T>
): Promise<T> {
  return traceAsync(`node.${nodeName}`, async span => {
    span.setAttributes({
      'node.name': nodeName,
      'state.task': state.task?.substring(0, 100),
      'state.iteration': state.iterationCount || 0,
      'state.thread_id': state.threadId
    })

    const startTime = Date.now()
    const result = await fn()
    const duration = Date.now() - startTime

    span.setAttributes({
      'node.duration_ms': duration,
      'node.success': true
    })

    return result
  })
}

/**
 * Create a span for agent API calls
 */
export async function traceAgentCall<T>(
  agentName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return traceAsync(`agent.${agentName}.${operation}`, async span => {
    span.setAttributes({
      'agent.name': agentName,
      'agent.operation': operation,
      'agent.service': 'autogen'
    })

    const startTime = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - startTime

      span.setAttributes({
        'agent.duration_ms': duration,
        'agent.success': true
      })

      return result
    } catch (error) {
      span.setAttributes({
        'agent.success': false,
        'agent.error': error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  })
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * Set attribute on current span
 */
export function setSpanAttribute(key: string, value: any) {
  const span = trace.getActiveSpan()
  if (span) {
    span.setAttribute(key, value)
  }
}

export { tracer }
