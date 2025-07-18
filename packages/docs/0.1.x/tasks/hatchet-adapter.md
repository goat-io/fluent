# Hatchet Workflow Engine Adapter

The `@goatlab/tasks-adapter-hatchet` package provides integration with the Hatchet workflow engine for distributed task processing and workflow orchestration.

## Overview

Hatchet is a distributed, fault-tolerant task queue and workflow engine. This adapter integrates Hatchet with the Goat Fluent task system, enabling:

- **Distributed Workflows**: Complex multi-step workflows
- **Fault Tolerance**: Built-in retry and error handling
- **Scalability**: Horizontal scaling across multiple workers
- **Observability**: Comprehensive monitoring and logging

## Installation

```bash
npm install @goatlab/tasks-adapter-hatchet @hatchet-dev/typescript-sdk
```

## Setup

### 1. Hatchet Server Setup

First, set up a Hatchet server (local development):

```bash
# Clone and run Hatchet server
git clone https://github.com/hatchet-dev/hatchet
cd hatchet
docker-compose up -d

# Or use Docker directly
docker run -p 8080:8080 -p 7077:7077 hatchet-dev/hatchet-server
```

### 2. Environment Configuration

```bash
# Environment variables
export HATCHET_CLIENT_TOKEN="your-hatchet-token"
export HATCHET_CLIENT_HOST_PORT="localhost:7077"
export HATCHET_CLIENT_API_URL="http://localhost:8888"
export HATCHET_CLIENT_TENANT_ID="your-tenant-id"
```

### 3. Initialize the Connector

```typescript
import { HatchetConnector } from '@goatlab/tasks-adapter-hatchet'

const connector = new HatchetConnector({
  token: process.env.HATCHET_CLIENT_TOKEN,
  hostAndPort: 'localhost:7077',
  apiUrl: 'http://localhost:8888',
  logLevel: 'INFO',
  tenantId: process.env.HATCHET_CLIENT_TENANT_ID
})
```

## Basic Usage

### Creating a Hatchet Task

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'
import { HatchetConnector } from '@goatlab/tasks-adapter-hatchet'

class ProcessOrderTask extends ShouldQueue<
  { orderId: string; items: Array<{ productId: string; quantity: number }> },
  { success: boolean; totalAmount: number }
> {
  public readonly taskName = 'process-order'
  public readonly postUrl = '/api/tasks/process-order'
  public retries = 3

  async handle(taskBody: { orderId: string; items: any[] }) {
    console.log(`Processing order ${taskBody.orderId}`)

    // Calculate total amount
    const totalAmount = taskBody.items.reduce((sum, item) => 
      sum + (item.quantity * 10), 0
    )

    // Process payment
    await this.processPayment(taskBody.orderId, totalAmount)

    // Update inventory
    await this.updateInventory(taskBody.items)

    return { success: true, totalAmount }
  }

  private async processPayment(orderId: string, amount: number) {
    console.log(`Processing payment for order ${orderId}: $${amount}`)
    // Payment processing logic
  }

  private async updateInventory(items: any[]) {
    console.log('Updating inventory for items:', items)
    // Inventory update logic
  }
}

// Initialize with Hatchet connector
const connector = new HatchetConnector({
  token: process.env.HATCHET_CLIENT_TOKEN,
  hostAndPort: 'localhost:7077',
  apiUrl: 'http://localhost:8888',
  logLevel: 'INFO'
})

const task = new ProcessOrderTask({
  connector,
  basePostUrl: 'https://api.example.com'
})
```

### Queueing Tasks

```typescript
// Queue a task for processing
const taskStatus = await task.queue({
  orderId: 'order-123',
  items: [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1 }
  ]
})

console.log('Task queued with ID:', taskStatus.id)
console.log('Status:', taskStatus.status)
```

### Task Status Monitoring

```typescript
// Check task status
const status = await task.getStatus(taskStatus.id)

