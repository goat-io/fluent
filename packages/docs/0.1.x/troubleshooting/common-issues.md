# Common Issues and Solutions

This guide covers common problems encountered when working with Fluent applications and their solutions.

## Database Issues

### Connection Problems

**Problem**: Database connection failures
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:
```bash
# Check database status
systemctl status postgresql
docker ps | grep postgres

# Test connection
psql -h localhost -U fluent -d fluent_prod

# Check environment variables
echo $DATABASE_URL

# Verify network connectivity
telnet localhost 5432
```

### Query Performance Issues

**Problem**: Slow database queries

**Solutions**:
```sql
-- Analyze slow queries
SELECT query, mean_time, rows, 100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 10
AND correlation < 0.1;

-- Add indexes
CREATE INDEX CONCURRENTLY idx_posts_user_created ON posts(user_id, created_at DESC);
```

## Application Issues

### Memory Leaks

**Problem**: Increasing memory usage over time

**Solutions**:
```typescript
// Monitor memory usage
const memoryUsage = process.memoryUsage();
console.log('Memory usage:', {
  rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
  heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
  heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
});

// Check for memory leaks
if (global.gc) {
  global.gc();
}

// Use heap snapshots
const v8 = require('v8');
const fs = require('fs');
const heapSnapshot = v8.getHeapSnapshot();
const fileName = `heap-${Date.now()}.heapsnapshot`;
const fileStream = fs.createWriteStream(fileName);
heapSnapshot.pipe(fileStream);
```

### Connection Pool Issues

**Problem**: Database connection pool exhaustion

**Solutions**:
```typescript
// Monitor connection pool
const pool = connector.manager.connection.driver.master;
console.log('Pool status:', {
  totalConnections: pool.totalCount,
  activeConnections: pool.activeCount,
  idleConnections: pool.idleCount,
  pendingConnections: pool.pendingCount
});

// Adjust pool configuration
const config = {
  max: 20,
  min: 5,
  idle: 30000,
  acquire: 60000,
  evict: 1000
};

// Check for connection leaks
setInterval(() => {
  if (pool.activeCount > pool.totalCount * 0.8) {
    console.warn('High connection usage detected');
  }
}, 30000);
```

## Docker Issues

### Container Startup Problems

**Problem**: Container fails to start

**Solutions**:
```bash
# Check container logs
docker logs fluent-app

# Inspect container
docker inspect fluent-app

# Check resource limits
docker stats fluent-app

# Debug container
docker run -it --rm fluent-app:latest /bin/sh

# Check health status
docker inspect --format='{{.State.Health.Status}}' fluent-app
```

### Image Build Issues

**Problem**: Docker build failures

**Solutions**:
```dockerfile
# Use multi-stage builds
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Check .dockerignore
node_modules
npm-debug.log
.git
.gitignore
```

## Kubernetes Issues

### Pod Startup Problems

**Problem**: Pods stuck in pending state

**Solutions**:
```bash
# Check pod status
kubectl describe pod fluent-app-xxx

# Check resource constraints
kubectl top nodes
kubectl top pods

# Check node capacity
kubectl describe nodes

# Check persistent volume claims
kubectl get pvc
kubectl describe pvc fluent-app-pvc
```

### Service Discovery Issues

**Problem**: Services cannot communicate

**Solutions**:
```bash
# Check service endpoints
kubectl get endpoints fluent-app-service

# Test service connectivity
kubectl exec -it fluent-app-xxx -- nslookup fluent-app-service

# Check network policies
kubectl get networkpolicies
kubectl describe networkpolicy fluent-app-network-policy

# Debug DNS
kubectl exec -it fluent-app-xxx -- nslookup kubernetes.default.svc.cluster.local
```

## Performance Issues

### High Response Times

**Problem**: Slow API responses

