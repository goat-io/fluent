# Monitoring and Alerting

This comprehensive guide covers monitoring, observability, and alerting strategies for Fluent applications in production.

## Overview

Effective monitoring provides visibility into application performance, health, and user experience. This guide covers metrics collection, visualization, and alerting strategies.

## Monitoring Stack

### Core Components
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Alert Manager** - Alert routing and management
- **Jaeger/Zipkin** - Distributed tracing
- **Elasticsearch/Fluentd/Kibana** - Log aggregation

## Application Metrics

### 1. Express.js Metrics

```typescript
import prometheus from 'prom-client';
import express from 'express';

// Create metrics registry
const register = new prometheus.Registry();

// Collect default metrics
prometheus.collectDefaultMetrics({ register });

// HTTP request metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);

// Middleware for metrics collection
export const metricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};

// Metrics endpoint
export const setupMetricsEndpoint = (app: express.Application) => {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
};
```

### 2. Business Metrics

```typescript
// Business-specific metrics
const userRegistrations = new prometheus.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source', 'plan']
});

const activeUsers = new prometheus.Gauge({
  name: 'active_users',
  help: 'Number of active users',
  labelNames: ['period']
});

const databaseQueries = new prometheus.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table', 'operation']
});

const queueJobs = new prometheus.Gauge({
  name: 'queue_jobs_total',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status']
});

register.registerMetric(userRegistrations);
register.registerMetric(activeUsers);
register.registerMetric(databaseQueries);
register.registerMetric(queueJobs);

// Usage examples
export class MetricsService {
  static recordUserRegistration(source: string, plan: string): void {
    userRegistrations.labels(source, plan).inc();
  }
  
  static updateActiveUsers(period: string, count: number): void {
    activeUsers.labels(period).set(count);
  }
  
  static recordDatabaseQuery(type: string, table: string, operation: string, duration: number): void {
    databaseQueries.labels(type, table, operation).observe(duration);
  }
  
  static updateQueueJobs(queue: string, status: string, count: number): void {
    queueJobs.labels(queue, status).set(count);
  }
}
```

## Prometheus Configuration

