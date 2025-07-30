# Utility API Reference

The Fluent ecosystem includes comprehensive utility packages for both browser and Node.js environments.

## js-utils Package

Browser and Node.js compatible utilities for common operations.

### Arrays

Powerful array manipulation utilities.

```typescript
import { Arrays } from '@goatlab/js-utils'

// Remove duplicates
const unique = Arrays.unique([1, 2, 2, 3, 3, 4])
// [1, 2, 3, 4]

// Chunk array into smaller arrays
const chunks = Arrays.chunk([1, 2, 3, 4, 5, 6], 2)
// [[1, 2], [3, 4], [5, 6]]

// Flatten nested arrays
const flat = Arrays.flatten([[1, 2], [3, [4, 5]]])
// [1, 2, 3, 4, 5]

// Remove falsy values
const compact = Arrays.compact([1, 0, '', false, 2, null, 3])
// [1, 2, 3]

// Difference between arrays
const diff = Arrays.difference([1, 2, 3], [2, 3, 4])
// [1]

// Intersection of arrays
const intersection = Arrays.intersection([1, 2, 3], [2, 3, 4])
// [2, 3]
```

### Objects

Comprehensive object manipulation utilities.

```typescript
import { Objects } from '@goatlab/js-utils'

const obj = {
  user: {
    name: 'John',
    profile: {
      age: 30,
      location: 'NYC'
    }
  }
}

// Deep get with path
const name = Objects.get(obj, 'user.name')
// 'John'

// Safe get with default
const city = Objects.get(obj, 'user.profile.city', 'Unknown')
// 'Unknown'

// Set nested values
Objects.set(obj, 'user.profile.city', 'Boston')

// Deep clone
const cloned = Objects.deepClone(obj)

// Flatten object
const flattened = Objects.flatten(obj)
// {
//   'user.name': 'John',
//   'user.profile.age': 30,
//   'user.profile.location': 'NYC'
// }

// Unflatten object
const unflattened = Objects.unflatten(flattened)

// Pick specific properties
const picked = Objects.pick(obj, ['user.name', 'user.profile.age'])

// Omit properties
const omitted = Objects.omit(obj, ['user.profile.location'])

// Deep merge objects
const merged = Objects.merge(obj1, obj2)

// Check if object is empty
const isEmpty = Objects.isEmpty({})
// true

// Remove null/undefined values
const cleaned = Objects.deleteNulls(obj)
```

### Strings

String manipulation and formatting utilities.

```typescript
import { Strings } from '@goatlab/js-utils'

// Case conversions
const camelCase = Strings.camelCase('hello-world')
// 'helloWorld'

const kebabCase = Strings.kebabCase('HelloWorld')
// 'hello-world'

const pascalCase = Strings.pascalCase('hello world')
// 'HelloWorld'

const snakeCase = Strings.snakeCase('HelloWorld')
// 'hello_world'

// String manipulation
const truncated = Strings.truncate('Long text here', 10)
// 'Long text...'

const slug = Strings.slug('Hello World! 123')
// 'hello-world-123'

// Template replacement
const template = Strings.template('Hello {name}!', { name: 'John' })
// 'Hello John!'

// Safe JSON parsing
const parsed = Strings.safeJsonParse('{"key": "value"}')
// { key: 'value' }

// Escape HTML
const escaped = Strings.escapeHtml('<script>alert("xss")</script>')

// Generate random string
const randomStr = Strings.random(10)
// 'aB3fGh9Kl2'

// Word count
const words = Strings.wordCount('Hello world')
// 2
```

### Numbers

Numeric utilities and formatters.

```typescript
import { Numbers } from '@goatlab/js-utils'

// Format currency
const currency = Numbers.currency(1234.56, 'USD')
// '$1,234.56'

// Format percentage
const percentage = Numbers.percentage(0.1234)
// '12.34%'

// Random number in range
const random = Numbers.random(1, 100)

// Round to decimal places
const rounded = Numbers.round(3.14159, 2)
// 3.14

// Check if number is in range
const inRange = Numbers.inRange(50, 1, 100)
// true

// Clamp number to range
const clamped = Numbers.clamp(150, 1, 100)
// 100

// Convert to ordinal
const ordinal = Numbers.ordinal(23)
// '23rd'

// Generate sequence
const sequence = Numbers.sequence(1, 5)
// [1, 2, 3, 4, 5]
```

