# Breaking Changes Documentation

This document tracks all breaking changes across versions of the Fluent ecosystem, providing detailed migration paths for each change.

## Version 0.5.x Breaking Changes

### 1. Connector Interface Refactoring

**Impact**: High - Affects all database connector usage

**Change**: Split `FluentConnector` into specific connector classes
- `TypeOrmConnector` for SQL databases
- `FirebaseConnector` for Firestore
- `LokiConnector` for in-memory LokiJS
- `PouchDBConnector` for PouchDB/CouchDB

**Migration**:
```typescript
// Before (0.4.x)
import { FluentConnector } from '@goatlab/fluent'

const connector = new FluentConnector({
  type: 'typeorm',
  database: { /* config */ }
})

// After (0.5.x)
import { TypeOrmConnector } from '@goatlab/fluent'

const connector = new TypeOrmConnector({
  /* direct typeorm config */
})
```

### 2. Query Builder API Changes

**Impact**: Medium - Affects query building code

**Change**: Unified query interface across all connectors

**Migration**:
```typescript
// Before (0.4.x)
const users = await connector.query('User')
  .where('age', '>', 18)
  .orderBy('createdAt', 'DESC')
  .limit(10)
  .execute()

// After (0.5.x)
const users = await connector.find('User', {
  where: { age: { $gt: 18 } },
  orderBy: { createdAt: 'DESC' },
  limit: 10
})
```

### 3. Entity Decorator Changes

**Impact**: Medium - Affects entity definitions

**Change**: Moved from custom decorators to standard TypeORM decorators

**Migration**:
```typescript
// Before (0.4.x)
import { Entity, FluentColumn } from '@goatlab/fluent'

@Entity('users')
export class User {
  @FluentColumn({ type: 'string', primary: true })
  id: string

  @FluentColumn({ type: 'string' })
  email: string
}

// After (0.5.x)
import { Entity, Column, PrimaryGeneratedColumn } from '@goatlab/fluent'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  email: string
}
```

### 4. Configuration Schema Updates

**Impact**: Medium - Affects application configuration

**Change**: Simplified configuration structure

**Migration**:
```typescript
// Before (0.4.x)
const api = new FluentAPI({
  connector,
  entities: [User, Post],
  routes: {
    prefix: '/api',
    version: 'v1'
  },
  features: {
    graphql: true,
    auth: true
  }
})

// After (0.5.x)
const api = new FluentAPI({
  connector,
  entities: [User, Post],
  config: {
    prefix: '/api',
    version: 'v1',
    enableGraphQL: true,
    enableAuth: true
  }
})
```

## Version 0.4.x Breaking Changes

### 1. Package Structure Reorganization

**Impact**: High - Affects all imports

**Change**: Split utilities into separate packages

**Migration**:
```typescript
// Before (0.3.x)
import { Fluent, Utils, Http, Validation } from '@goatlab/fluent'

// After (0.4.x)
import { Fluent } from '@goatlab/fluent'
import { Http, Validation } from '@goatlab/js-utils'
import { FileSystem, Process } from '@goatlab/node-utils'
```

### 2. Plugin System Introduction

**Impact**: Medium - Affects API and GraphQL setup

**Change**: Replaced feature flags with plugin system

**Migration**:
```typescript
// Before (0.3.x)
const fluent = new Fluent({
  connector,
  features: {
    api: true,
    graphql: true
  }
})

// After (0.4.x)
import { FluentAPI, FluentGraphQL } from '@goatlab/fluent'

const fluent = new Fluent({
  connector,
  plugins: [
    new FluentAPI(),
    new FluentGraphQL()
  ]
})
```

### 3. Environment Variable Changes

**Impact**: Low - Affects configuration

**Change**: Standardized environment variable names

**Migration**:
```bash
# Before (0.3.x)
FLUENT_DB_HOST=localhost
FLUENT_DB_PORT=5432

# After (0.4.x)
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

## Version 0.3.x Breaking Changes

### 1. TypeScript Strict Mode

**Impact**: High - Affects type safety

**Change**: Enabled strict TypeScript mode

**Migration**:
```typescript
// Before (0.2.x) - Implicit any allowed
function processUser(user) {
  return user.name.toUpperCase()
}

// After (0.3.x) - Explicit types required
function processUser(user: User): string {
  return user.name.toUpperCase()
}
```

### 2. Async/Await Requirement

**Impact**: Medium - Affects all database operations

**Change**: Removed callback-based APIs

**Migration**:
```typescript
// Before (0.2.x)
connector.find('User', { age: 18 }, (err, users) => {
  if (err) throw err
  console.log(users)
})

