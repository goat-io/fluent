# Security Patterns Guide

This guide covers security patterns and best practices using the `@goatlab/node-utils` security utilities, including JWT handling, encryption, hashing, and secure data management.

## JWT Security Patterns

### Basic JWT Implementation

```typescript
import { Jwt } from '@goatlab/node-utils'

const jwtSecret = process.env.JWT_SECRET || 'your-secure-secret-key'

// Generate JWT token
const generateToken = async (user: any) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  }
  
  return await Jwt.generate(payload, {
    secret: jwtSecret,
    expiresIn: '24h',
    algorithm: 'HS256'
  })
}

// Verify JWT token
const verifyToken = async (token: string) => {
  try {
    const decoded = await Jwt.verify(token, jwtSecret)
    return decoded
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}
```

### Token Refresh Pattern

```typescript
import { Jwt } from '@goatlab/node-utils'

class TokenManager {
  private accessTokenSecret: string
  private refreshTokenSecret: string
  
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!
  }
  
  async generateTokenPair(user: any) {
    const accessToken = await Jwt.generate(
      { userId: user.id, email: user.email, role: user.role },
      {
        secret: this.accessTokenSecret,
        expiresIn: '15m',
        algorithm: 'HS256'
      }
    )
    
    const refreshToken = await Jwt.generate(
      { userId: user.id, tokenType: 'refresh' },
      {
        secret: this.refreshTokenSecret,
        expiresIn: '7d',
        algorithm: 'HS256'
      }
    )
    
    return { accessToken, refreshToken }
  }
  
  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = await Jwt.verify(refreshToken, this.refreshTokenSecret)
      
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid refresh token')
      }
      
      // Get user from database
      const user = await this.getUserById(decoded.userId)
      if (!user) {
        throw new Error('User not found')
      }
      
      // Generate new access token
      const accessToken = await Jwt.generate(
        { userId: user.id, email: user.email, role: user.role },
        {
          secret: this.accessTokenSecret,
          expiresIn: '15m',
          algorithm: 'HS256'
        }
      )
      
      return accessToken
    } catch (error) {
      throw new Error('Invalid refresh token')
    }
  }
  
  private async getUserById(userId: string) {
    // Implement user lookup
    return await database.users.findById(userId)
  }
}
```

### JWT Middleware

```typescript
import { Jwt } from '@goatlab/node-utils'

const jwtMiddleware = (requiredRole?: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' })
      }
      
      const token = authHeader.split(' ')[1]
      if (!token) {
        return res.status(401).json({ error: 'No token provided' })
      }
      
      const decoded = await Jwt.verify(token, process.env.JWT_SECRET!)
      
      // Check token expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return res.status(401).json({ error: 'Token expired' })
      }
      
      // Check required role
      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      
      req.user = decoded
      next()
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

// Usage
app.get('/protected', jwtMiddleware(), (req, res) => {
  res.json({ message: 'Protected route', user: req.user })
})

app.get('/admin', jwtMiddleware('admin'), (req, res) => {
  res.json({ message: 'Admin only route' })
})
```

## Encryption and Decryption

### Symmetric Encryption

```typescript
import { Security } from '@goatlab/node-utils'

const secretKey = process.env.ENCRYPTION_SECRET || 'your-secret-key'

// Encrypt sensitive data
const encryptSensitiveData = (data: any) => {
  const jsonData = JSON.stringify(data)
  return Security.encryptString(jsonData, secretKey)
}

// Decrypt sensitive data
const decryptSensitiveData = (encryptedData: string) => {
  const decryptedJson = Security.decryptString(encryptedData, secretKey)
  return JSON.parse(decryptedJson)
}

// Example usage
const sensitiveInfo = {
  creditCard: '1234-5678-9012-3456',
  ssn: '123-45-6789',
  bankAccount: '987654321'
}

const encrypted = encryptSensitiveData(sensitiveInfo)
console.log('Encrypted:', encrypted)

const decrypted = decryptSensitiveData(encrypted)
console.log('Decrypted:', decrypted)
```

