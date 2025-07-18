# Complete CRUD Operations

This guide provides comprehensive examples of Create, Read, Update, and Delete operations using the Fluent ecosystem.

## Setup

Let's define a complete e-commerce domain model:

```typescript
import { TypeOrmConnector, f } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// Product entity
@f.entity('products')
class Product {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  description: string

  @f.property()
  price: number

  @f.property()
  category: string

  @f.property()
  sku: string

  @f.property()
  inStock: boolean

  @f.property()
  stockQuantity: number

  @f.property()
  images: string[]

  @f.property()
  metadata: {
    weight: number
    dimensions: {
      length: number
      width: number
      height: number
    }
    tags: string[]
  }

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date
}

// Define schemas
const ProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  category: z.string(),
  sku: z.string().min(1),
  inStock: z.boolean().default(true),
  stockQuantity: z.number().min(0),
  images: z.array(z.string()).default([]),
  metadata: z.object({
    weight: z.number().positive(),
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive()
    }),
    tags: z.array(z.string()).default([])
  })
})

const ProductUpdateSchema = ProductInputSchema.partial()

const ProductOutputSchema = ProductInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Create repository
class ProductRepository extends TypeOrmConnector<
  Product,
  z.infer<typeof ProductInputSchema>,
  z.infer<typeof ProductOutputSchema>
> {
  constructor(dataSource: DataSource) {
    super({
      entity: Product,
      dataSource,
      inputSchema: ProductInputSchema,
      outputSchema: ProductOutputSchema
    })
  }
}
```

## CREATE Operations

### Basic Create

```typescript
const productRepo = new ProductRepository(dataSource)

// Create a single product
const createProduct = async () => {
  const product = await productRepo.insert({
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 299.99,
    category: 'Electronics',
    sku: 'WH-001',
    inStock: true,
    stockQuantity: 50,
    images: [
      'https://example.com/headphones-1.jpg',
      'https://example.com/headphones-2.jpg'
    ],
    metadata: {
      weight: 0.25,
      dimensions: {
        length: 20,
        width: 15,
        height: 8
      },
      tags: ['wireless', 'bluetooth', 'noise-cancellation']
    }
  })

  console.log('Created product:', product.id)
  return product
}
```

### Batch Create

```typescript
// Create multiple products at once
const createMultipleProducts = async () => {
  const products = await productRepo.insertMany([
    {
      name: 'Smartphone',
      description: 'Latest flagship smartphone',
      price: 799.99,
      category: 'Electronics',
      sku: 'SP-001',
      inStock: true,
      stockQuantity: 30,
      images: ['https://example.com/phone-1.jpg'],
      metadata: {
        weight: 0.18,
        dimensions: { length: 15, width: 7, height: 0.8 },
        tags: ['phone', 'mobile', 'android']
      }
    },
    {
      name: 'Laptop',
      description: 'High-performance laptop for professionals',
      price: 1299.99,
      category: 'Electronics',
      sku: 'LP-001',
      inStock: true,
      stockQuantity: 15,
      images: ['https://example.com/laptop-1.jpg'],
      metadata: {
        weight: 2.1,
        dimensions: { length: 35, width: 24, height: 2 },
        tags: ['laptop', 'computer', 'business']
      }
    }
  ])

  console.log(`Created ${products.length} products`)
  return products
}
```

### Create with Validation

```typescript
// Create with custom validation
const createProductWithValidation = async (data: any) => {
  try {
    // Additional business logic validation
    if (data.price < 0) {
      throw new Error('Price must be positive')
    }

    if (data.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative')
    }

    // Check if SKU already exists
    const existingProduct = await productRepo.findFirst({
      where: { sku: data.sku }
    })

    if (existingProduct) {
      throw new Error(`Product with SKU ${data.sku} already exists`)
    }

    const product = await productRepo.insert(data)
    return product
  } catch (error) {
    console.error('Product creation failed:', error.message)
    throw error
  }
}
```

### Create with Generated Fields