// After (0.3.x)
try {
  const users = await connector.find('User', { age: 18 })
  console.log(users)
} catch (err) {
  throw err
}
```

## Migration Strategies

### 1. Gradual Migration

For large applications, implement changes incrementally:

```typescript
// Step 1: Create compatibility layer
class LegacyConnector {
  constructor(private newConnector: TypeOrmConnector) {}
  
  async query(entity: string) {
    // Delegate to new connector
    return this.newConnector.find(entity, {})
  }
}

// Step 2: Update modules one by one
// Module A: Use new API
const users = await connector.find('User', {})

// Module B: Use legacy wrapper (temporarily)
const posts = await legacyConnector.query('Post')

// Step 3: Remove compatibility layer
```

### 2. Automated Code Transformation

Use codemods for large-scale changes:

```javascript
// codemod: update-connector-imports.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift
  
  return j(fileInfo.source)
    .find(j.ImportDeclaration, {
      source: { value: '@goatlab/fluent' }
    })
    .forEach(path => {
      path.node.specifiers.forEach(spec => {
        if (spec.imported.name === 'FluentConnector') {
          spec.imported.name = 'TypeOrmConnector'
        }
      })
    })
    .toSource()
}
```

### 3. Feature Flags

Implement feature flags for gradual rollout:

```typescript
// config/features.ts
export const FEATURES = {
  USE_NEW_CONNECTOR: process.env.NODE_ENV === 'development',
  ENABLE_GRAPHQL_V2: process.env.ENABLE_GRAPHQL_V2 === 'true'
}

// usage
const connector = FEATURES.USE_NEW_CONNECTOR 
  ? new TypeOrmConnector(config)
  : new LegacyConnector(config)
```

## Testing Breaking Changes

### 1. Compatibility Tests

```typescript
// tests/compatibility/connector.test.ts
import { describe, it, expect } from 'vitest'
import { TypeOrmConnector } from '@goatlab/fluent'
import { LegacyConnector } from '../legacy/connector'

describe('Connector Compatibility', () => {
  it('should produce same results', async () => {
    const newConnector = new TypeOrmConnector(config)
    const legacyConnector = new LegacyConnector(config)
    
    const newResults = await newConnector.find('User', {})
    const legacyResults = await legacyConnector.query('User')
    
    expect(newResults).toEqual(legacyResults)
  })
})
```

### 2. Migration Tests

```typescript
// tests/migration/version-upgrade.test.ts
import { describe, it, expect } from 'vitest'
import { runMigration } from '../../scripts/migrate-to-0.5.0'

describe('Version 0.5.0 Migration', () => {
  it('should migrate connector configuration', async () => {
    const oldConfig = {
      type: 'typeorm',
      database: { type: 'postgres', host: 'localhost' }
    }
    
    const newConfig = await runMigration(oldConfig)
    
    expect(newConfig).toEqual({
      type: 'postgres',
      host: 'localhost'
    })
  })
})
```

## Communication Strategy

### 1. Deprecation Warnings

Add deprecation warnings before removing features:

```typescript
// v0.4.x - Add deprecation warning
export function oldQuery(entity: string) {
  console.warn(
    'oldQuery is deprecated and will be removed in v0.5.0. ' +
    'Use connector.find() instead.'
  )
  return this.find(entity, {})
}

// v0.5.x - Remove deprecated function
// oldQuery function removed
```

### 2. Migration Guides

Provide detailed migration guides:

```markdown
## Migration Guide v0.4.x → v0.5.x

### Breaking Changes
1. **Connector API Changes**
   - Impact: High
   - Action Required: Update all connector usage
   - Migration: See examples below

### Migration Steps
1. Update dependencies
2. Run migration script
3. Update imports
4. Test thoroughly
```

### 3. Changelog Format

Use structured changelog format:

```markdown
## [0.5.0] - 2024-01-15

### BREAKING CHANGES
- **connector**: Split FluentConnector into specific connector classes
- **query**: Unified query interface across all connectors
- **config**: Simplified configuration structure

### Added
- New TypeOrmConnector class
- Support for multiple database types
- Enhanced query builder

### Changed
- Improved performance for large queries
- Better error handling

### Removed
- Deprecated FluentConnector class
- Legacy query builder syntax
```

## Best Practices

### 1. Planning Breaking Changes
- Group related changes together
- Minimize frequency of breaking changes
- Provide clear migration paths
- Test thoroughly before release

### 2. Documentation
- Document all breaking changes
- Provide before/after examples
- Include migration scripts
- Update API documentation

### 3. Communication
- Announce breaking changes early
- Provide deprecation warnings
- Offer migration assistance
- Gather feedback from users

### 4. Testing
- Write compatibility tests
- Test migration scripts
- Validate in multiple environments
- Monitor post-release

This comprehensive breaking changes documentation helps developers understand the evolution of the Fluent ecosystem and provides clear migration paths for each version upgrade.