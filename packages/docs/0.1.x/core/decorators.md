# Decorators

Fluent uses decorators to define database entities, columns, and relationships. The decorator system is built on top of TypeORM decorators and provides a clean, declarative way to define your data models with full TypeScript support.

## Overview

Fluent decorators provide:
- **Entity Definition**: Define database tables and collections
- **Column Types**: Various column types with validation
- **Relationship Management**: Define relationships between entities
- **Schema Generation**: Automatic schema generation and validation
- **Type Safety**: Full TypeScript integration with compile-time validation

## Decorator Categories

### Entity Decorators
- `@f.entity()` - Define a database entity/table

### Column Decorators
- `@f.id()` - Primary key column
- `@f.mongoId()` - MongoDB ObjectId column
- `@f.property()` - Basic property/column
- `@f.embed()` - Embedded object
- `@f.embedArray()` - Array of embedded objects
- `@f.stringArray()` - Array of strings
- `@f.Enum()` - Enumeration column

### Timestamp Decorators
- `@f.created()` - Creation timestamp
- `@f.updated()` - Update timestamp
- `@f.deleted()` - Deletion timestamp (soft delete)
- `@f.version()` - Version column

### Relationship Decorators
- `@f.hasMany()` - One-to-many relationship
- `@f.belongsTo()` - Many-to-one relationship
- `@f.belongsToMany()` - Many-to-many relationship

## Basic Usage

### Entity Definition

```typescript
import { f } from '@goatlab/fluent'

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
```

## Entity Decorators

### `@f.entity(name)`

Defines a database entity/table.

**Parameters:**
- `name: string` - The table/collection name

**Example:**
```typescript
@f.entity('users')
export class User {
  // Entity properties
}

@f.entity('blog_posts')
export class BlogPost {
  // Entity properties
}
```

## Column Decorators

### `@f.id()`

Defines a primary key column with UUID generation.

**Features:**
- Automatically generates UUIDs
- Works with both SQL and NoSQL databases
- Combines TypeORM's PrimaryGeneratedColumn with ObjectIdColumn

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string // Will be a UUID string
}
```

### `@f.mongoId()`

Defines a MongoDB ObjectId primary key.

**Features:**
- Specifically for MongoDB databases
- Uses MongoDB's ObjectId type
- Automatically indexed

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.mongoId()
  id: ObjectId // MongoDB ObjectId
}
```

### `@f.property(params?)`

Defines a basic property/column.

**Parameters:**
```typescript
interface PropertyInterface {
  required?: boolean  // Whether the field is required
  unique?: boolean    // Whether the field should be unique
  hidden?: boolean    // Whether to hide from API responses
  type?: ColumnType   // Specific column type
}
```

**Examples:**
```typescript
@f.entity('users')
export class User {
  @f.property({ required: true })
  email: string

  @f.property({ required: true, unique: true })
  username: string

  @f.property({ hidden: true })
  password: string

  @f.property({ type: 'text' })
  bio: string

  @f.property()
  age?: number // Optional field
}
```

### `@f.embed(entity)`

Defines an embedded object column.

**Parameters:**
- `entity: any` - The embedded entity class

**Example:**
```typescript
class Address {
  street: string
  city: string
  country: string
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.embed(Address)
  address: Address
}
```

### `@f.embedArray(entity, params?)`

Defines an array of embedded objects.

**Parameters:**
- `entity: any` - The embedded entity class
- `params?: PropertyInterface` - Optional parameters

**Example:**
```typescript
class PhoneNumber {
  type: 'mobile' | 'home' | 'work'
  number: string
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.embedArray(PhoneNumber, { required: true })
  phoneNumbers: PhoneNumber[]
}
```

### `@f.stringArray(type, params?)`

Defines an array of strings.

