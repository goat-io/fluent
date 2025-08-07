// npx vitest run tests/opentelemetry.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  InMemorySpanExporter, 
  SimpleSpanProcessor,
  BasicTracerProvider
} from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

describe('OpenTelemetry Span Linkage', () => {
  let provider: BasicTracerProvider
  let exporter: InMemorySpanExporter
  let tracer: any
  
  beforeEach(() => {
    // Setup in-memory OTLP test collector
    exporter = new InMemorySpanExporter()
    provider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'delphi-test',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
      })
    })
    
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
    provider.register()
    
    tracer = trace.getTracer('delphi-test')
  })
  
  afterEach(() => {
    exporter.reset()
    provider.shutdown()
  })

  it('should create proper parent-child span relationships with depth of 6', async () => {
    // Simulate the Delphi pipeline span hierarchy
    await tracer.startActiveSpan('delphi.pipeline', async (pipelineSpan: any) => {
      try {
        // Level 2: Planner node
        await tracer.startActiveSpan('node.planner', async (plannerNode: any) => {
          try {
            // Level 3: Agent call
            await tracer.startActiveSpan('agent.planner.plan', async (plannerAgent: any) => {
              try {
                // Level 4: LLM call
                await tracer.startActiveSpan('llm.chat', async (llmCall: any) => {
                  try {
                    // Level 5: HTTP request
                    await tracer.startActiveSpan('http.post', async (httpSpan: any) => {
                      try {
                        // Level 6: Network socket
                        await tracer.startActiveSpan('net.socket', async (socketSpan: any) => {
                          try {
                            // Simulate work
                            await new Promise(resolve => setTimeout(resolve, 10))
                            socketSpan.setStatus({ code: SpanStatusCode.OK })
                          } finally {
                            socketSpan.end()
                          }
                        })
                        httpSpan.setStatus({ code: SpanStatusCode.OK })
                      } finally {
                        httpSpan.end()
                      }
                    })
                    llmCall.setStatus({ code: SpanStatusCode.OK })
                  } finally {
                    llmCall.end()
                  }
                })
                plannerAgent.setStatus({ code: SpanStatusCode.OK })
              } finally {
                plannerAgent.end()
              }
            })
            plannerNode.setStatus({ code: SpanStatusCode.OK })
          } finally {
            plannerNode.end()
          }
        })
        
        // Add other nodes to simulate full pipeline
        await tracer.startActiveSpan('node.refiner', async (refinerNode: any) => {
          try {
            await tracer.startActiveSpan('agent.refiner.refine', async (refinerAgent: any) => {
              try {
                await new Promise(resolve => setTimeout(resolve, 5))
                refinerAgent.setStatus({ code: SpanStatusCode.OK })
              } finally {
                refinerAgent.end()
              }
            })
            refinerNode.setStatus({ code: SpanStatusCode.OK })
          } finally {
            refinerNode.end()
          }
        })
        
        pipelineSpan.setStatus({ code: SpanStatusCode.OK })
      } finally {
        pipelineSpan.end()
      }
    })
    
    // Get all spans
    const spans = exporter.getFinishedSpans()
    
    // Build parent-child map
    const parentChildMap = new Map<string, string[]>()
    const spanMap = new Map<string, any>()
    
    for (const span of spans) {
      spanMap.set(span.spanContext().spanId, span)
      
      if (span.parentSpanId) {
        if (!parentChildMap.has(span.parentSpanId)) {
          parentChildMap.set(span.parentSpanId, [])
        }
        parentChildMap.get(span.parentSpanId)!.push(span.spanContext().spanId)
      }
    }
    
    // Find the root span
    const rootSpan = spans.find(s => !s.parentSpanId)
    expect(rootSpan).toBeDefined()
    expect(rootSpan!.name).toBe('delphi.pipeline')
    
    // Calculate depth of the span tree
    const calculateDepth = (spanId: string, depth: number = 1): number => {
      const children = parentChildMap.get(spanId) || []
      if (children.length === 0) return depth
      
      return Math.max(...children.map(childId => calculateDepth(childId, depth + 1)))
    }
    
    const treeDepth = calculateDepth(rootSpan!.spanContext().spanId)
    expect(treeDepth).toBe(6)
    
    // Verify span names at each level
    const getSpanAtDepth = (targetDepth: number): any => {
      const traverse = (spanId: string, currentDepth: number): any => {
        if (currentDepth === targetDepth) {
          return spanMap.get(spanId)
        }
        
        const children = parentChildMap.get(spanId) || []
        for (const childId of children) {
          const result = traverse(childId, currentDepth + 1)
          if (result) return result
        }
        return null
      }
      
      return traverse(rootSpan!.spanContext().spanId, 1)
    }
    
    expect(getSpanAtDepth(1)?.name).toBe('delphi.pipeline')
    expect(getSpanAtDepth(2)?.name).toMatch(/^node\./)
    expect(getSpanAtDepth(3)?.name).toMatch(/^agent\./)
    expect(getSpanAtDepth(4)?.name).toBe('llm.chat')
    expect(getSpanAtDepth(5)?.name).toBe('http.post')
    expect(getSpanAtDepth(6)?.name).toBe('net.socket')
  })

  it('should propagate trace context across async boundaries', async () => {
    const traceId = '12345678901234567890123456789012'
    
    // Create a parent span with specific trace ID
    const parentSpan = tracer.startSpan('parent', {
      root: true
    })
    
    const parentContext = trace.setSpan(context.active(), parentSpan)
    
    // Simulate async work with context propagation
    await context.with(parentContext, async () => {
      // Start child span in async context
      await new Promise(resolve => {
        setTimeout(() => {
          const childSpan = tracer.startSpan('child')
          
          // Verify parent-child relationship
          expect(childSpan.spanContext().traceId).toBe(parentSpan.spanContext().traceId)
          expect(childSpan.parentSpanId).toBe(parentSpan.spanContext().spanId)
          
          childSpan.end()
          resolve(undefined)
        }, 10)
      })
    })
    
    parentSpan.end()
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(2)
    
    // Verify both spans share the same trace ID
    const traceIds = new Set(spans.map(s => s.spanContext().traceId))
    expect(traceIds.size).toBe(1)
  })

  it('should include proper span attributes and events', async () => {
    await tracer.startActiveSpan('delphi.pipeline', async (span: any) => {
      // Add attributes
      span.setAttributes({
        'delphi.goal': 'Add error handling',
        'delphi.thread_id': 'test-thread-123',
        'delphi.iteration': 3,
        'delphi.max_iterations': 5
      })
      
      // Add events
      span.addEvent('planning_started')
      span.addEvent('refinement_completed', {
        iterations: 3
      })
      span.addEvent('code_generated', {
        diff_size: 1024,
        files_changed: 5
      })
      
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    })
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    
    const pipelineSpan = spans[0]
    
    // Verify attributes
    expect(pipelineSpan.attributes['delphi.goal']).toBe('Add error handling')
    expect(pipelineSpan.attributes['delphi.thread_id']).toBe('test-thread-123')
    expect(pipelineSpan.attributes['delphi.iteration']).toBe(3)
    
    // Verify events
    expect(pipelineSpan.events.length).toBe(3)
    expect(pipelineSpan.events[0].name).toBe('planning_started')
    expect(pipelineSpan.events[1].name).toBe('refinement_completed')
    expect(pipelineSpan.events[2].attributes?.['diff_size']).toBe(1024)
  })

  it('should handle error spans correctly', async () => {
    await tracer.startActiveSpan('failing.operation', async (span: any) => {
      try {
        throw new Error('Something went wrong')
      } catch (error: any) {
        span.recordException(error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        })
      } finally {
        span.end()
      }
    })
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    
    const errorSpan = spans[0]
    expect(errorSpan.status.code).toBe(SpanStatusCode.ERROR)
    expect(errorSpan.status.message).toBe('Something went wrong')
    
    // Check for exception event
    const exceptionEvent = errorSpan.events.find(e => e.name === 'exception')
    expect(exceptionEvent).toBeDefined()
    expect(exceptionEvent?.attributes?.['exception.message']).toBe('Something went wrong')
  })

  it('should measure span durations correctly', async () => {
    const startTime = Date.now()
    
    await tracer.startActiveSpan('timed.operation', async (span: any) => {
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100))
      span.end()
    })
    
    const endTime = Date.now()
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    
    const timedSpan = spans[0]
    const spanDuration = (timedSpan.endTime[0] * 1000 + timedSpan.endTime[1] / 1000000) - 
                        (timedSpan.startTime[0] * 1000 + timedSpan.startTime[1] / 1000000)
    
    // Duration should be approximately 100ms
    expect(spanDuration).toBeGreaterThan(90)
    expect(spanDuration).toBeLessThan(150)
  })

  it('should handle concurrent spans correctly', async () => {
    const promises = []
    
    // Start 5 concurrent operations
    for (let i = 0; i < 5; i++) {
      promises.push(
        tracer.startActiveSpan(`concurrent.op.${i}`, async (span: any) => {
          // Random delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
          span.setAttributes({ index: i })
          span.end()
        })
      )
    }
    
    await Promise.all(promises)
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(5)
    
    // All spans should have different span IDs
    const spanIds = new Set(spans.map(s => s.spanContext().spanId))
    expect(spanIds.size).toBe(5)
    
    // All should have the same trace ID (if they're part of the same trace)
    // In this case, they're independent, so each has its own trace
    const traceIds = new Set(spans.map(s => s.spanContext().traceId))
    expect(traceIds.size).toBe(5)
  })

  it('should link related spans across traces', async () => {
    // Create first trace
    const span1 = tracer.startSpan('operation.1')
    const span1Context = span1.spanContext()
    span1.end()
    
    // Create second trace with link to first
    const span2 = tracer.startSpan('operation.2', {
      links: [{
        context: span1Context,
        attributes: {
          'link.type': 'follows_from',
          'link.reason': 'continuation'
        }
      }]
    })
    span2.end()
    
    const spans = exporter.getFinishedSpans()
    expect(spans.length).toBe(2)
    
    // Verify the link
    const linkedSpan = spans.find(s => s.name === 'operation.2')
    expect(linkedSpan?.links.length).toBe(1)
    expect(linkedSpan?.links[0].context.spanId).toBe(span1Context.spanId)
    expect(linkedSpan?.links[0].attributes?.['link.type']).toBe('follows_from')
  })
})