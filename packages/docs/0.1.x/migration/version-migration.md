# Version Migration Guide

This guide provides comprehensive instructions for migrating between versions of the Fluent ecosystem. The migration process is designed to be smooth and predictable using changesets for version management.

## Overview

The Fluent ecosystem uses **changesets** for version management, which provides:
- **Semantic versioning** (semver) compliance
- **Automated changelog** generation
- **Coordinated releases** across packages
- **Clear migration paths** between versions

## Version Strategy

### Release Channels

#### 1. Major Versions (x.0.0)
- **Breaking changes** that require code modifications
- **New architecture** or significant API changes
- **Migration guides** provided for each major version

#### 2. Minor Versions (x.y.0)
- **New features** and enhancements
- **Backward compatible** changes
- **Optional migrations** for new features

#### 3. Patch Versions (x.y.z)
- **Bug fixes** and security updates
- **Fully backward compatible**
- **No migration required**

### Package Dependencies

The release dependency chain follows this order:
1. **js-utils** → Base utilities (browser/Node.js)
2. **node-utils** → Node.js specific utilities
3. **fluent** → Core query builder and connectors
4. **Specialized packages** → Database connectors, queue systems, etc.

## Migration Process

### Step 1: Preparation

#### Check Current Version
```bash
# Check current versions
pnpm list @goatlab/fluent
pnpm list @goatlab/js-utils
pnpm list @goatlab/node-utils

# Check for outdated packages
pnpm outdated
```

#### Backup Your Project
```bash
# Create backup
git tag backup-pre-migration-$(date +%Y%m%d)
git push origin backup-pre-migration-$(date +%Y%m%d)

# Or create a branch
git checkout -b backup-pre-migration
git push origin backup-pre-migration
git checkout main
```

#### Review Breaking Changes
```bash
# Check changelog for breaking changes
curl -s https://api.github.com/repos/goat-io/fluent/releases/latest
```

### Step 2: Update Dependencies

#### Update All Packages
```bash
# Update to latest versions
pnpm update @goatlab/fluent @goatlab/js-utils @goatlab/node-utils

# Or update specific packages
pnpm install @goatlab/fluent@latest
pnpm install @goatlab/js-utils@latest
pnpm install @goatlab/node-utils@latest
```

#### Update Specialized Packages
```bash
# Update database connectors
pnpm install @goatlab/fluent-firebase@latest
pnpm install @goatlab/fluent-loki@latest
pnpm install @goatlab/fluent-pouchdb@latest

# Update queue systems
pnpm install @goatlab/queue-core@latest
pnpm install @goatlab/queue-node@latest

# Update utilities
pnpm install @goatlab/uploads@latest
pnpm install @goatlab/formio-utils@latest
```

### Step 3: Code Migration

#### Automated Migration Tools
```bash
# Run migration scripts (if available)
npx @goatlab/fluent-migrate --from=0.4.x --to=0.5.x

# Or use codemods
npx @goatlab/fluent-codemods --version=0.5.x
```

#### Manual Migration Steps
Review the specific migration guides for your version upgrade:

## Version-Specific Migration Guides

### Migrating from 0.4.x to 0.5.x

#### Breaking Changes
1. **Connector Interface Changes**
2. **Query Builder API Updates**
3. **Configuration Format Changes**

#### Migration Steps

##### 1. Update Connector Configuration

**Before (0.4.x):**
```typescript
import { FluentConnector } from '@goatlab/fluent'

const connector = new FluentConnector({
  type: 'typeorm',
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'user',
    password: 'pass',
    database: 'mydb'
  }
})
```

**After (0.5.x):**
```typescript
import { TypeOrmConnector } from '@goatlab/fluent'

const connector = new TypeOrmConnector({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'pass',
  database: 'mydb'
})
```

##### 2. Update Query Builder Usage

**Before (0.4.x):**
```typescript
const users = await connector.query('User')
  .where('age', '>', 18)
  .orderBy('createdAt', 'DESC')
  .limit(10)
  .execute()
```

**After (0.5.x):**
```typescript
const users = await connector.find('User', {
  where: { age: { $gt: 18 } },
  orderBy: { createdAt: 'DESC' },
  limit: 10
})
```

##### 3. Update Entity Decorators

**Before (0.4.x):**
```typescript
import { Entity, FluentColumn } from '@goatlab/fluent'

@Entity('users')
export class User {
  @FluentColumn({ type: 'string', primary: true })
  id: string

  @FluentColumn({ type: 'string' })
  email: string
}
```

