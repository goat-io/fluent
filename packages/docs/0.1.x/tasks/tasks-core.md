# Task Processing Core - Task Queue Abstractions

The `@goatlab/tasks-core` package provides high-level abstractions for task processing and workflow management, built on top of the queue system.

## Overview

Task Core provides a more structured approach to background job processing with:

- **Type-safe Task Definitions**: Strongly typed task inputs and outputs
- **Task Status Tracking**: Comprehensive task lifecycle management
- **Connector Architecture**: Pluggable task execution backends
- **HTTP Integration**: Built-in HTTP endpoint support for task triggers

## Key Components

### ShouldQueue Abstract Class

The `ShouldQueue` class is the base class for all task definitions:

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'

export class SendEmailTask extends ShouldQueue<
  { to: string; subject: string; body: string }, // Input type
  { messageId: string }                          // Output type
> {
  public readonly taskName = 'send-email'
  public readonly postUrl = '/api/tasks/send-email'
  public retries = 3

  async handle(taskBody: { to: string; subject: string; body: string }) {
    console.log(`Sending email to ${taskBody.to}`)
    
    // Email sending logic
    const messageId = await emailService.send(taskBody)
    
    return { messageId }
  }
}
```

### Task Connector Interface

All task connectors implement the `TaskConnector` interface:

```typescript
export interface TaskConnector<TInput> {
  queue(params: {
    uniqueTaskName: string
    taskName: string
    postUrl: string
    taskBody: TInput
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>>
  
  getStatus(id: string): Promise<TaskStatus>
}
```

## Basic Usage

### Creating a Task

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'

type ProcessOrderInput = {
  orderId: string
  userId: string
  items: Array<{ productId: string; quantity: number }>
}

type ProcessOrderOutput = {
  success: boolean
  orderId: string
  totalAmount: number
}

export class ProcessOrderTask extends ShouldQueue<
  ProcessOrderInput,
  ProcessOrderOutput
> {
  public readonly taskName = 'process-order'
  public readonly postUrl = '/api/tasks/process-order'
  public retries = 5

  async handle(taskBody: ProcessOrderInput): Promise<ProcessOrderOutput> {
    console.log(`Processing order ${taskBody.orderId}`)
    
    // Calculate total
    const totalAmount = await this.calculateOrderTotal(taskBody.items)
    
    // Process payment
    await this.processPayment(taskBody.userId, totalAmount)
    
    // Update inventory
    await this.updateInventory(taskBody.items)
    
    return {
      success: true,
      orderId: taskBody.orderId,
      totalAmount
    }
  }

  private async calculateOrderTotal(items: ProcessOrderInput['items']) {
    // Calculate total logic
    return items.reduce((total, item) => total + (item.quantity * 10), 0)
  }

  private async processPayment(userId: string, amount: number) {
    // Payment processing logic
    console.log(`Processing payment of $${amount} for user ${userId}`)
  }

  private async updateInventory(items: ProcessOrderInput['items']) {
    // Inventory update logic
    console.log('Updating inventory for items:', items)
  }
}
```

### Queueing Tasks

```typescript
import { ProcessOrderTask } from './tasks/ProcessOrderTask'

// Initialize the task with a connector
const task = new ProcessOrderTask({
  connector: taskConnector, // Your chosen connector
  basePostUrl: 'https://api.example.com'
})

// Queue the task
const taskStatus = await task.queue({
  orderId: 'order-123',
  userId: 'user-456',
  items: [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1 }
  ]
})

console.log('Task queued:', taskStatus.id)
```

### Checking Task Status

```typescript
// Get task status
const status = await task.getStatus(taskStatus.id)

console.log('Task status:', status.status)
console.log('Attempts:', status.attempts)
console.log('Output:', status.output)
```

## Task Status Types

### TaskStatus Interface

```typescript
export interface TaskStatus<T extends InputType = UnknownInputType> {
  id: string
  name: string
  status: TaskStatusName
  output: string
  attempts: number
  created: string
  nextRun: string | null
  nextRunMinutes: number | null
  payload: T
}
```

### Status Names

```typescript
export type TaskStatusName =
  | 'QUEUED'    // Task is waiting to be processed
  | 'RUNNING'   // Task is currently being processed
  | 'FAILED'    // Task failed and won't be retried
  | 'COMPLETED' // Task completed successfully
  | 'CANCELLED' // Task was cancelled
```

## Advanced Features

### Custom Task Names

Override the default task naming behavior:

```typescript
export class CustomNameTask extends ShouldQueue<{ userId: string }, void> {
  public readonly taskName = 'custom-task'
  public readonly postUrl = '/api/tasks/custom'

  // Generate unique task names based on input
  protected getUniqueTaskName(input: { userId: string }): string {
    return `${this.taskName}-${input.userId}`
  }

  async handle(taskBody: { userId: string }) {
    console.log(`Processing for user ${taskBody.userId}`)
  }
}
```

### Retry Configuration

```typescript
export class RetryableTask extends ShouldQueue<{ data: string }, void> {
  public readonly taskName = 'retryable-task'
  public readonly postUrl = '/api/tasks/retryable'
  public retries = 10 // Will retry up to 10 times

  async handle(taskBody: { data: string }) {
    // Potentially failing operation
    if (Math.random() > 0.7) {
      throw new Error('Random failure for testing')
    }
    
    console.log('Task succeeded:', taskBody.data)
  }
}
```

### HTTP Integration

Tasks automatically integrate with HTTP endpoints:

```typescript
export class HttpTask extends ShouldQueue<
  { webhookUrl: string; payload: any },
  { responseStatus: number }
> {
  public readonly taskName = 'webhook-call'
  public readonly postUrl = '/api/tasks/webhook'

  async handle(taskBody: { webhookUrl: string; payload: any }) {
    const response = await fetch(taskBody.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody.payload)
    })

    return { responseStatus: response.status }
  }
}
```

## Type Safety

### Input Type Constraints

```typescript
export type InputType = {
  [x: string]: JsonValue
} & {
  [x: string]: JsonValue
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JsonValue }
  | JsonValue[]
```

### Type-Safe Task Definition

```typescript
interface UserNotificationInput {
  userId: string
  message: string
  channel: 'email' | 'sms' | 'push'
  priority: 'low' | 'medium' | 'high'
}

interface UserNotificationOutput {
  sent: boolean
  messageId?: string
  error?: string
}

export class UserNotificationTask extends ShouldQueue<
  UserNotificationInput,
  UserNotificationOutput
> {
  public readonly taskName = 'user-notification'
  public readonly postUrl = '/api/tasks/notify'

  async handle(taskBody: UserNotificationInput): Promise<UserNotificationOutput> {
    try {
      const messageId = await this.sendNotification(taskBody)
      return { sent: true, messageId }
    } catch (error) {
      return { sent: false, error: error.message }
    }
  }

  private async sendNotification(input: UserNotificationInput): Promise<string> {
    // Channel-specific notification logic
    switch (input.channel) {
      case 'email':
        return await this.sendEmail(input.userId, input.message)
      case 'sms':
        return await this.sendSMS(input.userId, input.message)
      case 'push':
        return await this.sendPush(input.userId, input.message)
      default:
        throw new Error(`Unsupported channel: ${input.channel}`)
    }
  }
}
```

## Error Handling

### Task-Level Error Handling

```typescript
export class RobustTask extends ShouldQueue<{ data: string }, { result: string }> {
  public readonly taskName = 'robust-task'
  public readonly postUrl = '/api/tasks/robust'

  async handle(taskBody: { data: string }): Promise<{ result: string }> {
    try {
      const result = await this.processData(taskBody.data)
      return { result }
    } catch (error) {
      console.error('Task failed:', error)
      
      // Decide whether to retry or fail permanently
      if (error.code === 'TEMPORARY_FAILURE') {
        throw error // Will retry
      } else {
        // Log permanent failure and return error result
        return { result: `Failed: ${error.message}` }
      }
    }
  }

  private async processData(data: string): Promise<string> {
    // Simulation of data processing
    if (data === 'fail') {
      throw new Error('Processing failed')
    }
    return `Processed: ${data}`
  }
}
```

## Testing Tasks

### Unit Testing

```typescript
import { ProcessOrderTask } from './ProcessOrderTask'

describe('ProcessOrderTask', () => {
  let task: ProcessOrderTask
  
  beforeEach(() => {
    task = new ProcessOrderTask({
      connector: mockConnector,
      basePostUrl: 'http://test.com'
    })
  })

  test('should process order successfully', async () => {
    const input = {
      orderId: 'test-order',
      userId: 'test-user',
      items: [{ productId: 'prod-1', quantity: 2 }]
    }

    const result = await task.handle(input)

    expect(result.success).toBe(true)
    expect(result.orderId).toBe('test-order')
    expect(result.totalAmount).toBe(20)
  })

  test('should handle empty items array', async () => {
    const input = {
      orderId: 'empty-order',
      userId: 'test-user',
      items: []
    }

    const result = await task.handle(input)

    expect(result.totalAmount).toBe(0)
  })
})
```

### Integration Testing

```typescript
describe('Task Integration', () => {
  test('should queue and process task', async () => {
    const task = new ProcessOrderTask({
      connector: realConnector,
      basePostUrl: 'https://api.example.com'
    })

    const taskStatus = await task.queue({
      orderId: 'integration-test',
      userId: 'test-user',
      items: [{ productId: 'prod-1', quantity: 1 }]
    })

    expect(taskStatus.status).toBe('QUEUED')
    expect(taskStatus.id).toBeDefined()

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000))

    const finalStatus = await task.getStatus(taskStatus.id)
    expect(finalStatus.status).toBe('COMPLETED')
  })
})
```

## Best Practices

1. **Type Safety**: Always define strict input/output types
2. **Error Handling**: Implement comprehensive error handling
3. **Retry Logic**: Use appropriate retry counts for different task types
4. **Task Naming**: Use descriptive, unique task names
5. **Resource Management**: Clean up resources in task handlers
6. **Monitoring**: Log task execution for debugging and monitoring

## Common Patterns

### Data Processing Pipeline

```typescript
export class DataProcessingTask extends ShouldQueue<
  { inputFile: string; outputFile: string },
  { recordsProcessed: number }
> {
  public readonly taskName = 'data-processing'
  public readonly postUrl = '/api/tasks/process-data'

  async handle(taskBody: { inputFile: string; outputFile: string }) {
    let recordsProcessed = 0
    
    try {
      // Read input file
      const data = await this.readFile(taskBody.inputFile)
      
      // Process data
      const processedData = await this.processData(data)
      recordsProcessed = processedData.length
      
      // Write output file
      await this.writeFile(taskBody.outputFile, processedData)
      
      return { recordsProcessed }
    } catch (error) {
      console.error('Data processing failed:', error)
      throw error
    }
  }
}
```

### Batch Processing

```typescript
export class BatchProcessingTask extends ShouldQueue<
  { batchId: string; itemIds: string[] },
  { processedItems: number; failedItems: number }
> {
  public readonly taskName = 'batch-processing'
  public readonly postUrl = '/api/tasks/batch-process'

  async handle(taskBody: { batchId: string; itemIds: string[] }) {
    let processedItems = 0
    let failedItems = 0

    for (const itemId of taskBody.itemIds) {
      try {
        await this.processItem(itemId)
        processedItems++
      } catch (error) {
        console.error(`Failed to process item ${itemId}:`, error)
        failedItems++
      }
    }

    return { processedItems, failedItems }
  }

  private async processItem(itemId: string) {
    // Item processing logic
    console.log(`Processing item ${itemId}`)
  }
}
```

## Next Steps

- Learn about [Google Cloud Tasks](gcp-tasks.md) for cloud-based task processing
- Explore [Hatchet Adapter](hatchet-adapter.md) for workflow orchestration
- Check out [Workflow Patterns](../advanced/workflow-patterns.md) for complex task coordination