### Object Encryption

```typescript
import { Security } from '@goatlab/node-utils'

class SecureDataManager {
  private secretKey: string
  
  constructor() {
    this.secretKey = process.env.ENCRYPTION_SECRET!
  }
  
  encryptObject(obj: Record<string, string>) {
    return Security.encryptObject(obj, this.secretKey)
  }
  
  decryptObject(encryptedObj: Record<string, string>) {
    return Security.decryptObject(encryptedObj, this.secretKey)
  }
  
  async storeSecureData(userId: string, data: Record<string, string>) {
    const encryptedData = this.encryptObject(data)
    
    // Store in database
    await database.secureData.create({
      userId,
      data: encryptedData,
      createdAt: new Date()
    })
  }
  
  async retrieveSecureData(userId: string) {
    const record = await database.secureData.findOne({ userId })
    if (!record) return null
    
    return this.decryptObject(record.data)
  }
}
```

### Buffer Encryption with Random IV

```typescript
import { Security } from '@goatlab/node-utils'

// For non-deterministic encryption (more secure)
const encryptFileContent = (content: Buffer) => {
  const secretKey = Buffer.from(process.env.FILE_ENCRYPTION_KEY!, 'base64')
  const secretKeyBase64 = secretKey.toString('base64')
  
  return Security.encryptRandomIVBuffer(content, secretKeyBase64)
}

const decryptFileContent = (encryptedContent: Buffer) => {
  const secretKey = Buffer.from(process.env.FILE_ENCRYPTION_KEY!, 'base64')
  const secretKeyBase64 = secretKey.toString('base64')
  
  return Security.decryptRandomIVBuffer(encryptedContent, secretKeyBase64)
}

// Example: Encrypt file before saving
const saveSecureFile = async (filePath: string, content: Buffer) => {
  const encryptedContent = encryptFileContent(content)
  await fs.promises.writeFile(filePath, encryptedContent)
}

const loadSecureFile = async (filePath: string) => {
  const encryptedContent = await fs.promises.readFile(filePath)
  return decryptFileContent(encryptedContent)
}
```

## Password Security

### Password Hashing

```typescript
import { Hashes } from '@goatlab/node-utils'

class PasswordManager {
  // Hash password for storage
  async hashPassword(password: string) {
    const saltRounds = 12 // Adjust based on security requirements
    return await Hashes.saltHash(password, saltRounds)
  }
  
  // Verify password
  async verifyPassword(password: string, hashedPassword: string) {
    return await Hashes.saltCompare(password, hashedPassword)
  }
  
  // Generate secure random password
  generateSecurePassword(length: number = 16) {
    return Security.generatePassword(length)
  }
  
  // Password strength validation
  validatePasswordStrength(password: string) {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
    
    const issues = []
    
    if (password.length < minLength) {
      issues.push(`Password must be at least ${minLength} characters long`)
    }
    
    if (!hasUpperCase) {
      issues.push('Password must contain at least one uppercase letter')
    }
    
    if (!hasLowerCase) {
      issues.push('Password must contain at least one lowercase letter')
    }
    
    if (!hasNumbers) {
      issues.push('Password must contain at least one number')
    }
    
    if (!hasSpecialChar) {
      issues.push('Password must contain at least one special character')
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }
}
```

### User Authentication System