**After (0.5.x):**
```typescript
import { Entity, Column, PrimaryGeneratedColumn } from '@goatlab/fluent'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  email: string
}
```

##### 4. Update API Generation

**Before (0.4.x):**
```typescript
import { FluentAPI } from '@goatlab/fluent'

const api = new FluentAPI({
  connector,
  entities: [User, Post],
  routes: {
    prefix: '/api',
    version: 'v1'
  }
})
```

**After (0.5.x):**
```typescript
import { FluentAPI } from '@goatlab/fluent'

const api = new FluentAPI({
  connector,
  entities: [User, Post],
  config: {
    prefix: '/api',
    version: 'v1',
    enableGraphQL: true
  }
})
```

### Migrating from 0.3.x to 0.4.x

#### Breaking Changes
1. **Package Structure Reorganization**
2. **Import Path Changes**
3. **Configuration Schema Updates**

#### Migration Steps

##### 1. Update Import Paths

**Before (0.3.x):**
```typescript
import { Fluent, Utils } from '@goatlab/fluent'
import { Http } from '@goatlab/fluent/http'
import { Validation } from '@goatlab/fluent/validation'
```

**After (0.4.x):**
```typescript
import { Fluent } from '@goatlab/fluent'
import { Http } from '@goatlab/js-utils'
import { Validation } from '@goatlab/js-utils'
```

##### 2. Update Configuration

**Before (0.3.x):**
```typescript
const fluent = new Fluent({
  connector: {
    type: 'typeorm',
    config: {
      // TypeORM configuration
    }
  },
  features: {
    api: true,
    graphql: true
  }
})
```

**After (0.4.x):**
```typescript
const connector = new TypeOrmConnector({
  // TypeORM configuration
})

const fluent = new Fluent({
  connector,
  plugins: [
    new FluentAPI(),
    new FluentGraphQL()
  ]
})
```

## Database Migration

### Schema Migrations

#### TypeORM Migrations
```typescript
// migrations/1640000000000-UpdateUserSchema.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class UpdateUserSchema1640000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('users', new TableColumn({
      name: 'phone',
      type: 'varchar',
      length: '20',
      isNullable: true
    }))

    await queryRunner.query(`
      CREATE INDEX idx_users_phone ON users(phone)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_users_phone`)
    await queryRunner.dropColumn('users', 'phone')
  }
}
```

#### Running Migrations
```bash
# Generate migration
npx typeorm migration:generate -n UpdateUserSchema

# Run migrations
npx typeorm migration:run

# Revert migration
npx typeorm migration:revert
```

### Data Migration

#### Custom Data Migration Script
```typescript
// scripts/migrate-data-0.5.0.ts
import { DataSource } from 'typeorm'
import { User } from '../src/entities/User'

export async function migrateUserData(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User)
  
  console.log('Starting user data migration...')
  
  // Get all users without phone numbers
  const users = await userRepository.find({
    where: { phone: null }
  })
  
  console.log(`Found ${users.length} users to migrate`)
  
  // Migrate in batches
  const batchSize = 100
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize)
    
    await Promise.all(batch.map(async (user) => {
      // Extract phone from legacy email format
      const phoneMatch = user.email.match(/\+(\d+)@/)
      if (phoneMatch) {
        user.phone = `+${phoneMatch[1]}`
        await userRepository.save(user)
      }
    }))
    
    console.log(`Migrated batch ${Math.floor(i / batchSize) + 1}`)
  }
  
  console.log('User data migration completed')
}

// Run migration
if (require.main === module) {
  const dataSource = new DataSource({
    // Your database configuration
  })
  
  dataSource.initialize().then(async () => {
    await migrateUserData(dataSource)
    await dataSource.destroy()
  })
}
```

## Configuration Migration

### Environment Variables

#### Update .env Files
```bash
# Before (0.4.x)
FLUENT_DB_TYPE=postgres
FLUENT_DB_HOST=localhost
FLUENT_DB_PORT=5432
FLUENT_DB_USERNAME=user
FLUENT_DB_PASSWORD=pass
FLUENT_DB_DATABASE=mydb

# After (0.5.x)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
TYPEORM_ENTITIES=src/entities/*.ts
TYPEORM_MIGRATIONS=src/migrations/*.ts
TYPEORM_LOGGING=true
```

