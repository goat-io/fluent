# @goatlab/queue-node

A Node.js-based scheduler implementation for the Goat queue system. This package provides a simple cron-based job scheduler using the `node-cron` library for executing recurring tasks.

## Installation

```bash
npm install @goatlab/queue-node
# or
yarn add @goatlab/queue-node
# or
pnpm add @goatlab/queue-node
```

## Usage

```typescript
import { NodeScheduler } from '@goatlab/queue-node'

const scheduler = new NodeScheduler()

// Schedule a job to run every minute
await scheduler.schedule({
  jobName: 'my-task',
  data: { message: 'Hello World' },
  repeat: {
    cronTime: 'minute',
    runOnInit: false,
    timeZone: 'EuropeStockholm'
  },
  handle: async (job) => {
    console.log('Job running:', job.name, job.data)
  }
})
```

## Features

- **Cron-based scheduling** - Built on top of the `cron` package for reliable task scheduling
- **Flexible intervals** - Support for various predefined intervals (seconds, minutes, hours)
- **Timezone support** - Schedule jobs in specific timezones
- **Queue-core compatible** - Implements the `Scheduler` interface from `@goatlab/queue-core`
- **Immediate execution** - Jobs without repeat settings run once after 250ms