# Queue Configuration - Production Setup

This guide covers production-ready configuration for the Goat Fluent queue and task systems.

## Overview

Proper queue configuration is essential for optimal performance, reliability, and scalability in production environments.

## Environment Configuration

### Development Environment

```bash
# .env.development
NODE_ENV=development
QUEUE_PROVIDER=node
MESSAGE_BROKER=fastq
REDIS_URL=redis://localhost:6379
MONGO_URL=mongodb://localhost:27017/jobs
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
QUEUE_PROVIDER=bullmq
MESSAGE_BROKER=rabbitmq
REDIS_URL=redis://redis-cluster:6379
MONGO_URL=mongodb://mongo-cluster:27017/jobs
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
```

## Queue Provider Configuration

### BullMQ Configuration

```typescript
const bullMQConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxmemoryPolicy: 'allkeys-lru'
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
  }
}
```

### Agenda Configuration

```typescript
const agendaConfig = {
  db: {
    address: process.env.MONGO_URL,
    collection: 'jobs',
    options: {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    }
  },
  processEvery: '10 seconds',
  defaultConcurrency: 5,
  maxConcurrency: 20,
  defaultLockLimit: 0,
  defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
  sort: { nextRunAt: 1, priority: -1 }
}
```

## Message Broker Configuration

### RabbitMQ Configuration

```typescript
const rabbitmqConfig = {
  connection: {
    protocol: 'amqp',
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USERNAME || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/',
    heartbeat: 60,
    connection_timeout: 10000,
  },
  exchange: {
    durable: true,
    autoDelete: false,
    type: 'topic'
  },
  queue: {
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 86400000, // 24 hours
      'x-max-length': 10000,
      'x-overflow': 'reject-publish'
    }
  }
}
```

### Kafka Configuration

```typescript
const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'goat-fluent',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_SASL_USERNAME ? {
    mechanism: 'plain',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD
  } : undefined,
  producer: {
    idempotent: true,
    transactionTimeout: 30000,
    maxInFlightRequests: 5,
    retry: {
      retries: 5,
      initialRetryTime: 100,
      maxRetryTime: 30000,
      factor: 2,
      multiplier: 1.5,
      restartOnFailure: async (e) => {
        console.error('Kafka producer restart:', e)
        return true
      }
    }
  },
  consumer: {
    groupId: process.env.KAFKA_GROUP_ID || 'goat-fluent-consumer',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576,
    minBytes: 1,
    maxBytes: 10485760,
    maxWaitTimeInMs: 5000,
    retry: {
      retries: 5,
      initialRetryTime: 100,
      maxRetryTime: 30000,
    }
  }
}
```

## Performance Tuning

### Redis Optimization

```typescript
const redisOptimization = {
  // Memory optimization
  maxmemory: '256mb',
  'maxmemory-policy': 'allkeys-lru',
  'maxmemory-samples': 5,
  
  // Persistence
  save: '900 1 300 10 60 10000',
  'stop-writes-on-bgsave-error': 'yes',
  
  // Network
  'tcp-keepalive': 300,
  timeout: 0,
  
  // Performance
  'hz': 10,
  'dynamic-hz': 'yes',
  
  // Replication
  'repl-disable-tcp-nodelay': 'no',
  'repl-backlog-size': '1mb',
  'repl-backlog-ttl': 3600,
}
```

### MongoDB Optimization

```typescript
const mongoOptimization = {
  // Connection pooling
  maxPoolSize: 100,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  
  // Timeouts
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  
  // Write concern
  w: 'majority',
  wtimeout: 5000,
  j: true,
  
  // Read preference
  readPreference: 'primary',
  readConcern: { level: 'majority' },
  
  // Indexes
  autoIndex: false,
  bufferMaxEntries: 0,
  bufferCommands: false,
}
```

## Scaling Configuration

### Horizontal Scaling

```typescript
const scalingConfig = {
  workers: {
    instances: parseInt(process.env.WORKER_INSTANCES || '4'),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
    queues: process.env.WORKER_QUEUES?.split(',') || ['default'],
  },
  
  queues: {
    'high-priority': {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60000, // 1 minute
      }
    },
    'normal-priority': {
      concurrency: 10,
      limiter: {
        max: 200,
        duration: 60000,
      }
    },
    'low-priority': {
      concurrency: 20,
      limiter: {
        max: 500,
        duration: 60000,
      }
    }
  },
  
  clustering: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    workers: parseInt(process.env.CLUSTER_WORKERS || '0'), // 0 = CPU cores
    respawn: true,
    silent: false,
  }
}
```

### Load Balancing

```typescript
const loadBalancingConfig = {
  strategy: 'round-robin', // 'round-robin', 'least-connections', 'ip-hash'
  
  healthCheck: {
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
    retries: 3,
    endpoint: '/health'
  },
  
  failover: {
    enabled: true,
    retryDelay: 1000,
    maxRetries: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30000
  }
}
```

## Security Configuration

### Authentication

```typescript
const authConfig = {
  redis: {
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {
      rejectUnauthorized: false
    } : undefined
  },
  
  mongodb: {
    auth: {
      username: process.env.MONGO_USERNAME,
      password: process.env.MONGO_PASSWORD,
      authSource: process.env.MONGO_AUTH_SOURCE || 'admin'
    },
    ssl: process.env.MONGO_SSL === 'true',
    sslValidate: process.env.MONGO_SSL_VALIDATE === 'true'
  },
  
  rabbitmq: {
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
    ssl: process.env.RABBITMQ_SSL === 'true'
  }
}
```

### Encryption