#### Update Configuration Files
```typescript
// config/database.ts

// Before (0.4.x)
export const databaseConfig = {
  type: 'postgres',
  host: process.env.FLUENT_DB_HOST,
  port: parseInt(process.env.FLUENT_DB_PORT || '5432'),
  username: process.env.FLUENT_DB_USERNAME,
  password: process.env.FLUENT_DB_PASSWORD,
  database: process.env.FLUENT_DB_DATABASE,
}

// After (0.5.x)
export const databaseConfig = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [process.env.TYPEORM_ENTITIES || 'src/entities/*.ts'],
  migrations: [process.env.TYPEORM_MIGRATIONS || 'src/migrations/*.ts'],
  logging: process.env.TYPEORM_LOGGING === 'true',
  synchronize: process.env.NODE_ENV === 'development',
}
```

## Testing Migration

### Migration Testing Strategy

#### 1. Automated Tests
```typescript
// tests/migration/version-migration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DataSource } from 'typeorm'
import { migrateUserData } from '../../scripts/migrate-data-0.5.0'

describe('Version Migration', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: ['src/entities/*.ts'],
      synchronize: true
    })
    await dataSource.initialize()
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  it('should migrate user data correctly', async () => {
    // Create test data with old format
    const userRepository = dataSource.getRepository(User)
    const testUser = await userRepository.save({
      email: '+1234567890@example.com',
      firstName: 'Test',
      lastName: 'User'
    })

    // Run migration
    await migrateUserData(dataSource)

    // Verify migration
    const migratedUser = await userRepository.findOne({
      where: { id: testUser.id }
    })

    expect(migratedUser?.phone).toBe('+1234567890')
    expect(migratedUser?.email).toBe('+1234567890@example.com')
  })
})
```

#### 2. Manual Testing Checklist
- [ ] Backup created successfully
- [ ] Dependencies updated without conflicts
- [ ] Database migrations run successfully
- [ ] Application starts without errors
- [ ] Core functionality works as expected
- [ ] API endpoints respond correctly
- [ ] Authentication still works
- [ ] Data integrity maintained

## Rollback Strategy

### Automated Rollback
```bash
# Create rollback script
#!/bin/bash
echo "Rolling back to previous version..."

# Revert to previous git tag
git checkout backup-pre-migration-$(date +%Y%m%d)

# Restore package versions
pnpm install --frozen-lockfile

# Revert database migrations
npx typeorm migration:revert

echo "Rollback completed"
```

### Manual Rollback Steps
1. **Stop the application**
2. **Revert to backup git tag**
3. **Restore previous package versions**
4. **Revert database migrations**
5. **Restore configuration files**
6. **Restart application**
7. **Verify rollback success**

## Common Migration Issues

### 1. Dependency Conflicts
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
pnpm install

# Or use force flag
pnpm install --force
```

### 2. TypeScript Errors
```bash
# Update TypeScript
pnpm install typescript@latest @types/node@latest

# Regenerate types
npx tsc --noEmit
```

### 3. Database Connection Issues
```typescript
// Check connection configuration
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  logging: true, // Enable logging to debug
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
})
```

### 4. API Changes
```typescript
// Use compatibility layer if available
import { FluentLegacyAPI } from '@goatlab/fluent/legacy'

// Or implement adapter pattern
class APIAdapter {
  constructor(private newAPI: FluentAPI) {}
  
  // Implement old API methods
  async query(entity: string) {
    return this.newAPI.find(entity, {})
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Review breaking changes documentation
- [ ] Create backup of code and database
- [ ] Test migration in development environment
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window

### During Migration
- [ ] Update dependencies
- [ ] Run database migrations
- [ ] Update configuration files
- [ ] Update code for breaking changes
- [ ] Run tests
- [ ] Verify application starts

### Post-Migration
- [ ] Verify all functionality works
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Communicate changes to team

## Best Practices

### 1. Version Planning
- Always review changelog before upgrading
- Test migrations in development first
- Plan for downtime during major upgrades
- Keep rollback plan ready

### 2. Incremental Updates
- Update one major version at a time
- Test each increment thoroughly
- Don't skip intermediate versions

### 3. Automated Testing
- Write tests for migration scripts
- Use CI/CD for migration testing
- Validate data integrity after migration

### 4. Documentation
- Document custom migration steps
- Update team on breaking changes
- Keep migration history for reference

### 5. Monitoring
- Monitor application after migration
- Watch for performance regressions
- Track error rates and user feedback

This comprehensive migration guide ensures smooth transitions between versions while maintaining application stability and data integrity.