**Parameters:**
- `type: any` - The string type
- `params?: PropertyInterface` - Optional parameters

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.stringArray(String, { required: true })
  tags: string[]

  @f.stringArray(String)
  hobbies?: string[]
}
```

### `@f.Enum(enumConfig, params?)`

Defines an enumeration column.

**Parameters:**
```typescript
interface EnumProperty {
  enum: any[]        // Array of enum values
  default?: Primitives // Default value
}
```

**Example:**
```typescript
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
}
```

## Timestamp Decorators

### `@f.created()`

Automatically sets the creation timestamp.

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.created()
  createdAt: Date // Automatically set on creation
}
```

### `@f.updated()`

Automatically updates the modification timestamp.

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.updated()
  updatedAt: Date // Automatically updated on modification
}
```

### `@f.deleted()`

Soft delete timestamp column.

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.deleted()
  deletedAt?: Date // Set when soft deleted
}
```

### `@f.version()`

Version column for optimistic locking.

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.version()
  version: number // Incremented on each update
}
```

## Relationship Decorators

### `@f.hasMany(params)`

Defines a one-to-many relationship.

**Parameters:**
```typescript
interface HasManyInterface<T> {
  entity: (type?: any) => DbEntity<T>  // Target entity
  inverse: string | ((object: T) => any) // Inverse property name
}
```

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]
}

@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.belongsTo({ entity: () => User, inverse: 'posts', pivotColumnName: 'authorId' })
  author: User
}
```

### `@f.belongsTo(params)`

Defines a many-to-one relationship.

**Parameters:**
```typescript
interface BelongsToInterface<T> {
  entity: (type?: any) => DbEntity<T>  // Target entity
  inverse: string | ((object: T) => any) // Inverse property name
  pivotColumnName?: string              // Foreign key column name
}
```

**Example:**
```typescript
@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'posts', 
    pivotColumnName: 'authorId' 
  })
  author: User

  @f.belongsTo({ 
    entity: () => Category, 
    inverse: 'posts', 
    pivotColumnName: 'categoryId' 
  })
  category: Category
}
```

### `@f.belongsToMany(params)`

Defines a many-to-many relationship.

**Parameters:**
```typescript
interface ManyToManyInterface<T> {
  entity: (type?: any) => DbEntity<T>  // Target entity
  joinTableName: string                 // Pivot table name
  foreignKey: string                    // Foreign key for this entity
  inverseForeignKey: string             // Foreign key for target entity
}
```

**Example:**
```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.belongsToMany({
    entity: () => Role,
    joinTableName: 'user_roles',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles: Role[]
}

@f.entity('roles')
export class Role {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.belongsToMany({
    entity: () => User,
    joinTableName: 'user_roles',
    foreignKey: 'roleId',
    inverseForeignKey: 'userId'
  })
  users: User[]
}
```

## Advanced Examples

### Complete User Entity

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
}

class UserPreferences {
  @f.property({ default: true })
  emailNotifications: boolean

  @f.property({ default: false })
  smsNotifications: boolean

  @f.property({ default: 'light' })
  theme: 'light' | 'dark'

  @f.property({ default: 'en' })
  language: string
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  email: string

  @f.property({ required: true, unique: true })
  username: string

  @f.property({ hidden: true, required: true })
  password: string

  @f.embed(UserProfile)
  profile: UserProfile

  @f.embed(UserPreferences)
  preferences: UserPreferences

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

  @f.stringArray(String)
  tags: string[]

  @f.property({ type: 'timestamp' })
  lastLoginAt?: Date

  @f.property({ type: 'timestamp' })
  emailVerifiedAt?: Date

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date

  @f.deleted()
  deletedAt?: Date

  @f.version()
  version: number