**Solutions**:
```typescript
// Add response time monitoring
const responseTimeMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
    
    if (duration > 1000) {
      console.warn('Slow request detected:', {
        method: req.method,
        path: req.path,
        duration,
        query: req.query,
        body: req.body
      });
    }
  });
  
  next();
};

// Optimize database queries
const optimizedQuery = `
  SELECT p.*, u.name 
  FROM posts p 
  JOIN users u ON p.user_id = u.id 
  WHERE p.status = 'published' 
  ORDER BY p.created_at DESC 
  LIMIT 10
`;

// Use caching
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}
```

### High CPU Usage

**Problem**: Excessive CPU consumption

**Solutions**:
```bash
# Monitor CPU usage
top -p $(pgrep -f "node")
htop

# Profile Node.js application
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Use CPU profiler
const profiler = require('v8-profiler-next');
profiler.startProfiling('CPU profile');
// ... application code
const profile = profiler.stopProfiling('CPU profile');
profile.export().pipe(fs.createWriteStream('cpu-profile.cpuprofile'));
```

## Security Issues

### Authentication Problems

**Problem**: JWT token validation failures

**Solutions**:
```typescript
// Debug JWT issues
const jwt = require('jsonwebtoken');

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token is valid:', decoded);
} catch (error) {
  console.error('JWT validation error:', error.message);
  
  if (error.name === 'TokenExpiredError') {
    // Token has expired
  } else if (error.name === 'JsonWebTokenError') {
    // Invalid token
  } else if (error.name === 'NotBeforeError') {
    // Token not active yet
  }
}

// Check token format
const tokenParts = token.split('.');
if (tokenParts.length !== 3) {
  console.error('Invalid token format');
}
```

### CORS Issues

**Problem**: Cross-origin request blocked

**Solutions**:
```typescript
// Configure CORS properly
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Debug CORS
app.use((req, res, next) => {
  console.log('CORS Debug:', {
    origin: req.get('Origin'),
    method: req.method,
    headers: req.headers
  });
  next();
});
```

## Monitoring and Alerting Issues

### Metrics Collection Problems

**Problem**: Missing or incorrect metrics

**Solutions**:
```typescript
// Verify metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});

// Check metric registration
console.log('Registered metrics:', prometheus.register.getMetricsAsJSON());

// Debug metric collection
const httpRequestsTotal = prometheus.register.getSingleMetric('http_requests_total');
if (!httpRequestsTotal) {
  console.error('http_requests_total metric not found');
}
```

### Alert Configuration Issues

**Problem**: Alerts not firing

**Solutions**:
```yaml
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Test alert rules
curl http://prometheus:9090/api/v1/rules

# Check Alertmanager
curl http://alertmanager:9093/api/v1/alerts

# Verify alert routing
curl -X POST http://alertmanager:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert"
    }
  }]'
```

## Debugging Tools

### Application Debugging

```typescript
// Enable debug logging
const debug = require('debug')('fluent:app');
debug('Application starting...');

// Add request logging
const morgan = require('morgan');
app.use(morgan('combined'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers,
    user: req.user
  });
  
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
});
```

### Database Debugging

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Check active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Check locks
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

## Troubleshooting Checklist

### Before Deployment
- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Health checks responding
- [ ] Logs configured properly
- [ ] Monitoring endpoints accessible
- [ ] Security policies applied

### During Issues
- [ ] Check application logs
- [ ] Verify database connectivity
- [ ] Monitor resource usage
- [ ] Check external dependencies
- [ ] Review recent changes
- [ ] Test in isolated environment

### After Resolution
- [ ] Document the issue and solution
- [ ] Update monitoring and alerts
- [ ] Review prevention measures
- [ ] Conduct post-mortem if needed
- [ ] Update troubleshooting guides

## Getting Help

### Log Collection
```bash
# Application logs
docker logs fluent-app --tail 100

# System logs
journalctl -u fluent-app --since "1 hour ago"

# Kubernetes logs
kubectl logs -f deployment/fluent-app

# Database logs
sudo tail -f /var/log/postgresql/postgresql-main.log
```

### Support Information
When reporting issues, include:
- Application version
- Environment details
- Error messages and stack traces
- Steps to reproduce
- Recent changes
- Resource usage metrics
- Relevant configuration