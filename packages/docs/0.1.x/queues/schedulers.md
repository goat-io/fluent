# Schedulers - Agenda, Bull, and BullMQ Setup

The `@goatlab/queue-core` package provides integration with popular job schedulers for persistent, distributed job processing.

## Overview

Schedulers provide persistent job storage and distributed processing capabilities. The system supports:

- **Agenda**: MongoDB-based job scheduler
- **Bull**: Redis-based job queue (legacy)
- **BullMQ**: Modern Redis-based job queue
- **Node Scheduler**: Built-in cron-based scheduler

## Scheduler Interface

All schedulers implement the `Scheduler` interface:

```typescript
export interface Scheduler {
  schedule(props: Job): Promise<void>
}
```

## Agenda Scheduler

### Installation

```bash
npm install agenda
```

### Basic Setup

```typescript
import { Jobs } from '@goatlab/queue-core'

// Note: Agenda implementation is currently commented out
// This shows the intended API structure

const agenda = new AgendaScheduler({
  mongoUrl: 'mongodb://localhost:27017/jobs',
  collection: 'jobs'
})

const job = Jobs.using(agenda)
```

### Configuration

```typescript
// Agenda configuration options
const agendaConfig = {
  db: {
    address: 'mongodb://localhost:27017/jobs',
    collection: '_goat_jobs'
  },
  defaultConcurrency: 5,
  defaultLockLifetime: 600000, // 10 minutes
  lockLimit: 0,
  maxConcurrency: 20,
  processEvery: '1000'
}
```

### Scheduling Jobs

```typescript
await job.schedule({
  jobName: 'send-email',
  data: { to: 'user@example.com', subject: 'Welcome!' },
  repeat: {
    cronTime: 'minutes5',
    timeZone: 'Europe/Stockholm',
    runOnInit: false
  },
  lockTime: 10000, // 10 seconds
  handle: async (jobDescription) => {
    console.log('Sending email:', jobDescription.data)
    // Email sending logic
  }
})
```

### Agenda Features

- **Persistent Storage**: Jobs are stored in MongoDB
- **Distributed Processing**: Multiple instances can process jobs
- **Cron-like Scheduling**: Supports cron expressions
- **Job Locking**: Prevents duplicate job execution
- **Failure Handling**: Automatic retry mechanisms

## Bull Scheduler

### Installation

```bash
npm install bull redis
```

### Basic Setup

```typescript
import { Jobs } from '@goatlab/queue-core'

// Note: Bull implementation is currently commented out
// This shows the intended API structure

const bullScheduler = new BullScheduler({
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0
  }
})

const job = Jobs.using(bullScheduler)
```

### Configuration

```typescript
// Bull Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  family: 4 // IPv4
}
```

### Scheduling Jobs

```typescript
await job.schedule({
  jobName: 'process-image',
  data: { imageId: 123, userId: 456 },
  repeat: {
    cronTime: 'hour',
    timeZone: 'UTC',
    runOnInit: false
  },
  handle: async (jobDescription) => {
    console.log('Processing image:', jobDescription.data)
    // Image processing logic
  }
})
```

### Bull Features

- **Redis Storage**: Fast, in-memory job storage
- **Job Queues**: Multiple named queues
- **Delayed Jobs**: Schedule jobs for future execution
- **Job Priorities**: Priority-based job processing
- **Web UI**: Built-in job monitoring dashboard

## BullMQ Scheduler

### Installation

```bash
npm install bullmq ioredis
```

### Basic Setup

```typescript
import { Jobs } from '@goatlab/queue-core'

// Note: BullMQ implementation is currently commented out
// This shows the intended API structure

const bullMQScheduler = new BullMQScheduler({
  connection: {
    host: 'localhost',
    port: 6379,
    db: 0
  }
})

const job = Jobs.using(bullMQScheduler)
```

### Configuration

```typescript
// BullMQ connection configuration
const connectionConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  family: 4 // IPv4
}
```

### Scheduling Jobs

```typescript
await job.schedule({
  jobName: 'generate-report',
  data: { reportType: 'monthly', userId: 789 },
  repeat: {
    cronTime: 'hours24', // Daily
    timeZone: 'America/New_York',
    runOnInit: false
  },
  handle: async (jobDescription) => {
    console.log('Generating report:', jobDescription.data)
    // Report generation logic
  }
})
```

### BullMQ Features

- **Modern Architecture**: Built on top of Redis streams
- **Better Performance**: Improved performance over Bull
- **Flow Control**: Complex job workflows
- **Job Events**: Comprehensive job lifecycle events
- **TypeScript Support**: Full TypeScript support

## Node Scheduler

### Installation

```bash
npm install @goatlab/queue-node
```

### Basic Setup

```typescript
import { Jobs } from '@goatlab/queue-core'
import { NodeScheduler } from '@goatlab/queue-node'

const nodeScheduler = new NodeScheduler()
const job = Jobs.using(nodeScheduler)
```

### Scheduling Jobs

