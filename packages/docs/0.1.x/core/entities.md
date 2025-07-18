# Entities

Entities in Fluent represent your data models and define the structure of your database tables or collections. They use decorators to specify columns, relationships, and validation rules, providing a clean and type-safe way to define your data layer.

## Overview

Fluent entities provide:
- **Declarative Schema Definition**: Use decorators to define your data structure
- **Type Safety**: Full TypeScript integration with compile-time validation
- **Relationship Management**: Define complex relationships between entities
- **Database Agnostic**: Same entity definition works across different databases
- **Validation Integration**: Seamless integration with Zod schemas
- **Migration Support**: Version control for your database schema

## Basic Entity Structure

Every entity in Fluent follows this basic structure:

```typescript
import { f } from '@goatlab/fluent'

@f.entity('table_name')
export class EntityName {
  @f.id()
  id: string

  @f.property({ required: true })
  requiredField: string

  @f.property()
  optionalField?: string

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Entity Definition

### Basic Entity

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  email: string

  @f.property({ required: true })
  name: string

  @f.property()
  age?: number

  @f.property({ hidden: true })
  password: string

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Entity with Enums

```typescript
import { f } from '@goatlab/fluent'

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned'
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  email: string

  @f.property({ required: true })
  name: string

  @f.Enum({ 
    enum: Object.values(UserRole), 
    default: UserRole.USER 
  })
  role: UserRole

  @f.Enum({ 
    enum: Object.values(UserStatus), 
    default: UserStatus.ACTIVE 
  })
  status: UserStatus

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Embedded Objects

### Simple Embedded Object

```typescript
import { f } from '@goatlab/fluent'

class Address {
  @f.property({ required: true })
  street: string

  @f.property({ required: true })
  city: string

  @f.property({ required: true })
  country: string

  @f.property()
  zipCode?: string
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.embed(Address)
  address: Address

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Complex Embedded Objects

```typescript
import { f } from '@goatlab/fluent'

class ContactInfo {
  @f.property()
  phone?: string

  @f.property()
  email?: string

  @f.property()
  website?: string
}

class SocialLinks {
  @f.property()
  twitter?: string

  @f.property()
  linkedin?: string

  @f.property()
  github?: string
}

class UserProfile {
  @f.property()
  firstName: string

  @f.property()
  lastName: string

  @f.property({ type: 'text' })
  bio?: string

  @f.property()
  avatar?: string

  @f.property({ type: 'date' })
  birthDate?: Date

  @f.embed(ContactInfo)
  contact: ContactInfo

  @f.embed(SocialLinks)
  social: SocialLinks
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  email: string

  @f.property({ required: true, unique: true })
  username: string

  @f.embed(UserProfile)
  profile: UserProfile

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Array of Embedded Objects

```typescript
import { f } from '@goatlab/fluent'

class PhoneNumber {
  @f.property({ required: true })
  type: 'mobile' | 'home' | 'work'

  @f.property({ required: true })
  number: string

  @f.property()
  isPrimary?: boolean
}

class WorkExperience {
  @f.property({ required: true })
  company: string

  @f.property({ required: true })
  position: string

  @f.property({ required: true })
  startDate: Date

  @f.property()
  endDate?: Date

  @f.property({ type: 'text' })
  description?: string
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.embedArray(PhoneNumber)
  phoneNumbers: PhoneNumber[]

  @f.embedArray(WorkExperience)
  workExperience: WorkExperience[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Relationships

### One-to-Many Relationships

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  email: string

  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]

  @f.hasMany({ entity: () => Comment, inverse: 'author' })
  comments: Comment[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'posts', 
    pivotColumnName: 'authorId' 
  })
  author: User

  @f.hasMany({ entity: () => Comment, inverse: 'post' })
  comments: Comment[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('comments')
export class Comment {
  @f.id()
  id: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'comments', 
    pivotColumnName: 'authorId' 
  })
  author: User

  @f.belongsTo({ 
    entity: () => Post, 
    inverse: 'comments', 
    pivotColumnName: 'postId' 
  })
  post: Post

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Many-to-Many Relationships

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  email: string

  @f.belongsToMany({
    entity: () => Role,
    joinTableName: 'user_roles',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles: Role[]

  @f.belongsToMany({
    entity: () => Project,
    joinTableName: 'user_projects',
    foreignKey: 'userId',
    inverseForeignKey: 'projectId'
  })
  projects: Project[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('roles')
export class Role {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  name: string

  @f.property({ type: 'text' })
  description?: string

  @f.stringArray(String)
  permissions: string[]

  @f.belongsToMany({
    entity: () => User,
    joinTableName: 'user_roles',
    foreignKey: 'roleId',
    inverseForeignKey: 'userId'
  })
  users: User[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('projects')
export class Project {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ type: 'text' })
  description?: string

  @f.belongsToMany({
    entity: () => User,
    joinTableName: 'user_projects',
    foreignKey: 'projectId',
    inverseForeignKey: 'userId'
  })
  members: User[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Self-Referencing Relationships

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  email: string

  // Self-referencing many-to-many for followers/following
  @f.belongsToMany({
    entity: () => User,
    joinTableName: 'user_followers',
    foreignKey: 'followerId',
    inverseForeignKey: 'followingId'
  })
  following: User[]

  @f.belongsToMany({
    entity: () => User,
    joinTableName: 'user_followers',
    foreignKey: 'followingId',
    inverseForeignKey: 'followerId'
  })
  followers: User[]

  // Self-referencing one-to-many for organizational hierarchy
  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'subordinates', 
    pivotColumnName: 'managerId' 
  })
  manager?: User

  @f.hasMany({ entity: () => User, inverse: 'manager' })
  subordinates: User[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Advanced Entity Features

### Soft Deletes

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  email: string

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date

  @f.deleted()
  deletedAt?: Date // Soft delete timestamp
}
```

### Versioning

```typescript
import { f } from '@goatlab/fluent'

@f.entity('documents')
export class Document {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.version()
  version: number // Optimistic locking

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### Audit Trail

```typescript
import { f } from '@goatlab/fluent'

@f.entity('audit_logs')
export class AuditLog {
  @f.id()
  id: string

