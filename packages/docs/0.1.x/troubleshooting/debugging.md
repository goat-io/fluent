# Debugging Techniques

This guide covers debugging strategies and tools for Fluent applications.

## Node.js Debugging

### Built-in Debugger
```bash
# Start with debugger
node --inspect app.js
node --inspect-brk app.js  # Break on start

# Connect with Chrome DevTools
# Open chrome://inspect in Chrome
```

### VS Code Debugging
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Fluent App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/index.js",
      "env": {
        "NODE_ENV": "development",
        "DATABASE_URL": "postgresql://localhost:5432/fluent_dev"
      },
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

## Database Debugging

### Query Analysis
```sql
-- Enable query logging
SET log_statement = 'all';

-- Analyze slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Check table statistics
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

### Connection Debugging
```typescript
// Debug database connections
const debugConnection = async () => {
  try {
    const result = await connector.query('SELECT version()');
    console.log('Database connected:', result[0]);
    
    // Check connection pool
    const pool = connector.manager.connection.driver.master;
    console.log('Pool stats:', {
      total: pool.totalCount,
      active: pool.activeCount,
      idle: pool.idleCount
    });
  } catch (error) {
    console.error('Database connection failed:', error);
  }
};
```

## Memory Analysis

### Heap Snapshots
```typescript
// Generate heap snapshot
const v8 = require('v8');
const fs = require('fs');

const generateHeapSnapshot = () => {
  const snapshot = v8.getHeapSnapshot();
  const fileName = `heap-${Date.now()}.heapsnapshot`;
  const fileStream = fs.createWriteStream(fileName);
  snapshot.pipe(fileStream);
  console.log(`Heap snapshot saved as ${fileName}`);
};

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  });
}, 30000);
```

### Memory Leak Detection
```typescript
// Track object creation
const objectCounts = new Map();

const trackObject = (name: string) => {
  const count = objectCounts.get(name) || 0;
  objectCounts.set(name, count + 1);
};

const releaseObject = (name: string) => {
  const count = objectCounts.get(name) || 0;
  objectCounts.set(name, Math.max(0, count - 1));
};

// Report object counts
setInterval(() => {
  console.log('Object counts:', Object.fromEntries(objectCounts));
}, 60000);
```

## Performance Profiling

### CPU Profiling
```bash
# Node.js profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Chrome DevTools profiling
node --inspect app.js
# Connect to Chrome DevTools and use Performance tab
```

### Custom Profiling
```typescript
import { performance } from 'perf_hooks';

const profileFunction = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  
  try {
    const result = await fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  } catch (error) {
    const end = performance.now();
    console.error(`${name} failed after ${(end - start).toFixed(2)}ms:`, error);
    throw error;
  }
};

// Usage
const data = await profileFunction('getUserData', async () => {
  return await userService.getData(userId);
});
```

## Request Tracing

### Correlation IDs
```typescript
import { randomUUID } from 'crypto';

const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

// Enhanced logging with correlation ID
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
      return `${timestamp} [${correlationId}] ${level}: ${message} ${JSON.stringify(meta)}`;
    })
  )
});
```

### Request Flow Tracking
```typescript
// Track request flow
const requestTracker = new Map();

const trackRequest = (correlationId: string, step: string) => {
  if (!requestTracker.has(correlationId)) {
    requestTracker.set(correlationId, []);
  }
  
  const steps = requestTracker.get(correlationId);
  steps.push({
    step,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage().heapUsed
  });
  
  // Clean up old requests
  if (steps.length > 100) {
    requestTracker.delete(correlationId);
  }
};
```

## Error Debugging

### Error Handling
```typescript
// Enhanced error handling
class DebuggableError extends Error {
  constructor(message: string, public context: any = {}) {
    super(message);
    this.name = this.constructor.name;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Add context
    this.context = {
      ...context,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage()
    };
  }
}

