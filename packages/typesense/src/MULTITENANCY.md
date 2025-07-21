# TypesenseApi Multitenancy Support

The TypesenseApi now supports multitenancy through collection-level isolation. Each tenant gets their own set of collections with a tenant-specific prefix.

## Overview

- **Collection Isolation**: Each tenant's data is stored in separate collections
- **Transparent API**: All operations work seamlessly with tenant prefixes
- **No Code Changes**: Existing code continues to work without modification
- **Admin Helpers**: Built-in utilities for managing tenant collections

## Collection Naming Convention

Collections are prefixed with the tenant ID using double underscores:
```
<tenantId>__<baseCollectionName>
```

Examples:
- `acme__products` - Products collection for tenant "acme"
- `globex__users` - Users collection for tenant "globex"

## Usage

### Basic Setup

```typescript
import { TypesenseApi } from './TypesenseApi'

// Create API instance with tenant ID
const api = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  tenantId: 'acme',  // <-- Specify tenant ID
  collectionName: 'products'
})

// All operations now use tenant-prefixed collections automatically
await api.collections.create({
  name: 'products',  // Creates 'acme__products'
  fields: [...]
})

await api.documents.insert({...})  // Inserts into 'acme__products'
await api.search.text({...})       // Searches 'acme__products'
```

### Tenant ID Requirements

Tenant IDs must follow these rules:
- Only alphanumeric characters, hyphens, and underscores allowed
- Maximum 128 characters
- Automatically converted to lowercase
- Cannot be empty or whitespace

### Multiple Tenants

```typescript
// Different API instances for different tenants
const acmeApi = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'xyz',
  tenantId: 'acme',
  collectionName: 'products'
})

const globexApi = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'xyz',
  tenantId: 'globex',
  collectionName: 'products'
})

// Each tenant's data is completely isolated
```

### Admin Operations

```typescript
// List all collections for a tenant
const collections = await api.listTenantCollections()
// Returns: ['acme__products', 'acme__users', ...]

// Get base collection names (without prefix)
const baseNames = await api.listTenantBaseCollectionNames()
// Returns: ['products', 'users', ...]

// Check if a collection exists
const exists = await api.tenantCollectionExists('products')

// Delete all tenant collections (use with caution!)
await api.deleteAllTenantCollections()
```

### Working Without Tenants

The API remains backward compatible. If no tenant ID is specified, it works exactly as before:

```typescript
const api = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'xyz',
  collectionName: 'products'  // No tenantId
})

// Uses 'products' collection directly (no prefix)
```

## Utility Functions

The package exports utility functions for working with tenant IDs:

```typescript
import { 
  sanitizeTenantId, 
  createFQCN, 
  parseFQCN, 
  filterCollectionsByTenant 
} from './utils/tenant'

// Validate and sanitize tenant ID
const tenantId = sanitizeTenantId('ACME-Corp')  // 'acme-corp'

// Create fully qualified collection name
const fqcn = createFQCN('acme', 'products')  // 'acme__products'

// Parse collection name
const parsed = parseFQCN('acme__products')
// { tenantId: 'acme', baseCollectionName: 'products' }

// Filter collections by tenant
const acmeCollections = filterCollectionsByTenant(allCollections, 'acme')
```

## Best Practices

1. **Tenant ID Format**: Use lowercase, URL-safe identifiers (e.g., 'acme-corp', 'tenant-123')
2. **API Keys**: Consider using scoped API keys per tenant for additional security
3. **Resource Limits**: Monitor collection count as each tenant creates separate collections
4. **Migration**: Use the export/import functionality to migrate existing data to tenant collections

## Migration Example

```typescript
// Export from non-tenant collection
const legacyApi = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'xyz',
  collectionName: 'products'
})

const data = await legacyApi.documents.export()
const schema = await legacyApi.collections.get('products')

// Import into tenant collection
const tenantApi = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'xyz',
  tenantId: 'legacy',
  collectionName: 'products'
})

await tenantApi.collections.create(schema)
await tenantApi.documents.import(data)
```

## Performance Considerations

- Each tenant collection consumes memory and shards
- Set appropriate shard limits per collection (e.g., 5 shards)
- Monitor total collection count via `/metrics.json`
- Consider horizontal scaling for large numbers of tenants

## Security Notes

- Collection isolation provides logical separation, not cryptographic isolation
- All tenants sharing an API key can technically access each other's collections
- For strict isolation, use separate API keys with collection-specific permissions
- Rate limits apply per API key, not per tenant