```typescript
// Create with auto-generated fields
const createProductWithDefaults = async (data: Partial<Product>) => {
  const productData = {
    ...data,
    sku: data.sku || generateSKU(data.category, data.name),
    inStock: data.stockQuantity > 0,
    metadata: {
      ...data.metadata,
      tags: data.metadata?.tags || generateTags(data.name, data.category)
    }
  }

  return await productRepo.insert(productData)
}

// Helper functions
const generateSKU = (category: string, name: string): string => {
  const prefix = category.substring(0, 3).toUpperCase()
  const suffix = Math.random().toString(36).substr(2, 6).toUpperCase()
  return `${prefix}-${suffix}`
}

const generateTags = (name: string, category: string): string[] => {
  const nameWords = name.toLowerCase().split(' ')
  const categoryTag = category.toLowerCase()
  return [...nameWords, categoryTag]
}
```

## READ Operations

### Basic Read

```typescript
// Find by ID
const getProduct = async (id: string) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product with ID ${id} not found`)
  }

  return product
}

// Find multiple by IDs
const getProducts = async (ids: string[]) => {
  return await productRepo.findByIds(ids)
}
```

### Filtered Read

```typescript
// Get products by category
const getProductsByCategory = async (category: string) => {
  return await productRepo.findMany({
    where: { category },
    orderBy: [{ name: 'asc' }]
  })
}

// Get products in stock
const getInStockProducts = async () => {
  return await productRepo.findMany({
    where: { inStock: true },
    orderBy: [{ stockQuantity: 'desc' }]
  })
}

// Get products by price range
const getProductsByPriceRange = async (minPrice: number, maxPrice: number) => {
  return await productRepo.findMany({
    where: {
      price: {
        gte: minPrice,
        lte: maxPrice
      }
    },
    orderBy: [{ price: 'asc' }]
  })
}
```

### Complex Read Queries

```typescript
// Advanced product search
const searchProducts = async (params: {
  query?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  tags?: string[]
  sortBy?: 'name' | 'price' | 'stock' | 'newest'
  limit?: number
  offset?: number
}) => {
  const conditions: any[] = []

  // Text search
  if (params.query) {
    conditions.push({
      OR: [
        { name: { contains: params.query } },
        { description: { contains: params.query } },
        { sku: { contains: params.query } }
      ]
    })
  }

  // Category filter
  if (params.category) {
    conditions.push({ category: params.category })
  }

  // Price range
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const priceCondition: any = {}
    if (params.minPrice !== undefined) priceCondition.gte = params.minPrice
    if (params.maxPrice !== undefined) priceCondition.lte = params.maxPrice
    conditions.push({ price: priceCondition })
  }

  // Stock filter
  if (params.inStock !== undefined) {
    conditions.push({ inStock: params.inStock })
  }

  // Tags filter
  if (params.tags && params.tags.length > 0) {
    const tagConditions = params.tags.map(tag => ({
      'metadata.tags': { contains: tag }
    }))
    conditions.push({ AND: tagConditions })
  }

  // Sort order
  let orderBy: any[]
  switch (params.sortBy) {
    case 'price':
      orderBy = [{ price: 'asc' }]
      break
    case 'stock':
      orderBy = [{ stockQuantity: 'desc' }]
      break
    case 'newest':
      orderBy = [{ createdAt: 'desc' }]
      break
    default:
      orderBy = [{ name: 'asc' }]
  }

  return await productRepo.findMany({
    where: conditions.length > 0 ? { AND: conditions } : {},
    orderBy,
    limit: params.limit || 50,
    offset: params.offset || 0
  })
}
```

### Read with Projections

```typescript
// Get product summaries (limited fields)
const getProductSummaries = async () => {
  return await productRepo.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      category: true,
      inStock: true,
      images: true
    },
    where: { inStock: true },
    orderBy: [{ createdAt: 'desc' }],
    limit: 20
  })
}

// Get product details for display
const getProductDetails = async (id: string) => {
  return await productRepo.findById(id, {
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      category: true,
      sku: true,
      inStock: true,
      stockQuantity: true,
      images: true,
      metadata: true,
      createdAt: true
    }
  })
}
```

## UPDATE Operations

### Basic Update

```typescript
// Update product by ID
const updateProduct = async (id: string, data: Partial<Product>) => {
  const updatedProduct = await productRepo.updateById(id, data)
  console.log(`Updated product ${id}`)
  return updatedProduct
}

// Update specific fields
const updateProductPrice = async (id: string, newPrice: number) => {
  return await productRepo.updateById(id, { price: newPrice })
}

