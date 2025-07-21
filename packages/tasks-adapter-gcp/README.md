# @goatlab/tasks-adapter-gcp

Google Cloud Tasks adapter for the Goat task processing system. Provides a connector to queue and manage asynchronous tasks using Google Cloud Tasks with built-in encryption and retry logic.

## Installation

```bash
npm install @goatlab/tasks-adapter-gcp
# or
yarn add @goatlab/tasks-adapter-gcp
# or
pnpm add @goatlab/tasks-adapter-gcp
```

## Usage

```typescript
import { CloudTaskConnector } from '@goatlab/tasks-adapter-gcp'
import { ShouldQueue } from '@goatlab/tasks-core'

// Initialize the connector
const cloudTask = new CloudTaskConnector({
  gcpServiceAccount: {
    project_id: 'your-project-id',
    client_email: 'service-account@project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n...',
    // ... other service account fields
  },
  location: 'europe-west1',
  encryptionKey: 'your-encryption-key',
  gcpProject: 'your-project-id'
})

// Create a task class
class ProcessOrderTask extends ShouldQueue<{ orderId: string }> {
  postUrl = 'https://api.example.com/process-order'
  taskName = 'process_order'

  async handle(taskBody: { orderId: string }): Promise<void> {
    // Your task logic here
    console.log('Processing order:', taskBody.orderId)
  }
}

// Queue a task
const task = new ProcessOrderTask({ connector: cloudTask })
const status = await task.queue({ orderId: '12345' })

// Check task status
const taskStatus = await task.getStatus(status.id)
console.log('Task status:', taskStatus.status) // QUEUED, RUNNING, COMPLETED, or FAILED
```

## Key Features

- **Automatic encryption**: Task payloads are encrypted before transmission and decrypted on retrieval
- **Retry configuration**: Built-in exponential backoff retry logic for failed tasks
- **Status tracking**: Monitor task execution status (QUEUED, RUNNING, COMPLETED, FAILED)
- **Queue management**: Support for multiple named queues (defaults to 'default')
- **Full Cloud Tasks integration**: Access to all Google Cloud Tasks features through the underlying client

## Configuration Options

- `gcpServiceAccount`: Google Cloud service account credentials (or path to key file)
- `location`: GCP region for Cloud Tasks (default: 'europe-west1')
- `encryptionKey`: Key for encrypting/decrypting task payloads
- `gcpProject`: Google Cloud project ID
- `queueName`: Task queue name (default: 'default')
- `backoffSettings`: Custom retry configuration for task execution