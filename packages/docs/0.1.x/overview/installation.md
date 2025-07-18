# Installation Guide

This guide will help you set up Fluent in your project with different database configurations.

## Prerequisites

- Node.js 18 or later
- TypeScript 4.5 or later
- A supported database (MySQL, PostgreSQL, MongoDB, SQLite, etc.)

## Basic Installation

Install the core Fluent package:

```bash
npm install @goatlab/fluent
# or
yarn add @goatlab/fluent
# or
pnpm add @goatlab/fluent
```

## Database-Specific Setup

### TypeORM Integration (SQL & MongoDB)

For SQL databases (MySQL, PostgreSQL, SQLite) and MongoDB:

```bash
# Core dependencies
npm install typeorm reflect-metadata zod

# Database drivers (choose one or more)
npm install mysql2      # for MySQL
npm install pg          # for PostgreSQL
npm install sqlite3     # for SQLite
npm install mongodb     # for MongoDB
```

#### MySQL Setup

```typescript
import { DataSource } from 'typeorm'
import { Fluent } from '@goatlab/fluent'
import { User } from './entities/User'

const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User],
  synchronize: false, // Set to true only in development
  logging: true
})

await Fluent.initialize([dataSource], [User])
```

#### PostgreSQL Setup

```typescript
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User],
  synchronize: false,
  logging: true
})

await Fluent.initialize([dataSource], [User])
```

#### SQLite Setup

```typescript
const dataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  entities: [User],
  synchronize: true, // Safe for SQLite in development
  logging: true
})

await Fluent.initialize([dataSource], [User])
```

#### MongoDB Setup

```typescript
const dataSource = new DataSource({
  type: 'mongodb',
  url: 'mongodb://localhost:27017/your_database',
  entities: [User],
  synchronize: true,
  logging: true
})

await Fluent.initialize([dataSource], [User])
```

### Firebase/Firestore Integration

For Firebase/Firestore support:

```bash
npm install @goatlab/fluent-firebase firebase-admin
```

```typescript
import { FirebaseConnector } from '@goatlab/fluent-firebase'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    // Your Firebase service account credentials
  })
})

// Use Firebase connector
const userRepo = new FirebaseConnector({
  collection: 'users',
  schema: UserSchema
})
```

### PouchDB Integration

For PouchDB support:

```bash
npm install @goatlab/fluent-pouchdb pouchdb
```

```typescript
import { PouchDBConnector } from '@goatlab/fluent-pouchdb'
import PouchDB from 'pouchdb'

const db = new PouchDB('my-database')
const userRepo = new PouchDBConnector({
  database: db,
  schema: UserSchema
})
```

### LokiJS Integration

For in-memory database support:

```bash
npm install @goatlab/fluent-loki lokijs
```

```typescript
import { LokiConnector } from '@goatlab/fluent-loki'
import Loki from 'lokijs'

const db = new Loki('my-database')
const userRepo = new LokiConnector({
  database: db,
  collection: 'users',
  schema: UserSchema
})
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes the necessary compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Package.json Scripts

Add helpful scripts to your `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/app.ts",
    "start": "node dist/app.js",
    "test": "jest",
    "db:generate": "typeorm migration:generate -d src/database.ts",
    "db:migrate": "typeorm migration:run -d src/database.ts",
    "db:revert": "typeorm migration:revert -d src/database.ts"
  }
}
```

## Environment Configuration

Create a `.env` file for environment variables:

```env
# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug

# Production Settings (for production)
# NODE_ENV=production
# LOG_LEVEL=error
```

Load environment variables in your application:

```typescript
import dotenv from 'dotenv'
dotenv.config()

const dataSource = new DataSource({
  type: process.env.DB_TYPE as any,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.LOG_LEVEL === 'debug'
})
```

## Docker Setup (Optional)

For containerized development, create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=mysql
      - DB_USERNAME=root
      - DB_PASSWORD=password
      - DB_DATABASE=fluent_app
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: fluent_app
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mysql_data:
```

## Development Tools

### VS Code Extensions

Install these VS Code extensions for better development experience:

- **TypeScript Importer** - Auto import TypeScript modules
- **TypeScript Hero** - Code organization and refactoring
- **SQL Tools** - Database management and query execution
- **Thunder Client** - API testing
- **GitLens** - Git integration

### ESLint and Prettier

Set up code formatting and linting:

```bash
npm install --save-dev eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

Create `.eslintrc.js`:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  }
}
```

Create `.prettierrc`:

```json
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## Testing Setup

Install testing dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest
```

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}
```

## Production Deployment

### Environment Variables

Set production environment variables:

```bash
# Database
export DB_TYPE=mysql
export DB_HOST=your-production-db-host
export DB_PORT=3306
export DB_USERNAME=your-production-username
export DB_PASSWORD=your-production-password
export DB_DATABASE=your-production-database

# Application
export NODE_ENV=production
export LOG_LEVEL=error
export PORT=3000
```

### Build and Deploy

```bash
# Build the application
npm run build

# Start the production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start dist/app.js --name "fluent-app"
```

## Troubleshooting

### Common Issues

1. **Decorator Issues**
   - Ensure `experimentalDecorators` and `emitDecoratorMetadata` are enabled
   - Import `reflect-metadata` at the top of your main file

2. **Database Connection Issues**
   - Check database credentials and connection strings
   - Verify database server is running
   - Ensure firewall allows connections

3. **TypeScript Errors**
   - Update TypeScript to latest version
   - Check `tsconfig.json` configuration
   - Verify all types are properly imported

4. **Module Resolution Issues**
   - Check `node_modules` installation
   - Clear npm/yarn cache
   - Delete `node_modules` and reinstall

### Getting Help

- Check the [GitHub Issues](https://github.com/goat-io/fluent/issues)
- Join our [Discord Community](https://discord.gg/goat)
- Read the [Architecture Guide](architecture.md)
- Review the [API Documentation](../core/fluent-class.md)

## Next Steps

Now that you have Fluent installed, you can:

1. **[Quick Start Tutorial](quick-start.md)** - Build your first application
2. **[Core Documentation](../core/fluent-class.md)** - Learn the main APIs
3. **[Entity Definition Guide](../core/entities.md)** - Define your data models
4. **[Query Builder Guide](../core/query-builder.md)** - Master type-safe queries

Ready to start building? Let's create your first Fluent application!