const updateProductStock = async (id: string, quantity: number) => {
  return await productRepo.updateById(id, {
    stockQuantity: quantity,
    inStock: quantity > 0
  })
}
```

### Conditional Updates

```typescript
// Update with conditions
const updateProductWithConditions = async (id: string, data: Partial<Product>) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  // Business logic validations
  if (data.price && data.price < 0) {
    throw new Error('Price cannot be negative')
  }

  if (data.stockQuantity !== undefined && data.stockQuantity < 0) {
    throw new Error('Stock quantity cannot be negative')
  }

  // Update inStock based on stockQuantity
  if (data.stockQuantity !== undefined) {
    data.inStock = data.stockQuantity > 0
  }

  return await productRepo.updateById(id, data)
}
```

### Batch Updates

```typescript
// Update multiple products
const updateMultipleProducts = async (updates: Array<{id: string, data: Partial<Product>}>) => {
  const results = await Promise.all(
    updates.map(({ id, data }) => productRepo.updateById(id, data))
  )
  
  console.log(`Updated ${results.length} products`)
  return results
}

// Bulk price update
const updateCategoryPrices = async (category: string, priceMultiplier: number) => {
  const products = await productRepo.findMany({
    where: { category },
    select: { id: true, price: true }
  })

  const updates = products.map(product => ({
    id: product.id,
    data: { price: product.price * priceMultiplier }
  }))

  return await updateMultipleProducts(updates)
}
```

### Complex Updates

```typescript
// Update with nested object manipulation
const updateProductMetadata = async (id: string, metadataUpdate: Partial<Product['metadata']>) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  const updatedMetadata = {
    ...product.metadata,
    ...metadataUpdate
  }

  return await productRepo.updateById(id, { metadata: updatedMetadata })
}

// Add tags to product
const addProductTags = async (id: string, newTags: string[]) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  const existingTags = product.metadata.tags || []
  const uniqueTags = [...new Set([...existingTags, ...newTags])]

  return await updateProductMetadata(id, { tags: uniqueTags })
}

// Remove tags from product
const removeProductTags = async (id: string, tagsToRemove: string[]) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  const filteredTags = product.metadata.tags.filter(tag => !tagsToRemove.includes(tag))

  return await updateProductMetadata(id, { tags: filteredTags })
}
```

### Replace Operations

```typescript
// Replace entire product
const replaceProduct = async (id: string, newData: z.infer<typeof ProductInputSchema>) => {
  const replacedProduct = await productRepo.replaceById(id, newData)
  console.log(`Replaced product ${id}`)
  return replacedProduct
}

// Replace with validation
const replaceProductWithValidation = async (id: string, newData: any) => {
  // Validate the new data
  const validatedData = ProductInputSchema.parse(newData)
  
  // Check if product exists
  const existingProduct = await productRepo.findById(id)
  if (!existingProduct) {
    throw new Error(`Product ${id} not found`)
  }

  // Additional validations
  if (validatedData.sku !== existingProduct.sku) {
    const skuExists = await productRepo.findFirst({
      where: { sku: validatedData.sku }
    })
    
    if (skuExists) {
      throw new Error(`SKU ${validatedData.sku} already exists`)
    }
  }

  return await productRepo.replaceById(id, validatedData)
}
```

## DELETE Operations

### Basic Delete

```typescript
// Delete by ID
const deleteProduct = async (id: string) => {
  const deletedId = await productRepo.deleteById(id)
  console.log(`Deleted product ${deletedId}`)
  return deletedId
}

// Delete with confirmation
const deleteProductWithConfirmation = async (id: string) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  console.log(`Deleting product: ${product.name}`)
  return await productRepo.deleteById(id)
}
```

### Conditional Delete

```typescript
// Delete with conditions
const deleteProductIfEmpty = async (id: string) => {
  const product = await productRepo.findById(id)
  
  if (!product) {
    throw new Error(`Product ${id} not found`)
  }

  if (product.stockQuantity > 0) {
    throw new Error(`Cannot delete product ${id} - still has stock`)
  }

  return await productRepo.deleteById(id)
}

