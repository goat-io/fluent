# Cloud Integration Setup

This guide covers setting up the Goat Fluent queue and task systems with major cloud providers.

## Overview

Cloud integration provides scalable, managed infrastructure for queue and task processing across AWS, GCP, and Azure.

## Google Cloud Platform (GCP)

### Cloud Tasks Setup

```bash
# Enable required APIs
gcloud services enable cloudtasks.googleapis.com
gcloud services enable compute.googleapis.com

# Create service account
gcloud iam service-accounts create queue-processor \
  --display-name="Queue Processor Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:queue-processor@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:queue-processor@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.taskRunner"

# Create service account key
gcloud iam service-accounts keys create queue-processor-key.json \
  --iam-account=queue-processor@PROJECT_ID.iam.gserviceaccount.com
```

### Cloud Tasks Configuration

```typescript
import { CloudTaskConnector } from '@goatlab/tasks-adapter-gcp'

const gcpConfig = {
  projectId: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION || 'us-central1',
  serviceAccountKey: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
  encryptionKey: process.env.ENCRYPTION_KEY,
  
  queues: {
    'high-priority': {
      rateLimits: {
        maxDispatchesPerSecond: 100,
        maxConcurrentDispatches: 10,
        maxBurstSize: 100
      },
      retryConfig: {
        maxAttempts: 3,
        maxRetryDuration: '300s',
        minBackoff: '1s',
        maxBackoff: '10s',
        maxDoublings: 5
      }
    },
    'normal-priority': {
      rateLimits: {
        maxDispatchesPerSecond: 50,
        maxConcurrentDispatches: 5,
        maxBurstSize: 50
      }
    }
  }
}

const connector = new CloudTaskConnector(gcpConfig)
```

### Cloud Pub/Sub Integration

```typescript
import { PubSub } from '@google-cloud/pubsub'

const pubSubConfig = {
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  
  topics: {
    'job-events': {
      messageRetentionDuration: 604800, // 7 days
      messageOrdering: true
    },
    'task-results': {
      messageRetentionDuration: 86400, // 1 day
      messageOrdering: false
    }
  },
  
  subscriptions: {
    'job-processor': {
      topic: 'job-events',
      ackDeadlineSeconds: 60,
      maxExtensionSeconds: 300,
      maxMessages: 100,
      allowExcessMessages: false
    }
  }
}
```

### Cloud Firestore for State Management

```typescript
import { Firestore } from '@google-cloud/firestore'

const firestoreConfig = {
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  
  collections: {
    tasks: 'task_states',
    workflows: 'workflow_states',
    deadLetters: 'dead_letter_queue'
  },
  
  settings: {
    ignoreUndefinedProperties: true,
    timestampsInSnapshots: true
  }
}
```

## Amazon Web Services (AWS)

### SQS Setup

```bash
# Create SQS queues
aws sqs create-queue --queue-name high-priority-queue
aws sqs create-queue --queue-name normal-priority-queue
aws sqs create-queue --queue-name dead-letter-queue

# Set queue attributes
aws sqs set-queue-attributes \
  --queue-url https://sqs.region.amazonaws.com/account/high-priority-queue \
  --attributes '{
    "VisibilityTimeoutSeconds": "300",
    "MessageRetentionPeriod": "1209600",
    "MaxReceiveCount": "3",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:region:account:dead-letter-queue\",\"maxReceiveCount\":3}"
  }'
```

### SQS Configuration

```typescript
import AWS from 'aws-sdk'

const sqsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  
  queues: {
    'high-priority': {
      url: process.env.SQS_HIGH_PRIORITY_URL,
      visibilityTimeout: 300,
      messageRetentionPeriod: 1209600,
      maxReceiveCount: 3,
      deadLetterQueue: process.env.SQS_DEAD_LETTER_URL
    },
    'normal-priority': {
      url: process.env.SQS_NORMAL_PRIORITY_URL,
      visibilityTimeout: 60,
      messageRetentionPeriod: 345600,
      maxReceiveCount: 5
    }
  }
}

const sqs = new AWS.SQS(sqsConfig)
```

### Lambda Integration

```typescript
// Lambda function for processing queue messages
export const handler = async (event: any) => {
  const { Records } = event
  
  for (const record of Records) {
    try {
      const message = JSON.parse(record.body)
      await processMessage(message)
      
      // Message processed successfully
    } catch (error) {
      console.error('Message processing failed:', error)
      
      // Let SQS handle retry/dead letter queue
      throw error
    }
  }
}

async function processMessage(message: any) {
  // Message processing logic
  console.log('Processing message:', message)
}
```

### DynamoDB for State Management

```typescript
import AWS from 'aws-sdk'

const dynamoConfig = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  
  tables: {
    tasks: {
      name: 'TaskStates',
      partitionKey: 'taskId',
      sortKey: 'timestamp',
      ttl: 'expiresAt'
    },
    workflows: {
      name: 'WorkflowStates',
      partitionKey: 'workflowId',
      sortKey: 'step'
    }
  }
}

const dynamodb = new AWS.DynamoDB.DocumentClient(dynamoConfig)
```

