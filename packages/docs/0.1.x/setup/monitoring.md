# Monitoring and Observability

This guide covers comprehensive monitoring and observability for the Goat Fluent queue and task systems.

## Overview

Effective monitoring provides visibility into system performance, reliability, and health. Key areas include:

- **Metrics Collection**: Performance and usage metrics
- **Logging**: Structured logging for debugging
- **Alerting**: Proactive issue detection
- **Tracing**: Request/task flow tracking
- **Dashboards**: Visual monitoring interfaces

## Metrics Collection

### Prometheus Integration

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client'

class MetricsCollector {
  private taskCounter: Counter<string>
  private taskDuration: Histogram<string>
  private queueSize: Gauge<string>
  private errorRate: Counter<string>

  constructor() {
    this.taskCounter = new Counter({
      name: 'tasks_total',
      help: 'Total number of tasks processed',
      labelNames: ['task_name', 'status']
    })

    this.taskDuration = new Histogram({
      name: 'task_duration_seconds',
      help: 'Task processing duration in seconds',
      labelNames: ['task_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
    })

    this.queueSize = new Gauge({
      name: 'queue_size',
      help: 'Current queue size',
      labelNames: ['queue_name']
    })

    this.errorRate = new Counter({
      name: 'task_errors_total',
      help: 'Total number of task errors',
      labelNames: ['task_name', 'error_type']
    })

    register.registerMetric(this.taskCounter)
    register.registerMetric(this.taskDuration)
    register.registerMetric(this.queueSize)
    register.registerMetric(this.errorRate)
  }

  recordTaskStart(taskName: string) {
    this.taskCounter.inc({ task_name: taskName, status: 'started' })
  }

  recordTaskCompletion(taskName: string, duration: number) {
    this.taskCounter.inc({ task_name: taskName, status: 'completed' })
    this.taskDuration.observe({ task_name: taskName }, duration)
  }

  recordTaskError(taskName: string, errorType: string) {
    this.taskCounter.inc({ task_name: taskName, status: 'failed' })
    this.errorRate.inc({ task_name: taskName, error_type: errorType })
  }

  updateQueueSize(queueName: string, size: number) {
    this.queueSize.set({ queue_name: queueName }, size)
  }
}
```

### Monitored Task Implementation

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'

class MonitoredTask extends ShouldQueue<any, any> {
  private static metrics = new MetricsCollector()

  async handle(taskBody: any) {
    const startTime = Date.now()
    const taskName = this.taskName

    MonitoredTask.metrics.recordTaskStart(taskName)

    try {
      const result = await this.processTask(taskBody)
      
      const duration = (Date.now() - startTime) / 1000
      MonitoredTask.metrics.recordTaskCompletion(taskName, duration)
      
      return result
    } catch (error) {
      const errorType = this.categorizeError(error)
      MonitoredTask.metrics.recordTaskError(taskName, errorType)
      throw error
    }
  }

  private categorizeError(error: Error): string {
    if (error.message.includes('timeout')) return 'timeout'
    if (error.message.includes('network')) return 'network'
    if (error.message.includes('validation')) return 'validation'
    return 'unknown'
  }
}
```

### Custom Metrics

```typescript
class CustomMetrics {
  private static instance: CustomMetrics
  private businessMetrics: Map<string, any>

  constructor() {
    this.businessMetrics = new Map()
  }

  static getInstance(): CustomMetrics {
    if (!CustomMetrics.instance) {
      CustomMetrics.instance = new CustomMetrics()
    }
    return CustomMetrics.instance
  }

  recordBusinessMetric(name: string, value: number, labels: Record<string, string> = {}) {
    const metric = {
      name,
      value,
      labels,
      timestamp: Date.now()
    }

    this.businessMetrics.set(`${name}_${Date.now()}`, metric)
    
    // Send to metrics backend
    this.sendToMetricsBackend(metric)
  }

  private async sendToMetricsBackend(metric: any) {
    // Implementation for sending to metrics backend
    console.log('Sending metric:', metric)
  }
}

// Usage in tasks
class BusinessTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    const metrics = CustomMetrics.getInstance()
    
    // Record business metrics
    metrics.recordBusinessMetric('orders_processed', 1, {
      customer_type: taskBody.customerType,
      region: taskBody.region
    })

    metrics.recordBusinessMetric('revenue_generated', taskBody.orderValue, {
      currency: taskBody.currency
    })

    return await this.processOrder(taskBody)
  }
}
```

## Structured Logging

### Winston Configuration

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
})

