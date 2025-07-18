# TypeScript Type Definitions

This document provides comprehensive type definitions for the Fluent ecosystem, enabling full TypeScript support and IntelliSense.

## Core Query Types

### FluentQuery<T>

The main query type used across all connectors.

```typescript
type FluentQuery<T> = {
  select?: QueryFieldSelector<T>
  where?: QueryWhereFitler<T> | LogicalOperators<T>
  orderBy?: QueryOrderSelector<T>[]
  limit?: number
  offset?: number
  take?: number
  include?: QueryIncludeRelation<T>
  paginated?: Paginator
}
```

**Example:**
```typescript
const query: FluentQuery<User> = {
  select: { name: true, email: true },
  where: { age: { gte: 18 } },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10,
  include: { posts: true }
}
```

### QueryFieldSelector<T>

Type for selecting specific fields from a model.

```typescript
type QueryFieldSelector<T> = Partial<{
  [K in keyof T]: T[K] extends object
    ? true | QueryFieldSelector<T[K]>
    : true
}>
```

**Example:**
```typescript
const select: QueryFieldSelector<User> = {
  id: true,
  name: true,
  profile: {
    avatar: true,
    bio: true
  }
}
```

### QueryWhereFitler<T>

Type for filtering records with various operators.

```typescript
type QueryWhereFitler<T> = Partial<{
  [K in keyof T]: T[K] extends object
    ? QueryWhereFitler<T[K]>
    : QueryOperations<T[K]> | T[K]
}>
```

**Example:**
```typescript
const where: QueryWhereFitler<User> = {
  age: { gte: 18, lte: 65 },
  name: { contains: 'John' },
  email: { endsWith: '@example.com' },
  active: true
}
```

### QueryOperations<T>

Available query operations for filtering.

```typescript
type QueryOperations<T> = {
  // Equality
  eq?: T
  not?: T
  
  // Comparison
  gt?: T
  gte?: T
  lt?: T
  lte?: T
  
  // Array operations
  in?: T[]
  notIn?: T[]
  
  // String operations (when T extends string)
  contains?: T
  startsWith?: T
  endsWith?: T
  
  // Null checks
  isNull?: boolean
  isNotNull?: boolean
}
```

### LogicalOperators<T>

Logical operators for complex queries.

```typescript
type LogicalOperators<T> = {
  OR?: (QueryWhereFitler<T> | LogicalOperators<T>)[]
  AND?: (QueryWhereFitler<T> | LogicalOperators<T>)[]
  NOT?: QueryWhereFitler<T> | LogicalOperators<T>
}
```

**Example:**
```typescript
const where: LogicalOperators<User> = {
  OR: [
    { age: { gte: 18 } },
    { role: 'admin' }
  ],
  AND: [
    { active: true },
    { verified: true }
  ]
}
```

### QueryOrderSelector<T>

Type for ordering results.

```typescript
type QueryOrderSelector<T> = Partial<{
  [K in keyof T]: T[K] extends object
    ? QueryOrderSelector<T[K]>
    : 'asc' | 'desc'
}>
```

**Example:**
```typescript
const orderBy: QueryOrderSelector<User>[] = [
  { name: 'asc' },
  { createdAt: 'desc' },
  { profile: { updatedAt: 'desc' } }
]
```

### QueryIncludeRelation<T>

Type for including related data.

```typescript
type QueryIncludeRelation<T> = {
  [K in keyof T]?: T[K] extends any[]
    ? (FluentQuery<T[K][0]> & { withPivot?: boolean }) | true
    : FluentQuery<T[K]> | true
}
```

**Example:**
```typescript
const include: QueryIncludeRelation<User> = {
  posts: {
    select: { title: true, content: true },
    where: { published: true },
    orderBy: [{ createdAt: 'desc' }]
  },
  roles: {
    withPivot: true
  }
}
```

## Connector Interface Types

### FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>

The main connector interface that all database connectors implement.