```typescript
await job.schedule({
  jobName: 'cleanup-logs',
  data: { directory: '/var/log/app' },
  repeat: {
    cronTime: 'hours6',
    timeZone: 'UTC',
    runOnInit: false
  },
  handle: async (jobDescription) => {
    console.log('Cleaning logs:', jobDescription.data)
    // Log cleanup logic
  }
})
```

## Time Zone Support

All schedulers support comprehensive time zone handling:

```typescript
// Supported time zones
const timeZones = [
  'UTC',
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  // ... and more
]

// Usage
await job.schedule({
  jobName: 'timezone-aware-job',
  repeat: {
    cronTime: 'hour',
    timeZone: 'Asia/Tokyo', // Job runs in Tokyo time
    runOnInit: false
  },
  handle: async (job) => {
    console.log('Running in Tokyo timezone')
  }
})
```

## Cron Expression Mapping

Friendly interval names are mapped to cron expressions:

```typescript
const cronMappings = {
  'never': 'one-time execution',
  'second': '* * * * * *',
  'minute': '*/1 * * * *',
  'minutes5': '*/5 * * * *',
  'minutes10': '*/10 * * * *',
  'minutes30': '*/30 * * * *',
  'hour': '0 */1 * * *',
  'hours2': '0 */2 * * *',
  'hours6': '0 */6 * * *',
  'hours12': '0 */12 * * *',
  'hours24': '0 0 * * *' // Daily
}
```

## Scheduler Comparison

| Feature | Agenda | Bull | BullMQ | Node |
|---------|--------|------|--------|------|
| **Storage** | MongoDB | Redis | Redis | Memory |
| **Persistence** | Yes | Yes | Yes | No |
| **Clustering** | Yes | Yes | Yes | No |
| **Web UI** | Third-party | Built-in | Third-party | No |
| **Performance** | Medium | High | Very High | Low |
| **Dependencies** | MongoDB | Redis | Redis | None |
| **Complexity** | Medium | Medium | Medium | Low |

## Error Handling

### Job Failure Handling

```typescript
await job.schedule({
  jobName: 'error-prone-job',
  lockTime: 30000, // 30 seconds
  handle: async (jobDescription) => {
    try {
      await riskyOperation(jobDescription.data)
    } catch (error) {
      console.error('Job failed:', error)
      // Depending on scheduler:
      // - Agenda: Will retry based on configuration
      // - Bull/BullMQ: Will retry based on queue settings
      // - Node: Will log error and continue
      throw error
    }
  }
})
```

### Retry Configuration

```typescript
// Agenda retry configuration
const agendaJob = {
  jobName: 'retry-job',
  lockTime: 10000,
  // Retry logic handled by Agenda internally
  handle: async (job) => {
    // Job logic
  }
}

// Bull/BullMQ retry configuration
const bullJob = {
  jobName: 'retry-job',
  // Retry configuration handled at queue level
  handle: async (job) => {
    // Job logic
  }
}
```

## Performance Optimization

### Agenda Optimization

```typescript
// Optimize Agenda for high throughput
const agendaConfig = {
  defaultConcurrency: 10,     // Concurrent jobs per job type
  maxConcurrency: 50,         // Total concurrent jobs
  processEvery: '5 seconds',  // How often to check for jobs
  lockLimit: 10,              // Max locks per job type
  defaultLockLifetime: 300000 // 5 minutes
}
```

### Bull/BullMQ Optimization

```typescript
// Optimize Redis connection
const redisConfig = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  maxmemoryPolicy: 'allkeys-lru'
}
```

## Monitoring and Observability

### Job Metrics

```typescript
await job.schedule({
  jobName: 'monitored-job',
  handle: async (jobDescription) => {
    const startTime = Date.now()
    
    try {
      await processJob(jobDescription.data)
      const duration = Date.now() - startTime
      console.log(`Job completed in ${duration}ms`)
    } catch (error) {
      console.error('Job failed:', error)
      // Send to monitoring system
    }
  }
})
```

### Health Checks

```typescript
// Check scheduler health
const healthCheck = async () => {
  try {
    // For Redis-based schedulers
    await redisClient.ping()
    
    // For MongoDB-based schedulers
    await mongoClient.admin().ping()
    
    console.log('Scheduler is healthy')
  } catch (error) {
    console.error('Scheduler health check failed:', error)
  }
}
```

## Best Practices

1. **Choose the Right Scheduler**: 
   - Node: Development and simple use cases
   - Agenda: MongoDB-based applications
   - Bull/BullMQ: High-performance, Redis-based

2. **Error Handling**: Always implement comprehensive error handling

3. **Resource Management**: Monitor memory and connection usage

4. **Job Naming**: Use descriptive job names for better debugging

5. **Time Zones**: Be explicit about time zones for scheduled jobs

6. **Monitoring**: Implement health checks and metrics collection

## Next Steps

- Learn about [Message Brokers](brokers.md) for distributed messaging
- Explore [Task Processing](../tasks/tasks-core.md) for complex workflows
- Check out [Queue Configuration](../setup/queue-configuration.md) for production setup