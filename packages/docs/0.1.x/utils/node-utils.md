# Node Utils Package

The `@goatlab/node-utils` package provides Node.js-specific utility functions including JWT handling, security utilities, file operations, stream processing, and environment management.

## Installation

```bash
npm install @goatlab/node-utils
# or
pnpm add @goatlab/node-utils
```

## Core Utilities

### JWT (JSON Web Tokens)

Secure JWT token generation and verification utilities.

```typescript
import { Jwt } from '@goatlab/node-utils'

// Generate a JWT token
const token = await Jwt.generate(
  { userId: '123', role: 'admin' },
  {
    secret: 'your-secret-key',
    expiresIn: '1h',
    algorithm: 'HS256'
  }
)

// Verify a JWT token
try {
  const decoded = await Jwt.verify(token, 'your-secret-key')
  console.log('User ID:', decoded.userId)
  console.log('Role:', decoded.role)
} catch (error) {
  console.error('Invalid token:', error)
}

// Verify with options
const decoded = await Jwt.verify(token, 'your-secret-key', {
  algorithms: ['HS256'],
  issuer: 'your-app',
  audience: 'your-users'
})
```

### Security Utilities

Comprehensive security utilities for encryption, hashing, and key generation.

#### Encryption and Decryption

```typescript
import { Security } from '@goatlab/node-utils'

// Encrypt and decrypt strings
const secretKey = 'your-secret-key'
const plaintext = 'sensitive data'

const encrypted = Security.encryptString(plaintext, secretKey)
const decrypted = Security.decryptString(encrypted, secretKey)

// Encrypt and decrypt objects
const sensitiveData = {
  apiKey: 'sk-123456',
  token: 'abc123',
  password: 'secret'
}

const encryptedObj = Security.encryptObject(sensitiveData, secretKey)
const decryptedObj = Security.decryptObject(encryptedObj, secretKey)
```

#### Buffer Encryption with Random IV

```typescript
// Encrypt buffer with random IV for non-deterministic encryption
const buffer = Buffer.from('sensitive data')
const secretKeyBase64 = Buffer.from('your-secret-key').toString('base64')

const encryptedBuffer = Security.encryptRandomIVBuffer(buffer, secretKeyBase64)
const decryptedBuffer = Security.decryptRandomIVBuffer(encryptedBuffer, secretKeyBase64)
```

#### Elliptic Curve Cryptography

```typescript
// Generate elliptic curve key pair
const keyPair = await Security.generateElipticCurve()
console.log('Public Key:', keyPair.publicKey)
console.log('Private Key:', keyPair.privateKey)

// Sign message with private key
const message = 'Hello, World!'
const signature = Security.encryptStringWithElliptic(message, keyPair.privateKey)

// Verify signature with public key
const isValid = Security.verifySignedStringWithElliptic(
  message,
  signature,
  keyPair.publicKey
)
```

#### Password Generation

```typescript
// Generate secure random password
const password = Security.generatePassword(16)
console.log('Generated password:', password)
```

### Hashing

Secure hashing utilities using bcrypt and crypto.

```typescript
import { Hashes } from '@goatlab/node-utils'

// Hash password with salt
const password = 'user-password'
const hashedPassword = await Hashes.saltHash(password, 10)

// Verify password
const isValid = await Hashes.saltCompare(password, hashedPassword)

// MD5 hashing
const md5Hash = Hashes.md5('Hello World')
const md5Buffer = Hashes.md5AsBuffer('Hello World')

// Custom algorithm hashing
const sha256Hash = Hashes.hash('Hello World', 'sha256')
const sha256Buffer = Hashes.hashAsBuffer('Hello World', 'sha256')

// Base64 encoding/decoding
const base64 = Hashes.stringToBase64('Hello World')
const decoded = Hashes.base64ToString(base64)

// Buffer to/from Base64
const buffer = Buffer.from('Hello World')
const base64FromBuffer = Hashes.bufferToBase64(buffer)
const bufferFromBase64 = Hashes.base64ToBuffer(base64FromBuffer)
```

### Streams

Powerful stream processing utilities for Node.js applications.

```typescript
import { Streams } from '@goatlab/node-utils'

// Create readable stream from iterable
const data = [1, 2, 3, 4, 5]
const readable = Streams.readableFrom(data)

// Stream processing pipeline
await Streams.pipeline([
  Streams.readableFrom(data),
  Streams.map(async (item) => item * 2),
  Streams.filter(item => item > 4),
  Streams.logProgress({ interval: 100 }),
  Streams.toWriteStream('./output.txt')
])
```

