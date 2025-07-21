# @goatlab/tasks-adapter-hatchet

Hatchet adapter for Goatlab's task processing system. Provides a seamless integration with [Hatchet](https://hatchet.run/) workflow engine for distributed task processing.

## Installation

```bash
npm install @goatlab/tasks-adapter-hatchet
# or
yarn add @goatlab/tasks-adapter-hatchet
# or
pnpm add @goatlab/tasks-adapter-hatchet
```

## Basic Usage

```typescript
import { HatchetConnector } from '@goatlab/tasks-adapter-hatchet'
import { ShouldQueue } from '@goatlab/tasks-core'

// Initialize Hatchet connector
const hatchetConnector = new HatchetConnector({
  token: process.env.HATCHET_JWT_TOKEN,
  hostAndPort: 'localhost:7077',  // optional, defaults to localhost:7077
  apiUrl: 'http://localhost:8888', // optional, defaults to http://localhost:8888
  logLevel: 'INFO',                // optional, defaults to INFO
  tenantId: 'your-tenant-id'       // optional
})

// Define a task
class MyTask extends ShouldQueue<{ message: string }> {
  taskName = 'process_message'
  
  async handle(taskBody: { message: string }): Promise<void> {
    console.log('Processing:', taskBody.message)
    // Your task logic here
  }
}

// Create task instance
const myTask = new MyTask({ connector: hatchetConnector })

// Start worker to process tasks
await hatchetConnector.startWorker({
  workerName: 'my-worker',
  tasks: [myTask],
  slots: 100  // concurrent task capacity
})

// Queue a task
const status = await myTask.queue({ message: 'Hello Hatchet!' })
console.log('Task queued:', status.id)

// Check task status
const taskStatus = await myTask.getStatus(status.id)
console.log('Task status:', taskStatus.status)
```

## Key Features

- **Seamless Integration**: Works with Goatlab's task system using Hatchet as the backend
- **Worker Management**: Easy worker creation with configurable concurrency slots
- **Task Status Tracking**: Monitor task execution status and results
- **Retry Support**: Built-in retry mechanism for failed tasks
- **Type Safety**: Full TypeScript support with strongly-typed task payloads

## Configuration Options

- `token` (required): Hatchet JWT authentication token
- `hostAndPort`: Hatchet server address (default: `localhost:7077`)
- `apiUrl`: Hatchet API URL (default: `http://localhost:8888`)
- `logLevel`: Logging verbosity (`INFO`, `OFF`, `DEBUG`, `WARN`, `ERROR`)
- `tenantId`: Hatchet tenant identifier for multi-tenant setups