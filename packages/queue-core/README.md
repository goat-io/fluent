# @goatlab/queue-core

Common interfaces and implementations for working with message brokers and job schedulers. Provides a unified API for different queue systems.

## Installation

```bash
npm install @goatlab/queue-core
# or
yarn add @goatlab/queue-core
# or
pnpm add @goatlab/queue-core
```

## Basic Usage

### Message Brokers

```typescript
import { FastQBroker, KafkaBroker, RabbitMQBroker } from '@goatlab/queue-core'

// FastQ (in-memory)
const fastq = new FastQBroker()
await fastq.connect()

// Kafka
const kafka = new KafkaBroker(['localhost:9092'], 'my-app')
await kafka.connect()

// RabbitMQ
const rabbitmq = new RabbitMQBroker('amqp://localhost')
await rabbitmq.connect()

// Publishing messages
await broker.publish({
  queueName: 'my-queue',
  data: { message: 'Hello World' },
  topic: 'my-topic' // optional
})

// Subscribing to messages
await broker.subscribe({
  queueName: 'my-queue',
  handle: async (job) => {
    console.log('Received:', job.data)
  },
  topics: ['my-topic'] // optional
})
```

### Job Schedulers

```typescript
import { Jobs } from '@goatlab/queue-core'

// Create a custom scheduler
class MyScheduler implements Scheduler {
  async schedule(props: Job): Promise<void> {
    // Implementation
  }
}

const scheduler = Jobs.using(new MyScheduler())

await scheduler.schedule({
  jobName: 'my-job',
  data: { foo: 'bar' },
  repeat: {
    cronTime: 'hour',
    timeZone: 'UTC',
    runOnInit: true
  },
  handle: async (job) => {
    console.log('Job executed:', job.data)
  }
})
```

## Supported Brokers

- **FastQ** - In-memory message queue using fastq
- **Kafka** - Apache Kafka broker using kafkajs
- **RabbitMQ** - RabbitMQ broker using amqplib

## Supported Schedulers

- **Agenda** - MongoDB-backed job scheduling
- **Bull** - Redis-backed job and message queue
- **BullMQ** - Modern Redis-backed queue system