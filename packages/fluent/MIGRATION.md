# Migration Guide

## Migrating to v0.8.0

This guide helps you migrate from previous versions of @goatlab/fluent to v0.8.0.

### Breaking Changes

#### 1. Test Framework Change (Development Only)

If you have custom tests for your repositories, you'll need to migrate from Jest to Vitest.

**Before:**
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

**After:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Vitest Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
})
```

#### 2. DataSource Parameter Type Change

The `dataSource` parameter in TypeOrmConnector now accepts both direct DataSource and getter functions.

**Before:**
```typescript
class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource, // Only DataSource accepted
      inputSchema: UserSchema
    })
  }
}
```

**After:**
```typescript
class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource | (() => DataSource)) {
    super({
      entity: User,
      dataSource, // Now accepts both types
      inputSchema: UserSchema
    })
  }
}

// Usage with getter function
const repo = new UserRepository(() => container.get(DataSource))
```

### New Features

#### 1. MongoDB Dot Notation Queries

You can now query nested MongoDB documents using dot notation:

```typescript
// New capability in v0.8.0
const users = await userRepo.findMany({
  where: {
    'address.city': 'New York',
    'profile.settings.theme': 'dark',
    'metadata.tags': { $in: ['premium', 'verified'] }
  }
})
```

#### 2. Improved Type Preservation

Nested queries now preserve original types:

```typescript
// Before v0.8.0: Numbers might be converted to strings
// After v0.8.0: Types are preserved correctly
const users = await userRepo.findMany({
  where: {
    'profile.age': { $gte: 18 }, // Number stays as number
    'settings.notifications': true, // Boolean stays as boolean
  }
})
```

### MongoDB-Specific Considerations

#### CreateDateColumn Behavior

In MongoDB, `@f.created()` fields ignore provided values and always use the current timestamp:

```typescript
// This behavior is now documented and tested
await userRepo.insert({
  name: 'Test User',
  created: new Date('2020-01-01') // Ignored in MongoDB, current date used
})
```

#### Optimized Queries

Simple MongoDB queries are now automatically optimized:

```typescript
// This query uses an optimized structure in v0.8.0
const users = await userRepo.findMany({
  where: {
    status: 'active',
    age: { $gte: 18 }
  }
})
// Generates: { status: 'active', age: { $gte: 18 } }
// Instead of: { filter: { $or: [{ $and: [...] }] } }
```

### Recommended Actions

1. **Update Dependencies:**
   ```bash
   pnpm update @goatlab/fluent
   ```

2. **Test Your Queries:**
   - Run your existing test suite
   - Pay special attention to MongoDB nested queries
   - Verify date handling in MongoDB

3. **Update Repository Constructors:**
   - If using dependency injection, consider using getter functions
   - Update constructor signatures to accept `DataSource | (() => DataSource)`

4. **Review MongoDB Queries:**
   - Take advantage of dot notation for nested queries
   - Review any workarounds for nested object queries

5. **Migrate Tests to Vitest:**
   - Install Vitest: `pnpm add -D vitest`
   - Update test scripts in package.json
   - Migrate test configuration

### Common Issues and Solutions

#### Issue: Tests failing after migration

**Solution:** Ensure you've migrated to Vitest and updated any Jest-specific syntax.

#### Issue: MongoDB nested queries not working

**Solution:** Use dot notation syntax:
```typescript
// Wrong
where: { profile: { city: 'New York' } }

// Correct
where: { 'profile.city': 'New York' }
```

#### Issue: Type errors with DataSource parameter

**Solution:** Update your repository constructor signature:
```typescript
constructor(dataSource: DataSource | (() => DataSource))
```

### Getting Help

If you encounter issues during migration:

1. Check the [API Documentation](./API.md)
2. Review the [test suites](./src/TypeOrmConnector/test/unified/unifiedTestSuite.ts) for examples
3. Report issues on the GitHub repository

### Version Compatibility

- **TypeORM**: Compatible with v0.3.x
- **MongoDB Driver**: Compatible with v6.x
- **Node.js**: Requires v14.16.0 or higher
- **TypeScript**: Requires v4.5 or higher