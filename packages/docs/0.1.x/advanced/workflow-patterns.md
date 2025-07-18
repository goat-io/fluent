# Workflow Patterns - Complex Task Orchestration

This guide covers advanced patterns for orchestrating complex workflows using the Goat Fluent queue and task systems.

## Overview

Workflow patterns enable you to coordinate multiple tasks, handle complex business logic, and build resilient distributed systems. Common patterns include:

- **Sequential Processing**: Tasks executed in order
- **Parallel Processing**: Tasks executed simultaneously
- **Conditional Workflows**: Tasks based on conditions
- **Error Handling**: Robust error recovery
- **Compensation**: Rollback mechanisms
- **State Management**: Workflow state tracking

## Sequential Workflow Pattern

### Basic Sequential Processing

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'

class OrderProcessingWorkflow extends ShouldQueue<
  { orderId: string; userId: string },
  { success: boolean; steps: string[] }
> {
  public readonly taskName = 'order-processing-workflow'
  public readonly postUrl = '/api/workflows/order-processing'

  async handle(taskBody: { orderId: string; userId: string }) {
    const completedSteps = []

    try {
      // Step 1: Validate order
      await this.validateOrder(taskBody.orderId)
      completedSteps.push('validate-order')

      // Step 2: Process payment
      await this.processPayment(taskBody.orderId)
      completedSteps.push('process-payment')

      // Step 3: Reserve inventory
      await this.reserveInventory(taskBody.orderId)
      completedSteps.push('reserve-inventory')

      // Step 4: Create shipment
      await this.createShipment(taskBody.orderId)
      completedSteps.push('create-shipment')

      // Step 5: Send confirmation
      await this.sendConfirmation(taskBody.userId, taskBody.orderId)
      completedSteps.push('send-confirmation')

      return { success: true, steps: completedSteps }
    } catch (error) {
      // Rollback completed steps
      await this.rollbackSteps(completedSteps, taskBody.orderId)
      throw error
    }
  }

  private async validateOrder(orderId: string) {
    console.log(`Validating order ${orderId}`)
    // Validation logic
  }

  private async processPayment(orderId: string) {
    console.log(`Processing payment for order ${orderId}`)
    // Payment processing logic
  }

  private async reserveInventory(orderId: string) {
    console.log(`Reserving inventory for order ${orderId}`)
    // Inventory reservation logic
  }

  private async createShipment(orderId: string) {
    console.log(`Creating shipment for order ${orderId}`)
    // Shipment creation logic
  }

  private async sendConfirmation(userId: string, orderId: string) {
    console.log(`Sending confirmation to user ${userId}`)
    // Confirmation sending logic
  }

  private async rollbackSteps(steps: string[], orderId: string) {
    console.log(`Rolling back steps: ${steps.join(', ')}`)
    // Rollback logic for each step
  }
}
```

### Chain of Responsibility Pattern

```typescript
abstract class WorkflowStep {
  protected nextStep?: WorkflowStep

  setNext(step: WorkflowStep): WorkflowStep {
    this.nextStep = step
    return step
  }

  abstract execute(context: any): Promise<any>

  protected async executeNext(context: any): Promise<any> {
    if (this.nextStep) {
      return await this.nextStep.execute(context)
    }
    return context
  }
}

class ValidationStep extends WorkflowStep {
  async execute(context: any) {
    console.log('Validating data...')
    // Validation logic
    context.validated = true
    return await this.executeNext(context)
  }
}

class ProcessingStep extends WorkflowStep {
  async execute(context: any) {
    console.log('Processing data...')
    // Processing logic
    context.processed = true
    return await this.executeNext(context)
  }
}

class NotificationStep extends WorkflowStep {
  async execute(context: any) {
    console.log('Sending notifications...')
    // Notification logic
    context.notified = true
    return await this.executeNext(context)
  }
}

// Usage
const workflow = new ValidationStep()
workflow
  .setNext(new ProcessingStep())
  .setNext(new NotificationStep())

const result = await workflow.execute({ orderId: '123' })
```

## Parallel Processing Pattern

### Concurrent Task Execution

```typescript
class ParallelProcessingWorkflow extends ShouldQueue<
  { dataId: string; tasks: string[] },
  { results: any[]; completed: number }
