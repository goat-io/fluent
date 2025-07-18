# Production Database Configuration

This guide covers database configuration, optimization, and best practices for production environments using the Fluent ecosystem.

## Overview

Fluent supports multiple database systems through its connector architecture. This guide provides production-ready configurations for each supported database type.

## Supported Databases

- **PostgreSQL** - Primary SQL database (recommended)
- **MySQL** - Alternative SQL database
- **MongoDB** - NoSQL document database
- **SQLite** - Embedded database (development/testing)
- **Firebase Firestore** - Cloud NoSQL database
- **LokiJS** - In-memory database
- **PouchDB** - Client-side database

## PostgreSQL Configuration

### 1. Basic Setup

```bash
# Environment variables
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=10000
DATABASE_STATEMENT_TIMEOUT=30000
DATABASE_QUERY_TIMEOUT=30000
```

### 2. Connection Pool Configuration

```typescript
import { TypeOrmConnector } from '@goat-sdk/fluent';

const connector = new TypeOrmConnector({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  
  // Connection pooling
  extra: {
    max: 20,              // Maximum connections in pool
    min: 5,               // Minimum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 10000,
    
    // SSL Configuration
    ssl: {
      mode: 'require',
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    }
  },
  
  // Logging
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error', 'warn'],
  logger: 'advanced-console',
  
  // Caching
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1 // Use separate DB for query cache
    },
    duration: 30000 // 30 seconds
  }
});
```

### 3. PostgreSQL Server Configuration

Add to `postgresql.conf`:

```conf
# Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL settings
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'ddl'
log_min_duration_statement = 1000
log_lock_waits = on
log_temp_files = 0

# Auto vacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
```

### 4. Index Optimization

```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY idx_posts_user_id ON posts(user_id);
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts(created_at DESC);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_posts_user_status ON posts(user_id, status);
CREATE INDEX CONCURRENTLY idx_activities_user_date ON activities(user_id, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX CONCURRENTLY idx_users_active ON users(id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_posts_published ON posts(created_at DESC) WHERE status = 'published';
```

## MySQL Configuration

### 1. Basic Setup

```bash
# Environment variables
DATABASE_URL=mysql://user:password@host:3306/database
DATABASE_SSL=true
DATABASE_CHARSET=utf8mb4
DATABASE_COLLATION=utf8mb4_unicode_ci
DATABASE_TIMEZONE=UTC
```

### 2. Connection Configuration

```typescript
const connector = new TypeOrmConnector({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  timezone: 'UTC',
  
  extra: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    
    // SSL Configuration
    ssl: process.env.NODE_ENV === 'production' ? {
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
      rejectUnauthorized: false
    } : false
  }
});
```

### 3. MySQL Server Configuration

Add to `my.cnf`:

```conf
[mysqld]
# Connection settings
max_connections = 200
max_user_connections = 50
wait_timeout = 28800
interactive_timeout = 28800

# Buffer settings
innodb_buffer_pool_size = 1G
innodb_buffer_pool_instances = 8
innodb_log_file_size = 256M
innodb_log_buffer_size = 16M

# Query cache
query_cache_type = 1
query_cache_size = 64M
query_cache_limit = 2M

# Logging
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
log_queries_not_using_indexes = 1

# Character set
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
```

## MongoDB Configuration

### 1. Basic Setup

```bash
# Environment variables
DATABASE_URL=mongodb://user:password@host:27017/database
DATABASE_SSL=true
DATABASE_AUTH_SOURCE=admin
DATABASE_REPLICA_SET=rs0
DATABASE_READ_PREFERENCE=secondary
```

### 2. Connection Configuration

```typescript
import { MongoConnector } from '@goat-sdk/fluent-mongodb';

const connector = new MongoConnector({
  uri: process.env.DATABASE_URL,
  options: {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    
    // SSL Configuration
    ssl: process.env.NODE_ENV === 'production',
    sslValidate: true,
    sslCA: process.env.DB_SSL_CA,
    sslCert: process.env.DB_SSL_CERT,
    sslKey: process.env.DB_SSL_KEY,
    
    // Read preference
    readPreference: 'secondaryPreferred',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority', j: true }
  }
});
```

### 3. MongoDB Server Configuration

```yaml
# mongod.conf
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true
  logRotate: rename

storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2
    collectionConfig:
      blockCompressor: snappy
    indexConfig:
      prefixCompression: true

processManagement:
  pidFilePath: /var/run/mongodb/mongod.pid
  fork: true

net:
  port: 27017
  bindIp: 127.0.0.1
  maxIncomingConnections: 200
  ssl:
    mode: requireSSL
    PEMKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.pem

replication:
  replSetName: rs0
  oplogSizeMB: 1024

security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile
```

### 4. Index Optimization

```javascript
// Create indexes for common queries
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
db.posts.createIndex({ userId: 1, createdAt: -1 });
db.posts.createIndex({ status: 1, createdAt: -1 });

// Compound indexes
db.activities.createIndex({ userId: 1, type: 1, createdAt: -1 });
db.messages.createIndex({ conversationId: 1, createdAt: -1 });

// Text search indexes
db.posts.createIndex({ 
  title: "text", 
  content: "text" 
}, { 
  weights: { title: 10, content: 5 },
  name: "posts_text_index"
});

// Geospatial indexes
db.locations.createIndex({ location: "2dsphere" });
```

## Firebase Firestore Configuration

