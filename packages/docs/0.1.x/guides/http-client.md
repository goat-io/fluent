# HTTP Client Patterns

This guide covers common HTTP client patterns using the `@goatlab/js-utils` HTTP utilities, built on top of the powerful `ky` library.

## Basic HTTP Client Usage

### Simple GET Request

```typescript
import { Http } from '@goatlab/js-utils'

// Get a configured HTTP client
const client = Http.getClient()

// Simple GET request
const response = await client.get('https://api.example.com/users')
const users = await response.json()
```

### POST Request with JSON

```typescript
const client = Http.getClient()

const newUser = {
  name: 'John Doe',
  email: 'john@example.com'
}

const response = await client.post('https://api.example.com/users', {
  json: newUser
})

const createdUser = await response.json()
```

### Request with Headers

```typescript
const client = Http.getClient({
  headers: {
    'Authorization': 'Bearer token123',
    'Content-Type': 'application/json'
  }
})

const response = await client.get('https://api.example.com/protected-data')
```

## Advanced Configuration

### Client with Custom Options

```typescript
const client = Http.getClient({
  timeout: 30000,
  retry: 3,
  headers: {
    'User-Agent': 'MyApp/1.0'
  },
  hooks: {
    beforeRequest: [
      (request) => {
        console.log('Making request to:', request.url)
      }
    ],
    afterResponse: [
      (request, options, response) => {
        console.log('Response status:', response.status)
      }
    ]
  }
})
```

### Request Interceptors

```typescript
const client = Http.getClient({
  hooks: {
    beforeRequest: [
      (request) => {
        // Add timestamp to all requests
        request.headers.set('X-Request-Time', Date.now().toString())
      }
    ],
    beforeError: [
      (error) => {
        // Log all errors
        console.error('HTTP Error:', error.message)
        return error
      }
    ]
  }
})
```

## Error Handling Patterns

### Basic Error Handling

```typescript
import { Http } from '@goatlab/js-utils'

const client = Http.getClient()

try {
  const response = await client.get('https://api.example.com/users')
  const users = await response.json()
  return users
} catch (error) {
  if (error.response) {
    console.error('HTTP Error:', error.response.status, error.response.statusText)
  } else {
    console.error('Network Error:', error.message)
  }
  throw error
}
```

### Retry with Backoff

```typescript
const client = Http.getClient({
  retry: {
    limit: 3,
    methods: ['get', 'post'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
    backoffLimit: 3000
  }
})
```

### Custom Error Handling

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

const client = Http.getClient({
  hooks: {
    beforeError: [
      (error) => {
        if (error.response) {
          throw new APIError(
            `API Error: ${error.response.statusText}`,
            error.response.status,
            error.response.body
          )
        }
        return error
      }
    ]
  }
})
```

## Authentication Patterns

### Bearer Token Authentication

```typescript
class AuthenticatedClient {
  private client: any
  private token: string | null = null
  
  constructor() {
    this.client = Http.getClient({
      hooks: {
        beforeRequest: [
          (request) => {
            if (this.token) {
              request.headers.set('Authorization', `Bearer ${this.token}`)
            }
          }
        ]
      }
    })
  }
  
  setToken(token: string) {
    this.token = token
  }
  
  async get(url: string) {
    return await this.client.get(url)
  }
  
  async post(url: string, data: any) {
    return await this.client.post(url, { json: data })
  }
}
```

### Automatic Token Refresh

```typescript
class TokenManager {
  private client: any
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private isRefreshing = false
  
  constructor() {
    this.client = Http.getClient({
      hooks: {
        beforeRequest: [
          (request) => {
            if (this.accessToken) {
              request.headers.set('Authorization', `Bearer ${this.accessToken}`)
            }
          }
        ],
        beforeError: [
          async (error) => {
            if (error.response?.status === 401 && !this.isRefreshing) {
              await this.refreshAccessToken()
              // Retry the original request
              return this.client(error.request)
            }
            return error
          }
        ]
      }
    })
  }
  
  private async refreshAccessToken() {
    if (!this.refreshToken || this.isRefreshing) return
    
    this.isRefreshing = true
    
    try {
      const response = await this.client.post('/auth/refresh', {
        json: { refreshToken: this.refreshToken }
      })
      
      const { accessToken, refreshToken } = await response.json()
      this.accessToken = accessToken
      this.refreshToken = refreshToken
    } catch (error) {
      // Refresh failed, redirect to login
      this.accessToken = null
      this.refreshToken = null
      window.location.href = '/login'
    } finally {
      this.isRefreshing = false
    }
  }
}
```

## Request/Response Transformation

### Request Transformation

```typescript
const client = Http.getClient({
  hooks: {
    beforeRequest: [
      (request) => {
        // Transform snake_case to camelCase
        if (request.body) {
          const transformed = transformKeys(request.body, camelCase)
          request.body = JSON.stringify(transformed)
        }
      }
    ]
  }
})
```

### Response Transformation

```typescript
const client = Http.getClient({
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        const json = await response.json()
        
        // Transform response data
        const transformed = transformKeys(json, camelCase)
        
        // Create new response with transformed data
        return new Response(JSON.stringify(transformed), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        })
      }
    ]
  }
})
```

## API Client Patterns

### REST API Client

```typescript
class RESTClient {
  private client: any
  private baseURL: string
  
