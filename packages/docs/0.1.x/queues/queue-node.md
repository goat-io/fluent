# Queue Node - Node.js Queue Implementation

The `@goatlab/queue-node` package provides a Node.js-native implementation of the queue system using the `cron` library for job scheduling.

## Overview

Queue Node offers a lightweight, dependency-light solution for job scheduling that runs entirely within your Node.js process using cron jobs.

## Installation

```bash
npm install @goatlab/queue-node
```

## Basic Usage

### Setting Up the Node Scheduler

```typescript
import { Jobs } from '@goatlab/queue-core'
import { NodeScheduler } from '@goatlab/queue-node'

// Create a scheduler instance
const scheduler = new NodeScheduler()

// Use it with the Jobs API
const job = Jobs.using(scheduler)

// Schedule a job
await job.schedule({
  jobName: 'daily-cleanup',
  data: { type: 'cleanup' },
  repeat: {
    cronTime: 'hour',
    timeZone: 'Europe/Stockholm',
    runOnInit: false
  },
  handle: async (jobDescription) => {
    console.log('Running daily cleanup:', jobDescription.data)
  }
})
```

### One-Time Job Execution

```typescript
// Schedule a job to run once immediately
await job.schedule({
  jobName: 'send-welcome-email',
  data: { userId: 123, email: 'user@example.com' },
  handle: async (job) => {
    console.log(`Sending welcome email to ${job.data.email}`)
    // Email sending logic here
  }
})
```

### Recurring Jobs

```typescript
// Schedule a recurring job
await job.schedule({
  jobName: 'user-metrics-aggregation',
  data: { metric: 'daily_active_users' },
  repeat: {
    cronTime: 'hours6', // Every 6 hours
    timeZone: 'UTC',
    runOnInit: true // Run immediately on startup
  },
  handle: async (job) => {
    console.log('Aggregating user metrics:', job.data.metric)
    // Metrics aggregation logic
  }
})
```

## Cron Time Mapping

The Node scheduler maps friendly time intervals to cron expressions:

```typescript
const cronMappings = {
  'never': 'never',          // One-time execution
  'second': '* * * * * *',   // Every second
  'minute': '*/1 * * * *',   // Every minute
  'minutes5': '*/5 * * * *', // Every 5 minutes
  'minutes10': '*/10 * * * *', // Every 10 minutes
  'hour': '0 */1 * * *',     // Every hour
  'hours2': '0 */2 * * *',   // Every 2 hours
  'hours6': '0 */6 * * *',   // Every 6 hours
  // ... and more
}
```

## Time Zone Support

The Node scheduler supports various time zones:

```typescript
await job.schedule({
  jobName: 'timezone-aware-job',
  repeat: {
    cronTime: 'hour',
    timeZone: 'America/New_York', // Will run according to NY timezone
    runOnInit: false
  },
  handle: async (job) => {
    console.log('Running in NY timezone')
  }
})
```

## Error Handling

The Node scheduler includes built-in error handling:

```typescript
await job.schedule({
  jobName: 'error-prone-job',
  handle: async (job) => {
    try {
      await riskyOperation()
    } catch (error) {
      console.error('Job failed:', error)
      // Error is logged but job continues to run on schedule
    }
  }
})
```

## Advanced Configuration

### Custom Job Descriptions

```typescript
import { NodeScheduler } from '@goatlab/queue-node'

const scheduler = new NodeScheduler()

await scheduler.schedule({
  jobName: 'custom-job',
  data: { customData: 'value' },
  repeat: {
    cronTime: 'minutes30',
    timeZone: 'Europe/Stockholm',
    runOnInit: true
  },
  handle: async (jobDescription) => {
    console.log('Job ID:', jobDescription.id)
    console.log('Job Name:', jobDescription.name)
    console.log('Job Data:', jobDescription.data)
    console.log('Job Instance:', jobDescription.instance)
  }
})
```

### Immediate Execution

For one-time jobs (cronTime: 'never'), the scheduler automatically sets execution time to 0.25 seconds from now:

```typescript
// This will run almost immediately
await job.schedule({
  jobName: 'immediate-job',
  data: { urgent: true },
  handle: async (job) => {
    console.log('Running immediately!')
  }
})
```

## Use Cases

### 1. Data Cleanup Jobs

```typescript
await job.schedule({
  jobName: 'cleanup-temp-files',
  repeat: {
    cronTime: 'hours6',
    timeZone: 'UTC',
    runOnInit: false
  },
  handle: async () => {
    // Clean up temporary files
    console.log('Cleaning up temporary files')
  }
})
```

### 2. Report Generation

```typescript
await job.schedule({
  jobName: 'generate-daily-report',
  data: { reportType: 'daily' },
  repeat: {
    cronTime: 'hour', // Every hour
    timeZone: 'America/New_York',
    runOnInit: false
  },
  handle: async (job) => {
    console.log(`Generating ${job.data.reportType} report`)
    // Report generation logic
  }
})
```

### 3. Health Checks

```typescript
await job.schedule({
  jobName: 'health-check',
  repeat: {
    cronTime: 'minutes5',
    timeZone: 'UTC',
    runOnInit: true
  },
  handle: async () => {
    // Perform health checks
    console.log('Performing health check')
  }
})
```

## Comparison with Other Schedulers

| Feature | Node Scheduler | Agenda | Bull/BullMQ |
|---------|----------------|---------|-------------|
| Dependencies | Low (cron only) | MongoDB required | Redis required |
| Persistence | No | Yes | Yes |
| Clustering | No | Yes | Yes |
| Memory Usage | Low | Medium | Medium |
| Setup Complexity | Low | Medium | Medium |

## Best Practices

1. **Use for Simple Scheduling**: Node scheduler is perfect for simple, non-persistent job scheduling
2. **Monitor Memory**: Since jobs run in-process, monitor memory usage for long-running applications
3. **Error Handling**: Always include proper error handling in your job handlers
4. **Timezone Awareness**: Be explicit about time zones for recurring jobs

## Limitations

- **No Persistence**: Jobs are not persisted across application restarts
- **No Clustering**: Jobs run only in the current process
- **No Job Queue**: No built-in job queue or retry mechanisms
- **Memory Bound**: All jobs run in the same process memory space

## Next Steps

- For persistent jobs, consider [Bull/BullMQ Schedulers](schedulers.md)
- For distributed processing, explore [Message Brokers](brokers.md)
- Learn about [Task Processing](../tasks/tasks-core.md) for more complex workflows