```typescript
import { Hashes, Jwt } from '@goatlab/node-utils'

class AuthenticationService {
  private passwordManager: PasswordManager
  private tokenManager: TokenManager
  
  constructor() {
    this.passwordManager = new PasswordManager()
    this.tokenManager = new TokenManager()
  }
  
  async register(userData: {
    email: string
    password: string
    name: string
  }) {
    // Validate password strength
    const passwordValidation = this.passwordManager.validatePasswordStrength(userData.password)
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.issues.join(', ')}`)
    }
    
    // Check if user already exists
    const existingUser = await database.users.findOne({ email: userData.email })
    if (existingUser) {
      throw new Error('User already exists')
    }
    
    // Hash password
    const hashedPassword = await this.passwordManager.hashPassword(userData.password)
    
    // Create user
    const user = await database.users.create({
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      createdAt: new Date()
    })
    
    // Generate tokens
    const { accessToken, refreshToken } = await this.tokenManager.generateTokenPair(user)
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      accessToken,
      refreshToken
    }
  }
  
  async login(email: string, password: string) {
    // Find user
    const user = await database.users.findOne({ email })
    if (!user) {
      throw new Error('Invalid credentials')
    }
    
    // Verify password
    const isValidPassword = await this.passwordManager.verifyPassword(password, user.password)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await this.tokenManager.generateTokenPair(user)
    
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      accessToken,
      refreshToken
    }
  }
  
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await database.users.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }
    
    // Verify current password
    const isValidPassword = await this.passwordManager.verifyPassword(currentPassword, user.password)
    if (!isValidPassword) {
      throw new Error('Current password is incorrect')
    }
    
    // Validate new password
    const passwordValidation = this.passwordManager.validatePasswordStrength(newPassword)
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.issues.join(', ')}`)
    }
    
    // Hash new password
    const hashedNewPassword = await this.passwordManager.hashPassword(newPassword)
    
    // Update user
    await database.users.updateById(userId, {
      password: hashedNewPassword,
      updatedAt: new Date()
    })
    
    return { success: true }
  }
}
```

## Digital Signatures

### Elliptic Curve Digital Signatures

```typescript
import { Security } from '@goatlab/node-utils'

class DigitalSignatureService {
  private keyPair: any
  
  async initialize() {
    this.keyPair = await Security.generateElipticCurve()
  }
  
  // Sign data
  signData(data: string) {
    return Security.encryptStringWithElliptic(data, this.keyPair.privateKey)
  }
  
  // Verify signature
  verifySignature(data: string, signature: string, publicKey?: string) {
    const keyToUse = publicKey || this.keyPair.publicKey
    return Security.verifySignedStringWithElliptic(data, signature, keyToUse)
  }
  
  // Sign API request
  signAPIRequest(payload: any, timestamp: number) {
    const dataToSign = JSON.stringify(payload) + timestamp
    return this.signData(dataToSign)
  }
  
  // Verify API request
  verifyAPIRequest(payload: any, timestamp: number, signature: string, publicKey: string) {
    const dataToVerify = JSON.stringify(payload) + timestamp
    return this.verifySignature(dataToVerify, signature, publicKey)
  }
}
```

### API Request Signing

```typescript
import { Security } from '@goatlab/node-utils'

class APISecurityManager {
  private signatureService: DigitalSignatureService
  
  constructor() {
    this.signatureService = new DigitalSignatureService()
  }
  
  async signRequest(method: string, url: string, body: any, timestamp: number) {
    const requestData = {
      method,
      url,
      body,
      timestamp
    }
    
    const signature = this.signatureService.signAPIRequest(requestData, timestamp)
    
    return {
      ...requestData,
      signature
    }
  }
  
  async verifyRequest(signedRequest: any, publicKey: string) {
    const { signature, timestamp, ...requestData } = signedRequest
    
    // Check timestamp (prevent replay attacks)
    const now = Date.now()
    const requestTime = timestamp * 1000
    const timeDiff = Math.abs(now - requestTime)
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      throw new Error('Request timestamp is too old')
    }
    
    // Verify signature
    const isValid = this.signatureService.verifyAPIRequest(
      requestData,
      timestamp,
      signature,
      publicKey
    )
    
    if (!isValid) {
      throw new Error('Invalid request signature')
    }
    
    return true
  }
}
```

## Secure Configuration Management

### Environment Variable Encryption