## Microsoft Azure

### Service Bus Setup

```bash
# Create Service Bus namespace
az servicebus namespace create \
  --name goat-fluent-namespace \
  --resource-group myResourceGroup \
  --location eastus

# Create queues
az servicebus queue create \
  --namespace-name goat-fluent-namespace \
  --name high-priority-queue \
  --resource-group myResourceGroup \
  --max-size 5120 \
  --default-message-time-to-live P14D

# Get connection string
az servicebus namespace authorization-rule keys list \
  --namespace-name goat-fluent-namespace \
  --name RootManageSharedAccessKey \
  --resource-group myResourceGroup
```

### Service Bus Configuration

```typescript
import { ServiceBusClient } from '@azure/service-bus'

const serviceBusConfig = {
  connectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
  
  queues: {
    'high-priority': {
      name: 'high-priority-queue',
      maxSizeInMegabytes: 5120,
      defaultMessageTimeToLive: 'P14D',
      maxDeliveryCount: 3,
      deadLetteringOnMessageExpiration: true
    },
    'normal-priority': {
      name: 'normal-priority-queue',
      maxSizeInMegabytes: 1024,
      defaultMessageTimeToLive: 'P7D',
      maxDeliveryCount: 5
    }
  }
}

const serviceBusClient = new ServiceBusClient(serviceBusConfig.connectionString)
```

### Azure Functions Integration

```typescript
import { AzureFunction, Context, HttpRequest } from '@azure/functions'

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  try {
    const message = req.body
    await processMessage(message)
    
    context.res = {
      status: 200,
      body: { success: true }
    }
  } catch (error) {
    context.log.error('Processing failed:', error)
    
    context.res = {
      status: 500,
      body: { error: error.message }
    }
  }
}

async function processMessage(message: any) {
  // Message processing logic
  console.log('Processing message:', message)
}

export default httpTrigger
```

### Cosmos DB for State Management

```typescript
import { CosmosClient } from '@azure/cosmos'

const cosmosConfig = {
  endpoint: process.env.COSMOS_DB_ENDPOINT,
  key: process.env.COSMOS_DB_KEY,
  
  database: {
    id: 'QueueDatabase',
    throughput: 400
  },
  
  containers: {
    tasks: {
      id: 'TaskStates',
      partitionKey: '/taskId',
      uniqueKeyPolicy: {
        uniqueKeys: [{ paths: ['/taskId'] }]
      }
    },
    workflows: {
      id: 'WorkflowStates',
      partitionKey: '/workflowId'
    }
  }
}

const cosmosClient = new CosmosClient(cosmosConfig)
```

## Multi-Cloud Configuration

### Cloud-Agnostic Setup

```typescript
class CloudConnectorFactory {
  static createTaskConnector(provider: 'gcp' | 'aws' | 'azure') {
    switch (provider) {
      case 'gcp':
        return new CloudTaskConnector({
          gcpProject: process.env.GCP_PROJECT_ID,
          location: process.env.GCP_LOCATION,
          gcpServiceAccount: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
          encryptionKey: process.env.ENCRYPTION_KEY
        })
      
      case 'aws':
        return new SQSConnector({
          region: process.env.AWS_REGION,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          queueUrl: process.env.SQS_QUEUE_URL
        })
      
      case 'azure':
        return new ServiceBusConnector({
          connectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
          queueName: process.env.AZURE_QUEUE_NAME
        })
      
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`)
    }
  }
}
```

### Environment-Based Provider Selection

```typescript
const getCloudProvider = (): string => {
  if (process.env.GCP_PROJECT_ID) return 'gcp'
  if (process.env.AWS_REGION) return 'aws'
  if (process.env.AZURE_SERVICE_BUS_CONNECTION_STRING) return 'azure'
  return 'local'
}

const connector = CloudConnectorFactory.createTaskConnector(getCloudProvider())
```

## Infrastructure as Code

### Terraform Configuration

```hcl
# Google Cloud Tasks
resource "google_cloud_tasks_queue" "high_priority" {
  name     = "high-priority-queue"
  location = var.gcp_location
  
  rate_limits {
    max_dispatches_per_second = 100
    max_concurrent_dispatches = 10
    max_burst_size           = 100
  }
  
  retry_config {
    max_attempts       = 3
    max_retry_duration = "300s"
    min_backoff        = "1s"
    max_backoff        = "10s"
    max_doublings      = 5
  }
}

# AWS SQS
resource "aws_sqs_queue" "high_priority" {
  name                       = "high-priority-queue"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600
  max_receive_count         = 3
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = 3
  })
}

