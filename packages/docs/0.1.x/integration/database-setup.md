# Database Setup Guide

This guide covers the setup and configuration of different database systems for use with Goat Fluent connectors.

## MySQL Setup

### Installation

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server mysql-client
sudo systemctl start mysql
sudo systemctl enable mysql
```

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Windows:**
Download and install MySQL from [official website](https://dev.mysql.com/downloads/installer/)

### Configuration

1. **Secure Installation:**
```bash
sudo mysql_secure_installation
```

2. **Create Database and User:**
```sql
CREATE DATABASE myapp_db;
CREATE USER 'myapp_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON myapp_db.* TO 'myapp_user'@'localhost';
FLUSH PRIVILEGES;
```

3. **TypeORM Configuration:**
```typescript
import { DataSource } from 'typeorm'

export const MySQLDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'myapp_user',
  password: 'secure_password',
  database: 'myapp_db',
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false, // Use migrations in production
  logging: true,
  migrations: [__dirname + '/../migrations/*.ts'],
  timezone: 'UTC'
})
```

### Production Optimization

```typescript
export const MySQLDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false,
  migrations: [__dirname + '/../migrations/*.ts'],
  ssl: process.env.NODE_ENV === 'production',
  extra: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  }
})
```

## PostgreSQL Setup

### Installation

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install PostgreSQL from [official website](https://www.postgresql.org/download/)

### Configuration

1. **Access PostgreSQL:**
```bash
sudo -u postgres psql
```

2. **Create Database and User:**
```sql
CREATE DATABASE myapp_db;
CREATE USER myapp_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE myapp_db TO myapp_user;
```

3. **TypeORM Configuration:**
```typescript
import { DataSource } from 'typeorm'

export const PostgreSQLDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'myapp_user',
  password: 'secure_password',
  database: 'myapp_db',
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: true,
  migrations: [__dirname + '/../migrations/*.ts'],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})
```

### Production Configuration

```typescript
export const PostgreSQLDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false,
  migrations: [__dirname + '/../migrations/*.ts'],
  ssl: {
    rejectUnauthorized: false
  },
  extra: {
    max: 20,
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 60000
  }
})
```

## MongoDB Setup

### Installation

**Linux (Ubuntu/Debian):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Windows:**
Download and install MongoDB from [official website](https://www.mongodb.com/try/download/community)

### Configuration

1. **Create Database and User:**
```javascript
use myapp_db
db.createUser({
  user: "myapp_user",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "myapp_db" }
  ]
})
```

2. **TypeORM Configuration:**
```typescript
import { DataSource } from 'typeorm'

export const MongoDataSource = new DataSource({
  type: 'mongodb',
  host: 'localhost',
  port: 27017,
  database: 'myapp_db',
  username: 'myapp_user',
  password: 'secure_password',
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: true,
  useUnifiedTopology: true,
  authSource: 'myapp_db'
})
```

### Production Configuration

```typescript
export const MongoDataSource = new DataSource({
  type: 'mongodb',
  url: process.env.MONGODB_URI,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false,
  useUnifiedTopology: true,
  ssl: true,
  extra: {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferMaxEntries: 0,
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
})
```

## SQLite Setup

### Installation

SQLite is included with most systems. For development:

```bash
# Linux/macOS
sudo apt install sqlite3  # Ubuntu/Debian
brew install sqlite       # macOS

# Windows
# Download from https://sqlite.org/download.html
```

### Configuration

```typescript
import { DataSource } from 'typeorm'

export const SQLiteDataSource = new DataSource({
  type: 'sqlite',
  database: './database.sqlite',
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: true, // OK for development
  logging: true,
  migrations: [__dirname + '/../migrations/*.ts']
})
```

### Production Configuration

```typescript
export const SQLiteDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DB_PATH || './production.sqlite',
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false,
  migrations: [__dirname + '/../migrations/*.ts']
})
```

## Firebase Setup

### Project Setup

1. **Create Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firestore Database

2. **Generate Service Account:**
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

3. **Configuration:**
```typescript
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = require('./path/to/service-account.json')

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://your-project.firebaseio.com'
})

export const firestore = getFirestore()
```

### Environment Configuration

```typescript
// config/firebase.ts
import { initializeApp, cert } from 'firebase-admin/app'

const firebaseConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
}

export const firebaseApp = initializeApp(firebaseConfig)
```

## Docker Setup

### MySQL with Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: myapp_db
      MYSQL_USER: myapp_user
      MYSQL_PASSWORD: secure_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql_data:
```