// Elasticsearch transport for production
if (process.env.NODE_ENV === 'production') {
  const { ElasticsearchTransport } = require('winston-elasticsearch')
  
  logger.add(new ElasticsearchTransport({
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    },
    index: 'queue-logs'
  }))
}

export default logger
```

### Logging in Tasks

```typescript
import logger from './logger'

class LoggedTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    const taskId = this.generateTaskId()
    const startTime = Date.now()

    logger.info('Task started', {
      taskId,
      taskName: this.taskName,
      taskBody: this.sanitizeTaskBody(taskBody),
      timestamp: new Date().toISOString()
    })

    try {
      const result = await this.processTask(taskBody)
      
      logger.info('Task completed', {
        taskId,
        taskName: this.taskName,
        duration: Date.now() - startTime,
        result: this.sanitizeResult(result),
        timestamp: new Date().toISOString()
      })

      return result
    } catch (error) {
      logger.error('Task failed', {
        taskId,
        taskName: this.taskName,
        duration: Date.now() - startTime,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        taskBody: this.sanitizeTaskBody(taskBody),
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  private generateTaskId(): string {
    return `${this.taskName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sanitizeTaskBody(taskBody: any): any {
    // Remove sensitive data
    const sanitized = { ...taskBody }
    delete sanitized.password
    delete sanitized.token
    delete sanitized.secret
    return sanitized
  }

  private sanitizeResult(result: any): any {
    // Remove sensitive data from result
    const sanitized = { ...result }
    delete sanitized.privateKey
    delete sanitized.internalData
    return sanitized
  }
}
```

## Distributed Tracing

### OpenTelemetry Integration

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

// Configure tracer
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'goat-fluent-queue',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
  })
})

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
})

provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter))
provider.register()

const tracer = trace.getTracer('goat-fluent-queue')

// Traced task implementation
class TracedTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    const span = tracer.startSpan(`task.${this.taskName}`, {
      attributes: {
        'task.name': this.taskName,
        'task.id': this.generateTaskId(),
        'task.input.size': JSON.stringify(taskBody).length
      }
    })

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await this.processTask(taskBody)
      })

      span.setStatus({ code: SpanStatusCode.OK })
      span.setAttributes({
        'task.result.size': JSON.stringify(result).length,
        'task.success': true
      })

      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      })
      span.setAttributes({
        'task.error.type': error.constructor.name,
        'task.error.message': error.message,
        'task.success': false
      })

      throw error
    } finally {
      span.end()
    }
  }

  private async processTask(taskBody: any) {
    // Create child span for processing
    const childSpan = tracer.startSpan('task.process', {
      parent: trace.getActiveSpan()
    })

    try {
      // Simulate processing steps
      await this.validateInput(taskBody)
      await this.performBusinessLogic(taskBody)
      await this.saveResults(taskBody)

      return { success: true, processedAt: new Date() }
    } finally {
      childSpan.end()
    }
  }

  private async validateInput(taskBody: any) {
    const span = tracer.startSpan('task.validate')
    try {
      // Validation logic
      await new Promise(resolve => setTimeout(resolve, 10))
    } finally {
      span.end()
    }
  }

  private async performBusinessLogic(taskBody: any) {
    const span = tracer.startSpan('task.business-logic')
    try {
      // Business logic
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      span.end()
    }
  }

  private async saveResults(taskBody: any) {
    const span = tracer.startSpan('task.save-results')
    try {
      // Save results
      await new Promise(resolve => setTimeout(resolve, 50))
    } finally {
      span.end()
    }
  }
}
```

## Alerting

### Alert Configuration

```typescript
interface AlertRule {
  name: string
  condition: string
  threshold: number
  duration: number
  severity: 'critical' | 'warning' | 'info'
  channels: string[]
}