```typescript
import { Security } from '@goatlab/node-utils'

class SecureConfig {
  private masterKey: string
  
  constructor() {
    this.masterKey = process.env.MASTER_KEY!
  }
  
  // Encrypt configuration
  encryptConfig(config: Record<string, string>) {
    return Security.encryptObject(config, this.masterKey)
  }
  
  // Decrypt configuration
  decryptConfig(encryptedConfig: Record<string, string>) {
    return Security.decryptObject(encryptedConfig, this.masterKey)
  }
  
  // Load secure configuration
  loadSecureConfig(configPath: string) {
    const encryptedConfig = require(configPath)
    return this.decryptConfig(encryptedConfig)
  }
  
  // Save secure configuration
  async saveSecureConfig(config: Record<string, string>, configPath: string) {
    const encryptedConfig = this.encryptConfig(config)
    await fs.promises.writeFile(configPath, JSON.stringify(encryptedConfig, null, 2))
  }
}

// Usage
const secureConfig = new SecureConfig()

// Original config
const config = {
  DATABASE_URL: 'mongodb://localhost:27017/myapp',
  JWT_SECRET: 'my-secret-key',
  API_KEY: 'sk-1234567890'
}

// Encrypt and save
await secureConfig.saveSecureConfig(config, './config.encrypted.json')

// Load and decrypt
const loadedConfig = secureConfig.loadSecureConfig('./config.encrypted.json')
```

## Session Management

### Secure Session Storage

```typescript
import { Security } from '@goatlab/node-utils'

class SessionManager {
  private sessionStore = new Map<string, any>()
  private encryptionKey: string
  
  constructor() {
    this.encryptionKey = process.env.SESSION_ENCRYPTION_KEY!
  }
  
  // Create session
  async createSession(userId: string, sessionData: any) {
    const sessionId = this.generateSessionId()
    
    const session = {
      userId,
      data: sessionData,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }
    
    // Encrypt session data
    const encryptedSession = Security.encryptString(
      JSON.stringify(session),
      this.encryptionKey
    )
    
    this.sessionStore.set(sessionId, encryptedSession)
    
    return sessionId
  }
  
  // Get session
  async getSession(sessionId: string) {
    const encryptedSession = this.sessionStore.get(sessionId)
    if (!encryptedSession) {
      return null
    }
    
    try {
      const sessionJson = Security.decryptString(encryptedSession, this.encryptionKey)
      const session = JSON.parse(sessionJson)
      
      // Check expiration
      if (new Date() > new Date(session.expiresAt)) {
        this.sessionStore.delete(sessionId)
        return null
      }
      
      return session
    } catch (error) {
      // Invalid session data
      this.sessionStore.delete(sessionId)
      return null
    }
  }
  
  // Update session
  async updateSession(sessionId: string, newData: any) {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }
    
    session.data = { ...session.data, ...newData }
    session.updatedAt = new Date()
    
    const encryptedSession = Security.encryptString(
      JSON.stringify(session),
      this.encryptionKey
    )
    
    this.sessionStore.set(sessionId, encryptedSession)
  }
  
  // Delete session
  async deleteSession(sessionId: string) {
    this.sessionStore.delete(sessionId)
  }
  
  // Generate secure session ID
  private generateSessionId() {
    return Security.generatePassword(32)
  }
  
  // Clean expired sessions
  cleanupExpiredSessions() {
    const now = new Date()
    
    for (const [sessionId, encryptedSession] of this.sessionStore.entries()) {
      try {
        const sessionJson = Security.decryptString(encryptedSession, this.encryptionKey)
        const session = JSON.parse(sessionJson)
        
        if (now > new Date(session.expiresAt)) {
          this.sessionStore.delete(sessionId)
        }
      } catch (error) {
        // Invalid session, remove it
        this.sessionStore.delete(sessionId)
      }
    }
  }
}
```

## Data Sanitization

### Input Validation and Sanitization