console.log('Task status:', status.status)
console.log('Attempts:', status.attempts)
console.log('Created:', status.created)
console.log('Output:', status.output)
```

## Worker Management

### Starting Workers

```typescript
// Create multiple tasks
const tasks = [
  new ProcessOrderTask({ connector }),
  new SendEmailTask({ connector }),
  new GenerateReportTask({ connector })
]

// Start a worker to process these tasks
const worker = await connector.startWorker({
  workerName: 'order-processor',
  tasks: tasks,
  slots: 10 // Number of concurrent task slots
})

console.log('Worker started and ready to process tasks')
```

### Worker Configuration

```typescript
// Advanced worker configuration
const worker = await connector.startWorker({
  workerName: 'high-throughput-worker',
  tasks: [
    new DataProcessingTask({ connector }),
    new ImageProcessingTask({ connector }),
    new EmailTask({ connector })
  ],
  slots: 50 // High concurrency for fast tasks
})

// Worker automatically generates unique name with nano ID
// Result: "high-throughput-worker-abc123"
```

## Advanced Features

### Workflow Orchestration

```typescript
// Create a complex workflow task
class OrderFulfillmentWorkflow extends ShouldQueue<
  { orderId: string; userId: string },
  { completed: boolean; steps: string[] }
> {
  public readonly taskName = 'order-fulfillment-workflow'
  public readonly postUrl = '/api/workflows/order-fulfillment'

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

      // Step 4: Ship order
      await this.shipOrder(taskBody.orderId)
      completedSteps.push('ship-order')

      // Step 5: Send confirmation
      await this.sendConfirmation(taskBody.userId, taskBody.orderId)
      completedSteps.push('send-confirmation')

      return { completed: true, steps: completedSteps }
    } catch (error) {
      console.error('Workflow failed at step:', completedSteps.length + 1)
      throw error
    }
  }

  private async validateOrder(orderId: string) {
    console.log(`Validating order ${orderId}`)
    // Validation logic
  }

  private async processPayment(orderId: string) {
    console.log(`Processing payment for order ${orderId}`)
    // Payment logic
  }

  private async reserveInventory(orderId: string) {
    console.log(`Reserving inventory for order ${orderId}`)
    // Inventory logic
  }

  private async shipOrder(orderId: string) {
    console.log(`Shipping order ${orderId}`)
    // Shipping logic
  }

  private async sendConfirmation(userId: string, orderId: string) {
    console.log(`Sending confirmation to user ${userId} for order ${orderId}`)
    // Notification logic
  }
}
```

### Error Handling and Retries

```typescript
class RetryableTask extends ShouldQueue<
  { data: string; retryCount?: number },
  { success: boolean; attempts: number }
> {
  public readonly taskName = 'retryable-task'
  public readonly postUrl = '/api/tasks/retryable'
  public retries = 5 // Hatchet will retry up to 5 times

  async handle(taskBody: { data: string; retryCount?: number }) {
    const currentAttempt = (taskBody.retryCount || 0) + 1

    try {
      // Simulate a task that might fail
      if (Math.random() < 0.6) {
        throw new Error('Random failure for testing')
      }

      console.log(`Task succeeded on attempt ${currentAttempt}`)
      return { success: true, attempts: currentAttempt }
    } catch (error) {
      console.error(`Task failed on attempt ${currentAttempt}:`, error)
      
      // Hatchet will automatically retry based on retries setting
      throw error
    }
  }
}
```

## Hatchet-Specific Features

### Task Registration

```typescript
// Get Hatchet task definition
const hatchetTask = connector.getHatchetTask(task)

// Manually register with Hatchet (usually done automatically)
const hatchetClient = connector.getHatchetClient()
const worker = await hatchetClient.worker('manual-worker', {
  workflows: [hatchetTask]
})
```

### Direct Hatchet API Usage

```typescript
// Access Hatchet client directly
const hatchetClient = connector.getHatchetClient()