  constructor(baseURL: string, options = {}) {
    this.baseURL = baseURL
    this.client = Http.getClient({
      prefixUrl: baseURL,
      ...options
    })
  }
  
  async get(endpoint: string, params?: any) {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint
    const response = await this.client.get(url)
    return await response.json()
  }
  
  async post(endpoint: string, data: any) {
    const response = await this.client.post(endpoint, { json: data })
    return await response.json()
  }
  
  async put(endpoint: string, data: any) {
    const response = await this.client.put(endpoint, { json: data })
    return await response.json()
  }
  
  async patch(endpoint: string, data: any) {
    const response = await this.client.patch(endpoint, { json: data })
    return await response.json()
  }
  
  async delete(endpoint: string) {
    const response = await this.client.delete(endpoint)
    return response.status === 204
  }
}

// Usage
const api = new RESTClient('https://api.example.com')

const users = await api.get('/users')
const user = await api.post('/users', { name: 'John', email: 'john@example.com' })
```

### Resource-Based API Client

```typescript
class ResourceClient {
  private client: any
  
  constructor(baseURL: string) {
    this.client = Http.getClient({
      prefixUrl: baseURL,
      timeout: 30000
    })
  }
  
  resource(name: string) {
    return {
      list: async (params?: any) => {
        const url = params ? `${name}?${new URLSearchParams(params)}` : name
        const response = await this.client.get(url)
        return await response.json()
      },
      
      get: async (id: string) => {
        const response = await this.client.get(`${name}/${id}`)
        return await response.json()
      },
      
      create: async (data: any) => {
        const response = await this.client.post(name, { json: data })
        return await response.json()
      },
      
      update: async (id: string, data: any) => {
        const response = await this.client.put(`${name}/${id}`, { json: data })
        return await response.json()
      },
      
      delete: async (id: string) => {
        const response = await this.client.delete(`${name}/${id}`)
        return response.status === 204
      }
    }
  }
}

// Usage
const client = new ResourceClient('https://api.example.com')

const users = client.resource('users')
const posts = client.resource('posts')

const userList = await users.list()
const user = await users.get('123')
const newPost = await posts.create({ title: 'Hello', content: 'World' })
```

## Caching Patterns

### Simple Response Caching

```typescript
class CachedClient {
  private client: any
  private cache = new Map<string, { data: any, timestamp: number }>()
  private cacheTTL = 5 * 60 * 1000 // 5 minutes
  
  constructor() {
    this.client = Http.getClient()
  }
  
  async get(url: string) {
    const cacheKey = url
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }
    
    const response = await this.client.get(url)
    const data = await response.json()
    
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
    
    return data
  }
}
```

### Cache with Invalidation

```typescript
class SmartCachedClient {
  private client: any
  private cache = new Map<string, any>()
  private cacheTags = new Map<string, Set<string>>()
  
  constructor() {
    this.client = Http.getClient()
  }
  
  async get(url: string, tags: string[] = []) {
    const cached = this.cache.get(url)
    if (cached) return cached
    
    const response = await this.client.get(url)
    const data = await response.json()
    
    this.cache.set(url, data)
    
    // Store cache tags
    tags.forEach(tag => {
      if (!this.cacheTags.has(tag)) {
        this.cacheTags.set(tag, new Set())
      }
      this.cacheTags.get(tag)!.add(url)
    })
    
    return data
  }
  
  async post(url: string, data: any, invalidateTags: string[] = []) {
    const response = await this.client.post(url, { json: data })
    const result = await response.json()
    
    // Invalidate cache by tags
    invalidateTags.forEach(tag => {
      const urls = this.cacheTags.get(tag)
      if (urls) {
        urls.forEach(url => this.cache.delete(url))
        this.cacheTags.delete(tag)
      }
    })
    
    return result
  }
}
```

## File Upload Patterns

### Simple File Upload

```typescript
const client = Http.getClient()

const uploadFile = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await client.post('https://api.example.com/upload', {
    body: formData
  })
  
  return await response.json()
}
```

### Upload with Progress

```typescript
const uploadWithProgress = async (file: File, onProgress: (progress: number) => void) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const client = Http.getClient({
    hooks: {
      beforeRequest: [
        (request) => {
          // Add upload progress tracking
          if (request.body instanceof FormData) {
            // Note: Progress tracking requires additional implementation
            // This is a simplified example
          }
        }
      ]
    }
  })
  
  const response = await client.post('https://api.example.com/upload', {
    body: formData
  })
  
  return await response.json()
}
```

## Polling Patterns

### Simple Polling

```typescript
class PollingClient {
  private client: any
  