### Collection

Advanced collection manipulation (extends Array).

```typescript
import { Collection } from '@goatlab/js-utils'

const users = new Collection([
  { id: 1, name: 'John', age: 30, active: true },
  { id: 2, name: 'Jane', age: 25, active: false },
  { id: 3, name: 'Bob', age: 35, active: true }
])

// Filter by condition
const active = users.where('active', true)
const adults = users.where('age', '>', 18)

// Group by field
const byAge = users.groupBy('age')

// Sort by field
const sorted = users.sortBy('name')
const sortedDesc = users.sortByDesc('age')

// Get unique values
const uniqueAges = users.unique('age')

// Pluck values
const names = users.pluck('name')
// ['John', 'Jane', 'Bob']

// Transform items
const transformed = users.map(user => ({
  ...user,
  displayName: user.name.toUpperCase()
}))

// Reduce to single value
const totalAge = users.reduce((sum, user) => sum + user.age, 0)

// Paginate results
const page1 = users.paginate(1, 2)
// { data: [first 2 users], meta: { page: 1, perPage: 2, total: 3 } }

// Chain operations
const result = users
  .where('active', true)
  .sortBy('age')
  .pluck('name')
  .first()
```

### Promises

Promise utilities for better async handling.

```typescript
import { Promises } from '@goatlab/js-utils'

// Try-catch wrapper
const [error, result] = await Promises.try(asyncOperation())

// Retry with backoff
const result = await Promises.retry(
  () => fetch('/api/data'),
  { attempts: 3, delay: 1000 }
)

// Timeout promise
const result = await Promises.timeout(
  fetch('/api/data'),
  5000 // 5 seconds
)

// Parallel execution with concurrency limit
const results = await Promises.map(
  urls,
  url => fetch(url),
  { concurrency: 3 }
)

// Waterfall execution
const result = await Promises.waterfall([
  () => getUser(),
  user => getProfile(user.id),
  profile => getSettings(profile.id)
])

// Delay execution
await Promises.delay(1000) // Wait 1 second

// All settled (like Promise.allSettled)
const results = await Promises.allSettled([
  promise1,
  promise2,
  promise3
])
```

### Http

HTTP client utilities (ky wrapper).

```typescript
import { Http } from '@goatlab/js-utils'

// GET request
const users = await Http.get('https://api.example.com/users')

// POST request
const user = await Http.post('https://api.example.com/users', {
  json: { name: 'John', email: 'john@example.com' }
})

// PUT request
const updated = await Http.put('https://api.example.com/users/123', {
  json: { name: 'John Updated' }
})

// DELETE request
await Http.delete('https://api.example.com/users/123')

// Request with custom headers
const data = await Http.get('https://api.example.com/data', {
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  }
})

// Upload files
const result = await Http.post('https://api.example.com/upload', {
  body: formData
})

// Download with progress
const blob = await Http.get('https://api.example.com/file', {
  onDownloadProgress: (progress) => {
    console.log(`Downloaded ${progress.percent}%`)
  }
})
```

### Ids

ID generation and validation utilities.

```typescript
import { Ids } from '@goatlab/js-utils'

// Generate UUID
const uuid = Ids.uuid()
// '550e8400-e29b-41d4-a716-446655440000'

// Generate short ID
const shortId = Ids.shortId()
// 'B1bLiGn9G'

// Generate ObjectId (MongoDB compatible)
const objectId = Ids.objectId()
// '507f1f77bcf86cd799439011'

// Validate ObjectId
const isValid = Ids.isValidObjectId('507f1f77bcf86cd799439011')
// true

// Convert ObjectId to string
const stringId = Ids.objectIdString(objectId)

// Generate nanoid
const nanoId = Ids.nanoid()
// 'V1StGXR8_Z5jdHi6B-myT'

// Generate numeric ID
const numId = Ids.numeric(8)
// 12345678
```

