# Google Cloud Tasks Integration

The `@goatlab/tasks-adapter-gcp` package provides integration with Google Cloud Tasks for scalable, distributed task processing in the cloud.

## Overview

Google Cloud Tasks is a fully managed service that allows you to manage the execution, dispatch, and delivery of distributed tasks. This adapter integrates Cloud Tasks with the Goat Fluent task system.

## Key Features

- **Fully Managed**: No infrastructure to manage
- **Scalable**: Automatic scaling based on demand
- **Reliable**: Built-in retry logic and error handling
- **Secure**: End-to-end encryption and authentication
- **HTTP Integration**: Direct HTTP endpoint invocation

## Installation

```bash
npm install @goatlab/tasks-adapter-gcp @google-cloud/tasks
```

## Setup

### 1. Google Cloud Configuration

First, set up your Google Cloud project and enable the Cloud Tasks API:

```bash
# Enable Cloud Tasks API
gcloud services enable cloudtasks.googleapis.com

# Create a service account
gcloud iam service-accounts create task-processor \
  --display-name="Task Processor Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:task-processor@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### 2. Service Account Key

Create and download a service account key:

```bash
gcloud iam service-accounts keys create task-processor-key.json \
  --iam-account=task-processor@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 3. Initialize the Connector

```typescript
import { CloudTaskConnector } from '@goatlab/tasks-adapter-gcp'

const connector = new CloudTaskConnector({
  gcpProject: 'your-project-id',
  location: 'us-central1',
  gcpServiceAccount: require('./task-processor-key.json'),
  encryptionKey: process.env.ENCRYPTION_KEY // 32-character encryption key
})
```

## Basic Usage

### Creating a Task with GCP Connector

```typescript
import { ShouldQueue } from '@goatlab/tasks-core'
import { CloudTaskConnector } from '@goatlab/tasks-adapter-gcp'

// Define your task
class ProcessImageTask extends ShouldQueue<
  { imageUrl: string; userId: string },
  { processedUrl: string }
> {
  public readonly taskName = 'process-image'
  public readonly postUrl = '/api/tasks/process-image'

  async handle(taskBody: { imageUrl: string; userId: string }) {
    console.log(`Processing image for user ${taskBody.userId}`)
    
    // Image processing logic
    const processedUrl = await this.processImage(taskBody.imageUrl)
    
    return { processedUrl }
  }

  private async processImage(imageUrl: string): Promise<string> {
    // Image processing implementation
    return `processed-${imageUrl}`
  }
}

// Initialize with GCP connector
const connector = new CloudTaskConnector({
  gcpProject: 'my-project',
  location: 'us-central1',
  gcpServiceAccount: serviceAccountKey,
  encryptionKey: 'your-32-character-encryption-key'
})

const task = new ProcessImageTask({
  connector,
  basePostUrl: 'https://your-api.com'
})

// Queue the task
const taskStatus = await task.queue({
  imageUrl: 'https://example.com/image.jpg',
  userId: 'user-123'
})

console.log('Task queued:', taskStatus.id)
```

### Task Status Tracking

```typescript
// Check task status
const status = await task.getStatus(taskStatus.id)

console.log('Status:', status.status)
console.log('Attempts:', status.attempts)
console.log('Next run:', status.nextRun)
console.log('Output:', status.output)
```

## Advanced Configuration

### Custom Queue Names

```typescript
const connector = new CloudTaskConnector({
  gcpProject: 'my-project',
  location: 'us-central1',
  gcpServiceAccount: serviceAccountKey,
  encryptionKey: encryption_key
})

// Add task to specific queue
await connector.addTask({
  task: {
    name: 'custom-task-name',
    httpRequest: {
      url: 'https://api.example.com/tasks/process',
      body: JSON.stringify({ data: 'task payload' })
    }
  },
  queueName: 'high-priority-queue', // Custom queue name
  backoffSettings: {
    maxRetries: 5,
    initialRetryDelayMillis: 1000,
    retryDelayMultiplier: 2,
    maxRetryDelayMillis: 30000
  }
})
```

### Retry Configuration

```typescript
const backoffSettings = {
  maxRetries: 3,                    // Maximum retry attempts
  initialRetryDelayMillis: 2000,    // Initial retry delay (2 seconds)
  retryDelayMultiplier: 1.5,        // Exponential backoff multiplier
  maxRetryDelayMillis: 60000,       // Maximum retry delay (60 seconds)
  initialRpcTimeoutMillis: 30000    // Initial RPC timeout (30 seconds)
}

await connector.addTask({
  task: taskDefinition,
  queueName: 'retry-queue',
  backoffSettings
})
```

