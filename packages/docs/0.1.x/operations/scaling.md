# Horizontal Scaling

This guide covers scaling strategies for Fluent applications including auto-scaling, load balancing, and capacity planning.

## Auto-Scaling

### Kubernetes HPA
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fluent-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fluent-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Custom Metrics Scaling
```yaml
# custom-metrics-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fluent-app-custom-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fluent-app
  minReplicas: 2
  maxReplicas: 50
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  - type: Object
    object:
      metric:
        name: queue_length
      describedObject:
        apiVersion: v1
        kind: Service
        name: redis-service
      target:
        type: Value
        value: "1000"
```

## Load Balancing

### Application Load Balancer
```typescript
// Load balancer health check
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  };
  
  res.status(200).json(healthCheck);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
```

### Session Management
```typescript
// Stateless session handling
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

## Database Scaling

### Read Replicas
```typescript
// Database connection with read replicas
const masterConfig = {
  host: process.env.DB_MASTER_HOST,
  port: 5432,
  database: 'fluent_prod',
  username: 'fluent',
  password: process.env.DB_PASSWORD
};

const replicaConfig = {
  host: process.env.DB_REPLICA_HOST,
  port: 5432,
  database: 'fluent_prod',
  username: 'fluent_readonly',
  password: process.env.DB_READONLY_PASSWORD
};

// Read/write splitting
class DatabaseRouter {
  static async executeQuery(query: string, params: any[], readOnly: boolean = false) {
    const connection = readOnly ? replicaConnection : masterConnection;
    return connection.query(query, params);
  }
}
```

### Connection Pooling
```typescript
// Optimized connection pool
const poolConfig = {
  max: 20,
  min: 5,
  idle: 30000,
  acquire: 60000,
  evict: 1000,
  handleDisconnects: true,
  
  // Custom validation
  validate: async (connection: any) => {
    try {
      await connection.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
};
```

## Cache Scaling

### Redis Cluster
```yaml
# redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-cluster-config
data:
  redis.conf: |
    cluster-enabled yes
    cluster-config-file nodes.conf
    cluster-node-timeout 5000
    appendonly yes
    
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster-service
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /etc/redis/redis.conf
        ports:
        - containerPort: 6379
        - containerPort: 16379
        volumeMounts:
        - name: redis-config
          mountPath: /etc/redis
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-config
        configMap:
          name: redis-cluster-config
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

## Capacity Planning

### Metrics Collection
```typescript
// Capacity metrics
const capacityMetrics = {
  requestRate: new prometheus.Histogram({
    name: 'requests_per_second',
    help: 'Request rate per second',
    buckets: [1, 5, 10, 50, 100, 500, 1000]
  }),
  
  responseTime: new prometheus.Histogram({
    name: 'response_time_seconds',
    help: 'Response time in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),
  
  resourceUtilization: new prometheus.Gauge({
    name: 'resource_utilization',
    help: 'Resource utilization percentage',
    labelNames: ['resource']
  })
};

// Capacity monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  capacityMetrics.resourceUtilization.set(
    { resource: 'memory' },
    memUsage.heapUsed / memUsage.heapTotal
  );
  
  capacityMetrics.resourceUtilization.set(
    { resource: 'cpu' },
    (cpuUsage.user + cpuUsage.system) / 1000000
  );
}, 30000);
```

### Scaling Policies
```typescript
// Automatic scaling decisions
class ScalingManager {
  static async evaluateScaling() {
    const metrics = await this.getMetrics();
    
    if (metrics.cpuUtilization > 80 && metrics.requestRate > 1000) {
      return { action: 'scale-up', replicas: Math.min(metrics.currentReplicas * 2, 20) };
    }
    
    if (metrics.cpuUtilization < 20 && metrics.requestRate < 100) {
      return { action: 'scale-down', replicas: Math.max(Math.floor(metrics.currentReplicas / 2), 2) };
    }
    
    return { action: 'no-change' };
  }
}
```

## Monitoring Scaling

### Scaling Alerts
```yaml
# Alert rules for scaling
groups:
- name: scaling-alerts
  rules:
  - alert: HighCPUUsage
    expr: avg(rate(container_cpu_usage_seconds_total[5m])) > 0.8
    for: 5m
    annotations:
      summary: "High CPU usage detected"
      
  - alert: HighMemoryUsage
    expr: avg(container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.8
    for: 5m
    annotations:
      summary: "High memory usage detected"
      
  - alert: ScalingEventFailed
    expr: increase(kube_hpa_status_condition{condition="ScalingLimited"}[5m]) > 0
    for: 1m
    annotations:
      summary: "HPA scaling event failed"
```

### Performance Testing
```bash
# Load testing with Artillery
artillery run --config artillery.yml --target https://api.yourdomain.com test-scenarios.yml

# JMeter load testing
jmeter -n -t load-test.jmx -l results.jtl -e -o report/

# K6 load testing
k6 run --vus 100 --duration 30s load-test.js
```

## Best Practices

### 1. Stateless Design
- Store session data in Redis/database
- Use external file storage (S3, GCS)
- Implement idempotent operations

### 2. Circuit Breaker Pattern
```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

const breaker = new CircuitBreaker(callExternalService, options);

breaker.on('open', () => console.log('Circuit breaker opened'));
breaker.on('halfOpen', () => console.log('Circuit breaker half-open'));
```

### 3. Graceful Degradation
```typescript
// Fallback mechanisms
const getUserData = async (userId: string) => {
  try {
    return await primaryService.getUser(userId);
  } catch (error) {
    console.warn('Primary service failed, using cache');
    return await cacheService.getUser(userId);
  }
};
```

## Scaling Checklist

- [ ] Stateless application design
- [ ] Horizontal Pod Autoscaler configured
- [ ] Load balancer health checks
- [ ] Database read replicas
- [ ] Cache clustering
- [ ] Session management
- [ ] Monitoring and alerting
- [ ] Capacity planning
- [ ] Performance testing
- [ ] Graceful shutdown handling

## Next Steps

1. [Monitoring](monitoring.md) - Monitor scaling metrics
2. [Troubleshooting](../troubleshooting/performance-issues.md) - Debug scaling issues
3. [Backup](backup.md) - Backup scaled environments