### Time

Time and date utilities.

```typescript
import { Time } from '@goatlab/js-utils'

// Format date
const formatted = Time.format(new Date(), 'YYYY-MM-DD')
// '2023-12-25'

// Parse date string
const parsed = Time.parse('2023-12-25', 'YYYY-MM-DD')

// Add time
const tomorrow = Time.add(new Date(), 1, 'day')
const nextWeek = Time.add(new Date(), 1, 'week')

// Subtract time
const yesterday = Time.subtract(new Date(), 1, 'day')

// Get difference
const diff = Time.difference(date1, date2, 'hours')

// Get start/end of period
const startOfDay = Time.startOf(new Date(), 'day')
const endOfMonth = Time.endOf(new Date(), 'month')

// Relative time
const relative = Time.fromNow(new Date(Date.now() - 3600000))
// 'an hour ago'

// Is date before/after
const isBefore = Time.isBefore(date1, date2)
const isAfter = Time.isAfter(date1, date2)

// Timezone conversion
const utc = Time.toUTC(new Date())
const local = Time.toLocal(utcDate)
```

## node-utils Package

Node.js-specific utilities for server-side operations.

### Jwt

JWT token utilities.

```typescript
import { Jwt } from '@goatlab/node-utils'

// Sign JWT
const token = Jwt.sign(
  { userId: '123', role: 'admin' },
  'secret-key',
  { expiresIn: '1h' }
)

// Verify JWT
const decoded = Jwt.verify(token, 'secret-key')

// Decode without verification
const payload = Jwt.decode(token)

// Generate secret key
const secret = Jwt.generateSecret()
```

### Hashes

Hashing and cryptographic utilities.

```typescript
import { Hashes } from '@goatlab/node-utils'

// Hash password
const hashed = await Hashes.hash('password123')

// Verify password
const isValid = await Hashes.verify('password123', hashed)

// Generate salt
const salt = Hashes.salt()

// MD5 hash
const md5 = Hashes.md5('content')

// SHA256 hash
const sha256 = Hashes.sha256('content')

// Generate random bytes
const randomBytes = Hashes.randomBytes(32)

// HMAC
const hmac = Hashes.hmac('content', 'secret', 'sha256')
```

### Folders

File system utilities.

```typescript
import { Folders } from '@goatlab/node-utils'

// Ensure directory exists
await Folders.ensure('/path/to/directory')

// Read directory recursively
const files = await Folders.readRecursive('/path/to/directory')

// Copy directory
await Folders.copy('/source', '/destination')

// Move directory
await Folders.move('/source', '/destination')

// Delete directory
await Folders.delete('/path/to/directory')

// Get directory size
const size = await Folders.size('/path/to/directory')

// Check if directory exists
const exists = await Folders.exists('/path/to/directory')

// Get file stats
const stats = await Folders.stats('/path/to/file')
```

### Processes

Process management utilities.

```typescript
import { Processes } from '@goatlab/node-utils'

// Execute command
const result = await Processes.exec('ls -la')

// Spawn process
const child = Processes.spawn('node', ['script.js'])

// Kill process
await Processes.kill(child.pid)

// Get process info
const info = await Processes.info(process.pid)

// Check if process is running
const isRunning = await Processes.isRunning(12345)

// Get system stats
const stats = await Processes.systemStats()
```

### Scripts

Script and command execution utilities with signal handling.

```typescript
import { Scripts } from '@goatlab/node-utils'

// Run npm scripts
await Scripts.run('test')
await Scripts.run('build')

// Execute shell commands
await Scripts.runCommand('npm install')

// Run command in specific directory
await Scripts.runCommand('pnpm build', { 
  cwd: '/path/to/project' 
})

// Use workingDirectory alias
await Scripts.runCommand('yarn install', { 
  workingDirectory: rootPath 
})

// Capture command output
const version = await Scripts.runCommand('node --version', { 
  captureOutput: true 
})

// Run silently
await Scripts.runCommand('npm test', { 
  silent: true 
})

// Handle errors
try {
  await Scripts.runCommand('npm test')
} catch (error) {
  console.error('Command failed:', error.message)
}

// Complex commands with pipes
await Scripts.runCommand('npm install && npm test', {
  cwd: './my-project'
})
```