```typescript
const encryptionConfig = {
  taskPayloads: {
    enabled: process.env.ENCRYPT_PAYLOADS === 'true',
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY, // 32 bytes
    iv: process.env.ENCRYPTION_IV    // 16 bytes
  },
  
  connections: {
    redis: {
      tls: process.env.REDIS_TLS === 'true'
    },
    mongodb: {
      ssl: process.env.MONGO_SSL === 'true'
    },
    rabbitmq: {
      ssl: process.env.RABBITMQ_SSL === 'true'
    }
  }
}
```

## Monitoring Configuration

### Metrics Collection

```typescript
const metricsConfig = {
  enabled: process.env.METRICS_ENABLED === 'true',
  
  collectors: {
    prometheus: {
      enabled: true,
      endpoint: '/metrics',
      port: parseInt(process.env.METRICS_PORT || '9090')
    },
    
    influxdb: {
      enabled: process.env.INFLUXDB_ENABLED === 'true',
      host: process.env.INFLUXDB_HOST,
      database: process.env.INFLUXDB_DATABASE,
      measurement: 'queue_metrics'
    }
  },
  
  metrics: {
    jobDuration: true,
    jobCount: true,
    errorRate: true,
    queueLength: true,
    workerUtilization: true
  }
}
```

### Logging Configuration

```typescript
const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  
  transports: {
    console: {
      enabled: true,
      colorize: process.env.NODE_ENV !== 'production',
      timestamp: true
    },
    
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      filename: process.env.LOG_FILE || 'queue.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      rotationFormat: 'YYYY-MM-DD'
    },
    
    elasticsearch: {
      enabled: process.env.ELASTICSEARCH_ENABLED === 'true',
      host: process.env.ELASTICSEARCH_HOST,
      index: process.env.ELASTICSEARCH_INDEX || 'queue-logs'
    }
  },
  
  structured: {
    enabled: true,
    format: 'json',
    includeMetadata: true
  }
}
```

## Health Checks

### Application Health

```typescript
const healthCheckConfig = {
  endpoint: '/health',
  
  checks: {
    redis: {
      enabled: true,
      timeout: 5000,
      critical: true
    },
    
    mongodb: {
      enabled: true,
      timeout: 5000,
      critical: true
    },
    
    rabbitmq: {
      enabled: true,
      timeout: 5000,
      critical: false
    },
    
    diskSpace: {
      enabled: true,
      threshold: 80, // 80% full
      critical: true
    },
    
    memory: {
      enabled: true,
      threshold: 85, // 85% used
      critical: true
    }
  }
}
```

## Configuration Management

### Environment-Based Configuration

```typescript
class ConfigurationManager {
  private config: any

  constructor() {
    this.config = this.loadConfiguration()
  }

  private loadConfiguration() {
    const env = process.env.NODE_ENV || 'development'
    
    const baseConfig = {
      env,
      app: {
        name: process.env.APP_NAME || 'goat-fluent',
        version: process.env.APP_VERSION || '1.0.0',
        port: parseInt(process.env.PORT || '3000')
      }
    }

    const envConfig = this.loadEnvironmentConfig(env)
    const secretsConfig = this.loadSecretsConfig()

    return {
      ...baseConfig,
      ...envConfig,
      ...secretsConfig
    }
  }

  private loadEnvironmentConfig(env: string) {
    switch (env) {
      case 'production':
        return require('./config/production')
      case 'staging':
        return require('./config/staging')
      case 'test':
        return require('./config/test')
      default:
        return require('./config/development')
    }
  }

  private loadSecretsConfig() {
    // Load secrets from external service (AWS Secrets Manager, HashiCorp Vault, etc.)
    return {
      secrets: {
        redisPassword: process.env.REDIS_PASSWORD,
        mongoPassword: process.env.MONGO_PASSWORD,
        encryptionKey: process.env.ENCRYPTION_KEY
      }
    }
  }

  get(key: string, defaultValue?: any) {
    return this.getNestedValue(this.config, key, defaultValue)
  }

  private getNestedValue(obj: any, path: string, defaultValue: any = undefined) {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current === null || current === undefined || !current.hasOwnProperty(key)) {
        return defaultValue
      }
      current = current[key]
    }

    return current
  }
}
```

## Best Practices

1. **Environment Separation**: Use different configurations for dev/staging/production
2. **Secret Management**: Store sensitive data in secure secret management systems
3. **Resource Limits**: Set appropriate resource limits and timeouts
4. **Monitoring**: Implement comprehensive monitoring and alerting
5. **Health Checks**: Regular health checks for all components
6. **Graceful Shutdown**: Implement proper shutdown procedures
7. **Configuration Validation**: Validate configuration on startup

## Configuration Templates

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - MONGO_URL=mongodb://mongodb:27017/jobs
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - redis
      - mongodb
      - rabbitmq

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  mongodb:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password

  rabbitmq:
    image: rabbitmq:3-management
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=password

volumes:
  redis_data:
  mongo_data:
  rabbitmq_data:
```

### Kubernetes Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: queue-config
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis-service"
  MONGO_HOST: "mongodb-service"
  RABBITMQ_HOST: "rabbitmq-service"
  LOG_LEVEL: "info"
  METRICS_ENABLED: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-workers
spec:
  replicas: 3
  selector:
    matchLabels:
      app: queue-workers
  template:
    metadata:
      labels:
        app: queue-workers
    spec:
      containers:
      - name: worker
        image: your-app:latest
        envFrom:
        - configMapRef:
            name: queue-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Next Steps

- Learn about [Cloud Integration](cloud-integration.md) for cloud-specific configurations
- Explore [Monitoring and Observability](monitoring.md) for production monitoring
- Check out [Error Handling](../advanced/error-handling.md) for robust error management