### Scheduled Tasks

```typescript
// Schedule task for future execution
const futureTime = new Date(Date.now() + 3600000) // 1 hour from now

await connector.addTask({
  task: {
    name: 'scheduled-task',
    httpRequest: {
      url: 'https://api.example.com/tasks/scheduled',
      body: JSON.stringify({ scheduledData: 'value' })
    },
    scheduleTime: {
      seconds: Math.floor(futureTime.getTime() / 1000)
    }
  },
  queueName: 'scheduled-queue',
  backoffSettings: defaultBackoffSettings
})
```

## Security Features

### Message Encryption

The connector automatically encrypts task payloads:

```typescript
// Task bodies are automatically encrypted before sending
const encryptedTask = await connector.addTask({
  task: {
    httpRequest: {
      url: 'https://api.example.com/secure-task',
      body: JSON.stringify({ sensitiveData: 'secret-value' })
    }
  },
  queueName: 'secure-queue',
  backoffSettings: defaultBackoffSettings
})
```

### Decrypting Task Bodies

```typescript
// In your HTTP endpoint handler
import { CloudTaskConnector } from '@goatlab/tasks-adapter-gcp'

const connector = new CloudTaskConnector({
  gcpProject: 'my-project',
  encryptionKey: process.env.ENCRYPTION_KEY
})

// Decrypt incoming task body
app.post('/api/tasks/secure-task', (req, res) => {
  const decryptedBody = connector.decryptBody(req.body)
  
  console.log('Decrypted task data:', decryptedBody)
  
  // Process the task
  res.status(200).json({ success: true })
})
```

## Task Monitoring

### Listing Failed Tasks

```typescript
// Get all failed tasks in a queue
const failedTasks = await connector.listFailedTasks('my-queue')

console.log(`Found ${failedTasks.length} failed tasks`)

failedTasks.forEach(task => {
  console.log('Failed task:', {
    name: task.name,
    attempts: task.dispatchCount,
    lastError: task.lastAttempt?.responseStatus?.message
  })
})
```

### Task Status Monitoring

```typescript
// Monitor task progress
const monitorTask = async (taskId: string) => {
  const status = await connector.getStatus(taskId)
  
  switch (status.status) {
    case 'QUEUED':
      console.log(`Task ${taskId} is queued`)
      break
    case 'RUNNING':
      console.log(`Task ${taskId} is running`)
      break
    case 'COMPLETED':
      console.log(`Task ${taskId} completed successfully`)
      break
    case 'FAILED':
      console.log(`Task ${taskId} failed after ${status.attempts} attempts`)
      break
  }
  
  return status
}
```

## Error Handling

### Task Failure Scenarios

```typescript
class RobustTask extends ShouldQueue<
  { data: string },
  { result: string; error?: string }
> {
  public readonly taskName = 'robust-task'
  public readonly postUrl = '/api/tasks/robust'
  public retries = 3

  async handle(taskBody: { data: string }) {
    try {
      // Potentially failing operation
      const result = await this.processData(taskBody.data)
      return { result }
    } catch (error) {
      console.error('Task processing failed:', error)
      
      // For permanent failures, return error result
      if (error.code === 'PERMANENT_FAILURE') {
        return { result: '', error: error.message }
      }
      
      // For temporary failures, throw to trigger retry
      throw error
    }
  }

  private async processData(data: string): Promise<string> {
    // Simulate processing with potential failures
    if (Math.random() < 0.3) {
      throw new Error('Random processing failure')
    }
    return `Processed: ${data}`
  }
}
```

### HTTP Endpoint Error Handling

```typescript
// Task endpoint with proper error handling
app.post('/api/tasks/process-data', async (req, res) => {
  try {
    const taskBody = connector.decryptBody(req.body)
    
    // Process the task
    const result = await processTaskData(taskBody)
    
    res.status(200).json({ success: true, result })
  } catch (error) {
    console.error('Task processing failed:', error)
    
    // Return 500 to trigger Cloud Tasks retry
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})
```

## Performance Optimization

### Batch Processing