// Use Hatchet API directly
const taskResult = await hatchetClient.task({
  name: 'direct-task',
  retries: 3,
  fn: async (input) => {
    console.log('Direct Hatchet task:', input)
    return { result: 'success' }
  }
}).runNoWait({ data: 'test' })

console.log('Direct task ID:', await taskResult.runId)
```

## Configuration Options

### Connector Configuration

```typescript
const connector = new HatchetConnector({
  token: 'your-hatchet-token',
  hostAndPort: 'localhost:7077',    // Hatchet server gRPC endpoint
  apiUrl: 'http://localhost:8888',  // Hatchet API endpoint
  logLevel: 'DEBUG',                // Logging level
  tenantId: 'your-tenant-id'        // Optional tenant ID
})
```

### Environment-Based Configuration

```typescript
// Production configuration
const connector = new HatchetConnector({
  token: process.env.HATCHET_CLIENT_TOKEN,
  hostAndPort: process.env.HATCHET_CLIENT_HOST_PORT || 'hatchet.example.com:7077',
  apiUrl: process.env.HATCHET_CLIENT_API_URL || 'https://api.hatchet.example.com',
  logLevel: process.env.NODE_ENV === 'production' ? 'WARN' : 'INFO',
  tenantId: process.env.HATCHET_CLIENT_TENANT_ID
})
```

## Monitoring and Observability

### Task Lifecycle Monitoring

```typescript
class MonitoredTask extends ShouldQueue<
  { taskId: string; data: any },
  { result: any; metrics: any }
> {
  public readonly taskName = 'monitored-task'
  public readonly postUrl = '/api/tasks/monitored'

  async handle(taskBody: { taskId: string; data: any }) {
    const startTime = Date.now()
    
    try {
      console.log(`Starting task ${taskBody.taskId}`)
      
      // Process the task
      const result = await this.processTask(taskBody.data)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      console.log(`Task ${taskBody.taskId} completed in ${duration}ms`)
      
      return {
        result,
        metrics: {
          duration,
          startTime,
          endTime,
          success: true
        }
      }
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      console.error(`Task ${taskBody.taskId} failed after ${duration}ms:`, error)
      
      return {
        result: null,
        metrics: {
          duration,
          startTime,
          endTime,
          success: false,
          error: error.message
        }
      }
    }
  }

  private async processTask(data: any) {
    // Task processing logic
    return { processed: true, data }
  }
}
```

### Health Checks

```typescript
// Check Hatchet connectivity
const healthCheck = async () => {
  try {
    const hatchetClient = connector.getHatchetClient()
    
    // Attempt to create a simple task
    const testTask = hatchetClient.task({
      name: 'health-check',
      retries: 0,
      fn: async () => ({ status: 'healthy' })
    })
    
    const result = await testTask.runNoWait({})
    const runId = await result.runId
    
    console.log('Hatchet health check passed:', runId)
    return true
  } catch (error) {
    console.error('Hatchet health check failed:', error)
    return false
  }
}
```

## Performance Optimization

### Worker Scaling

```typescript
// Scale workers based on load
const scaleWorkers = async (taskTypes: string[], load: number) => {
  const workerCount = Math.min(Math.max(1, Math.ceil(load / 10)), 10)
  
  for (let i = 0; i < workerCount; i++) {
    await connector.startWorker({
      workerName: `auto-scaled-worker-${i}`,
      tasks: taskTypes.map(type => createTaskByType(type)),
      slots: 20
    })
  }
}
```

### Batch Processing

```typescript
class BatchHatchetTask extends ShouldQueue<
  { batchId: string; items: any[] },
  { processedCount: number; failedCount: number }