// Soft delete (mark as inactive)
const softDeleteProduct = async (id: string) => {
  return await productRepo.updateById(id, {
    inStock: false,
    stockQuantity: 0
  })
}
```

### Batch Delete

```typescript
// Delete multiple products
const deleteMultipleProducts = async (ids: string[]) => {
  const results = await Promise.all(
    ids.map(id => productRepo.deleteById(id))
  )
  
  console.log(`Deleted ${results.length} products`)
  return results
}

// Delete by criteria
const deleteProductsByCategory = async (category: string) => {
  const products = await productRepo.findMany({
    where: { category },
    select: { id: true }
  })

  const ids = products.map(p => p.id)
  return await deleteMultipleProducts(ids)
}

// Delete out of stock products
const deleteOutOfStockProducts = async () => {
  const outOfStockProducts = await productRepo.findMany({
    where: { stockQuantity: 0 },
    select: { id: true }
  })

  const ids = outOfStockProducts.map(p => p.id)
  return await deleteMultipleProducts(ids)
}
```

## Complete CRUD Service

```typescript
// Complete service class combining all operations
class ProductService {
  constructor(private productRepo: ProductRepository) {}

  // CREATE
  async createProduct(data: z.infer<typeof ProductInputSchema>) {
    return await this.productRepo.insert(data)
  }

  async createProducts(products: z.infer<typeof ProductInputSchema>[]) {
    return await this.productRepo.insertMany(products)
  }

  // READ
  async getProduct(id: string) {
    const product = await this.productRepo.findById(id)
    if (!product) {
      throw new Error(`Product ${id} not found`)
    }
    return product
  }

  async getProducts(ids: string[]) {
    return await this.productRepo.findByIds(ids)
  }

  async searchProducts(params: any) {
    return await searchProducts(params)
  }

  async getProductsByCategory(category: string) {
    return await this.productRepo.findMany({
      where: { category },
      orderBy: [{ name: 'asc' }]
    })
  }

  // UPDATE
  async updateProduct(id: string, data: Partial<Product>) {
    return await this.productRepo.updateById(id, data)
  }

  async updateProducts(updates: Array<{id: string, data: Partial<Product>}>) {
    return await Promise.all(
      updates.map(({ id, data }) => this.productRepo.updateById(id, data))
    )
  }

  // DELETE
  async deleteProduct(id: string) {
    return await this.productRepo.deleteById(id)
  }

  async deleteProducts(ids: string[]) {
    return await Promise.all(
      ids.map(id => this.productRepo.deleteById(id))
    )
  }

  // UTILITY
  async getProductCount() {
    const products = await this.productRepo.findMany({
      select: { id: true }
    })
    return products.length
  }

  async getProductStats() {
    const products = await this.productRepo.collect()
    
    return {
      total: products.length,
      inStock: products.where('inStock', true).length,
      outOfStock: products.where('inStock', false).length,
      categories: products.groupBy('category'),
      avgPrice: products.reduce((sum, p) => sum + p.price, 0) / products.length
    }
  }
}
```

## Error Handling Best Practices

```typescript
import { Promises } from '@goatlab/js-utils'

// Robust CRUD operations with error handling
class RobustProductService {
  constructor(private productRepo: ProductRepository) {}

  async safeCreateProduct(data: any) {
    const [error, product] = await Promises.try(
      this.productRepo.insert(data)
    )

    if (error) {
      console.error('Product creation failed:', error.message)
      throw new Error('Failed to create product')
    }

    return product
  }

  async safeUpdateProduct(id: string, data: any) {
    const [error, product] = await Promises.try(
      this.productRepo.updateById(id, data)
    )

    if (error) {
      console.error(`Product update failed for ${id}:`, error.message)
      throw new Error('Failed to update product')
    }

    return product
  }

  async safeDeleteProduct(id: string) {
    const [error, deletedId] = await Promises.try(
      this.productRepo.deleteById(id)
    )

    if (error) {
      console.error(`Product deletion failed for ${id}:`, error.message)
      throw new Error('Failed to delete product')
    }

    return deletedId
  }
}
```

## Next Steps

- [Relationships](./relations.md) - Working with relationships
- [Aggregations](./aggregations.md) - Aggregation queries
- [Performance Guide](../guides/performance.md) - Optimization strategies
- [Testing Guide](../guides/testing.md) - Testing CRUD operations