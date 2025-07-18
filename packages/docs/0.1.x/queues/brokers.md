# Message Brokers - RabbitMQ, Kafka, and FastQ Integration

The `@goatlab/queue-core` package provides adapters for popular message brokers to enable reliable message passing and distributed processing.

## Overview

Message brokers enable asynchronous communication between different parts of your application or between different services. The system supports:

- **RabbitMQ**: Enterprise-grade message broker
- **Kafka**: High-throughput distributed streaming platform
- **FastQ**: Lightweight in-memory queue for development

## Message Broker Interface

All message brokers implement the `MessageBroker` interface:

```typescript
export interface MessageBroker {
  connect(): Promise<void>
  publish(props: MessageProducer): Promise<boolean>
  subscribe(props: MessageSubscriber): Promise<void>
  close(): Promise<void>
}
```

## RabbitMQ Broker

### Installation

```bash
npm install amqplib
```

### Basic Setup

```typescript
import { RabbitMQBroker } from '@goatlab/queue-core'

const broker = new RabbitMQBroker('amqp://localhost:5672')
await broker.connect()
```

### Connection Options

```typescript
// String connection
const broker = new RabbitMQBroker('amqp://user:pass@localhost:5672')

// Object connection
const broker = new RabbitMQBroker({
  protocol: 'amqp',
  hostname: 'localhost',
  port: 5672,
  username: 'user',
  password: 'pass',
  vhost: '/'
})
```

### Publishing Messages

```typescript
await broker.publish({
  queueName: 'user-events',
  topic: 'user.created',
  data: {
    userId: 123,
    email: 'user@example.com',
    timestamp: new Date().toISOString()
  }
})
```

### Subscribing to Messages

```typescript
await broker.subscribe({
  queueName: 'user-events',
  topics: ['user.created', 'user.updated'],
  exclusiveQueues: false,
  handle: async (job) => {
    console.log('Processing message:', job.data)
    console.log('Topic:', job.name)
    console.log('Message ID:', job.id)
  }
})
```

### Advanced RabbitMQ Features

```typescript
// Exclusive queues (auto-delete when consumer disconnects)
await broker.subscribe({
  queueName: 'temp-processing',
  topics: ['temp.process'],
  exclusiveQueues: true,
  handle: async (job) => {
    // Process temporary data
  }
})

// Multiple topic bindings
await broker.subscribe({
  queueName: 'all-user-events',
  topics: ['user.*'], // Wildcard matching
  handle: async (job) => {
    console.log('User event:', job.name)
  }
})
```

## Kafka Broker

### Installation

```bash
npm install kafkajs
```

### Basic Setup

```typescript
import { KafkaBroker } from '@goatlab/queue-core'

const broker = new KafkaBroker(
  ['localhost:9092'], // Broker list
  'my-app-client-id'  // Client ID
)
await broker.connect()
```

### Publishing Messages

```typescript
await broker.publish({
  queueName: 'user-events', // Used as consumer group
  topic: 'user-topic',
  data: {
    userId: 123,
    action: 'login',
    timestamp: Date.now()
  }
})
```

### Subscribing to Messages

```typescript
await broker.subscribe({
  queueName: 'user-processor', // Consumer group ID
  topics: ['user-topic', 'order-topic'],
  handle: async (job) => {
    console.log('Kafka message:', job.data)
    console.log('Topic:', job.name)
    console.log('Partition info:', job.instance.partition)
  }
})
```

### Kafka Configuration

```typescript
// Multiple brokers with custom client ID
const broker = new KafkaBroker([
  'kafka1:9092',
  'kafka2:9092',
  'kafka3:9092'
], 'my-microservice')

// The broker automatically handles:
// - Producer connections
// - Consumer group management
// - Topic subscription
// - Message serialization/deserialization
```

## FastQ Broker

### Installation

```bash
npm install fastq
```

### Basic Setup

```typescript
import { FastQBroker } from '@goatlab/queue-core'

const broker = new FastQBroker()
await broker.connect() // No-op, but consistent interface
```

### Publishing Messages

```typescript
await broker.publish({
  queueName: 'local-processing',
  topic: 'process.data',
  data: {
    taskId: 'task-123',
    payload: { /* task data */ }
  }
})
```

### Subscribing to Messages

```typescript
await broker.subscribe({
  queueName: 'local-processing',
  topics: ['process.data'],
  handle: async (job) => {
    console.log('Processing local task:', job.data)
    // Process immediately in-memory
  }
})
```

### FastQ Configuration