```typescript
interface FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO> {
  // CREATE
  insert(data: InputDTO): Promise<OutputDTO>
  insertMany(data: InputDTO[]): Promise<OutputDTO[]>

  // READ
  findById<T extends FindByIdFilter<ModelDTO>>(
    id: string,
    q?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>
  
  findByIds<T extends FindByIdFilter<ModelDTO>>(
    ids: string[],
    q?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  
  findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  
  findFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO> | null>
  
  requireById(
    id: string,
    q?: FindByIdFilter<ModelDTO>
  ): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
  
  requireFirst<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>>

  // UPDATE
  updateById(id: string, data: InputDTO): Promise<OutputDTO>
  replaceById(id: string, data: InputDTO): Promise<OutputDTO>

  // DELETE
  deleteById(id: string): Promise<string>

  // RELATIONS
  loadFirst(query?: FluentQuery<ModelDTO>): any
  loadById(id: string): any
  raw(): any
}
```

### FindByIdFilter<T>

Type for finding records by ID with optional field selection.

```typescript
type FindByIdFilter<T> = {
  select?: QueryFieldSelector<T>
  include?: QueryIncludeRelation<T>
  limit?: number
}
```

### QueryOutput<T, Model>

Type that represents the output of a query, respecting select and include options.

```typescript
type QueryOutput<T extends FluentQuery<Model>, Model> = 
  T extends { select: infer S }
    ? S extends QueryFieldSelector<Model>
      ? GetSelectedFields<S, Model>
      : Model
    : Model
```

This complex type ensures that TypeScript knows exactly which fields will be present in the result based on the query's select clause.

## Relationship Types

### FluentHasManyParams<T>

Type for defining one-to-many relationships.

```typescript
interface FluentHasManyParams<T> {
  repository: new () => T
  entity: new () => any
}
```

### FluentBelongsToParams<T>

Type for defining many-to-one relationships.

```typescript
interface FluentBelongsToParams<T> {
  repository: new () => T
  entity: new () => any
}
```

### FluentBelongsToManyParams<T>

Type for defining many-to-many relationships.

```typescript
interface FluentBelongsToManyParams<T> {
  repository: new () => T
  entity: new () => any
  pivot: new () => any
}
```

## Utility Types

### AnyObject

General object type.

```typescript
type AnyObject = Record<string, any>
```

### Primitives

Primitive value types.

```typescript
type Primitives = string | number | boolean | Date | null | undefined
```

### Unpacked<T>

Type to unpack array types.

```typescript
type Unpacked<T> = T extends (infer U)[] ? U : T
```

### Concrete<T>

Type to remove undefined from all properties.

```typescript
type Concrete<T> = {
  [K in keyof T]-?: T[K]
}
```

### DeepPartial<T>

Type to make all properties optional recursively.

```typescript
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? DeepPartial<T[K]>
    : T[K]
}
```

## Pagination Types

### Paginator

Type for pagination configuration.

```typescript
interface Paginator {
  page: number
  perPage: number
}
```

### PaginatedData<T>

Type for paginated results.

```typescript
interface PaginatedData<T> {
  data: T[]
  meta: {
    page: number
    perPage: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

## Connector-Specific Types

### TypeOrmConnectorParams<Input, Output>

Parameters for TypeORM connector initialization.

```typescript
interface TypeOrmConnectorParams<Input, Output> {
  entity: any
  dataSource: DataSource
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}
```

### FirebaseConnectorParams<Input, Output>

Parameters for Firebase connector initialization.

```typescript
interface FirebaseConnectorParams<Input, Output> {
  entity: any
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}
```

### LokiConnectorParams<Input, Output>

Parameters for Loki connector initialization.

```typescript
interface LokiConnectorParams<Input, Output> {
  entity: any
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>
}
```

## Decorator Types

### PropertyInterface

Interface for property decorators.

```typescript
interface PropertyInterface {
  required?: boolean
  unique?: boolean
  hidden?: boolean
  type?: ColumnType
}
```

### EnumProperty

Interface for enum properties.

```typescript
interface EnumProperty {
  enum: any[]
  default?: Primitives
}
```

### DbEntity<T>

Type for database entities.

```typescript
type DbEntity<T> = new () => T
```

## Error Types

### AppError

Custom application error type.

```typescript
class AppError extends Error {
  code: string
  statusCode: number
  