```typescript
class BatchProcessingTask extends ShouldQueue<
  { batchId: string; items: string[] },
  { processedCount: number }
> {
  public readonly taskName = 'batch-processing'
  public readonly postUrl = '/api/tasks/batch-process'

  async handle(taskBody: { batchId: string; items: string[] }) {
    const batchSize = 100
    let processedCount = 0

    // Process items in batches
    for (let i = 0; i < taskBody.items.length; i += batchSize) {
      const batch = taskBody.items.slice(i, i + batchSize)
      
      try {
        await this.processBatch(batch)
        processedCount += batch.length
      } catch (error) {
        console.error(`Batch processing failed for batch ${i}:`, error)
        // Continue with next batch
      }
    }

    return { processedCount }
  }

  private async processBatch(items: string[]) {
    // Batch processing logic
    console.log(`Processing batch of ${items.length} items`)
  }
}
```

### Queue Configuration

```typescript
// Configure different queues for different priorities
const highPriorityConnector = new CloudTaskConnector({
  gcpProject: 'my-project',
  location: 'us-central1',
  gcpServiceAccount: serviceAccountKey,
  encryptionKey: encryptionKey
})

const lowPriorityConnector = new CloudTaskConnector({
  gcpProject: 'my-project',
  location: 'us-central1',
  gcpServiceAccount: serviceAccountKey,
  encryptionKey: encryptionKey
})

// Use appropriate connector based on task priority
const useConnector = (priority: 'high' | 'low') => {
  return priority === 'high' ? highPriorityConnector : lowPriorityConnector
}
```

## Best Practices

1. **Security**: Always use encryption for sensitive task data
2. **Retry Logic**: Configure appropriate backoff settings
3. **Queue Management**: Use separate queues for different priorities
4. **Monitoring**: Implement comprehensive task monitoring
5. **Error Handling**: Handle both temporary and permanent failures
6. **Resource Management**: Set appropriate timeouts and limits

## Common Use Cases

### Image Processing Pipeline

```typescript
class ImageProcessingTask extends ShouldQueue<
  { imageUrl: string; transformations: string[] },
  { processedImages: string[] }
> {
  public readonly taskName = 'image-processing'
  public readonly postUrl = '/api/tasks/image-processing'

  async handle(taskBody: { imageUrl: string; transformations: string[] }) {
    const processedImages = []

    for (const transformation of taskBody.transformations) {
      try {
        const processedUrl = await this.applyTransformation(
          taskBody.imageUrl,
          transformation
        )
        processedImages.push(processedUrl)
      } catch (error) {
        console.error(`Transformation ${transformation} failed:`, error)
      }
    }

    return { processedImages }
  }

  private async applyTransformation(imageUrl: string, transformation: string) {
    // Image transformation logic
    return `${imageUrl}?transform=${transformation}`
  }
}
```

### Data Export Task

```typescript
class DataExportTask extends ShouldQueue<
  { userId: string; format: 'csv' | 'json'; includeHistory: boolean },
  { exportUrl: string; recordCount: number }
> {
  public readonly taskName = 'data-export'
  public readonly postUrl = '/api/tasks/data-export'

  async handle(taskBody: { userId: string; format: string; includeHistory: boolean }) {
    console.log(`Exporting data for user ${taskBody.userId}`)

    // Gather user data
    const userData = await this.gatherUserData(taskBody.userId, taskBody.includeHistory)
    
    // Generate export file
    const exportUrl = await this.generateExportFile(userData, taskBody.format)
    
    return { exportUrl, recordCount: userData.length }
  }

  private async gatherUserData(userId: string, includeHistory: boolean) {
    // Data gathering logic
    return [] // Placeholder
  }

  private async generateExportFile(data: any[], format: string) {
    // Export file generation logic
    return `https://exports.example.com/user-data.${format}`
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify service account permissions
2. **Encryption Failures**: Check encryption key configuration
3. **Queue Not Found**: Ensure queue exists in specified region
4. **HTTP Timeouts**: Adjust timeout settings for long-running tasks

### Debug Mode

```typescript
// Enable debug logging
const connector = new CloudTaskConnector({
  gcpProject: 'my-project',
  location: 'us-central1',
  gcpServiceAccount: serviceAccountKey,
  encryptionKey: encryptionKey
})

// Log task details
console.log('Queueing task with details:', {
  taskName: 'debug-task',
  queueName: 'debug-queue',
  postUrl: '/api/tasks/debug'
})
```

## Next Steps

- Explore [Hatchet Adapter](hatchet-adapter.md) for workflow orchestration
- Learn about [Workflow Patterns](../advanced/workflow-patterns.md) for complex task coordination
- Check out [Cloud Integration Setup](../setup/cloud-integration.md) for production configuration