  @f.property({ required: true })
  entityType: string

  @f.property({ required: true })
  entityId: string

  @f.property({ required: true })
  action: 'create' | 'update' | 'delete'

  @f.property({ type: 'json' })
  oldValues?: any

  @f.property({ type: 'json' })
  newValues?: any

  @f.property({ required: true })
  userId: string

  @f.property()
  ipAddress?: string

  @f.property()
  userAgent?: string

  @f.created()
  createdAt: Date
}
```

## E-commerce Example

```typescript
import { f } from '@goatlab/fluent'

enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock'
}

enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

class ProductDimensions {
  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  length: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  width: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  height: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  weight: number
}

class ProductPricing {
  @f.property({ type: 'decimal', precision: 10, scale: 2, required: true })
  price: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  compareAtPrice?: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  costPrice?: number

  @f.property({ type: 'varchar', length: 3 })
  currency: string
}

@f.entity('categories')
export class Category {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ unique: true })
  slug: string

  @f.property({ type: 'text' })
  description?: string

  @f.property()
  image?: string

  @f.belongsTo({ 
    entity: () => Category, 
    inverse: 'children', 
    pivotColumnName: 'parentId' 
  })
  parent?: Category

  @f.hasMany({ entity: () => Category, inverse: 'parent' })
  children: Category[]

  @f.hasMany({ entity: () => Product, inverse: 'category' })
  products: Product[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('products')
export class Product {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ unique: true })
  slug: string

  @f.property({ type: 'text' })
  description?: string

  @f.property({ unique: true })
  sku: string

  @f.embed(ProductPricing)
  pricing: ProductPricing

  @f.embed(ProductDimensions)
  dimensions: ProductDimensions

  @f.property({ type: 'int', default: 0 })
  stockQuantity: number

  @f.Enum({ 
    enum: Object.values(ProductStatus), 
    default: ProductStatus.ACTIVE 
  })
  status: ProductStatus

  @f.stringArray(String)
  images: string[]

  @f.stringArray(String)
  tags: string[]

  @f.belongsTo({ 
    entity: () => Category, 
    inverse: 'products', 
    pivotColumnName: 'categoryId' 
  })
  category: Category

  @f.hasMany({ entity: () => OrderItem, inverse: 'product' })
  orderItems: OrderItem[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('orders')
export class Order {
  @f.id()
  id: string

  @f.property({ required: true })
  orderNumber: string

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  taxAmount: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  shippingAmount: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  total: number

  @f.Enum({ 
    enum: Object.values(OrderStatus), 
    default: OrderStatus.PENDING 
  })
  status: OrderStatus

  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'orders', 
    pivotColumnName: 'customerId' 
  })
  customer: User

  @f.hasMany({ entity: () => OrderItem, inverse: 'order' })
  items: OrderItem[]

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

@f.entity('order_items')
export class OrderItem {
  @f.id()
  id: string

  @f.property({ type: 'int', required: true })
  quantity: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  price: number

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  total: number

  @f.belongsTo({ 
    entity: () => Order, 
    inverse: 'items', 
    pivotColumnName: 'orderId' 
  })
  order: Order

  @f.belongsTo({ 
    entity: () => Product, 
    inverse: 'orderItems', 
    pivotColumnName: 'productId' 
  })
  product: Product

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Database-Specific Entities

### MongoDB Entity

```typescript
import { f } from '@goatlab/fluent'
import { ObjectId } from 'mongodb'

@f.entity('users')
export class User {
  @f.mongoId()
  _id: ObjectId

  @f.property({ required: true })
  email: string

  @f.property({ required: true })
  name: string

  // MongoDB supports nested objects natively
  @f.embed(Address)
  address: Address

  @f.embedArray(PhoneNumber)
  phoneNumbers: PhoneNumber[]

  // MongoDB-specific field types
  @f.property({ type: 'array' })
  tags: string[]

  @f.property({ type: 'object' })
  metadata: any

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

### SQL Entity with Indexes

```typescript
import { f } from '@goatlab/fluent'
import { Index } from 'typeorm'

@Index(['email']) // Single field index
@Index(['email', 'status']) // Composite index
@Index(['createdAt']) // Timestamp index
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  email: string

