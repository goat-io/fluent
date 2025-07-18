# Error Handling Strategies

This guide covers comprehensive error handling strategies for the Goat Fluent queue and task systems.

## Overview

Robust error handling is essential for building reliable distributed systems. This includes:

- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Circuit Breakers**: Preventing cascade failures
- **Dead Letter Queues**: Handling permanently failed messages
- **Compensation**: Rollback mechanisms for failed transactions
- **Monitoring**: Error tracking and alerting

## Retry Strategies

### Exponential Backoff

```typescript
class RetryableTask extends ShouldQueue<
  { data: any; attempt?: number },
  { success: boolean; attempts: number }
> {
  public readonly taskName = 'retryable-task'
  public readonly postUrl = '/api/tasks/retryable'
  public retries = 5

  async handle(taskBody: { data: any; attempt?: number }) {
    const attempt = taskBody.attempt || 1
    const maxDelay = 60000 // 1 minute max delay

    try {
      const result = await this.processWithRetry(taskBody.data, attempt)
      return { success: true, attempts: attempt, result }
    } catch (error) {
      if (attempt < this.retries) {
        const delay = Math.min(Math.pow(2, attempt) * 1000, maxDelay)
        console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${this.retries})`)
        
        await this.sleep(delay)
        return this.handle({ ...taskBody, attempt: attempt + 1 })
      }
      
      throw new Error(`Task failed after ${attempt} attempts: ${error.message}`)
    }
  }

  private async processWithRetry(data: any, attempt: number) {
    // Simulate operation that might fail
    if (Math.random() < 0.7) {
      throw new Error('Random failure')
    }
    return { processed: true, data }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Conditional Retry

```typescript
class ConditionalRetryTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    try {
      return await this.processTask(taskBody)
    } catch (error) {
      if (this.shouldRetry(error)) {
        throw error // Will be retried by the system
      } else {
        // Log permanent failure and don't retry
        console.error('Permanent failure:', error)
        return { success: false, error: error.message }
      }
    }
  }

  private shouldRetry(error: Error): boolean {
    // Retry on temporary failures
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NETWORK_ERROR',
      'RATE_LIMITED'
    ]
    
    return retryableErrors.some(code => error.message.includes(code))
  }
}
```

## Circuit Breaker Pattern

### Basic Circuit Breaker

```typescript
class CircuitBreakerTask extends ShouldQueue<
  { serviceId: string; data: any },
  { success: boolean; fallbackUsed: boolean }
> {
  private static circuitBreakers = new Map<string, CircuitBreaker>()

  async handle(taskBody: { serviceId: string; data: any }) {
    const { serviceId, data } = taskBody
    const circuitBreaker = this.getCircuitBreaker(serviceId)

    try {
      if (circuitBreaker.isOpen()) {
        const fallbackResult = await this.executeFallback(serviceId, data)
        return { success: true, fallbackUsed: true, result: fallbackResult }
      }

      const result = await circuitBreaker.execute(() => this.callExternalService(serviceId, data))
      return { success: true, fallbackUsed: false, result }
    } catch (error) {
      const fallbackResult = await this.executeFallback(serviceId, data)
      return { success: false, fallbackUsed: true, result: fallbackResult }
    }
  }

  private getCircuitBreaker(serviceId: string): CircuitBreaker {
    if (!CircuitBreakerTask.circuitBreakers.has(serviceId)) {
      CircuitBreakerTask.circuitBreakers.set(serviceId, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000
      }))
    }
    return CircuitBreakerTask.circuitBreakers.get(serviceId)!
  }

  private async callExternalService(serviceId: string, data: any) {
    // External service call
    return { serviceId, data, timestamp: new Date() }
  }

  private async executeFallback(serviceId: string, data: any) {
    // Fallback logic
    return { serviceId, data, fallback: true }
  }
}
```

## Dead Letter Queue Pattern

### Dead Letter Handling

```typescript
class DeadLetterProcessor extends ShouldQueue<
  { originalTask: any; error: string; attempts: number },
  { handled: boolean; action: string }
> {
  public readonly taskName = 'dead-letter-processor'
  public readonly postUrl = '/api/tasks/dead-letter'

  async handle(taskBody: { originalTask: any; error: string; attempts: number }) {
    const { originalTask, error, attempts } = taskBody

    console.log(`Processing dead letter: ${originalTask.taskName} failed after ${attempts} attempts`)

    // Analyze the error and take appropriate action
    const action = this.determineAction(error, attempts)

    switch (action) {
      case 'retry':
        await this.requeueTask(originalTask)
        break
      case 'manual_review':
        await this.flagForManualReview(originalTask, error)
        break
      case 'discard':
        await this.discardTask(originalTask, error)
        break
      case 'fallback':
        await this.executeFallbackAction(originalTask)
        break
    }

    return { handled: true, action }
  }

  private determineAction(error: string, attempts: number): string {
    if (error.includes('NETWORK_ERROR') && attempts < 10) {
      return 'retry'
    }
    if (error.includes('VALIDATION_ERROR')) {
      return 'manual_review'
    }
    if (error.includes('PERMANENT_FAILURE')) {
      return 'discard'
    }
    return 'fallback'
  }

  private async requeueTask(originalTask: any) {
    console.log('Requeuing task for retry')
    // Requeue logic
  }

  private async flagForManualReview(originalTask: any, error: string) {
    console.log('Flagging task for manual review')
    // Manual review logic
  }

  private async discardTask(originalTask: any, error: string) {
    console.log('Discarding task permanently')
    // Discard logic
  }

  private async executeFallbackAction(originalTask: any) {
    console.log('Executing fallback action')
    // Fallback logic
  }
}
```

## Compensation Pattern

### Saga Error Handling

```typescript
class SagaWithCompensation extends ShouldQueue<
  { transactionId: string; steps: any[] },
  { success: boolean; compensated: boolean }
> {
  public readonly taskName = 'saga-with-compensation'
  public readonly postUrl = '/api/tasks/saga'

  async handle(taskBody: { transactionId: string; steps: any[] }) {
    const { transactionId, steps } = taskBody
    const completedSteps = []

    try {
      // Execute all steps
      for (const step of steps) {
        await this.executeStep(step, transactionId)
        completedSteps.push(step)
      }

      return { success: true, compensated: false }
    } catch (error) {
      console.error(`Saga failed at step ${completedSteps.length + 1}:`, error)

      // Compensate completed steps in reverse order
      const compensationResults = []
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        try {
          await this.compensateStep(completedSteps[i], transactionId)
          compensationResults.push({ step: completedSteps[i], success: true })
        } catch (compensationError) {
          compensationResults.push({ step: completedSteps[i], success: false, error: compensationError.message })
        }
      }

      return { success: false, compensated: true, compensationResults }
    }
  }

  private async executeStep(step: any, transactionId: string) {
    console.log(`Executing step ${step.name} for transaction ${transactionId}`)
    // Step execution logic
  }

  private async compensateStep(step: any, transactionId: string) {
    console.log(`Compensating step ${step.name} for transaction ${transactionId}`)
    // Compensation logic
  }
}
```

## Error Monitoring and Alerting

### Error Tracking

```typescript
class MonitoredTask extends ShouldQueue<any, any> {
  private static errorTracker = new ErrorTracker()

  async handle(taskBody: any) {
    const startTime = Date.now()
    const taskId = this.generateTaskId()

    try {
      const result = await this.processTask(taskBody)
      
      // Track success metrics
      MonitoredTask.errorTracker.recordSuccess(this.taskName, Date.now() - startTime)
      
      return result
    } catch (error) {
      // Track error metrics
      MonitoredTask.errorTracker.recordError(this.taskName, error, {
        taskId,
        duration: Date.now() - startTime,
        taskBody: JSON.stringify(taskBody)
      })

      // Check if alerting is needed
      if (MonitoredTask.errorTracker.shouldAlert(this.taskName)) {
        await this.sendAlert(error, taskId)
      }

      throw error
    }
  }

  private generateTaskId(): string {
    return `${this.taskName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async sendAlert(error: Error, taskId: string) {
    console.error(`ALERT: Task ${this.taskName} (${taskId}) failed:`, error.message)
    // Send alert to monitoring system
  }
}

class ErrorTracker {
  private errors = new Map<string, any[]>()
  private successes = new Map<string, number>()

  recordError(taskName: string, error: Error, context: any) {
    if (!this.errors.has(taskName)) {
      this.errors.set(taskName, [])
    }
    
    this.errors.get(taskName)!.push({
      error: error.message,
      timestamp: new Date(),
      context
    })

    // Keep only last 100 errors
    const errors = this.errors.get(taskName)!
    if (errors.length > 100) {
      errors.shift()
    }
  }

  recordSuccess(taskName: string, duration: number) {
    const current = this.successes.get(taskName) || 0
    this.successes.set(taskName, current + 1)
  }

  shouldAlert(taskName: string): boolean {
    const errors = this.errors.get(taskName) || []
    const recentErrors = errors.filter(e => 
      Date.now() - e.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    )

    return recentErrors.length >= 5 // Alert on 5+ errors in 5 minutes
  }
}
```

## Error Recovery Strategies

### Checkpoint and Recovery

```typescript
class CheckpointTask extends ShouldQueue<
  { data: any; checkpoint?: any },
  { success: boolean; checkpoints: any[] }
> {
  public readonly taskName = 'checkpoint-task'
  public readonly postUrl = '/api/tasks/checkpoint'

  async handle(taskBody: { data: any; checkpoint?: any }) {
    const { data, checkpoint } = taskBody
    const checkpoints = []

    try {
      // Resume from checkpoint if available
      let currentStep = checkpoint?.step || 0
      let processedData = checkpoint?.data || data

      while (currentStep < this.getTotalSteps()) {
        // Process step
        processedData = await this.processStep(currentStep, processedData)
        currentStep++

        // Create checkpoint
        const newCheckpoint = {
          step: currentStep,
          data: processedData,
          timestamp: new Date()
        }
        checkpoints.push(newCheckpoint)

        // Save checkpoint for recovery
        await this.saveCheckpoint(newCheckpoint)
      }

      return { success: true, checkpoints }
    } catch (error) {
      console.error(`Task failed at step ${checkpoints.length}:`, error)
      
      // The checkpoint is already saved, so recovery can resume from here
      throw error
    }
  }

  private getTotalSteps(): number {
    return 5 // Example: 5 processing steps
  }

  private async processStep(step: number, data: any) {
    console.log(`Processing step ${step}`)
    // Step processing logic
    return { ...data, step }
  }

  private async saveCheckpoint(checkpoint: any) {
    console.log('Saving checkpoint:', checkpoint)
    // Save checkpoint to persistent storage
  }
}
```

### Graceful Degradation

```typescript
class GracefulDegradationTask extends ShouldQueue<
  { data: any; priority: 'high' | 'medium' | 'low' },
  { success: boolean; degraded: boolean }
> {
  public readonly taskName = 'graceful-degradation-task'
  public readonly postUrl = '/api/tasks/graceful-degradation'

  async handle(taskBody: { data: any; priority: 'high' | 'medium' | 'low' }) {
    const { data, priority } = taskBody

    try {
      // Try full processing
      const result = await this.processFullFeatures(data)
      return { success: true, degraded: false, result }
    } catch (error) {
      console.warn('Full processing failed, trying degraded mode:', error.message)

      try {
        // Try degraded processing
        const result = await this.processEssentialFeatures(data)
        return { success: true, degraded: true, result }
      } catch (degradedError) {
        if (priority === 'high') {
          // For high priority, try minimal processing
          const result = await this.processMinimalFeatures(data)
          return { success: true, degraded: true, result }
        }
        
        throw degradedError
      }
    }
  }

  private async processFullFeatures(data: any) {
    console.log('Processing with full features')
    // Full feature processing
    return { fullProcessing: true, data }
  }

  private async processEssentialFeatures(data: any) {
    console.log('Processing with essential features only')
    // Essential feature processing
    return { essentialProcessing: true, data }
  }

  private async processMinimalFeatures(data: any) {
    console.log('Processing with minimal features')
    // Minimal feature processing
    return { minimalProcessing: true, data }
  }
}
```

## Best Practices

1. **Categorize Errors**: Distinguish between transient and permanent failures
2. **Implement Idempotency**: Ensure operations can be safely retried
3. **Use Exponential Backoff**: Prevent overwhelming downstream services
4. **Monitor Error Rates**: Track and alert on error patterns
5. **Provide Fallbacks**: Always have a backup plan
6. **Log Comprehensively**: Include context for debugging
7. **Test Error Scenarios**: Regularly test error handling paths

## Common Error Categories

### Transient Errors
- Network timeouts
- Service unavailable
- Rate limiting
- Database connection issues

### Permanent Errors
- Invalid data format
- Authorization failures
- Resource not found
- Business rule violations

### System Errors
- Out of memory
- Disk full
- Service crashes
- Configuration errors

## Error Handling Checklist

- [ ] Implement retry logic with exponential backoff
- [ ] Add circuit breaker for external services
- [ ] Set up dead letter queue processing
- [ ] Implement error monitoring and alerting
- [ ] Add comprehensive logging
- [ ] Create fallback mechanisms
- [ ] Test error scenarios
- [ ] Document error handling procedures

## Next Steps

- Learn about [Queue Configuration](../setup/queue-configuration.md) for optimal error handling
- Explore [Monitoring and Observability](../setup/monitoring.md) for error tracking
- Check out [Workflow Patterns](workflow-patterns.md) for error-resilient workflows