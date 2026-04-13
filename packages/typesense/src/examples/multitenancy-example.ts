/**
 * Example of using TypesenseApi with multitenancy support
 */

import { TypesenseApi } from '../TypesenseApi'
import type { TypesenseCollection } from '../typesense.model'
import {
  createFQCN,
  filterCollectionsByTenant,
  parseFQCN,
  sanitizeTenantId,
} from '../utils/tenant'

// Example 1: Creating separate API instances for different tenants
async function _example1() {
  // API instance for tenant "acme"
  const acmeApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'acme',
    collectionName: 'products',
  })

  // API instance for tenant "globex"
  const globexApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'globex',
    collectionName: 'products',
  })

  // Define schema
  const productSchema: TypesenseCollection = {
    name: 'products',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'price', type: 'float' },
      { name: 'category', type: 'string', facet: true },
    ],
  }

  // Create collections - each tenant gets their own prefixed collection
  // This creates "acme__products" collection
  await acmeApi.collections.create(productSchema)

  // This creates "globex__products" collection
  await globexApi.collections.create(productSchema)

  // Insert documents - completely isolated between tenants
  await acmeApi.documents.insert({
    id: '1',
    name: 'Acme Widget',
    price: 19.99,
    category: 'widgets',
  })

  await globexApi.documents.insert({
    id: '1', // Same ID is fine - different collection
    name: 'Globex Gadget',
    price: 29.99,
    category: 'gadgets',
  })

  // Search - each tenant only sees their own data
  const acmeResults = await acmeApi.search.text({
    q: '*',
    query_by: 'name',
  })
  console.log('Acme products:', acmeResults.hits) // Only Acme Widget

  const globexResults = await globexApi.search.text({
    q: '*',
    query_by: 'name',
  })
  console.log('Globex products:', globexResults.hits) // Only Globex Gadget
}

// Example 2: Admin operations across tenants
async function _example2() {
  const adminApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'acme',
  })

  // List all collections for the tenant
  const tenantCollections = await adminApi.listTenantCollections()
  console.log('Acme collections:', tenantCollections)
  // Output: ['acme__products', 'acme__users', 'acme__orders']

  // Get base collection names (without tenant prefix)
  const baseNames = await adminApi.listTenantBaseCollectionNames()
  console.log('Base collection names:', baseNames)
  // Output: ['products', 'users', 'orders']

  // Check if a specific collection exists
  const exists = await adminApi.tenantCollectionExists('products')
  console.log('Products collection exists:', exists)

  // Delete all tenant data (use with caution!)
  // await adminApi.deleteAllTenantCollections()
}

// Example 3: Working with multiple collections per tenant
async function _example3() {
  const api = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'acme',
  })

  // Create multiple collections for the tenant
  await api.collections.create({
    name: 'users',
    fields: [
      { name: 'email', type: 'string' },
      { name: 'name', type: 'string' },
    ],
  })

  await api.collections.create({
    name: 'orders',
    fields: [
      { name: 'order_id', type: 'string' },
      { name: 'user_email', type: 'string' },
      { name: 'total', type: 'float' },
    ],
  })

  // Work with different collections by changing the context
  const userApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'acme',
    collectionName: 'users',
  })

  const orderApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'acme',
    collectionName: 'orders',
  })

  // Insert data into different collections
  await userApi.documents.insert({
    id: 'user-1',
    email: 'john@acme.com',
    name: 'John Doe',
  })

  await orderApi.documents.insert({
    id: 'ORD-001',
    order_id: 'ORD-001',
    user_email: 'john@acme.com',
    total: 99.99,
  })
}

// Example 4: Migrating existing non-tenant data
async function _example4() {
  // API without tenant (legacy mode)
  const legacyApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    collectionName: 'products',
  })

  // API with tenant
  const tenantApi = new TypesenseApi({
    prefixUrl: 'http://localhost:8108',
    token: 'xyz',
    tenantId: 'legacy',
    collectionName: 'products',
  })

  // Export from legacy collection
  const legacyData = await legacyApi.documents.export()

  // Create new tenant collection
  const schema = await legacyApi.collections.get('products')
  await tenantApi.collections.create(schema)

  // Import into tenant collection
  await tenantApi.documents.import(legacyData)
}

// Example 5: Using tenant utilities directly
async function _example5() {
  // Validate tenant ID
  try {
    const tenantId = sanitizeTenantId('ACME-Corp')
    console.log('Sanitized:', tenantId) // 'acme-corp'
  } catch (error) {
    console.error('Invalid tenant ID:', error.message)
  }

  // Create fully qualified collection name
  const fqcn = createFQCN('acme', 'products')
  console.log('FQCN:', fqcn) // 'acme__products'

  // Parse collection name
  const parsed = parseFQCN('acme__products')
  console.log('Parsed:', parsed) // { tenantId: 'acme', baseCollectionName: 'products' }

  // Filter collections by tenant
  const allCollections = [
    'acme__products',
    'acme__users',
    'globex__products',
    'legacy_collection',
  ]
  const acmeCollections = filterCollectionsByTenant(allCollections, 'acme')
  console.log('Acme collections:', acmeCollections) // ['acme__products', 'acme__users']
}