> {
  public readonly taskName = 'batch-processing'
  public readonly postUrl = '/api/tasks/batch'

  async handle(taskBody: { batchId: string; items: any[] }) {
    let processedCount = 0
    let failedCount = 0

    // Process items in parallel with controlled concurrency
    const batchSize = 10
    for (let i = 0; i < taskBody.items.length; i += batchSize) {
      const batch = taskBody.items.slice(i, i + batchSize)
      
      const results = await Promise.allSettled(
        batch.map(item => this.processItem(item))
      )

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          processedCount++
        } else {
          failedCount++
        }
      })
    }

    return { processedCount, failedCount }
  }

  private async processItem(item: any) {
    // Process individual item
    console.log('Processing item:', item)
  }
}
```

## Best Practices

1. **Worker Management**: Use appropriate worker counts and slot configurations
2. **Error Handling**: Implement comprehensive error handling and retry logic
3. **Resource Management**: Monitor memory usage and connection pools
4. **Monitoring**: Implement health checks and performance metrics
5. **Scaling**: Use horizontal scaling for high-throughput scenarios

## Common Use Cases

### Data Pipeline Processing

```typescript
class DataPipelineTask extends ShouldQueue<
  { pipelineId: string; inputData: any },
  { outputData: any; stages: string[] }
> {
  public readonly taskName = 'data-pipeline'
  public readonly postUrl = '/api/tasks/data-pipeline'

  async handle(taskBody: { pipelineId: string; inputData: any }) {
    const stages = []
    let currentData = taskBody.inputData

    // Stage 1: Data validation
    currentData = await this.validateData(currentData)
    stages.push('validate')

    // Stage 2: Data transformation
    currentData = await this.transformData(currentData)
    stages.push('transform')

    // Stage 3: Data enrichment
    currentData = await this.enrichData(currentData)
    stages.push('enrich')

    // Stage 4: Data storage
    await this.storeData(currentData)
    stages.push('store')

    return { outputData: currentData, stages }
  }

  private async validateData(data: any) {
    console.log('Validating data')
    return data
  }

  private async transformData(data: any) {
    console.log('Transforming data')
    return data
  }

  private async enrichData(data: any) {
    console.log('Enriching data')
    return data
  }

  private async storeData(data: any) {
    console.log('Storing data')
  }
}
```

### Long-Running Jobs

```typescript
class LongRunningTask extends ShouldQueue<
  { jobId: string; duration: number },
  { completed: boolean; elapsed: number }
> {
  public readonly taskName = 'long-running-job'
  public readonly postUrl = '/api/tasks/long-running'

  async handle(taskBody: { jobId: string; duration: number }) {
    const startTime = Date.now()
    
    console.log(`Starting long-running job ${taskBody.jobId}`)
    
    // Simulate long-running work with progress updates
    const steps = 10
    const stepDuration = taskBody.duration / steps
    
    for (let i = 1; i <= steps; i++) {
      await this.sleep(stepDuration)
      console.log(`Job ${taskBody.jobId} progress: ${i}/${steps}`)
    }
    
    const elapsed = Date.now() - startTime
    console.log(`Job ${taskBody.jobId} completed in ${elapsed}ms`)
    
    return { completed: true, elapsed }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check Hatchet server status and network connectivity
2. **Task Not Executing**: Verify worker is running and task is registered
3. **High Memory Usage**: Monitor worker memory consumption
4. **Task Timeouts**: Adjust timeout settings for long-running tasks

### Debug Mode

```typescript
// Enable debug logging
const connector = new HatchetConnector({
  token: process.env.HATCHET_CLIENT_TOKEN,
  hostAndPort: 'localhost:7077',
  apiUrl: 'http://localhost:8888',
  logLevel: 'DEBUG' // Enable detailed logging
})

// Log task execution details
class DebugTask extends ShouldQueue<any, any> {
  async handle(taskBody: any) {
    console.log('Task input:', JSON.stringify(taskBody, null, 2))
    
    const result = await this.processTask(taskBody)
    
    console.log('Task output:', JSON.stringify(result, null, 2))
    
    return result
  }
}
```

## Next Steps

- Learn about [Workflow Patterns](../advanced/workflow-patterns.md) for complex orchestration
- Explore [Error Handling Strategies](../advanced/error-handling.md) for robust task processing
- Check out [Monitoring and Observability](../setup/monitoring.md) for production monitoring