# Azure Service Bus
resource "azurerm_servicebus_queue" "high_priority" {
  name                = "high-priority-queue"
  namespace_id        = azurerm_servicebus_namespace.main.id
  max_size_in_megabytes = 5120
  default_message_ttl = "P14D"
  max_delivery_count  = 3
}
```

### Kubernetes Deployment

```yaml
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
      serviceAccountName: queue-processor
      containers:
      - name: worker
        image: your-app:latest
        env:
        - name: CLOUD_PROVIDER
          value: "gcp"
        - name: GCP_PROJECT_ID
          value: "your-project-id"
        - name: GCP_LOCATION
          value: "us-central1"
        - name: GOOGLE_APPLICATION_CREDENTIALS
          value: "/etc/gcp/service-account.json"
        volumeMounts:
        - name: gcp-credentials
          mountPath: /etc/gcp
          readOnly: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: gcp-credentials
        secret:
          secretName: gcp-service-account-key
```

## Monitoring and Observability

### Cloud-Native Monitoring

```typescript
// GCP Monitoring
const gcpMonitoring = {
  projectId: process.env.GCP_PROJECT_ID,
  
  metrics: {
    taskDuration: 'custom.googleapis.com/task/duration',
    taskCount: 'custom.googleapis.com/task/count',
    errorRate: 'custom.googleapis.com/task/error_rate'
  },
  
  alerts: {
    highErrorRate: {
      condition: 'error_rate > 0.1',
      duration: '300s',
      notification: process.env.ALERT_EMAIL
    }
  }
}

// AWS CloudWatch
const awsMonitoring = {
  region: process.env.AWS_REGION,
  
  metrics: {
    namespace: 'GoatFluent/Tasks',
    dimensions: [
      { name: 'TaskName', value: 'ProcessOrder' },
      { name: 'Environment', value: process.env.NODE_ENV }
    ]
  },
  
  alarms: {
    highErrorRate: {
      metricName: 'ErrorRate',
      threshold: 10,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 2,
      period: 300
    }
  }
}

// Azure Monitor
const azureMonitoring = {
  instrumentationKey: process.env.AZURE_INSIGHTS_INSTRUMENTATION_KEY,
  
  customMetrics: {
    taskDuration: 'TaskDuration',
    taskCount: 'TaskCount',
    errorRate: 'ErrorRate'
  },
  
  alerts: {
    highErrorRate: {
      condition: 'customMetrics/ErrorRate > 0.1',
      windowSize: 'PT5M',
      frequency: 'PT1M'
    }
  }
}
```

## Best Practices

1. **Use Managed Services**: Leverage cloud-native queue services when possible
2. **Implement IAM**: Use proper identity and access management
3. **Enable Monitoring**: Set up comprehensive monitoring and alerting
4. **Use Secrets Management**: Store sensitive configuration in cloud secret stores
5. **Implement Auto-scaling**: Configure auto-scaling for variable workloads
6. **Multi-region Setup**: Consider multi-region deployment for high availability
7. **Cost Optimization**: Monitor and optimize cloud resource usage

## Security Considerations

### Identity and Access Management

```typescript
const iamConfig = {
  gcp: {
    serviceAccount: 'queue-processor@project.iam.gserviceaccount.com',
    roles: [
      'roles/cloudtasks.enqueuer',
      'roles/cloudtasks.taskRunner',
      'roles/pubsub.publisher',
      'roles/pubsub.subscriber'
    ]
  },
  
  aws: {
    role: 'arn:aws:iam::account:role/QueueProcessorRole',
    policies: [
      'arn:aws:iam::aws:policy/AmazonSQSFullAccess',
      'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'
    ]
  },
  
  azure: {
    managedIdentity: 'queue-processor-identity',
    roles: [
      'Azure Service Bus Data Owner',
      'Cosmos DB Account Reader Role'
    ]
  }
}
```

### Network Security

```typescript
const networkConfig = {
  gcp: {
    vpcNetwork: 'projects/project/global/networks/main',
    subnetwork: 'projects/project/regions/region/subnetworks/private',
    firewallRules: [
      {
        name: 'allow-queue-traffic',
        direction: 'INGRESS',
        priority: 1000,
        sourceRanges: ['10.0.0.0/8'],
        allowed: [{ IPProtocol: 'tcp', ports: ['443', '80'] }]
      }
    ]
  },
  
  aws: {
    vpcId: 'vpc-12345678',
    subnetIds: ['subnet-12345678', 'subnet-87654321'],
    securityGroups: [
      {
        name: 'queue-sg',
        rules: [
          {
            type: 'ingress',
            fromPort: 443,
            toPort: 443,
            protocol: 'tcp',
            cidrBlocks: ['10.0.0.0/8']
          }
        ]
      }
    ]
  },
  
  azure: {
    virtualNetwork: 'queue-vnet',
    subnet: 'queue-subnet',
    networkSecurityGroup: 'queue-nsg',
    rules: [
      {
        name: 'AllowHTTPS',
        priority: 100,
        direction: 'Inbound',
        access: 'Allow',
        protocol: 'Tcp',
        sourcePortRange: '*',
        destinationPortRange: '443',
        sourceAddressPrefix: '10.0.0.0/8'
      }
    ]
  }
}
```

## Next Steps

- Learn about [Queue Configuration](queue-configuration.md) for optimal performance
- Explore [Monitoring and Observability](monitoring.md) for production monitoring
- Check out [Error Handling](../advanced/error-handling.md) for cloud-resilient systems