const alertRules: AlertRule[] = [
  {
    name: 'High Task Error Rate',
    condition: 'task_errors_total / tasks_total > 0.1',
    threshold: 0.1,
    duration: 300, // 5 minutes
    severity: 'critical',
    channels: ['slack', 'email', 'pagerduty']
  },
  {
    name: 'Queue Size Too Large',
    condition: 'queue_size > 1000',
    threshold: 1000,
    duration: 600, // 10 minutes
    severity: 'warning',
    channels: ['slack', 'email']
  },
  {
    name: 'Task Processing Slow',
    condition: 'histogram_quantile(0.95, task_duration_seconds) > 60',
    threshold: 60,
    duration: 300,
    severity: 'warning',
    channels: ['slack']
  }
]

class AlertManager {
  private static instance: AlertManager
  private alerts: Map<string, Date>

  constructor() {
    this.alerts = new Map()
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager()
    }
    return AlertManager.instance
  }

  async checkAlerts(metrics: any) {
    for (const rule of alertRules) {
      const isTriggered = await this.evaluateCondition(rule, metrics)
      
      if (isTriggered) {
        await this.triggerAlert(rule)
      } else {
        this.resolveAlert(rule.name)
      }
    }
  }

  private async evaluateCondition(rule: AlertRule, metrics: any): Promise<boolean> {
    // Implementation depends on your metrics system
    // This is a simplified example
    
    switch (rule.name) {
      case 'High Task Error Rate':
        const errorRate = metrics.errorCount / metrics.totalTasks
        return errorRate > rule.threshold
      case 'Queue Size Too Large':
        return metrics.queueSize > rule.threshold
      case 'Task Processing Slow':
        return metrics.p95Duration > rule.threshold
      default:
        return false
    }
  }

  private async triggerAlert(rule: AlertRule) {
    const alertKey = rule.name
    const lastAlerted = this.alerts.get(alertKey)
    
    // Don't spam alerts - wait at least 30 minutes between alerts
    if (lastAlerted && Date.now() - lastAlerted.getTime() < 30 * 60 * 1000) {
      return
    }

    this.alerts.set(alertKey, new Date())

    for (const channel of rule.channels) {
      await this.sendAlert(channel, rule)
    }
  }

  private async sendAlert(channel: string, rule: AlertRule) {
    const message = {
      title: `Alert: ${rule.name}`,
      description: `Condition: ${rule.condition}`,
      severity: rule.severity,
      timestamp: new Date().toISOString()
    }

    switch (channel) {
      case 'slack':
        await this.sendSlackAlert(message)
        break
      case 'email':
        await this.sendEmailAlert(message)
        break
      case 'pagerduty':
        await this.sendPagerDutyAlert(message)
        break
    }
  }

  private async sendSlackAlert(message: any) {
    // Slack webhook implementation
    console.log('Sending Slack alert:', message)
  }

  private async sendEmailAlert(message: any) {
    // Email alert implementation
    console.log('Sending email alert:', message)
  }

  private async sendPagerDutyAlert(message: any) {
    // PagerDuty alert implementation
    console.log('Sending PagerDuty alert:', message)
  }

  private resolveAlert(alertName: string) {
    this.alerts.delete(alertName)
  }
}
```

## Health Checks

### Application Health

```typescript
class HealthChecker {
  private checks: Map<string, () => Promise<boolean>>

  constructor() {
    this.checks = new Map()
    this.registerDefaultChecks()
  }

  private registerDefaultChecks() {
    this.checks.set('redis', this.checkRedis)
    this.checks.set('database', this.checkDatabase)
    this.checks.set('queue', this.checkQueue)
    this.checks.set('disk-space', this.checkDiskSpace)
    this.checks.set('memory', this.checkMemory)
  }

