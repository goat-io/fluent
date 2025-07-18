# Production Environment Setup

This guide covers the essential steps to set up a production-ready environment for your Fluent application.

## Overview

Production environments require careful configuration to ensure security, performance, and reliability. This guide provides comprehensive setup instructions for deploying Fluent applications.

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+ (package manager)
- Docker 20.10+ (for containerization)
- A supported database (PostgreSQL, MySQL, MongoDB, etc.)
- SSL certificates for HTTPS
- Reverse proxy (Nginx, Apache, or cloud load balancer)

## Environment Configuration

### 1. Environment Variables

Create a `.env.production` file with the following essential variables:

```bash
# Application Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/fluent_prod
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Security
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-here

# CORS Settings
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/fluent/app.log

# Cache Configuration
REDIS_URL=redis://localhost:6379
REDIS_DB=0
REDIS_TIMEOUT=5000

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp,application/pdf

# Email Service
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password

# Monitoring
HEALTH_CHECK_ENDPOINT=/health
METRICS_ENDPOINT=/metrics
PROMETHEUS_ENABLED=true
```

### 2. Database Connection

Configure your database connection based on your chosen database:

#### PostgreSQL
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=10000
```

#### MySQL
```bash
DATABASE_URL=mysql://user:password@host:3306/database
DATABASE_SSL=true
DATABASE_CHARSET=utf8mb4
DATABASE_TIMEZONE=UTC
```

#### MongoDB
```bash
DATABASE_URL=mongodb://user:password@host:27017/database
DATABASE_SSL=true
DATABASE_AUTH_SOURCE=admin
DATABASE_REPLICA_SET=rs0
```

### 3. Security Configuration

#### SSL/TLS Setup
```bash
# SSL Certificate paths
SSL_CERT_PATH=/etc/ssl/certs/yourdomain.crt
SSL_KEY_PATH=/etc/ssl/private/yourdomain.key
SSL_CA_PATH=/etc/ssl/certs/ca-bundle.crt

# Force HTTPS
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000
```

#### Security Headers
```bash
# Content Security Policy
CSP_ENABLED=true
CSP_DIRECTIVES="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"

# Additional Security
X_FRAME_OPTIONS=DENY
X_CONTENT_TYPE_OPTIONS=nosniff
X_XSS_PROTECTION=1; mode=block
REFERRER_POLICY=strict-origin-when-cross-origin
```

## Production Build

### 1. Build Process

```bash
# Install dependencies
pnpm install --frozen-lockfile --production

# Build all packages
pnpm build

# Run tests
pnpm test

# Clean development dependencies
pnpm prune --production
```

### 2. TypeScript Configuration

Ensure your `tsconfig.json` includes production optimizations:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "removeComments": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Process Management

### 1. PM2 Configuration

Create a `ecosystem.config.js` file:

```javascript
module.exports = {
  apps: [{
    name: 'fluent-app',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/fluent/err.log',
    out_file: '/var/log/fluent/out.log',
    log_file: '/var/log/fluent/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 2. Systemd Service

Create a systemd service file `/etc/systemd/system/fluent.service`:

```ini
[Unit]
Description=Fluent Application
After=network.target

[Service]
Type=simple
User=fluent
WorkingDirectory=/opt/fluent
ExecStart=/usr/local/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fluent

[Install]
WantedBy=multi-user.target
```

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
upstream fluent_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://fluent_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://fluent_app;
        proxy_set_header Host $host;
    }
    
    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://fluent_app;
    }
}
```

## Health Checks

### Application Health Check

Implement a comprehensive health check endpoint:

```typescript
import { Request, Response } from 'express';
import { BaseConnector } from '@goat-sdk/fluent';

export class HealthController {
  constructor(private connector: BaseConnector) {}

  async healthCheck(req: Request, res: Response): Promise<void> {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      checks: {
        database: await this.checkDatabase(),
        cache: await this.checkCache(),
        memory: this.checkMemory(),
        disk: await this.checkDisk()
      }
    };

    const isHealthy = Object.values(checks.checks).every(check => check.status === 'ok');
    
    res.status(isHealthy ? 200 : 503).json(checks);
  }

  private async checkDatabase(): Promise<{ status: string; responseTime?: number }> {
    try {
      const start = Date.now();
      await this.connector.query('SELECT 1');
      const responseTime = Date.now() - start;
      
      return { status: 'ok', responseTime };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private async checkCache(): Promise<{ status: string; responseTime?: number }> {
    // Implement cache health check
    return { status: 'ok' };
  }

  private checkMemory(): { status: string; usage: NodeJS.MemoryUsage } {
    const usage = process.memoryUsage();
    const maxMemory = 1024 * 1024 * 1024; // 1GB
    
    return {
      status: usage.heapUsed < maxMemory ? 'ok' : 'warning',
      usage
    };
  }

  private async checkDisk(): Promise<{ status: string; usage?: any }> {
    // Implement disk space check
    return { status: 'ok' };
  }
}
```

## Monitoring Setup

### 1. Prometheus Metrics

```typescript
import prometheus from 'prom-client';

// Create metrics registry
const register = new prometheus.Registry();

// Default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

export const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const databaseQueryDuration = new prometheus.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(databaseQueryDuration);
```

### 2. Metrics Endpoint

```typescript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring and logging setup
- [ ] Health checks implemented
- [ ] Backup strategy in place
- [ ] Load balancer configured
- [ ] CDN setup for static assets
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] Security scanning completed
- [ ] Documentation updated

## Next Steps

1. [Database Configuration](database-config.md) - Configure production databases
2. [Security Best Practices](security.md) - Implement security measures
3. [Performance Optimization](performance.md) - Optimize application performance
4. [Deployment Guides](../deployment/docker.md) - Deploy your application