```typescript
// FastQ is perfect for:
// - Development environments
// - Single-process applications
// - In-memory task processing
// - Testing scenarios

// Concurrency is controlled by the constructor
const broker = new FastQBroker() // Default concurrency: 1
```

## Universal Message API

### Using the Message Registry

```typescript
import { Message } from '@goatlab/queue-core'

// Register brokers
const rabbitBroker = new RabbitMQBroker('amqp://localhost')
await rabbitBroker.connect()
Message.register('rabbitmq', rabbitBroker)

const kafkaBroker = new KafkaBroker(['localhost:9092'])
await kafkaBroker.connect()
Message.register('kafka', kafkaBroker)

// Use any registered broker
const broker = Message.using('rabbitmq')
await broker.publish({
  queueName: 'events',
  topic: 'user.created',
  data: { userId: 123 }
})
```

### Environment-Based Configuration

```typescript
// Configuration based on environment
const brokerType = process.env.MESSAGE_BROKER || 'fastq'

let broker: MessageBroker

switch (brokerType) {
  case 'rabbitmq':
    broker = new RabbitMQBroker(process.env.RABBITMQ_URL)
    break
  case 'kafka':
    broker = new KafkaBroker(process.env.KAFKA_BROKERS.split(','))
    break
  default:
    broker = new FastQBroker()
}

await broker.connect()
Message.register('default', broker)
```

## Error Handling and Reliability

### RabbitMQ Error Handling

```typescript
await broker.subscribe({
  queueName: 'critical-processing',
  topics: ['critical.task'],
  handle: async (job) => {
    try {
      await processImportantTask(job.data)
      // Success - message will be acknowledged
    } catch (error) {
      console.error('Task failed:', error)
      // Error thrown - message will not be acknowledged
      // RabbitMQ will requeue the message
      throw error
    }
  }
})
```

### Kafka Error Handling

```typescript
await broker.subscribe({
  queueName: 'kafka-processor',
  topics: ['events'],
  handle: async (job) => {
    try {
      await processEvent(job.data)
    } catch (error) {
      console.error('Event processing failed:', error)
      // Kafka doesn't have automatic retry
      // Implement your own retry logic
      await handleFailedEvent(job.data, error)
    }
  }
})
```

## Performance Considerations

### RabbitMQ

- **Prefetch**: Automatically set to 1 for controlled processing
- **Connection Pooling**: Separate connections for publishing and consuming
- **Acknowledgments**: Manual acknowledgment for reliability

### Kafka

- **Consumer Groups**: Automatic load balancing across instances
- **Offset Management**: Automatic offset management
- **Partition Awareness**: Messages include partition information

### FastQ

- **Memory Bound**: All processing happens in memory
- **Single Process**: No distribution across processes
- **Immediate Processing**: No persistence, immediate execution

## Monitoring and Observability

### Connection Management

```typescript
// Monitor connection health
try {
  await broker.connect()
  console.log('Broker connected successfully')
} catch (error) {
  console.error('Broker connection failed:', error)
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await broker.close()
  process.exit(0)
})
```

### Message Metrics

```typescript
await broker.subscribe({
  queueName: 'metrics-queue',
  topics: ['events'],
  handle: async (job) => {
    const startTime = Date.now()
    
    try {
      await processMessage(job.data)
      const processingTime = Date.now() - startTime
      console.log(`Message processed in ${processingTime}ms`)
    } catch (error) {
      console.error('Message processing failed:', error)
      // Log to monitoring system
    }
  }
})
```

## Best Practices

1. **Connection Management**: Always call `connect()` before using the broker
2. **Error Handling**: Implement proper error handling in message handlers
3. **Graceful Shutdown**: Always call `close()` during application shutdown
4. **Topic Naming**: Use consistent topic naming conventions
5. **Message Schema**: Define clear message schemas for better maintainability

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check broker service status and connection strings
2. **Message Not Received**: Verify topic names and queue bindings
3. **High Memory Usage**: Monitor FastQ usage in production
4. **Acknowledgment Issues**: Ensure proper error handling in RabbitMQ

### Debug Mode

```typescript
// Enable debug logging
Message.setMaxListeners(0) // Unlimited listeners for debugging

// Log all messages
await broker.subscribe({
  queueName: 'debug-queue',
  topics: ['*'],
  handle: async (job) => {
    console.log('DEBUG - Message received:', {
      id: job.id,
      name: job.name,
      data: job.data
    })
  }
})
```

## Next Steps

- Learn about [Job Schedulers](schedulers.md) for time-based processing
- Explore [Task Processing](../tasks/tasks-core.md) for complex workflows
- Check out [Queue Configuration](../setup/queue-configuration.md) for production setup