  async checkHealth(): Promise<{ healthy: boolean; checks: any }> {
    const results = {}
    let overall = true

    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now()
        const healthy = await check()
        const duration = Date.now() - startTime

        results[name] = {
          healthy,
          duration,
          timestamp: new Date().toISOString()
        }

        if (!healthy) {
          overall = false
        }
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
        overall = false
      }
    }

    return { healthy: overall, checks: results }
  }

  private async checkRedis(): Promise<boolean> {
    // Redis health check
    try {
      // Implement Redis ping
      return true
    } catch (error) {
      return false
    }
  }

  private async checkDatabase(): Promise<boolean> {
    // Database health check
    try {
      // Implement database connectivity check
      return true
    } catch (error) {
      return false
    }
  }

  private async checkQueue(): Promise<boolean> {
    // Queue health check
    try {
      // Check queue connectivity and basic operations
      return true
    } catch (error) {
      return false
    }
  }

  private async checkDiskSpace(): Promise<boolean> {
    // Disk space check
    try {
      const fs = require('fs')
      const stats = fs.statSync('/')
      const freeSpace = stats.free / stats.size
      return freeSpace > 0.2 // 20% free space required
    } catch (error) {
      return false
    }
  }

  private async checkMemory(): Promise<boolean> {
    // Memory usage check
    try {
      const usage = process.memoryUsage()
      const totalMemory = require('os').totalmem()
      const memoryUsage = usage.heapUsed / totalMemory
      return memoryUsage < 0.8 // Less than 80% memory usage
    } catch (error) {
      return false
    }
  }
}

// Express endpoint for health checks
app.get('/health', async (req, res) => {
  const healthChecker = new HealthChecker()
  const health = await healthChecker.checkHealth()
  
  res.status(health.healthy ? 200 : 503).json(health)
})
```

## Dashboards

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Goat Fluent Queue Dashboard",
    "panels": [
      {
        "title": "Task Processing Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(tasks_total[5m])",
            "legendFormat": "Tasks per second"
          }
        ]
      },
      {
        "title": "Task Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(task_errors_total[5m]) / rate(tasks_total[5m])",
            "legendFormat": "Error rate"
          }
        ]
      },
      {
        "title": "Queue Size",
        "type": "graph",
        "targets": [
          {
            "expr": "queue_size",
            "legendFormat": "Queue: {{queue_name}}"
          }
        ]
      },
      {
        "title": "Task Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, task_duration_seconds)",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, task_duration_seconds)",
            "legendFormat": "50th percentile"
          }
        ]
      }
    ]
  }
}
```

## Best Practices

1. **Monitor Key Metrics**: Focus on throughput, latency, and error rates
2. **Set Appropriate Alerts**: Avoid alert fatigue with meaningful thresholds
3. **Use Structured Logging**: Enable easier searching and analysis
4. **Implement Distributed Tracing**: Track request flows across services
5. **Regular Health Checks**: Implement comprehensive health monitoring
6. **Dashboard Design**: Create clear, actionable dashboards
7. **Retention Policies**: Set appropriate data retention for logs and metrics

## Troubleshooting Guide

### Common Issues

1. **High Error Rate**: Check logs for error patterns, review recent deployments
2. **Slow Processing**: Analyze task duration metrics, check resource usage
3. **Queue Backlog**: Monitor queue sizes, check worker capacity
4. **Memory Leaks**: Monitor memory usage trends, implement proper cleanup

### Debug Mode

```typescript
class DebugTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('DEBUG: Task input:', JSON.stringify(taskBody, null, 2))
      console.log('DEBUG: Task name:', this.taskName)
      console.log('DEBUG: Memory usage:', process.memoryUsage())
    }

    const result = await this.processTask(taskBody)

    if (process.env.DEBUG_MODE === 'true') {
      console.log('DEBUG: Task output:', JSON.stringify(result, null, 2))
    }

    return result
  }
}
```

## Next Steps

- Learn about [Queue Configuration](queue-configuration.md) for optimal performance
- Explore [Cloud Integration](cloud-integration.md) for cloud-native monitoring
- Check out [Error Handling](../advanced/error-handling.md) for robust error management