#### Stream Transformations

```typescript
// Map transformation
const doubledStream = Streams.map(async (item) => item * 2)

// Synchronous map
const syncMappedStream = Streams.mapSync(item => item.toString())

// Filter transformation
const filteredStream = Streams.filter(item => item > 10)

// Buffer/batch transformation
const batchedStream = Streams.buffer({ batchSize: 100 })

// Compression
const gzipStream = Streams.gzip()
const unzipStream = Streams.unGzip()

// JSON parsing
const jsonStream = Streams.parseJson()

// Convert to NDJSON
const ndjsonStream = Streams.toNDJson()

// Log progress
const progressStream = Streams.logProgress({ 
  interval: 1000,
  label: 'Processing items'
})
```

#### File Operations

```typescript
// Stream to file
await Streams.pipeline([
  Streams.readableFrom(data),
  Streams.map(item => JSON.stringify(item)),
  Streams.toWriteStream('./data.json')
])

// Process large files
await Streams.pipeline([
  fs.createReadStream('./large-file.txt'),
  Streams.map(async (chunk) => processChunk(chunk)),
  Streams.toWriteStream('./processed-file.txt')
])
```

### File and Folder Operations

```typescript
import { Folders } from '@goatlab/node-utils'

// Get folder size
const size = await Folders.getSize('./path/to/folder')

// Copy folder recursively
await Folders.copy('./source', './destination')

// Delete folder and contents
await Folders.delete('./path/to/folder')

// Create directory structure
await Folders.ensureDir('./path/to/nested/folder')

// List files recursively
const files = await Folders.listFiles('./path/to/folder', {
  recursive: true,
  extensions: ['.js', '.ts']
})
```

### Environment and Configuration

```typescript
import { Env } from '@goatlab/node-utils'

// Get environment variables with defaults
const port = Env.get('PORT', 3000)
const dbUrl = Env.get('DATABASE_URL', 'mongodb://localhost:27017/app')

// Get required environment variables (throws if missing)
const apiKey = Env.require('API_KEY')

// Get build information
const buildInfo = Env.getBuildInfo()
console.log('Version:', buildInfo.version)
console.log('Build Date:', buildInfo.buildDate)
console.log('Git Hash:', buildInfo.gitHash)

// Check environment
const isDev = Env.isDevelopment()
const isProd = Env.isProduction()
const isTest = Env.isTest()
```

### Process Management

```typescript
import { Processes } from '@goatlab/node-utils'

// Execute shell command
const result = await Processes.exec('ls -la')
console.log('Output:', result.stdout)

// Execute with options
const result2 = await Processes.exec('npm test', {
  cwd: './my-project',
  env: { NODE_ENV: 'test' }
})

// Spawn long-running process
const child = Processes.spawn('node', ['server.js'], {
  stdio: 'inherit'
})

// Kill process gracefully
await Processes.kill(child.pid, 'SIGTERM')
```

### Script Execution

The node-utils package provides two powerful utilities for script execution: `runScript` for running async functions as top-level scripts, and `runCommand` for executing shell commands.

#### runScript - Async Script Runner

The `runScript` function provides a robust wrapper for running Node.js scripts with automatic error handling, signal management, and process lifecycle control.

```typescript
import { runScript } from '@goatlab/node-utils'

// Basic usage - automatic error handling and clean exit
runScript(async () => {
  console.log('Starting my script...')
  await doSomeWork()
  console.log('Script completed!')
})
```

##### Key Features

- **Automatic Error Handling**: Catches and logs all errors, exits with proper codes
- **Signal Handling**: Gracefully handles SIGINT (Ctrl+C), SIGTERM, and SIGHUP
- **Clean Exit**: Ensures process.exit() is called after completion
- **Global Error Catching**: Handles uncaught exceptions and unhandled promise rejections
- **Customizable**: Configure logging, exit behavior, and callbacks

##### Signal Handling

The function automatically handles these signals for graceful shutdown:
- `SIGINT`: Interrupt signal (Ctrl+C)
- `SIGTERM`: Termination signal (used by process managers)
- `SIGHUP`: Hangup signal (terminal closed)

##### Examples

**Database Script with Cleanup**:
```typescript
import { runScript } from '@goatlab/node-utils'
import { connectDB, disconnectDB } from './database'

runScript(async () => {
  const db = await connectDB()
  
  try {
    await db.users.migrate()
    await db.posts.reindex()
    console.log('Database operations completed')
  } finally {
    // This cleanup runs even if script is interrupted
    await disconnectDB()
  }
})
```