### 1. Prometheus Server

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Fluent application
  - job_name: 'fluent-app'
    static_configs:
      - targets: ['fluent-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s
    
  # Node exporter
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    
  # PostgreSQL exporter
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
    
  # Redis exporter
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
    
  # Nginx exporter
  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### 2. Alert Rules

```yaml
# alerts.yml
groups:
  - name: fluent-app
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests per second"
      
      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"
      
      # Database connection issues
      - alert: DatabaseConnectionFailure
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "PostgreSQL database is unreachable"
      
      # Memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"
      
      # Disk space
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value | humanizePercentage }} available"
```

## Grafana Dashboards

### 1. Application Overview Dashboard

```json
{
  "dashboard": {
    "title": "Fluent Application Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "99th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"4..\"}[5m])",
            "legendFormat": "4xx errors"
          },
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users{period=\"1h\"}",
            "legendFormat": "Last hour"
          }
        ]
      }
    ]
  }
}
```

### 2. Infrastructure Dashboard

```json
{
  "dashboard": {
    "title": "Infrastructure Monitoring",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "100 - (avg by (instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Disk Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100",
            "legendFormat": "{{instance}} {{mountpoint}}"
          }
        ]
      },
      {
        "title": "Network Traffic",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(node_network_receive_bytes_total[5m])",
            "legendFormat": "{{instance}} receive"
          },
          {
            "expr": "rate(node_network_transmit_bytes_total[5m])",
            "legendFormat": "{{instance}} transmit"
          }
        ]
      }
    ]
  }
}
```

## Alert Manager Configuration

### 1. Alert Manager Config

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@yourdomain.com'
  slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'

route:
  group_by: ['alertname', 'instance']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
  
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#alerts-critical'
        title: 'Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        send_resolved: true
    email_configs:
      - to: 'oncall@yourdomain.com'
        subject: 'Critical Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
  
  - name: 'warning-alerts'
    slack_configs:
      - channel: '#alerts-warning'
        title: 'Warning Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

### 2. Alert Routing

```yaml
# Advanced routing
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    # Database alerts
    - match_re:
        alertname: 'Database.*'
      receiver: 'database-team'
      group_wait: 5s
      repeat_interval: 30m
    
    # Application alerts
    - match_re:
        alertname: 'High.*Rate|.*ResponseTime'
      receiver: 'app-team'
      group_wait: 30s
      repeat_interval: 15m
    
    # Infrastructure alerts
    - match_re:
        alertname: '.*Memory.*|.*Disk.*|.*CPU.*'
      receiver: 'infra-team'
      group_wait: 1m
      repeat_interval: 1h
```

## Distributed Tracing

### 1. Jaeger Integration

```typescript
import { initTracer } from 'jaeger-client';
import opentracing from 'opentracing';

// Initialize tracer
const config = {
  serviceName: 'fluent-app',
  sampler: {
    type: 'const',
    param: 1, // Sample all requests in development
  },
  reporter: {
    logSpans: true,
    agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
    agentPort: process.env.JAEGER_AGENT_PORT || 6832,
  },
};

const tracer = initTracer(config);
opentracing.initGlobalTracer(tracer);

// Tracing middleware
export const tracingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  
  span.setTag('http.method', req.method);
  span.setTag('http.url', req.url);
  span.setTag('user.id', req.user?.id);
  
  // Attach span to request
  req.span = span;
  
  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    if (res.statusCode >= 400) {
      span.setTag('error', true);
    }
    span.finish();
  });
  
  next();
};

// Database tracing
export const traceDatabaseQuery = async (query: string, params: any[], span?: any) => {
  const childSpan = span ? span.tracer().startSpan('database.query', { childOf: span }) : tracer.startSpan('database.query');
  
  childSpan.setTag('db.type', 'postgresql');
  childSpan.setTag('db.statement', query);
  
  try {
    const result = await executeQuery(query, params);
    childSpan.setTag('db.rows_affected', result.rowCount);
    return result;
  } catch (error) {
    childSpan.setTag('error', true);
    childSpan.log({ error: error.message });
    throw error;
  } finally {
    childSpan.finish();
  }
};
```

## Health Checks

### 1. Comprehensive Health Check

```typescript
export class HealthCheckService {
  private static checks: Map<string, () => Promise<boolean>> = new Map();
  
  static registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }
  
  static async runHealthChecks(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, { status: 'pass' | 'fail'; responseTime: number; error?: string }>;
    timestamp: string;
  }> {
    const results: Record<string, any> = {};
    let overallStatus = 'healthy';
    
    for (const [name, check] of this.checks) {
      const start = Date.now();
      
      try {
        const result = await Promise.race([
          check(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        
        results[name] = {
          status: result ? 'pass' : 'fail',
          responseTime: Date.now() - start
        };
        
        if (!result) {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          responseTime: Date.now() - start,
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }
    
    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date().toISOString()
    };
  }
}

// Register health checks
HealthCheckService.registerCheck('database', async () => {
  try {
    await connector.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
});

HealthCheckService.registerCheck('redis', async () => {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
});

HealthCheckService.registerCheck('external-api', async () => {
  try {
    const response = await fetch('https://api.external-service.com/health');
    return response.ok;
  } catch {
    return false;
  }
});
```

## Monitoring Best Practices

### 1. The Four Golden Signals
- **Latency** - Time to process requests
- **Traffic** - Demand on the system
- **Errors** - Rate of failed requests
- **Saturation** - Resource utilization

### 2. SLIs and SLOs
```typescript
// Service Level Indicators
const slis = {
  availability: {
    target: 99.9, // 99.9% uptime
    measure: 'up{job="fluent-app"} == 1'
  },
  latency: {
    target: 200, // 200ms p95 response time
    measure: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
  },
  errorRate: {
    target: 0.1, // 0.1% error rate
    measure: 'rate(http_requests_total{status_code=~"5.."}[5m])'
  }
};
```

### 3. Alerting Guidelines
- Alert on symptoms, not causes
- Use multiple severity levels
- Include runbooks in alerts
- Avoid alert fatigue
- Test alert channels regularly

## Deployment Checklist

- [ ] Prometheus server configured
- [ ] Application metrics implemented
- [ ] Grafana dashboards created
- [ ] Alert rules defined
- [ ] Alert Manager configured
- [ ] Notification channels tested
- [ ] Health checks implemented
- [ ] Distributed tracing enabled
- [ ] SLIs and SLOs defined
- [ ] Runbooks created
- [ ] On-call procedures established
- [ ] Monitoring documented

## Next Steps

1. [Logging](logging.md) - Set up centralized logging
2. [Backup and Recovery](backup.md) - Implement backup strategies
3. [Scaling](scaling.md) - Configure auto-scaling
4. [Troubleshooting](../troubleshooting/performance-issues.md) - Debug performance issues