  @f.property({ required: true })
  name: string

  @f.property()
  status: string

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Entity Validation

### Integration with Zod

```typescript
import { z } from 'zod'
import { f } from '@goatlab/fluent'

// Entity definition
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  email: string

  @f.property({ required: true })
  name: string

  @f.property()
  age?: number

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  age: z.number().min(0, 'Age must be positive').max(150, 'Age too high').optional()
})

export const UpdateUserSchema = CreateUserSchema.partial()

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Type exports
export type CreateUserDTO = z.infer<typeof CreateUserSchema>
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>
export type UserDTO = z.infer<typeof UserSchema>
```

## Entity Testing

### Unit Tests

```typescript
import { User } from './User'
import { CreateUserSchema, UserSchema } from './user.schema'

describe('User Entity', () => {
  test('should validate create user data', () => {
    const validData = {
      email: 'john@example.com',
      name: 'John Doe',
      age: 30
    }

    const result = CreateUserSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      name: 'John Doe',
      age: 30
    }

    const result = CreateUserSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid email format')
  })

  test('should handle optional fields', () => {
    const minimalData = {
      email: 'john@example.com',
      name: 'John Doe'
    }

    const result = CreateUserSchema.safeParse(minimalData)
    expect(result.success).toBe(true)
  })
})
```

### Integration Tests

```typescript
import { DataSource } from 'typeorm'
import { User } from './User'
import { UserRepository } from './UserRepository'

describe('User Entity Integration', () => {
  let dataSource: DataSource
  let userRepo: UserRepository

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User],
      synchronize: true
    })

    await dataSource.initialize()
    userRepo = new UserRepository(dataSource)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  test('should create and persist user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      age: 25
    }

    const user = await userRepo.insert(userData)
    expect(user.id).toBeDefined()
    expect(user.email).toBe(userData.email)
    expect(user.createdAt).toBeDefined()
    expect(user.updatedAt).toBeDefined()
  })

  test('should enforce unique constraints', async () => {
    const userData = {
      email: 'duplicate@example.com',
      name: 'User One'
    }

    await userRepo.insert(userData)

    await expect(userRepo.insert(userData)).rejects.toThrow()
  })
})
```

## Best Practices

### 1. Consistent Naming Conventions

```typescript
// ✅ Good - consistent naming
@f.entity('users')
export class User {
  @f.property({ required: true })
  firstName: string

  @f.property({ required: true })
  lastName: string

  @f.property({ required: true })
  emailAddress: string
}

// ❌ Bad - inconsistent naming
@f.entity('users')
export class User {
  @f.property({ required: true })
  first_name: string

  @f.property({ required: true })
  last_name: string

  @f.property({ required: true })
  email: string
}
```

### 2. Use Appropriate Data Types

```typescript
// ✅ Good - appropriate types
@f.entity('products')
export class Product {
  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  price: number

  @f.property({ type: 'text' })
  description: string

  @f.property({ type: 'timestamp' })
  publishedAt: Date
}

// ❌ Bad - generic types
@f.entity('products')
export class Product {
  @f.property()
  price: number

  @f.property()
  description: string

  @f.property()
  publishedAt: Date
}
```

### 3. Define Relationships Clearly

```typescript
// ✅ Good - clear relationships
@f.entity('users')
export class User {
  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]
}

@f.entity('posts')
export class Post {
  @f.belongsTo({ entity: () => User, inverse: 'posts', pivotColumnName: 'authorId' })
  author: User
}
```

### 4. Use Embedded Objects for Complex Data

```typescript
// ✅ Good - embedded objects
class Address {
  street: string
  city: string
  country: string
}

@f.entity('users')
export class User {
  @f.embed(Address)
  address: Address
}

// ❌ Bad - flat structure
@f.entity('users')
export class User {
  @f.property()
  addressStreet: string

  @f.property()
  addressCity: string

  @f.property()
  addressCountry: string
}
```

### 5. Include Timestamps

```typescript
// ✅ Good - include timestamps
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Related Documentation

- **[Decorators](decorators.md)** - Complete decorator reference
- **[TypeORM Connector](typeorm-connector.md)** - Database integration
- **[Query Builder](query-builder.md)** - Querying entities
- **[Base Connector](base-connector.md)** - Understanding connectors

Entities form the backbone of your Fluent application, providing a clean, type-safe way to define your data models while maintaining flexibility across different database systems. The decorator-based approach ensures your code is both readable and maintainable as your application grows.