**Custom Logger and Error Handling**:
```typescript
import { runScript } from '@goatlab/node-utils'
import { createLogger } from './logger'

const logger = createLogger()

runScript(async () => {
  await processData()
}, {
  logger,
  onError: (error) => {
    logger.error('Script failed:', error)
    // Send to monitoring service
    sendToSentry(error)
  },
  onExit: (code) => {
    logger.info(`Script exiting with code ${code}`)
    // Cleanup resources
    closeConnections()
  }
})
```

**Long-Running Process with Graceful Shutdown**:
```typescript
import { runScript } from '@goatlab/node-utils'

let server

runScript(async () => {
  server = await startServer()
  console.log('Server started on port 3000')
  
  // Keep the process running
  await new Promise(() => {})
}, {
  onExit: async (code) => {
    console.log('Shutting down server...')
    if (server) {
      await server.close()
    }
    console.log('Server stopped')
  }
})
```

**Testing Mode - Prevent Process Exit**:
```typescript
import { runScript } from '@goatlab/node-utils'

runScript(async () => {
  await runTests()
}, {
  noExit: true, // Useful for test runners like Jest
  onExit: (code) => {
    console.log(`Tests finished with code: ${code}`)
  }
})
```

##### Configuration Options

```typescript
interface RunScriptOptions {
  // Prevent process.exit() after completion (default: false)
  noExit?: boolean
  
  // Custom logger instance (default: console)
  logger?: CommonLogger
  
  // Callback when process is about to exit
  onExit?: (code: number) => void
  
  // Callback when an error occurs
  onError?: (error: unknown) => void
}
```

##### Why Use runScript?

Traditional Node.js scripts require boilerplate code:
```typescript
// Without runScript - verbose and error-prone
async function main() {
  try {
    await doWork()
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main().catch(console.error)

// Handle signals manually
process.on('SIGINT', () => {
  console.log('Interrupted')
  process.exit(0)
})
```

With runScript, all this is handled automatically:
```typescript
// With runScript - clean and robust
runScript(async () => {
  await doWork()
})
```

#### Advanced Command Execution

The `runCommand` function provides robust command execution with signal handling:

```typescript
import { Scripts } from '@goatlab/node-utils'

// Basic command execution
await Scripts.runCommand('npm install')

// Run in a specific directory
await Scripts.runCommand('pnpm build', { cwd: '/path/to/project' })

// Using workingDirectory alias for better readability
await Scripts.runCommand('yarn install', { workingDirectory: rootPath })

// Capture command output instead of displaying it
const output = await Scripts.runCommand('echo hello', { captureOutput: true })
console.log(output) // "hello"

// Run silently (no output shown)
await Scripts.runCommand('npm test', { silent: true })

// Handle errors
try {
  await Scripts.runCommand('npm test')
} catch (error) {
  console.error('Command failed:', error.message)
}

// Running multiple commands
await Scripts.runCommand('npm install && npm test', { cwd: './my-project' })
```

#### Signal Handling

`runCommand` properly handles system signals for graceful termination:

- **SIGINT** (Ctrl+C): Gracefully terminates the child process
- **SIGTERM**: Standard termination signal, handled gracefully  
- **SIGHUP**: Terminal hangup signal, handled gracefully

On Unix systems, it kills the entire process group. On Windows, it uses taskkill to terminate the process tree.

#### Command Options

```typescript
interface RunCommandOptions {
  // Working directory for the command. Defaults to process.cwd()
  cwd?: string
  
  // Alias for cwd, provides better readability
  workingDirectory?: string
  
  // If true, suppresses all command output
  silent?: boolean
  
  // If true, captures and returns stdout instead of displaying it
  captureOutput?: boolean
}
```

### Port Utilities

```typescript
import { Ports } from '@goatlab/node-utils'

// Find available port
const port = await Ports.findAvailable(3000)
console.log('Available port:', port)

// Find port in range
const portInRange = await Ports.findInRange(3000, 4000)

// Check if port is available
const isAvailable = await Ports.isAvailable(3000)

// Get random available port
const randomPort = await Ports.getRandom()
```

### IP Address Utilities

```typescript
import { Ips } from '@goatlab/node-utils'

// Get local IP address
const localIp = Ips.getLocal()
console.log('Local IP:', localIp)

// Get public IP address
const publicIp = await Ips.getPublic()
console.log('Public IP:', publicIp)

// Validate IP address
const isValid = Ips.isValid('192.168.1.1')
const isValidIPv6 = Ips.isValidIPv6('::1')

// Check if IP is private
const isPrivate = Ips.isPrivate('192.168.1.1')
const isPublic = Ips.isPublic('8.8.8.8')
```

