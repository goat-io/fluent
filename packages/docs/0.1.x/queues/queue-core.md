# Queue Core - Core Queue Abstractions

The `@goatlab/queue-core` package provides the foundational abstractions for job scheduling and message queue processing in the Goat Fluent ecosystem.

## Overview

Queue Core offers a unified interface for job scheduling and message brokering that works across different implementations (Agenda, Bull, BullMQ, RabbitMQ, Kafka, etc.).

## Key Components

### Jobs Class

The `Jobs` class provides the main interface for job scheduling:

```typescript
import { Jobs } from '@goatlab/queue-core'

// Initialize with a specific scheduler
const myScheduler = new MyCustomScheduler()
const job = Jobs.using(myScheduler)

// Schedule a job
await job.schedule({
  jobName: 'process-user-signup',
  data: { userId: 123 },
  handle: async (job) => {
    console.log(`Processing user signup for ${job.data.userId}`)
  }
})
```

### Message Broker System

The message broker system provides publish/subscribe capabilities:

```typescript
import { Message } from '@goatlab/queue-core'
import { RabbitMQBroker } from '@goatlab/queue-core'

// Register a message broker
const broker = new RabbitMQBroker('amqp://localhost')
await broker.connect()

Message.register('rabbitmq', broker)

// Use the broker
const messageBroker = Message.using('rabbitmq')
await messageBroker.publish({
  queueName: 'user-events',
  data: { event: 'user-created', userId: 123 }
})
```

## Job Types and Interfaces

### Job Interface

```typescript
export type Job = {
  data?: DataMap
  jobName: string
  repeat?: Repeat
  lockTime?: number
  handle(job: JobDescription): Promise<void>
}
```

### JobDescription Interface

```typescript
export interface JobDescription {
  id: string
  name: string
  data?: DataMap
  instance: any
}
```

### Repeat Configuration

```typescript
export type Repeat = {
  cronTime: RepeatEvery
  timeZone: TimeZones
  runOnInit: boolean
}
```

## Scheduler Interface

All schedulers must implement the `Scheduler` interface:

```typescript
export interface Scheduler {
  schedule(props: Job): Promise<void>
}
```

### Example Custom Scheduler

```typescript
class MyCustomScheduler implements Scheduler {
  async schedule(props: Job): Promise<void> {
    // Your custom scheduling logic
    console.log(`Scheduling job: ${props.jobName}`)
    
    // Handle immediate execution
    if (!props.repeat) {
      await props.handle({
        id: generateId(),
        name: props.jobName,
        data: props.data,
        instance: null
      })
    }
  }
}
```

## Supported Time Zones

The system supports multiple time zones:

```typescript
export type TimeZones =
  | 'UTC'
  | 'Europe/Stockholm'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'America/New_York'
  | 'America/Los_Angeles'
  | 'Asia/Tokyo'
  | 'Asia/Shanghai'
  // ... and more
```

## Repeat Intervals

Predefined repeat intervals are available:

```typescript
export type RepeatEvery =
  | 'never'
  | 'second'
  | 'minute'
  | 'minutes5'
  | 'minutes10'
  | 'hour'
  | 'hours2'
  | 'hours6'
  // ... and more
```

## Error Handling

The system includes built-in error handling with retry logic:

```typescript
await job.schedule({
  jobName: 'risky-operation',
  lockTime: 30000, // 30 seconds
  handle: async (job) => {
    try {
      await riskyOperation(job.data)
    } catch (error) {
      console.error('Job failed:', error)
      throw error // Will be retried based on scheduler configuration
    }
  }
})
```

## Worker Configuration

Configure worker processes for better performance:

```typescript
// Set maximum event listeners
Jobs.setMaxListeners(100)

// Access worker cluster
const worker = Jobs.worker()
```

## Next Steps

- Learn about specific message brokers in [Message Brokers](brokers.md)
- Explore scheduler implementations in [Schedulers](schedulers.md)
- Check out the Node.js implementation in [Queue Node](queue-node.md)