### PostgreSQL with Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp_db
      POSTGRES_USER: myapp_user
      POSTGRES_PASSWORD: secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### MongoDB with Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:6.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: adminpassword
      MONGO_INITDB_DATABASE: myapp_db
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  mongodb_data:
```

## Environment Variables

### .env File Template

```bash
# Database Configuration
NODE_ENV=development
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=myapp_user
DB_PASSWORD=secure_password
DB_NAME=myapp_db

# MongoDB (if using MongoDB)
MONGODB_URI=mongodb://myapp_user:secure_password@localhost:27017/myapp_db

# Firebase (if using Firebase)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# SQLite (if using SQLite)
DB_PATH=./database.sqlite

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

### Environment-Specific Configuration

```typescript
// config/database.ts
import { DataSource } from 'typeorm'

const config = {
  development: {
    type: 'sqlite' as const,
    database: './dev.sqlite',
    synchronize: true,
    logging: true
  },
  test: {
    type: 'sqlite' as const,
    database: ':memory:',
    synchronize: true,
    logging: false
  },
  production: {
    type: process.env.DB_TYPE as any,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    ssl: true
  }
}

export const AppDataSource = new DataSource({
  ...config[process.env.NODE_ENV || 'development'],
  entities: [__dirname + '/../entities/*.ts'],
  migrations: [__dirname + '/../migrations/*.ts']
})
```

## Health Checks

### Database Health Check

```typescript
// utils/healthCheck.ts
import { AppDataSource } from '../config/database'

export const checkDatabaseHealth = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
    }
    
    // Simple query to check connection
    await AppDataSource.query('SELECT 1')
    
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}
```

### Health Check Endpoint

```typescript
// routes/health.ts
import { Router } from 'express'
import { checkDatabaseHealth } from '../utils/healthCheck'

const router = Router()

router.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth()
  
  const health = {
    status: dbHealth.status,
    services: {
      database: dbHealth
    }
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(health)
})

export default router
```

## Backup and Recovery

### MySQL Backup

```bash
# Create backup
mysqldump -u myapp_user -p myapp_db > backup.sql

# Restore backup
mysql -u myapp_user -p myapp_db < backup.sql
```

### PostgreSQL Backup

```bash
# Create backup
pg_dump -U myapp_user -h localhost myapp_db > backup.sql

# Restore backup
psql -U myapp_user -h localhost myapp_db < backup.sql
```

### MongoDB Backup

```bash
# Create backup
mongodump --db myapp_db --out backup/

# Restore backup
mongorestore --db myapp_db backup/myapp_db/
```

## Monitoring and Logging

### Database Monitoring

```typescript
// utils/monitoring.ts
import { AppDataSource } from '../config/database'

export const monitorDatabase = () => {
  const queryLogger = {
    logQuery: (query: string, parameters?: any[]) => {
      console.log('Query:', query)
      if (parameters) {
        console.log('Parameters:', parameters)
      }
    },
    logQueryError: (error: string, query: string, parameters?: any[]) => {
      console.error('Query Error:', error)
      console.error('Query:', query)
      if (parameters) {
        console.error('Parameters:', parameters)
      }
    },
    logQuerySlow: (time: number, query: string, parameters?: any[]) => {
      console.warn(`Slow Query (${time}ms):`, query)
      if (parameters) {
        console.warn('Parameters:', parameters)
      }
    }
  }

  AppDataSource.setOptions({
    logger: queryLogger,
    maxQueryExecutionTime: 1000 // Log queries taking longer than 1 second
  })
}
```

## Troubleshooting

### Common Issues

1. **Connection Timeout:**
   - Check firewall settings
   - Verify database service is running
   - Increase connection timeout

2. **Authentication Failed:**
   - Verify credentials
   - Check user permissions
   - Ensure database exists

3. **SSL Issues:**
   - Configure SSL properly
   - Check certificate validity
   - Use appropriate SSL mode

4. **Performance Issues:**
   - Add proper indexes
   - Optimize queries
   - Increase connection pool size

### Debug Configuration

```typescript
// config/debug.ts
export const debugConfig = {
  type: process.env.DB_TYPE as any,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: ['query', 'error', 'schema', 'warn', 'info'],
  logger: 'advanced-console',
  maxQueryExecutionTime: 500
}
```

This comprehensive guide covers the setup and configuration of various database systems for use with Goat Fluent, ensuring proper installation, configuration, and optimization for both development and production environments.