```typescript
import { Hashes } from '@goatlab/node-utils'

class DataSanitizer {
  // Sanitize string input
  sanitizeString(input: string, options: {
    maxLength?: number
    allowedChars?: RegExp
    trim?: boolean
  } = {}) {
    const { maxLength = 1000, allowedChars, trim = true } = options
    
    let sanitized = input
    
    if (trim) {
      sanitized = sanitized.trim()
    }
    
    if (maxLength) {
      sanitized = sanitized.substring(0, maxLength)
    }
    
    if (allowedChars) {
      sanitized = sanitized.replace(allowedChars, '')
    }
    
    return sanitized
  }
  
  // Sanitize email
  sanitizeEmail(email: string) {
    const sanitized = this.sanitizeString(email, {
      maxLength: 254,
      allowedChars: /[^a-zA-Z0-9@._-]/g,
      trim: true
    }).toLowerCase()
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitized)) {
      throw new Error('Invalid email format')
    }
    
    return sanitized
  }
  
  // Sanitize phone number
  sanitizePhoneNumber(phone: string) {
    // Remove all non-numeric characters
    const sanitized = phone.replace(/\D/g, '')
    
    // Validate length
    if (sanitized.length < 10 || sanitized.length > 15) {
      throw new Error('Invalid phone number length')
    }
    
    return sanitized
  }
  
  // Sanitize object (recursive)
  sanitizeObject(obj: any, schema: any): any {
    const sanitized: any = {}
    
    for (const key in schema) {
      if (obj[key] !== undefined) {
        const fieldSchema = schema[key]
        
        switch (fieldSchema.type) {
          case 'string':
            sanitized[key] = this.sanitizeString(obj[key], fieldSchema.options)
            break
          case 'email':
            sanitized[key] = this.sanitizeEmail(obj[key])
            break
          case 'phone':
            sanitized[key] = this.sanitizePhoneNumber(obj[key])
            break
          case 'number':
            sanitized[key] = parseFloat(obj[key])
            if (isNaN(sanitized[key])) {
              throw new Error(`Invalid number for field ${key}`)
            }
            break
          case 'boolean':
            sanitized[key] = Boolean(obj[key])
            break
          case 'object':
            sanitized[key] = this.sanitizeObject(obj[key], fieldSchema.schema)
            break
          case 'array':
            if (Array.isArray(obj[key])) {
              sanitized[key] = obj[key].map((item: any) => 
                this.sanitizeObject(item, fieldSchema.itemSchema)
              )
            } else {
              throw new Error(`Field ${key} must be an array`)
            }
            break
        }
      } else if (fieldSchema.required) {
        throw new Error(`Required field ${key} is missing`)
      }
    }
    
    return sanitized
  }
}

// Usage example
const sanitizer = new DataSanitizer()

const userSchema = {
  name: {
    type: 'string',
    required: true,
    options: { maxLength: 100, allowedChars: /[^a-zA-Z\s]/g }
  },
  email: {
    type: 'email',
    required: true
  },
  phone: {
    type: 'phone',
    required: false
  },
  age: {
    type: 'number',
    required: true
  }
}

const userData = {
  name: '  John Doe123  ',
  email: 'JOHN.DOE@EXAMPLE.COM',
  phone: '+1 (555) 123-4567',
  age: '30'
}

const sanitizedUser = sanitizer.sanitizeObject(userData, userSchema)
```

## Rate Limiting and Security

### Rate Limiting Implementation