  // Relationships
  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]

  @f.hasMany({ entity: () => Comment, inverse: 'author' })
  comments: Comment[]

  @f.belongsToMany({
    entity: () => Role,
    joinTableName: 'user_roles',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles: Role[]

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
}
```

### Blog Post Entity

```typescript
import { f } from '@goatlab/fluent'

enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

class PostMetadata {
  @f.property()
  excerpt?: string

  @f.property()
  featuredImage?: string

  @f.stringArray(String)
  keywords: string[]

  @f.property({ type: 'int', default: 0 })
  readingTime: number

  @f.property({ default: false })
  isFeatured: boolean
}

@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property({ required: true })
  slug: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.embed(PostMetadata)
  metadata: PostMetadata

  @f.Enum({ 
    enum: Object.values(PostStatus), 
    default: PostStatus.DRAFT 
  })
  status: PostStatus

  @f.stringArray(String)
  tags: string[]

  @f.property({ type: 'timestamp' })
  publishedAt?: Date

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date

  @f.deleted()
  deletedAt?: Date

  // Relationships
  @f.belongsTo({ 
    entity: () => User, 
    inverse: 'posts', 
    pivotColumnName: 'authorId' 
  })
  author: User

  @f.belongsTo({ 
    entity: () => Category, 
    inverse: 'posts', 
    pivotColumnName: 'categoryId' 
  })
  category: Category

  @f.hasMany({ entity: () => Comment, inverse: 'post' })
  comments: Comment[]

  @f.belongsToMany({
    entity: () => Tag,
    joinTableName: 'post_tags',
    foreignKey: 'postId',
    inverseForeignKey: 'tagId'
  })
  postTags: Tag[]
}
```

## Database-Specific Features

### MongoDB Specific

```typescript
@f.entity('users')
export class User {
  @f.mongoId()
  _id: ObjectId

  @f.property({ required: true })
  email: string

  // MongoDB supports nested objects natively
  @f.embed(Address)
  address: Address

  @f.embedArray(PhoneNumber)
  phoneNumbers: PhoneNumber[]
}
```

### SQL Specific

```typescript
@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, unique: true })
  email: string

  // SQL-specific column types
  @f.property({ type: 'varchar', length: 255 })
  name: string

  @f.property({ type: 'text' })
  bio: string

  @f.property({ type: 'decimal', precision: 10, scale: 2 })
  balance: number

  @f.property({ type: 'timestamp' })
  lastLoginAt: Date
}
```

## Validation Integration

Decorators work seamlessly with validation schemas:

```typescript
import { z } from 'zod'

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
}

// Corresponding Zod schema
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  age: z.number().min(0).max(150).optional()
})

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})
```

## Best Practices

### 1. Consistent Naming

```typescript
// ✅ Good - consistent naming
@f.entity('users')
export class User {
  @f.belongsTo({ 
    entity: () => Company, 
    inverse: 'users', 
    pivotColumnName: 'companyId' 
  })
  company: Company
}

// ❌ Bad - inconsistent naming
@f.entity('users')
export class User {
  @f.belongsTo({ 
    entity: () => Company, 
    inverse: 'employees', 
    pivotColumnName: 'comp_id' 
  })
  company: Company
}
```

### 2. Use Appropriate Types

```typescript
// ✅ Good - specific types
@f.entity('users')
export class User {
  @f.property({ type: 'varchar', length: 255 })
  email: string

  @f.property({ type: 'text' })
  bio: string

  @f.property({ type: 'timestamp' })
  lastLoginAt: Date
}

// ❌ Bad - generic types
@f.entity('users')
export class User {
  @f.property()
  email: string

  @f.property()
  bio: string

  @f.property()
  lastLoginAt: Date
}
```

### 3. Define Relationships Properly

```typescript
// ✅ Good - bidirectional relationships
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
  zipCode: string
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

  @f.property()
  addressZipCode: string
}
```

## Related Documentation

- **[Entities](entities.md)** - Complete entity definition guide
- **[TypeORM Connector](typeorm-connector.md)** - Database integration
- **[Query Builder](query-builder.md)** - Querying decorated entities
- **[Base Connector](base-connector.md)** - Understanding connector patterns

The decorator system in Fluent provides a powerful, type-safe way to define your data models while maintaining clean, readable code. The integration with TypeORM ensures broad database compatibility while the TypeScript integration provides excellent developer experience.