> {
  public readonly taskName = 'parallel-processing-workflow'
  public readonly postUrl = '/api/workflows/parallel-processing'

  async handle(taskBody: { dataId: string; tasks: string[] }) {
    const { dataId, tasks } = taskBody

    // Execute tasks in parallel
    const results = await Promise.allSettled([
      this.processData(dataId),
      this.generateReport(dataId),
      this.sendNotifications(dataId),
      this.updateAnalytics(dataId)
    ])

    // Process results
    const completedTasks = results.filter(r => r.status === 'fulfilled')
    const failedTasks = results.filter(r => r.status === 'rejected')

    console.log(`Completed: ${completedTasks.length}, Failed: ${failedTasks.length}`)

    return {
      results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason),
      completed: completedTasks.length
    }
  }

  private async processData(dataId: string) {
    console.log(`Processing data ${dataId}`)
    // Data processing logic
    return { task: 'processData', success: true }
  }

  private async generateReport(dataId: string) {
    console.log(`Generating report for ${dataId}`)
    // Report generation logic
    return { task: 'generateReport', success: true }
  }

  private async sendNotifications(dataId: string) {
    console.log(`Sending notifications for ${dataId}`)
    // Notification logic
    return { task: 'sendNotifications', success: true }
  }

  private async updateAnalytics(dataId: string) {
    console.log(`Updating analytics for ${dataId}`)
    // Analytics logic
    return { task: 'updateAnalytics', success: true }
  }
}
```

### Controlled Concurrency

```typescript
class BatchProcessingWorkflow extends ShouldQueue<
  { items: any[]; batchSize: number },
  { processed: number; failed: number }