  constructor(message: string, code?: string, statusCode?: number)
}
```

### HttpError

HTTP-specific error type.

```typescript
class HttpError extends AppError {
  constructor(statusCode: number, message: string)
}
```

## Collection Types

### Collection<T>

Type for the Collection class.

```typescript
class Collection<T> extends Array<T> {
  where<K extends keyof T>(key: K, value: T[K]): Collection<T>
  where<K extends keyof T>(key: K, operator: string, value: any): Collection<T>
  
  pluck<K extends keyof T>(key: K): T[K][]
  
  groupBy<K extends keyof T>(key: K): Record<string, Collection<T>>
  groupBy<R>(callback: (item: T) => R): Record<string, Collection<T>>
  
  sortBy<K extends keyof T>(key: K): Collection<T>
  sortByDesc<K extends keyof T>(key: K): Collection<T>
  
  unique<K extends keyof T>(key?: K): Collection<T>
  
  paginate(page: number, perPage: number): PaginatedData<T>
  
  // ... other collection methods
}
```

## Usage Examples

### Type-Safe Repository

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { z } from 'zod'

// Define schemas
const UserInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
})

const UserOutputSchema = UserInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Define types
type UserInput = z.infer<typeof UserInputSchema>
type UserOutput = z.infer<typeof UserOutputSchema>

// Create connector with full type safety
class UserRepository extends TypeOrmConnector<
  UserOutput,
  UserInput,
  UserOutput
> {
  constructor() {
    super({
      entity: UserEntity,
      dataSource: dataSource,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### Type-Safe Queries

```typescript
const userRepo = new UserRepository()

// TypeScript knows the return type
const users: UserOutput[] = await userRepo.findMany({
  where: { age: { gte: 18 } },
  select: { name: true, email: true },
  orderBy: [{ createdAt: 'desc' }]
})

// TypeScript knows this returns only name and email
const limitedUsers = await userRepo.findMany({
  select: { name: true, email: true }
})
// Type: Array<{ name: string; email: string }>
```

### Type-Safe Relationships

```typescript
class UserRepository extends TypeOrmConnector<User, UserInput, UserOutput> {
  posts() {
    return this.hasMany({
      repository: PostRepository,
      entity: PostEntity
    })
  }
}

// Usage with full type safety
const user = await userRepo.loadById('user-123')
const posts = await user.posts().findMany({
  where: { published: true },
  select: { title: true, content: true }
})
// Type: Array<{ title: string; content: string }>
```

## Advanced Type Patterns

### Conditional Types

```typescript
type IsArray<T> = T extends any[] ? true : false
type ArrayElement<T> = T extends (infer U)[] ? U : never
type NonNullable<T> = T extends null | undefined ? never : T
```

### Mapped Types

```typescript
type Optional<T> = {
  [K in keyof T]?: T[K]
}

type Required<T> = {
  [K in keyof T]-?: T[K]
}

type Readonly<T> = {
  readonly [K in keyof T]: T[K]
}
```

### Template Literal Types

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type ApiEndpoint<T extends string> = `/api/${T}`
```

## Best Practices

1. **Always use proper type annotations** for better IntelliSense
2. **Define schemas with Zod** for runtime validation
3. **Use generic types** for reusable components
4. **Leverage conditional types** for complex type logic
5. **Use mapped types** for type transformations
6. **Define union types** for specific value sets
7. **Use interface inheritance** for extending types

## Related Documentation

- [Fluent API](./fluent-api.md) - Main Fluent class
- [Connector API](./connector-api.md) - Database connectors
- [Utility API](./utility-api.md) - Utility functions
- [Basic Examples](../examples/basic-queries.md) - Usage examples