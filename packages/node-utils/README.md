# @goatlab/node-utils

Node.js-specific utilities for common server-side tasks including JWT handling, security operations, stream processing, and environment management.

## Installation

```bash
npm install @goatlab/node-utils
# or
yarn add @goatlab/node-utils
# or
pnpm add @goatlab/node-utils
```

## Usage Examples

### JWT Operations
```typescript
import { Jwt } from '@goatlab/node-utils'

// Sign a token
const token = await Jwt.sign({ userId: '123' }, 'your-secret', { expiresIn: '1h' })

// Verify a token
const payload = await Jwt.verify(token, 'your-secret')
```

### Security & Encryption
```typescript
import { Security, Hashes } from '@goatlab/node-utils'

// Generate secure random strings
const password = Security.randomString(16)
const apiKey = Security.randomString(32, { includeSymbols: true })

// Encrypt/decrypt data
const encrypted = Security.encrypt('sensitive data', 'secret-key')
const decrypted = Security.decrypt(encrypted, 'secret-key')

// Generate RSA key pair
const { publicKey, privateKey } = Security.generateKeyPair()

// Hash passwords
const hash = await Hashes.hash('password123')
const isValid = await Hashes.verify('password123', hash)
```

### Stream Processing
```typescript
import { Streams } from '@goatlab/node-utils'

// Transform streams with pipeline
await Streams.pipeline(
  readableStream,
  Streams.map(async (item) => ({ ...item, processed: true })),
  Streams.filter((item) => item.valid),
  Streams.gzip(),
  Streams.toWriteStream('./output.gz')
)

// Parse NDJSON
await Streams.pipeline(
  fs.createReadStream('./data.ndjson'),
  Streams.parseJson(),
  Streams.logProgress('Processing'),
  writableStream
)
```

### Environment & Process Management
```typescript
import { Env, Processes } from '@goatlab/node-utils'

// Get environment info
const buildInfo = Env.getBuildInfo()
const isProduction = Env.isProduction()

// Execute shell commands
const result = await Processes.run('npm list')

// Find available port
import { Ports } from '@goatlab/node-utils'
const port = await Ports.findPort(3000)
const availablePort = await Ports.getAvailablePort()
```

### Scripts & Command Execution
```typescript
import { Scripts, runScript } from '@goatlab/node-utils'

// Run async scripts with automatic error handling
runScript(async () => {
  await doSomething()
  console.log('Script completed')
})

// Execute shell commands with signal handling
await Scripts.runCommand('npm build', { cwd: './packages/app' })

// Capture command output
const output = await Scripts.runCommand('git status', { 
  captureOutput: true,
  silent: true 
})
```

## Available Utilities

### Authentication & Security
- **Jwt** - JWT token signing and verification
- **Security** - Encryption, decryption, random string generation, RSA key pairs
- **Hashes** - Password hashing (bcrypt), MD5, SHA256 hashing
- **Secrets** - Generate secure random secrets

### Stream Processing
- **Streams** - Pipeline builder with transforms: map, filter, buffer, gzip, JSON parsing, progress logging

### System & Environment
- **Env** - Environment detection and build info
- **Processes** - Shell command execution
- **Ports** - Find available network ports
- **Folders** - Directory operations
- **Scripts** - Run Node.js scripts and shell commands programmatically

### Data & Utilities
- **ObjectIds** - BSON ObjectId generation and validation
- **Ips** - IP address utilities
- **Log** - Winston logger instance