> {
  public readonly taskName = 'batch-processing-workflow'
  public readonly postUrl = '/api/workflows/batch-processing'

  async handle(taskBody: { items: any[]; batchSize: number }) {
    const { items, batchSize } = taskBody
    let processed = 0
    let failed = 0

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const results = await Promise.allSettled(
        batch.map(item => this.processItem(item))
      )

      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          processed++
        } else {
          failed++
        }
      })

      // Optional: Add delay between batches
      await this.sleep(100)
    }

    return { processed, failed }
  }

  private async processItem(item: any) {
    console.log(`Processing item ${item.id}`)
    // Item processing logic
    return { itemId: item.id, success: true }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## Conditional Workflow Pattern

### Decision-Based Routing

```typescript
class ConditionalWorkflow extends ShouldQueue<
  { userId: string; userType: string; action: string },
  { path: string; result: any }
> {
  public readonly taskName = 'conditional-workflow'
  public readonly postUrl = '/api/workflows/conditional'

  async handle(taskBody: { userId: string; userType: string; action: string }) {
    const { userId, userType, action } = taskBody

    // Route based on user type
    let result: any
    let path: string

    switch (userType) {
      case 'premium':
        result = await this.processPremiumUser(userId, action)
        path = 'premium-path'
        break
      case 'standard':
        result = await this.processStandardUser(userId, action)
        path = 'standard-path'
        break
      case 'trial':
        result = await this.processTrialUser(userId, action)
        path = 'trial-path'
        break
      default:
        throw new Error(`Unknown user type: ${userType}`)
    }

    return { path, result }
  }

  private async processPremiumUser(userId: string, action: string) {
    console.log(`Processing premium user ${userId} with action ${action}`)
    // Premium user logic
    return { features: ['all'], priority: 'high' }
  }

  private async processStandardUser(userId: string, action: string) {
    console.log(`Processing standard user ${userId} with action ${action}`)
    // Standard user logic
    return { features: ['basic'], priority: 'medium' }
  }

  private async processTrialUser(userId: string, action: string) {
    console.log(`Processing trial user ${userId} with action ${action}`)
    // Trial user logic
    return { features: ['limited'], priority: 'low' }
  }
}
```

### State Machine Pattern

```typescript
enum WorkflowState {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

class StateMachineWorkflow extends ShouldQueue<
  { requestId: string; currentState: WorkflowState; data: any },
  { finalState: WorkflowState; transitions: string[] }
> {
  public readonly taskName = 'state-machine-workflow'
  public readonly postUrl = '/api/workflows/state-machine'

  async handle(taskBody: { requestId: string; currentState: WorkflowState; data: any }) {
    const { requestId, currentState, data } = taskBody
    const transitions = []
    let nextState = currentState

    // State transitions
    switch (currentState) {
      case WorkflowState.INITIATED:
        nextState = await this.processInitiated(requestId, data)
        break
      case WorkflowState.PROCESSING:
        nextState = await this.processProcessing(requestId, data)
        break
      case WorkflowState.APPROVED:
        nextState = await this.processApproved(requestId, data)
        break
      case WorkflowState.REJECTED:
        nextState = await this.processRejected(requestId, data)
        break
      default:
        throw new Error(`Invalid state: ${currentState}`)
    }

    transitions.push(`${currentState} -> ${nextState}`)

    // Continue processing if not in final state
    if (nextState !== WorkflowState.COMPLETED && nextState !== WorkflowState.FAILED) {
      const continuationResult = await this.handle({
        requestId,
        currentState: nextState,
        data
      })
      transitions.push(...continuationResult.transitions)
      nextState = continuationResult.finalState
    }

    return { finalState: nextState, transitions }
  }

  private async processInitiated(requestId: string, data: any): Promise<WorkflowState> {
    console.log(`Processing initiated request ${requestId}`)
    // Validation logic
    return WorkflowState.PROCESSING
  }

  private async processProcessing(requestId: string, data: any): Promise<WorkflowState> {
    console.log(`Processing request ${requestId}`)
    // Business logic
    return Math.random() > 0.5 ? WorkflowState.APPROVED : WorkflowState.REJECTED
  }

  private async processApproved(requestId: string, data: any): Promise<WorkflowState> {
    console.log(`Processing approved request ${requestId}`)
    // Approval logic
    return WorkflowState.COMPLETED
  }

  private async processRejected(requestId: string, data: any): Promise<WorkflowState> {
    console.log(`Processing rejected request ${requestId}`)
    // Rejection logic
    return WorkflowState.FAILED
  }
}
```

## Error Handling Patterns

### Saga Pattern

```typescript
class SagaWorkflow extends ShouldQueue<
  { transactionId: string; operations: string[] },
  { success: boolean; compensations: string[] }
> {
  public readonly taskName = 'saga-workflow'
  public readonly postUrl = '/api/workflows/saga'

  async handle(taskBody: { transactionId: string; operations: string[] }) {
    const { transactionId, operations } = taskBody
    const completedOperations = []
    const compensations = []

    try {
      // Execute operations
      for (const operation of operations) {
        await this.executeOperation(operation, transactionId)
        completedOperations.push(operation)
      }

      return { success: true, compensations: [] }
    } catch (error) {
      console.error(`Saga failed at operation ${completedOperations.length + 1}:`, error)

      // Compensate completed operations in reverse order
      for (let i = completedOperations.length - 1; i >= 0; i--) {
        const operation = completedOperations[i]
        try {
          await this.compensateOperation(operation, transactionId)
          compensations.push(operation)
        } catch (compensationError) {
          console.error(`Compensation failed for ${operation}:`, compensationError)
        }
      }

      return { success: false, compensations }
    }
  }

  private async executeOperation(operation: string, transactionId: string) {
    console.log(`Executing operation ${operation} for transaction ${transactionId}`)
    
    switch (operation) {
      case 'reserve-inventory':
        await this.reserveInventory(transactionId)
        break
      case 'process-payment':
        await this.processPayment(transactionId)
        break
      case 'create-shipment':
        await this.createShipment(transactionId)
        break
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  private async compensateOperation(operation: string, transactionId: string) {
    console.log(`Compensating operation ${operation} for transaction ${transactionId}`)
    
    switch (operation) {
      case 'reserve-inventory':
        await this.releaseInventory(transactionId)
        break
      case 'process-payment':
        await this.refundPayment(transactionId)
        break
      case 'create-shipment':
        await this.cancelShipment(transactionId)
        break
    }
  }

  private async reserveInventory(transactionId: string) {
    // Inventory reservation logic
  }

  private async processPayment(transactionId: string) {
    // Payment processing logic
  }

  private async createShipment(transactionId: string) {
    // Shipment creation logic
  }

  private async releaseInventory(transactionId: string) {
    // Inventory release logic
  }

  private async refundPayment(transactionId: string) {
    // Payment refund logic
  }

  private async cancelShipment(transactionId: string) {
    // Shipment cancellation logic
  }
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreakerWorkflow extends ShouldQueue<
  { serviceId: string; data: any },
  { success: boolean; fallbackUsed: boolean }
> {
  public readonly taskName = 'circuit-breaker-workflow'
  public readonly postUrl = '/api/workflows/circuit-breaker'

  private circuitBreakers = new Map<string, CircuitBreaker>()

  async handle(taskBody: { serviceId: string; data: any }) {
    const { serviceId, data } = taskBody
    const circuitBreaker = this.getCircuitBreaker(serviceId)

    try {
      if (circuitBreaker.isOpen()) {
        console.log(`Circuit breaker is open for service ${serviceId}`)
        const fallbackResult = await this.executeFallback(serviceId, data)
        return { success: true, fallbackUsed: true, result: fallbackResult }
      }

      const result = await circuitBreaker.execute(() => this.callService(serviceId, data))
      return { success: true, fallbackUsed: false, result }
    } catch (error) {
      console.error(`Service call failed for ${serviceId}:`, error)
      const fallbackResult = await this.executeFallback(serviceId, data)
      return { success: false, fallbackUsed: true, result: fallbackResult }
    }
  }

  private getCircuitBreaker(serviceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 10000 // 10 seconds
      }))
    }
    return this.circuitBreakers.get(serviceId)!
  }

  private async callService(serviceId: string, data: any) {
    console.log(`Calling service ${serviceId}`)
    // Service call logic
    return { serviceId, data, timestamp: new Date() }
  }

  private async executeFallback(serviceId: string, data: any) {
    console.log(`Executing fallback for service ${serviceId}`)
    // Fallback logic
    return { serviceId, data, fallback: true }
  }
}

class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(private config: {
    failureThreshold: number
    resetTimeout: number
    monitoringPeriod: number
  }) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN'
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
    }
  }
}
```

## Message-Driven Workflows

### Event-Driven Pattern

```typescript
import { RabbitMQBroker } from '@goatlab/queue-core'

class EventDrivenWorkflow extends ShouldQueue<
  { eventType: string; payload: any },
  { eventsProcessed: number }
> {
  public readonly taskName = 'event-driven-workflow'
  public readonly postUrl = '/api/workflows/event-driven'

  private broker: RabbitMQBroker

  constructor(options: any) {
    super(options)
    this.broker = new RabbitMQBroker('amqp://localhost')
  }

  async handle(taskBody: { eventType: string; payload: any }) {
    const { eventType, payload } = taskBody

    // Process the event
    await this.processEvent(eventType, payload)

    // Emit follow-up events
    await this.emitFollowUpEvents(eventType, payload)

    return { eventsProcessed: 1 }
  }

  private async processEvent(eventType: string, payload: any) {
    console.log(`Processing event ${eventType}:`, payload)

    switch (eventType) {
      case 'user.created':
        await this.handleUserCreated(payload)
        break
      case 'order.placed':
        await this.handleOrderPlaced(payload)
        break
      case 'payment.processed':
        await this.handlePaymentProcessed(payload)
        break
      default:
        console.warn(`Unknown event type: ${eventType}`)
    }
  }

  private async emitFollowUpEvents(eventType: string, payload: any) {
    const followUpEvents = this.getFollowUpEvents(eventType, payload)

    for (const event of followUpEvents) {
      await this.broker.publish({
        queueName: 'workflow-events',
        topic: event.type,
        data: event.payload
      })
    }
  }

  private getFollowUpEvents(eventType: string, payload: any) {
    const events = []

    switch (eventType) {
      case 'user.created':
        events.push({
          type: 'email.welcome',
          payload: { userId: payload.userId, email: payload.email }
        })
        break
      case 'order.placed':
        events.push({
          type: 'inventory.reserve',
          payload: { orderId: payload.orderId, items: payload.items }
        })
        break
    }

    return events
  }

  private async handleUserCreated(payload: any) {
    console.log(`Handling user created: ${payload.userId}`)
    // User creation logic
  }

  private async handleOrderPlaced(payload: any) {
    console.log(`Handling order placed: ${payload.orderId}`)
    // Order processing logic
  }

  private async handlePaymentProcessed(payload: any) {
    console.log(`Handling payment processed: ${payload.paymentId}`)
    // Payment processing logic
  }
}
```

## Best Practices

1. **Idempotency**: Ensure workflow steps can be safely retried
2. **State Management**: Track workflow state for recovery
3. **Error Handling**: Implement comprehensive error handling
4. **Compensation**: Provide rollback mechanisms for failed workflows
5. **Monitoring**: Log workflow execution for debugging
6. **Timeouts**: Set appropriate timeouts for long-running workflows

## Common Pitfalls

1. **Blocking Operations**: Avoid blocking the event loop
2. **Resource Leaks**: Properly clean up resources
3. **Cascading Failures**: Implement circuit breakers
4. **State Inconsistency**: Use proper state management
5. **Memory Leaks**: Monitor workflow memory usage

## Performance Considerations

1. **Batch Processing**: Process multiple items together
2. **Parallel Execution**: Use appropriate concurrency levels
3. **Caching**: Cache frequently accessed data
4. **Resource Pooling**: Reuse expensive resources
5. **Monitoring**: Track workflow performance metrics

## Next Steps

- Learn about [Error Handling Strategies](error-handling.md) for robust workflows
- Explore [Monitoring and Observability](../setup/monitoring.md) for workflow tracking
- Check out [Queue Configuration](../setup/queue-configuration.md) for optimal performance