  constructor() {
    this.client = Http.getClient()
  }
  
  async pollUntilComplete(url: string, maxAttempts = 10, intervalMs = 1000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.client.get(url)
      const data = await response.json()
      
      if (data.status === 'complete') {
        return data
      }
      
      if (data.status === 'failed') {
        throw new Error('Operation failed')
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
    
    throw new Error('Polling timeout')
  }
}
```

### Exponential Backoff Polling

```typescript
class BackoffPollingClient {
  private client: any
  
  constructor() {
    this.client = Http.getClient()
  }
  
  async pollWithBackoff(
    url: string,
    options: {
      maxAttempts?: number
      initialDelay?: number
      backoffFactor?: number
      maxDelay?: number
    } = {}
  ) {
    const {
      maxAttempts = 10,
      initialDelay = 1000,
      backoffFactor = 2,
      maxDelay = 30000
    } = options
    
    let delay = initialDelay
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.client.get(url)
      const data = await response.json()
      
      if (data.status === 'complete') {
        return data
      }
      
      if (data.status === 'failed') {
        throw new Error('Operation failed')
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
    
    throw new Error('Polling timeout')
  }
}
```

## Testing Patterns

### Mock HTTP Client

```typescript
class MockClient {
  private mocks = new Map<string, any>()
  
  mock(url: string, response: any) {
    this.mocks.set(url, response)
  }
  
  async get(url: string) {
    const mockResponse = this.mocks.get(url)
    if (mockResponse) {
      return { json: async () => mockResponse }
    }
    throw new Error(`No mock found for ${url}`)
  }
  
  async post(url: string, data: any) {
    const mockResponse = this.mocks.get(url)
    if (mockResponse) {
      return { json: async () => mockResponse }
    }
    throw new Error(`No mock found for ${url}`)
  }
}

// Usage in tests
const mockClient = new MockClient()
mockClient.mock('/users', [{ id: 1, name: 'John' }])

const users = await mockClient.get('/users')
```

### HTTP Client Factory

```typescript
class HttpClientFactory {
  static create(environment: 'development' | 'production' | 'test') {
    const baseConfig = {
      timeout: 30000,
      retry: 2
    }
    
    switch (environment) {
      case 'development':
        return Http.getClient({
          ...baseConfig,
          debug: true,
          logStart: true,
          logFinished: true
        })
      
      case 'production':
        return Http.getClient({
          ...baseConfig,
          debug: false
        })
      
      case 'test':
        return new MockClient()
      
      default:
        throw new Error(`Unknown environment: ${environment}`)
    }
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
// The underlying ky library handles connection pooling automatically
const client = Http.getClient({
  // Connection reuse is handled automatically
  timeout: 30000,
  retry: 2
})
```

### Request Batching

```typescript
class BatchClient {
  private client: any
  private batchQueue: Array<{ url: string, resolve: Function, reject: Function }> = []
  private batchTimeout: number = 100
  
  constructor() {
    this.client = Http.getClient()
  }
  
  async batchGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ url, resolve, reject })
      
      if (this.batchQueue.length === 1) {
        setTimeout(() => this.processBatch(), this.batchTimeout)
      }
    })
  }
  
  private async processBatch() {
    const batch = this.batchQueue.splice(0)
    const urls = batch.map(item => item.url)
    
    try {
      const response = await this.client.post('/batch', {
        json: { urls }
      })
      
      const results = await response.json()
      
      batch.forEach((item, index) => {
        item.resolve(results[index])
      })
    } catch (error) {
      batch.forEach(item => {
        item.reject(error)
      })
    }
  }
}
```

## Best Practices

1. **Use Appropriate Timeouts**: Set reasonable timeouts for different types of requests
2. **Implement Retry Logic**: Use exponential backoff for transient failures
3. **Handle Errors Gracefully**: Provide meaningful error messages
4. **Cache Responses**: Cache expensive or frequently accessed data
5. **Use Request Interceptors**: Add common headers and authentication
6. **Monitor Performance**: Track request times and error rates
7. **Test Edge Cases**: Test network failures, timeouts, and error responses

## Common Pitfalls

1. **Not Handling Network Errors**: Always wrap HTTP calls in try-catch blocks
2. **Blocking the Main Thread**: Use async/await properly
3. **Not Setting Timeouts**: Requests can hang indefinitely
4. **Ignoring Status Codes**: Check response status before processing
5. **Memory Leaks**: Clean up event listeners and cancel requests when needed

## Security Considerations

1. **Validate Input**: Sanitize data before sending requests
2. **Use HTTPS**: Always use secure connections for sensitive data
3. **Implement CSRF Protection**: Include CSRF tokens in requests
4. **Rate Limiting**: Implement client-side rate limiting
5. **Secure Headers**: Use appropriate security headers