### Streams

Stream processing utilities.

```typescript
import { Streams } from '@goatlab/node-utils'

// Transform stream
const transformer = Streams.transform((chunk) => {
  return chunk.toString().toUpperCase()
})

// Filter stream
const filter = Streams.filter((chunk) => {
  return chunk.length > 10
})

// Map stream
const mapper = Streams.map((data) => {
  return JSON.parse(data)
})

// Batch stream
const batcher = Streams.batch(100)

// Pipeline streams
const pipeline = Streams.pipeline([
  fs.createReadStream('input.txt'),
  transformer,
  filter,
  fs.createWriteStream('output.txt')
])
```

### Security

Security utilities for Node.js applications.

```typescript
import { Security } from '@goatlab/node-utils'

// Encrypt data
const encrypted = Security.encrypt('sensitive data', 'secret-key')

// Decrypt data
const decrypted = Security.decrypt(encrypted, 'secret-key')

// Generate secure random string
const randomStr = Security.randomString(32)

// Hash with salt
const hashed = Security.hashWithSalt('password', 'salt')

// Constant time comparison
const isEqual = Security.constantTimeEqual(str1, str2)

// Generate API key
const apiKey = Security.generateApiKey()

// Validate input
const isValid = Security.validateInput(input, schema)
```

### Env

Environment and configuration utilities.

```typescript
import { Env } from '@goatlab/node-utils'

// Get environment variable with default
const port = Env.get('PORT', 3000)

// Get required environment variable
const dbUrl = Env.required('DATABASE_URL')

// Get boolean environment variable
const debug = Env.boolean('DEBUG', false)

// Get number environment variable
const timeout = Env.number('TIMEOUT', 5000)

// Get array environment variable
const hosts = Env.array('ALLOWED_HOSTS', [])

// Load .env file
Env.load('.env')

// Get all environment variables
const allVars = Env.all()

// Check if in production
const isProd = Env.isProduction()

// Get build info
const buildInfo = Env.getBuildInfo()
```

## Error Handling

All utilities provide consistent error handling:

```typescript
import { Errors } from '@goatlab/js-utils'

// Create application error
const error = new Errors.AppError('Something went wrong', 'VALIDATION_ERROR')

// HTTP error
const httpError = new Errors.HttpError(404, 'Not Found')

// Try-catch wrapper
const [error, result] = await Errors.try(asyncOperation())

// Error mode handling
Errors.setMode('development') // or 'production'
```

## Performance Utilities

### Memo

Memoization utilities for caching expensive operations.

```typescript
import { Memo } from '@goatlab/js-utils'

// Memoize function
const memoized = Memo.memoize(expensiveFunction)

// Memoize with TTL
const memoizedWithTTL = Memo.memoizeWithTTL(expensiveFunction, 60000)

// Memoize async function
const memoizedAsync = Memo.memoizeAsync(asyncFunction)

// Decorator
class MyClass {
  @Memo.method()
  expensiveMethod() {
    // expensive operation
  }
}
```

### Debounce

Debouncing utilities for rate limiting.

```typescript
import { Functions } from '@goatlab/js-utils'

// Debounce function
const debounced = Functions.debounce(handler, 300)

// Throttle function
const throttled = Functions.throttle(handler, 1000)

// Decorator
class MyClass {
  @Functions.debounce(300)
  handleInput() {
    // handle input
  }
}
```

## Related Documentation

- [Fluent API](./fluent-api.md) - Main Fluent class
- [Connector API](./connector-api.md) - Database connectors
- [Type Definitions](./types.md) - TypeScript types
- [Basic Examples](../examples/basic-queries.md) - Usage examples