// Usage
try {
  await processUserData(userData);
} catch (error) {
  throw new DebuggableError('Failed to process user data', {
    userId: userData.id,
    operation: 'processUserData',
    originalError: error.message
  });
}
```

### Error Tracking
```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend: (event, hint) => {
    // Add debugging information
    if (event.request) {
      event.request.headers = {
        ...event.request.headers,
        'x-correlation-id': hint.originalException?.correlationId
      };
    }
    return event;
  }
});

// Error middleware
app.use(Sentry.Handlers.errorHandler());
```

## Container Debugging

### Docker Debugging
```bash
# Debug running container
docker exec -it fluent-app /bin/sh

# Check container logs
docker logs fluent-app --tail 100 --follow

# Monitor container resources
docker stats fluent-app

# Inspect container
docker inspect fluent-app
```

### Kubernetes Debugging
```bash
# Debug pod
kubectl exec -it fluent-app-xxx -- /bin/sh

# Check pod logs
kubectl logs fluent-app-xxx --previous --tail 100

# Describe pod
kubectl describe pod fluent-app-xxx

# Port forward for debugging
kubectl port-forward fluent-app-xxx 3000:3000
```

## Testing and Debugging

### Unit Test Debugging
```typescript
// Debug test with additional logging
describe('UserService', () => {
  beforeEach(() => {
    // Enable debug logging for tests
    process.env.DEBUG = 'fluent:*';
  });
  
  it('should create user', async () => {
    const userData = { email: 'test@example.com' };
    console.log('Creating user with data:', userData);
    
    const user = await userService.create(userData);
    console.log('Created user:', user);
    
    expect(user.email).toBe(userData.email);
  });
});
```

### Integration Test Debugging
```typescript
// Debug integration tests
const debugRequest = (req: supertest.Test) => {
  return req
    .set('x-debug', 'true')
    .expect((res) => {
      console.log('Response:', {
        status: res.status,
        headers: res.headers,
        body: res.body
      });
    });
};

// Usage in tests
await debugRequest(
  request(app)
    .post('/api/users')
    .send({ email: 'test@example.com' })
)
.expect(201);
```

## Debugging Tools

### Performance Monitoring
```typescript
// APM integration
import newrelic from 'newrelic';

// Custom instrumentation
newrelic.addCustomAttribute('userId', req.user.id);
newrelic.addCustomAttribute('correlationId', req.correlationId);

// Custom metrics
newrelic.recordMetric('Custom/UserRegistrations', 1);
```

### Real-time Debugging
```typescript
// WebSocket debugging
const WebSocket = require('ws');

const debugWs = new WebSocket.Server({ port: 8080 });

debugWs.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const command = JSON.parse(message);
      
      switch (command.type) {
        case 'memory':
          ws.send(JSON.stringify({
            type: 'memory',
            data: process.memoryUsage()
          }));
          break;
          
        case 'query':
          // Execute debug query
          connector.query(command.sql)
            .then(result => {
              ws.send(JSON.stringify({
                type: 'query-result',
                data: result
              }));
            })
            .catch(error => {
              ws.send(JSON.stringify({
                type: 'error',
                message: error.message
              }));
            });
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
});
```

## Best Practices

### 1. Logging Strategy
- Use structured logging
- Include correlation IDs
- Log at appropriate levels
- Avoid logging sensitive data

### 2. Error Handling
- Capture full context
- Use meaningful error messages
- Implement error boundaries
- Track error patterns

### 3. Performance Debugging
- Profile regularly
- Monitor key metrics
- Use appropriate tools
- Test under load

### 4. Security
- Sanitize debug output
- Disable debug in production
- Secure debugging endpoints
- Audit debug access

## Debugging Checklist

- [ ] Enable appropriate logging levels
- [ ] Set up correlation IDs
- [ ] Configure error tracking
- [ ] Set up performance monitoring
- [ ] Prepare debugging tools
- [ ] Test debugging procedures
- [ ] Document debugging processes
- [ ] Train team on debugging tools

## Next Steps

1. [Common Issues](common-issues.md) - Review common problems
2. [Performance Issues](performance-issues.md) - Debug performance problems
3. [Monitoring](../operations/monitoring.md) - Set up monitoring