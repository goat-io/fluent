# Secret Services

This directory contains two secret management services:

## SecretService

The base service for loading secrets from various providers (FILE, ENV, VAULT, GCP).

Features:
- Multiple provider support
- TTL-based caching
- Async and sync methods
- Encryption support for file-based secrets

## PreloadedSecretService

An extension of SecretService that adds preloading capabilities for improved performance and safety.

### Key Features

1. **Preloading**: Load all secrets at application startup
2. **Immutability**: Secrets are deep-frozen to prevent accidental modification
3. **Synchronous Access**: Fast, synchronous methods after preload
4. **Metadata Tracking**: Track when and how secrets were loaded
5. **Backward Compatible**: Falls back to parent methods when not preloaded

### Usage Example

```typescript
import { PreloadedSecretService } from './preloaded-secret.service'

// Define your secrets structure
interface AppSecrets {
  API_KEY: string
  DATABASE_URL: string
  JWT_SECRET: string
}

// Initialize service
const secretService = new PreloadedSecretService<AppSecrets>({
  provider: 'FILE',
  location: './secrets/production.enc.json',
  encryptionKey: process.env.ENCRYPTION_KEY!
})

// Preload at startup
await secretService.preload()

// Use synchronous methods for fast access
const apiKey = secretService.getSecretSync('API_KEY')
const dbUrl = secretService.getSecretSync('DATABASE_URL')
```

### When to Use PreloadedSecretService

Use PreloadedSecretService when you:
- Need fast, synchronous access to secrets
- Want to fail fast at startup if secrets are unavailable
- Need immutable secrets to prevent accidental modification
- Have a known set of secrets that won't change during runtime

Use the base SecretService when you:
- Need dynamic secret loading
- Want lazy loading of secrets
- Have secrets that may change during runtime
- Need to minimize memory usage

See `preloaded-secret.example.ts` for more detailed examples.