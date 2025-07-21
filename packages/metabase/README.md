# @goatlab/metabase

A comprehensive TypeScript wrapper for the Metabase API, providing a fluent interface for admin operations, collections, questions, dashboards, and permission management.

## Installation

```bash
npm install @goatlab/metabase
# or
pnpm add @goatlab/metabase
# or
yarn add @goatlab/metabase
```

## Basic Usage

```typescript
import { MetabaseApi } from '@goatlab/metabase'

// Initialize with session token
const api = new MetabaseApi({
  baseUrl: 'https://your-metabase-instance.com',
  sessionToken: 'your-session-token'
})

// Or initialize with API key (preferred for automation)
const api = new MetabaseApi({
  baseUrl: 'https://your-metabase-instance.com',
  apiKey: 'your-api-key'
})

// Example: Create a collection
const collectionId = await api.collections.getOrCreate({
  collectionName: 'My Reports'
})

// Example: Enable embeddings
await api.admin.enableEmbeddings()
```

## Key Features

### Static Methods (Pre-authentication)
- `MetabaseApi.waitForMetabase()` - Wait for Metabase instance to be ready
- `MetabaseApi.createAdminUser()` - Create initial admin user
- `MetabaseApi.loginAdminUser()` - Login and get session token

### Admin Operations
- `api.admin.enableEmbeddings()` - Enable embedding functionality
- `api.admin.deleteSampleDatabase()` - Remove sample database
- `api.admin.disableOnboardingSidebar()` - Hide onboarding UI
- `api.admin.disableTracking()` - Disable analytics tracking
- `api.admin.addDataSource()` - Add new database connection
- `api.admin.enableActionsInDatasource()` - Enable actions for a datasource
- `api.admin.createApiKey()` - Generate API keys
- `api.admin.getEmbeddingSecretKey()` - Retrieve embedding secret

### Collections
- `api.collections.getOrCreate()` - Get or create collection by name
- `api.collections.delete()` - Delete a collection
- `api.collections.deleteAll()` - Remove all collections

### Questions (Cards)
- `api.questions.getOrCreate()` - Get or create a question
- `api.questions.getOrCreateAccounts()` - Create accounts-specific question

### Dashboards
- `api.dashboards.getOrCreate()` - Get or create dashboard

### Permission Groups
- `api.groups.create()` - Create new permission group
- `api.groups.getOrCreate()` - Get or create group by name
- `api.groups.list()` - List all groups
- `api.groups.disableAllDatabaseAccess()` - Revoke all database permissions
- `api.groups.disableAllUsersGroupDatabaseAccess()` - Disable default user group access
- `api.groups.grantDatabaseAccessByPrefix()` - Grant access to databases by name prefix
- `api.groups.setDatabasePermissionsForGroup()` - Set specific database permissions
- `api.groups.updatePermissions()` - Update group permissions