### 1. Basic Setup

```bash
# Environment variables
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

### 2. Connection Configuration

```typescript
import { FirebaseConnector } from '@goat-sdk/fluent-firebase';

const connector = new FirebaseConnector({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  
  // Performance settings
  settings: {
    ignoreUndefinedProperties: true,
    merge: true,
    timestampsInSnapshots: true
  }
});
```

### 3. Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Posts with proper validation
    match /posts/{postId} {
      allow read: if resource.data.status == 'published' || 
                     (request.auth != null && request.auth.uid == resource.data.userId);
      allow create: if request.auth != null && 
                       request.auth.uid == resource.data.userId &&
                       validatePost(resource.data);
      allow update: if request.auth != null && 
                       request.auth.uid == resource.data.userId &&
                       validatePost(resource.data);
      allow delete: if request.auth != null && 
                       request.auth.uid == resource.data.userId;
    }
    
    function validatePost(data) {
      return data.title is string && data.title.size() > 0 &&
             data.content is string && data.content.size() > 0 &&
             data.status in ['draft', 'published'];
    }
  }
}
```

## Database Monitoring

### 1. Performance Monitoring

```typescript
// Database query monitoring
export class DatabaseMonitor {
  private queryCounter = new Map<string, number>();
  private slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];
  
  logQuery(query: string, duration: number): void {
    // Count queries
    const count = this.queryCounter.get(query) || 0;
    this.queryCounter.set(query, count + 1);
    
    // Track slow queries
    if (duration > 1000) { // 1 second threshold
      this.slowQueries.push({
        query,
        duration,
        timestamp: new Date()
      });
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }
  }
  
  getStats(): {
    totalQueries: number;
    slowQueries: number;
    topQueries: Array<{ query: string; count: number }>;
  } {
    const totalQueries = Array.from(this.queryCounter.values()).reduce((a, b) => a + b, 0);
    const slowQueries = this.slowQueries.length;
    const topQueries = Array.from(this.queryCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return { totalQueries, slowQueries, topQueries };
  }
}
```

### 2. Health Checks

```typescript
export class DatabaseHealthCheck {
  constructor(private connector: BaseConnector) {}
  
  async checkHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      await this.connector.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      // Check connection pool
      const poolStats = await this.getPoolStats();
      
      // Determine health status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (responseTime > 5000) {
        status = 'critical';
      } else if (responseTime > 1000 || poolStats.activeConnections > poolStats.maxConnections * 0.8) {
        status = 'warning';
      }
      
      return {
        status,
        details: {
          responseTime,
          poolStats,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'critical',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
  
  private async getPoolStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
  }> {
    // Implementation depends on database type
    return {
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: 20
    };
  }
}
```

## Backup Strategies

### 1. PostgreSQL Backup

```bash
#!/bin/bash
# PostgreSQL backup script

DB_NAME="fluent_prod"
DB_USER="postgres"
DB_HOST="localhost"
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -b -v -f $BACKUP_DIR/full_backup_$DATE.backup

# Compressed backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/compressed_backup_$DATE.sql.gz

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.backup" -type f -mtime +7 -delete
find $BACKUP_DIR -name "*.sql.gz" -type f -mtime +7 -delete
```

### 2. MongoDB Backup

```bash
#!/bin/bash
# MongoDB backup script

DB_NAME="fluent_prod"
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup
mongodump --db $DB_NAME --out $BACKUP_DIR/full_backup_$DATE

# Compressed backup
mongodump --db $DB_NAME --archive=$BACKUP_DIR/compressed_backup_$DATE.archive --gzip

# Remove backups older than 7 days
find $BACKUP_DIR -name "full_backup_*" -type d -mtime +7 -exec rm -rf {} \;
find $BACKUP_DIR -name "compressed_backup_*.archive" -type f -mtime +7 -delete
```

## Migration Management

### 1. Database Migrations

```typescript
// Migration runner
export class MigrationRunner {
  constructor(private connector: BaseConnector) {}
  
  async runMigrations(): Promise<void> {
    const migrations = await this.getPendingMigrations();
    
    for (const migration of migrations) {
      try {
        await this.connector.startTransaction();
        await migration.up(this.connector);
        await this.markMigrationAsCompleted(migration.name);
        await this.connector.commitTransaction();
        
        console.log(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        await this.connector.rollbackTransaction();
        throw new Error(`Migration ${migration.name} failed: ${error.message}`);
      }
    }
  }
  
  private async getPendingMigrations(): Promise<Migration[]> {
    // Implementation to get pending migrations
    return [];
  }
  
  private async markMigrationAsCompleted(name: string): Promise<void> {
    // Implementation to mark migration as completed
  }
}
```

## Production Checklist

- [ ] Database server configured and optimized
- [ ] Connection pooling configured
- [ ] SSL/TLS encryption enabled
- [ ] Indexes created for common queries
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting setup
- [ ] Health checks implemented
- [ ] Migration strategy in place
- [ ] Security rules configured (NoSQL)
- [ ] Query performance monitoring
- [ ] Connection limits configured
- [ ] Log rotation configured
- [ ] Disaster recovery plan documented

## Next Steps

1. [Security Best Practices](security.md) - Implement database security
2. [Performance Optimization](performance.md) - Optimize database performance
3. [Monitoring Setup](../operations/monitoring.md) - Set up database monitoring
4. [Backup and Recovery](../operations/backup.md) - Implement backup strategies