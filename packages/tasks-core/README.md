# @goatlab/tasks-core

A TypeScript library providing a common interface for creating queueable tasks that can be executed by different task processing backends. This package defines the core abstractions for task queuing, status tracking, and execution handling.

## Installation

```bash
pnpm add @goatlab/tasks-core
```

## Basic Usage

Create a queueable task by extending the `ShouldQueue` abstract class:

```typescript
import { ShouldQueue, TaskConnector } from '@goatlab/tasks-core'

// Define your task input/output types
interface EmailTaskInput {
  to: string
  subject: string
  body: string
}

// Create your task class
class SendEmailTask extends ShouldQueue<EmailTaskInput, void> {
  taskName = 'send-email'
  postUrl = '/api/tasks/send-email'

  async handle(taskBody: EmailTaskInput): Promise<void> {
    // Your task logic here
    await sendEmail(taskBody.to, taskBody.subject, taskBody.body)
  }
}

// Initialize with a connector (e.g., GCP Cloud Tasks, Hatchet, etc.)
const emailTask = new SendEmailTask({
  connector: myTaskConnector,
  basePostUrl: 'https://api.example.com'
})

// Queue the task
const status = await emailTask.queue({
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up'
})

// Check task status
const taskStatus = await emailTask.getStatus(status.id)
```

## Key Features

- **Abstract task interface** - Define queueable tasks with consistent behavior
- **Type-safe** - Full TypeScript support for task inputs and outputs
- **Connector agnostic** - Works with any task backend that implements `TaskConnector`
- **Status tracking** - Monitor task execution with standardized status types
- **Retry support** - Built-in retry configuration for failed tasks
- **Unique task naming** - Override `getUniqueTaskName()` for deduplication