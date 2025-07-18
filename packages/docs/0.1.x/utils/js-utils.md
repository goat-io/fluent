# JS Utils Package

The `@goatlab/js-utils` package provides a comprehensive collection of utility functions for JavaScript and TypeScript applications. It works in both browser and Node.js environments, offering utilities for arrays, objects, strings, HTTP requests, promises, and more.

## Installation

```bash
npm install @goatlab/js-utils
# or
pnpm add @goatlab/js-utils
```

## Core Utilities

### Arrays

The `Arrays` utility provides powerful methods for array manipulation and processing.

#### Basic Operations

```typescript
import { Arrays } from '@goatlab/js-utils'

// Get first and last elements
const numbers = [1, 2, 3, 4, 5]
const first = Arrays.first(numbers) // 1
const last = Arrays.last(numbers) // 5

// Chunk array into smaller arrays
const chunks = Arrays.chunk(numbers, 2) // [[1, 2], [3, 4], [5]]

// Remove duplicates
const duplicates = [1, 2, 2, 3, 3, 4]
const unique = Arrays.deDuplicate(duplicates) // [1, 2, 3, 4]

// Flatten nested arrays
const nested = [[1, 2], [3, 4], [5, 6]]
const flattened = Arrays.collapse(nested) // [1, 2, 3, 4, 5, 6]
```

#### Advanced Operations

```typescript
// Group by a property
const users = [
  { name: 'John', age: 25 },
  { name: 'Jane', age: 30 },
  { name: 'Bob', age: 25 }
]
const groupedByAge = Arrays.groupBy(users, user => user.age)
// { '25': [{ name: 'John', age: 25 }, { name: 'Bob', age: 25 }], '30': [{ name: 'Jane', age: 30 }] }

// Sort by a property
const sortedByAge = Arrays.sortBy(users, user => user.age)

// Count occurrences
const fruits = ['apple', 'banana', 'apple', 'orange', 'banana']
const counts = Arrays.countBy(fruits, fruit => fruit)
// { apple: 2, banana: 2, orange: 1 }

// Sum values
const scores = [10, 20, 30, 40]
const total = Arrays.sum(scores) // 100
const totalAge = Arrays.sumBy(users, user => user.age) // 80
```

#### Set Operations

```typescript
// Find intersection
const arr1 = [1, 2, 3, 4]
const arr2 = [3, 4, 5, 6]
const intersection = Arrays.intersection(arr1, arr2) // [3, 4]

// Find difference
const difference = Arrays.difference(arr1, arr2) // [1, 2]

// Remove falsy values
const withFalsy = [1, null, 2, undefined, 3, '', 4, 0]
const compact = Arrays.compact(withFalsy) // [1, 2, 3, 4]
```

### Objects

The `Objects` utility provides methods for object manipulation, deep operations, and transformations.

#### Basic Operations

```typescript
import { Objects } from '@goatlab/js-utils'

// Safe property access
const user = { profile: { name: 'John' } }
const name = Objects.get(() => user.profile.name, 'Unknown') // 'John'

// Get value from path
const value = Objects.getFromPath(user, 'profile.name') // { label: 'profile.name', value: 'John' }

// Clone object
const cloned = Objects.clone(user)

// Check if empty
const isEmpty = Objects.isEmpty({}) // true
const isNotEmpty = Objects.isEmpty({ name: 'John' }) // false
```

#### Object Transformation

```typescript
// Flatten nested object
const nested = {
  user: {
    profile: {
      name: 'John',
      age: 30
    }
  }
}
const flattened = Objects.flatten(nested)
// { 'user.profile.name': 'John', 'user.profile.age': '30' }

// Nest flattened object
const nested = Objects.nest(flattened)

// Filter object properties
const filtered = Objects.filterObject(user, (key, value) => key !== 'age')

// Map object values
const mapped = Objects.mapValues(user, (key, value) => value.toUpperCase())

// Pick specific properties
const picked = Objects.pick(user, ['name', 'email'])

// Omit specific properties
const omitted = Objects.omit(user, ['password', 'internal'])
```

#### Deep Operations

```typescript
// Deep equality comparison
const obj1 = { a: 1, b: { c: 2 } }
const obj2 = { a: 1, b: { c: 2 } }
const isEqual = Objects.deepEquals(obj1, obj2) // true

// Clear empty values
const withEmpties = { name: 'John', age: null, profile: { bio: '' } }
const cleaned = Objects.clearEmpties(withEmpties) // { name: 'John' }

// Sort object keys
const sorted = Objects.sortObjectDeep(user)
```

### Strings

The `Strings` utility provides comprehensive string manipulation methods.

#### Case Conversion

