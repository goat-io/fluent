# Metabase API Client Utilities

This directory contains a comprehensive TypeScript API client for Metabase administration and automation.

## Overview

The Metabase API client provides a clean, type-safe interface for:
- Setting up Metabase instances
- Managing databases and data sources
- Creating collections, questions, and dashboards
- Configuring authentication and permissions
- Enabling features like embeddings

## Architecture

### Core Components

1. **MetabaseApi Class** (`Metabase.ts`)
   - Main entry point for all API operations
   - Uses context binding pattern for clean API design
   - Supports both session token and API key authentication

2. **Common Utilities** (`common/`)
   - `fetch-wrapper.ts`: Centralized HTTP client with error handling
   - `retry.ts`: Exponential backoff retry logic for resilience

3. **Admin Operations** (`admin/`)
   - Initial setup and configuration
   - Database management
   - Security settings

4. **Action Operations** (`actions/`)
   - Collection management
   - Question (card) creation
   - Dashboard operations

## Usage Examples

### Basic Setup

```typescript
import { MetabaseApi } from './util/Metabase'

// Wait for Metabase to be ready
await MetabaseApi.waitForMetabase('http://localhost:3000')

// Create admin user (first time setup)
const sessionToken = await MetabaseApi.createAdminUser({
  baseUrl: 'http://localhost:3000',
  userName: 'admin@example.com',
  password: 'secure-password'
})

// Initialize API client
const api = new MetabaseApi({
  baseUrl: 'http://localhost:3000',
  sessionToken // or use apiKey for production
})
```

### Managing Data Sources

```typescript
// Add a MySQL database
const dbId = await api.admin.addDataSource({
  dbHost: 'mysql.example.com',
  dbName: 'myapp',
  dbPort: '3306',
  dbUser: 'dbuser',
  dbPassword: 'dbpass',
  dbNameInMetabase: 'Production DB',
  engine: 'mysql'
})

// Remove sample database
await api.admin.deleteSampleDatabase()
```

### Creating Collections and Questions

```typescript
// Create a collection
const collectionId = await api.collections.getOrCreate({
  collectionName: 'Sales Analytics'
})

// Create a question
const questionId = await api.questions.getOrCreate({
  collectionId,
  databaseId: dbId,
  questionConfig: {
    name: 'Monthly Revenue',
    query: 'SELECT DATE_FORMAT(created_at, "%Y-%m") as month, SUM(amount) as revenue FROM orders GROUP BY month',
    display: 'line',
    visualizationSettings: {
      'graph.dimensions': ['month'],
      'graph.metrics': ['revenue']
    }
  }
})
```

### API Key Authentication (Recommended for Production)

```typescript
// Create an API key
const apiKeyResponse = await api.admin.createApiKey({
  keyName: 'Production Integration',
  groupId: 2 // All Users group
})

// Use API key for subsequent requests
const productionApi = new MetabaseApi({
  baseUrl: 'https://metabase.example.com',
  apiKey: apiKeyResponse.unmasked_key
})
```

## Key Features

### Error Handling
- Custom `MetabaseApiError` class with detailed debugging information
- Automatic retry logic for transient failures
- Proper timeout handling for long-running operations

### Type Safety
- Full TypeScript support with interfaces for all API responses
- Type-safe method signatures using generics
- Compile-time validation of API parameters

### Performance Optimizations
- Connection pooling via fetch
- Request timeout handling
- Exponential backoff for retries
- Efficient error response parsing

## Best Practices

1. **Authentication**
   - Use API keys for production automation
   - Session tokens are suitable for initial setup only
   - Store credentials securely (environment variables)

2. **Error Handling**
   - Always wrap API calls in try-catch blocks
   - Check for specific error types (404, 403, etc.)
   - Log errors with full context for debugging

3. **Resource Management**
   - Check if resources exist before creating
   - Use descriptive names for collections and questions
   - Clean up test data in development environments

4. **Performance**
   - Batch operations when possible
   - Use appropriate timeouts for different operations
   - Enable caching for frequently accessed data

## Development

### Adding New Endpoints

1. Create a new function in the appropriate directory
2. Use `metabaseFetch` for consistent error handling
3. Add proper TypeScript interfaces
4. Update the MetabaseApi class to expose the new method
5. Add documentation and examples

### Testing

```bash
# Run tests
npm test

# Test specific functionality
npm test -- metabase
```

## Common Issues and Solutions

### Connection Refused
- Ensure Metabase is running on the specified port
- Check firewall rules and Docker networking
- Verify the base URL includes protocol (http/https)

### Authentication Failures
- API keys expire - regenerate if needed
- Session tokens timeout after inactivity
- Ensure proper permissions for the user/group

### Database Connection Issues
- Verify database credentials and network access
- Check if database server allows remote connections
- Ensure proper SSL/TLS configuration if required

## Resources

- [Metabase API Documentation](https://www.metabase.com/docs/latest/api-documentation)
- [Metabase GitHub Repository](https://github.com/metabase/metabase)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)