### Secrets Management

```typescript
import { Secrets } from '@goatlab/node-utils'

// Generate random secret
const secret = Secrets.generate(32)

// Generate API key
const apiKey = Secrets.generateApiKey()

// Generate UUID
const uuid = Secrets.uuid()

// Generate random bytes
const randomBytes = Secrets.randomBytes(16)

// Generate random string
const randomString = Secrets.randomString(20)
```

### Object IDs

```typescript
import { ObjectIds } from '@goatlab/node-utils'

// Generate MongoDB-style ObjectId
const objectId = ObjectIds.generate()

// Validate ObjectId
const isValid = ObjectIds.isValid('507f1f77bcf86cd799439011')

// Convert to timestamp
const timestamp = ObjectIds.getTimestamp('507f1f77bcf86cd799439011')

// Generate with custom timestamp
const customId = ObjectIds.generateFromTime(new Date('2023-01-01'))
```

### Logging

```typescript
import { Log } from '@goatlab/node-utils'

// Configure logger
const logger = Log.create({
  level: 'info',
  format: 'json',
  transports: ['console', 'file']
})

// Log messages
logger.info('Application started')
logger.error('Something went wrong', { error: error.message })
logger.debug('Debug information', { data: someData })

// Structured logging
logger.info('User created', {
  userId: '123',
  email: 'user@example.com',
  timestamp: new Date().toISOString()
})
```

### Search Integration (Typesense)

```typescript
import { TypesenseService } from '@goatlab/node-utils'

// Initialize Typesense client
const typesense = new TypesenseService({
  apiKey: 'your-api-key',
  nodes: [{
    host: 'localhost',
    port: 8108,
    protocol: 'http'
  }]
})

// Create collection
await typesense.createCollection({
  name: 'users',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' }
  ]
})

// Index documents
await typesense.indexDocument('users', {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
})

// Search documents
const results = await typesense.search('users', {
  q: 'John',
  query_by: 'name,email'
})
```

## Advanced Usage

### Stream Processing Pipeline

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Process large CSV file
await Streams.pipeline([
  fs.createReadStream('./large-data.csv'),
  Streams.map(async (line) => {
    const data = parseCsvLine(line)
    return await processData(data)
  }),
  Streams.filter(item => item.isValid),
  Streams.buffer({ batchSize: 1000 }),
  Streams.map(async (batch) => {
    await saveBatchToDatabase(batch)
  }),
  Streams.logProgress({ interval: 10000, label: 'Processing records' }),
  Streams.closePipeline()
])
```

### Secure Configuration Management

```typescript
import { Security, Env } from '@goatlab/node-utils'

// Encrypt sensitive configuration
const config = {
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  jwtSecret: process.env.JWT_SECRET
}

const masterKey = Env.require('MASTER_KEY')
const encryptedConfig = Security.encryptObject(config, masterKey)

// Store encrypted config
fs.writeFileSync('./config.encrypted', JSON.stringify(encryptedConfig))

// Later, decrypt config
const encryptedData = JSON.parse(fs.readFileSync('./config.encrypted', 'utf8'))
const decryptedConfig = Security.decryptObject(encryptedData, masterKey)
```

### Microservice Health Checks

```typescript
import { Ports, Ips, Processes } from '@goatlab/node-utils'

class HealthChecker {
  async checkSystem() {
    const health = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      network: {
        localIp: Ips.getLocal(),
        publicIp: await Ips.getPublic()
      },
      ports: {
        main: await Ports.isAvailable(3000),
        metrics: await Ports.isAvailable(9090)
      }
    }
    
    return health
  }
}
```

## Error Handling

All utilities include proper error handling and TypeScript types:

```typescript
import { Jwt, Security } from '@goatlab/node-utils'

try {
  const token = await Jwt.generate(payload, options)
  const encrypted = Security.encryptString(data, key)
} catch (error) {
  if (error instanceof Error) {
    console.error('Operation failed:', error.message)
  }
}
```

## Performance Considerations

- Stream processing for large datasets
- Efficient memory usage with buffering
- Async/await patterns for I/O operations
- Optimized cryptographic operations
- Connection pooling for database operations

## Security Best Practices

- Use strong secrets and rotate them regularly
- Implement proper key management
- Use secure random number generation
- Validate all inputs
- Use HTTPS for all network communications
- Implement rate limiting and monitoring

## Contributing

The node-utils package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.