```typescript
import { Strings } from '@goatlab/js-utils'

// Convert to camelCase
const camelCase = Strings.camel('hello world') // 'helloWorld'

// Convert to snake_case
const snakeCase = Strings.snake('Hello World') // 'hello_world'

// Convert to kebab-case
const kebabCase = Strings.kebabCase('Hello World') // 'hello-world'

// Capitalize first letter
const capitalized = Strings.capitalize('hello world') // 'Hello world'

// Upper/lower first letter
const upperFirst = Strings.upperFirst('hello') // 'Hello'
const lowerFirst = Strings.lowerFirst('Hello') // 'hello'
```

#### String Manipulation

```typescript
// Create URL-friendly slugs
const slug = Strings.slug('Hello World! This is a Test') // 'hello-world-this-is-a-test'

// Truncate strings
const truncated = Strings.truncate('This is a long string', 10) // 'This is a...'
const truncatedMiddle = Strings.truncateMiddle('This is a very long string', 15) // 'This is...string'

// Limit string length
const limited = Strings.limit('This is a long string', 10) // 'This is a ...'

// Extract substrings
const before = Strings.before('user@example.com', '@') // 'user'
const after = Strings.after('user@example.com', '@') // 'example.com'

// Check if contains
const contains = Strings.contains('Hello World', 'World') // true
const containsAny = Strings.contains('Hello World', ['World', 'Universe']) // true
```

#### Advanced String Operations

```typescript
// Generate n-grams for search
const ngram = Strings.ngram('hello world')

// Parse JSON safely
const parsed = Strings.jsonParseIfPossible('{"name": "John"}') // { name: 'John' }
const notJson = Strings.jsonParseIfPossible('not json') // 'not json'

// Split words
const words = Strings.words('Hello, world! How are you?') // ['Hello', 'world', 'How', 'are', 'you']

// Parse query string
const query = Strings.parseQueryString('?name=John&age=30') // { name: 'John', age: '30' }
```

### HTTP Client

The `Http` utility provides a configured HTTP client based on `ky` with reasonable defaults.

```typescript
import { Http } from '@goatlab/js-utils'

// Get a configured HTTP client
const client = Http.getClient({
  timeout: 30000,
  retry: 3,
  logStart: true,
  logFinished: true
})

// Make requests
const response = await client.get('https://api.example.com/users')
const data = await response.json()

// POST request
const newUser = await client.post('https://api.example.com/users', {
  json: { name: 'John', email: 'john@example.com' }
})
```

#### HTTP Client Options

```typescript
const client = Http.getClient({
  timeout: 60000,
  retry: 2,
  debug: true, // Enables all logging
  logStart: true,
  logFinished: true,
  logRequest: true,
  logResponse: true,
  maxResponseLength: 5000,
  logWithSearchParams: false,
  logWithPrefixUrl: false
})
```

### Promises

The `Promises` utility provides enhanced promise handling and utilities.

```typescript
import { Promises } from '@goatlab/js-utils'

// Try-catch wrapper
const [error, result] = await Promises.try(async () => {
  const response = await fetch('https://api.example.com/data')
  return await response.json()
})

if (error) {
  console.error('Request failed:', error)
} else {
  console.log('Data:', result)
}

// Parallel mapping with concurrency control
const urls = ['url1', 'url2', 'url3']
const results = await Promises.map(urls, async url => {
  const response = await fetch(url)
  return await response.json()
}, { concurrency: 2 })

// Retry with backoff
const retryResult = await Promises.retry(
  async () => {
    const response = await fetch('https://api.example.com/data')
    if (!response.ok) throw new Error('Request failed')
    return await response.json()
  },
  { retries: 3, factor: 2 }
)

// Timeout wrapper
const timeoutResult = await Promises.timeout(
  fetch('https://api.example.com/data'),
  5000 // 5 seconds
)
```

### Numbers

The `Numbers` utility provides number manipulation and validation methods.

```typescript
import { Numbers } from '@goatlab/js-utils'

// Round to decimal places
const rounded = Numbers.round(3.14159, 2) // 3.14

// Clamp number between bounds
const clamped = Numbers.clamp(15, 0, 10) // 10

// Check if number is in range
const inRange = Numbers.inRange(5, 0, 10) // true

// Format as currency
const currency = Numbers.formatCurrency(1234.56, 'USD') // '$1,234.56'

// Parse number safely
const parsed = Numbers.parseFloat('123.45abc') // 123.45
const invalid = Numbers.parseFloat('abc') // NaN
```

### Time and Date

The package includes time utilities and date interval handling.

```typescript
import { Time } from '@goatlab/js-utils'

// Calculate time since
const startTime = new Date()
// ... some operation
const elapsed = Time.since(startTime) // '125ms' or '2.5s'

// Format duration
const duration = Time.formatDuration(125000) // '2m 5s'

// Sleep/delay
await Time.sleep(1000) // Wait 1 second
```