```typescript
import { Cache } from '@goatlab/node-backend'

class RateLimiter {
  private cache: Cache<any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: { namespace: 'rate-limit' }
    })
  }
  
  async checkLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ) {
    const key = `${identifier}:${Math.floor(Date.now() / windowMs)}`
    
    const current = await this.cache.get(key) || 0
    
    if (current >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.ceil(Date.now() / windowMs) * windowMs
      }
    }
    
    await this.cache.set(key, current + 1, windowMs)
    
    return {
      allowed: true,
      remaining: maxRequests - current - 1,
      resetTime: Math.ceil(Date.now() / windowMs) * windowMs
    }
  }
  
  // Sliding window rate limiter
  async checkSlidingWindow(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ) {
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Get all requests in the window
    const requests = await this.cache.get(`sliding:${identifier}`) || []
    
    // Filter out old requests
    const validRequests = requests.filter((timestamp: number) => timestamp > windowStart)
    
    if (validRequests.length >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: validRequests[0] + windowMs
      }
    }
    
    // Add current request
    validRequests.push(now)
    
    // Store updated requests
    await this.cache.set(`sliding:${identifier}`, validRequests, windowMs)
    
    return {
      allowed: true,
      remaining: maxRequests - validRequests.length,
      resetTime: now + windowMs
    }
  }
}
```

## Security Best Practices

### Security Headers Middleware

```typescript
const securityHeaders = (req: any, res: any, next: any) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  )
  
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  
  // HTTPS only
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  next()
}
```

### Input Validation Middleware

```typescript
const validateInput = (schema: any) => {
  return (req: any, res: any, next: any) => {
    try {
      const sanitizer = new DataSanitizer()
      
      // Validate and sanitize request body
      if (req.body && Object.keys(req.body).length > 0) {
        req.body = sanitizer.sanitizeObject(req.body, schema.body || {})
      }
      
      // Validate and sanitize query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        req.query = sanitizer.sanitizeObject(req.query, schema.query || {})
      }
      
      next()
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  }
}
```

## Security Monitoring

### Security Event Logging

```typescript
class SecurityLogger {
  private logger: any
  
  constructor() {
    this.logger = require('winston').createLogger({
      level: 'info',
      format: require('winston').format.json(),
      transports: [
        new require('winston').transports.File({ filename: 'security.log' })
      ]
    })
  }
  
  logLoginAttempt(email: string, success: boolean, ip: string) {
    this.logger.info('Login attempt', {
      email,
      success,
      ip,
      timestamp: new Date().toISOString(),
      event: 'login_attempt'
    })
  }
  
  logPasswordChange(userId: string, ip: string) {
    this.logger.info('Password change', {
      userId,
      ip,
      timestamp: new Date().toISOString(),
      event: 'password_change'
    })
  }
  
  logSuspiciousActivity(description: string, userId?: string, ip?: string) {
    this.logger.warn('Suspicious activity', {
      description,
      userId,
      ip,
      timestamp: new Date().toISOString(),
      event: 'suspicious_activity'
    })
  }
  
  logSecurityViolation(violation: string, userId?: string, ip?: string) {
    this.logger.error('Security violation', {
      violation,
      userId,
      ip,
      timestamp: new Date().toISOString(),
      event: 'security_violation'
    })
  }
}
```

## Common Security Pitfalls

1. **Weak JWT Secrets**: Always use strong, randomly generated secrets
2. **Insufficient Input Validation**: Always validate and sanitize user input
3. **Missing Rate Limiting**: Implement rate limiting to prevent abuse
4. **Inadequate Error Handling**: Don't expose sensitive information in error messages
5. **Weak Password Policies**: Enforce strong password requirements
6. **Missing Security Headers**: Always include appropriate security headers
7. **Improper Session Management**: Use secure session storage and management
8. **Insufficient Logging**: Log security events for monitoring and analysis

## Security Checklist

- [ ] Use HTTPS for all communications
- [ ] Implement proper authentication and authorization
- [ ] Validate and sanitize all user inputs
- [ ] Use strong encryption for sensitive data
- [ ] Implement rate limiting
- [ ] Add security headers
- [ ] Log security events
- [ ] Regularly update dependencies
- [ ] Use environment variables for secrets
- [ ] Implement proper error handling
- [ ] Use secure session management
- [ ] Implement CSRF protection
- [ ] Use parameterized queries to prevent SQL injection
- [ ] Implement proper access controls

This comprehensive guide covers essential security patterns and best practices for building secure applications using the Goat Fluent utilities.