### Validation and Assertions

```typescript
import { assert, Is } from '@goatlab/js-utils'

// Type assertions
assert(value !== null, 'Value cannot be null')

// Type checking
const isString = Is.string(value)
const isNumber = Is.number(value)
const isObject = Is.object(value)
const isArray = Is.array(value)

// Validate email
const isValidEmail = Is.email('user@example.com') // true
```

### Error Handling

```typescript
import { AppError, ErrorMode } from '@goatlab/js-utils'

// Create structured errors
const error = new AppError('User not found', {
  code: 'USER_NOT_FOUND',
  statusCode: 404,
  context: { userId: '123' }
})

// Error modes for different handling strategies
const errorMode = ErrorMode.THROW // or ErrorMode.RETURN
```

### Memoization

```typescript
import { Memo } from '@goatlab/js-utils'

// Memoize function results
const expensiveFunction = (input: string) => {
  // Expensive computation
  return input.toUpperCase()
}

const memoized = Memo.fn(expensiveFunction)
const result1 = memoized('hello') // Computed
const result2 = memoized('hello') // Cached

// Async memoization
const asyncMemoized = Memo.fnAsync(async (input: string) => {
  const response = await fetch(`https://api.example.com/${input}`)
  return await response.json()
})
```

### Collections

```typescript
import { Collection } from '@goatlab/js-utils'

// Create a collection
const collection = new Collection([1, 2, 3, 4, 5])

// Chain operations
const result = collection
  .filter(n => n > 2)
  .map(n => n * 2)
  .reduce((sum, n) => sum + n, 0) // 18

// Collection methods
collection.first() // 1
collection.last() // 5
collection.count() // 5
collection.sum() // 15
collection.average() // 3
```

### Browser Events

For browser environments, the package provides event handling utilities.

```typescript
import { BrowserEvents } from '@goatlab/js-utils'

// Add event listener with cleanup
const cleanup = BrowserEvents.addEventListener(button, 'click', () => {
  console.log('Button clicked')
})

// Remove listener
cleanup()

// Debounced event handling
const debouncedHandler = BrowserEvents.debounce((event) => {
  console.log('Debounced event:', event)
}, 300)
```

## TypeScript Support

The package is written in TypeScript and provides full type definitions. All utilities are strongly typed and provide excellent IntelliSense support.

```typescript
import { Arrays, Objects, Strings } from '@goatlab/js-utils'

// All methods are fully typed
const users: User[] = [...]
const grouped: Record<string, User[]> = Arrays.groupBy(users, u => u.department)
const mapped: Record<string, string> = Objects.mapValues(user, (k, v) => v.toString())
```

## Performance Considerations

- All utilities are optimized for performance
- Lazy evaluation where possible
- Efficient algorithms for common operations
- Minimal memory footprint
- Tree-shaking friendly for bundle size optimization

## Common Patterns

### Data Processing Pipeline

```typescript
import { Arrays, Objects, Strings } from '@goatlab/js-utils'

const processUsers = (users: User[]) => {
  return Arrays.groupBy(users, u => u.department)
    |> (grouped => Objects.mapValues(grouped, (dept, users) => ({
      count: users.length,
      totalSalary: Arrays.sumBy(users, u => u.salary),
      names: users.map(u => Strings.capitalize(u.name))
    })))
}
```

### Safe API Calls

```typescript
import { Http, Promises } from '@goatlab/js-utils'

const fetchUserData = async (userId: string) => {
  const client = Http.getClient({ timeout: 5000 })
  
  const [error, result] = await Promises.try(async () => {
    const response = await client.get(`/users/${userId}`)
    return await response.json()
  })
  
  if (error) {
    console.error('Failed to fetch user:', error)
    return null
  }
  
  return result
}
```

## Migration Guide

If you're migrating from other utility libraries:

### From Lodash

```typescript
// Lodash
import _ from 'lodash'
const grouped = _.groupBy(users, 'department')
const mapped = _.mapValues(obj, v => v.toString())

// JS Utils
import { Arrays, Objects } from '@goatlab/js-utils'
const grouped = Arrays.groupBy(users, u => u.department)
const mapped = Objects.mapValues(obj, (k, v) => v.toString())
```

### From Ramda

```typescript
// Ramda
import R from 'ramda'
const result = R.pipe(
  R.filter(n => n > 2),
  R.map(n => n * 2),
  R.sum
)(numbers)

// JS Utils
import { Arrays } from '@goatlab/js-utils'
const result = Arrays.sum(
  Arrays.filter(numbers, n => n > 2).map(n => n * 2)
)
```

## Contributing

The js-utils package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.