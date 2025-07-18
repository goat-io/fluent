# Security Best Practices

This comprehensive guide covers security best practices for production deployment of Fluent applications.

## Overview

Security is paramount in production environments. This guide provides essential security configurations, best practices, and monitoring strategies to protect your Fluent applications.

## Authentication & Authorization

### 1. JWT Configuration

```typescript
// JWT Security Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET, // Use strong, randomly generated secret
  expiresIn: '24h',
  issuer: 'your-app-name',
  audience: 'your-app-users',
  algorithm: 'HS256',
  
  // Additional security options
  clockTolerance: 5, // 5 seconds
  ignoreExpiration: false,
  ignoreNotBefore: false,
  
  // Secure cookie options
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  }
};

// JWT Middleware with security enhancements
export const jwtMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      clockTolerance: jwtConfig.clockTolerance
    });
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 2. Password Security

```typescript
import bcrypt from 'bcryptjs';
import zxcvbn from 'zxcvbn';

export class PasswordSecurity {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_STRENGTH = 3;
  
  static async hashPassword(password: string): Promise<string> {
    // Validate password strength
    const strength = zxcvbn(password);
    if (strength.score < this.MIN_STRENGTH) {
      throw new Error('Password too weak. Please use a stronger password.');
    }
    
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }
  
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  static validatePasswordPolicy(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 3. Multi-Factor Authentication (MFA)

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class MFAService {
  static generateSecret(userEmail: string): {
    secret: string;
    qrCodeUrl: string;
  } {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: 'Your App Name',
      length: 32
    });
    
    const qrCodeUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: userEmail,
      issuer: 'Your App Name',
      encoding: 'base32'
    });
    
    return {
      secret: secret.base32,
      qrCodeUrl
    };
  }
  
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }
  
  static verifyToken(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after
    });
  }
}
```

## Input Validation & Sanitization

### 1. Request Validation

```typescript
import Joi from 'joi';
import DOMPurify from 'isomorphic-dompurify';

// Validation schemas
export const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
});

export const postSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  content: Joi.string().min(10).max(5000).required(),
  tags: Joi.array().items(Joi.string().max(30)).max(10).optional(),
  status: Joi.string().valid('draft', 'published').required()
});

// Validation middleware
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    req.body = value;
    next();
  };
};

// HTML sanitization
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_SCHEMES: ['http', 'https', 'mailto']
  });
};
```

### 2. SQL Injection Prevention

```typescript
// Always use parameterized queries
export class SecureQuery {
  static async findUser(connector: BaseConnector, email: string): Promise<User | null> {
    // Good: Using parameterized query
    const result = await connector.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return result[0] || null;
  }
  
  static async searchPosts(
    connector: BaseConnector,
    search: string,
    limit: number = 10
  ): Promise<Post[]> {
    // Good: Using parameterized query with LIKE
    const result = await connector.query(
      'SELECT * FROM posts WHERE title ILIKE $1 OR content ILIKE $1 LIMIT $2',
      [`%${search}%`, limit]
    );
    
    return result;
  }
}
```

## HTTPS & TLS Configuration

### 1. SSL Certificate Setup

```bash
# Generate self-signed certificate for testing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Production: Use Let's Encrypt with Certbot
certbot certonly --webroot -w /var/www/html -d yourdomain.com

# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Other security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CSP header
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';" always;
}
```

### 2. Application HTTPS Configuration

```typescript
import https from 'https';
import fs from 'fs';

// HTTPS server configuration
const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || 'key.pem'),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || 'cert.pem'),
  
  // Security options
  secureProtocol: 'TLSv1_2_method',
  ciphers: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  honorCipherOrder: true,
  
  // Client certificate validation (optional)
  requestCert: false,
  rejectUnauthorized: true
};

// Force HTTPS middleware
export const forceHTTPS = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};
```

## Rate Limiting & DDoS Protection

### 1. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  
  // Custom key generator for user-based limiting
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true
});

// Progressive delay for repeated requests
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // allow 2 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 5000 // maximum delay of 5 seconds
});

// File upload rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many file uploads'
});
```

### 2. CORS Configuration

```typescript
import cors from 'cors';

export const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count']
};
```

## File Upload Security

### 1. File Validation

```typescript
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// File type validation
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    // Generate secure random filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'));
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.txt'];
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(extension)) {
    return cb(new Error('Invalid file extension'));
  }
  
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Maximum 5 files
  }
});

// File scanning middleware
export const scanFile = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return next();
  
  try {
    // Scan file with antivirus (e.g., ClamAV)
    const isClean = await scanFileWithAntivirus(req.file.path);
    
    if (!isClean) {
      // Delete infected file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'File contains malware' });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

async function scanFileWithAntivirus(filePath: string): Promise<boolean> {
  // Implement antivirus scanning logic
  // This is a placeholder - integrate with actual antivirus solution
  return true;
}
```

### 2. File Storage Security

```typescript
import AWS from 'aws-sdk';

// Secure S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4'
});

export class SecureFileStorage {
  static async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
    const key = `uploads/${userId}/${Date.now()}-${file.filename}`;
    
    const params = {
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      
      // Security settings
      ServerSideEncryption: 'AES256',
      ACL: 'private',
      
      // Metadata
      Metadata: {
        userId,
        uploadDate: new Date().toISOString(),
        originalName: file.originalname
      }
    };
    
    const result = await s3.upload(params).promise();
    return result.Location;
  }
  
  static async getSignedUrl(key: string, userId: string): Promise<string> {
    // Verify user has access to file
    const isAuthorized = await this.verifyFileAccess(key, userId);
    if (!isAuthorized) {
      throw new Error('Unauthorized access to file');
    }
    
    return s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Expires: 60 * 5 // 5 minutes
    });
  }
  
  private static async verifyFileAccess(key: string, userId: string): Promise<boolean> {
    // Check if user has access to this file
    return key.startsWith(`uploads/${userId}/`);
  }
}
```

## Database Security

### 1. Connection Security

```typescript
// Database connection with security
export const createSecureConnection = () => {
  return new TypeOrmConnector({
    // ... other options
    
    // SSL configuration
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(process.env.DB_SSL_CA!),
      cert: fs.readFileSync(process.env.DB_SSL_CERT!),
      key: fs.readFileSync(process.env.DB_SSL_KEY!)
    },
    
    // Logging - disable in production
    logging: process.env.NODE_ENV === 'development' ? 'all' : false,
    
    // Connection pooling with security
    extra: {
      // Connection limits
      max: 20,
      min: 5,
      
      // Timeout settings
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      
      // Security options
      statement_timeout: 30000,
      query_timeout: 30000,
      
      // Disable dangerous functions
      application_name: 'fluent-app',
      
      // Connection parameters
      sslmode: 'require',
      sslcert: process.env.DB_SSL_CERT,
      sslkey: process.env.DB_SSL_KEY,
      sslrootcert: process.env.DB_SSL_CA
    }
  });
};
```

### 2. Database User Permissions

```sql
-- Create application user with limited permissions
CREATE USER fluent_app WITH PASSWORD 'secure_password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE fluent_prod TO fluent_app;
GRANT USAGE ON SCHEMA public TO fluent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fluent_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fluent_app;

-- Revoke dangerous permissions
REVOKE ALL ON SCHEMA information_schema FROM fluent_app;
REVOKE ALL ON SCHEMA pg_catalog FROM fluent_app;
REVOKE CREATE ON SCHEMA public FROM fluent_app;

-- Create read-only user for reporting
CREATE USER fluent_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE fluent_prod TO fluent_readonly;
GRANT USAGE ON SCHEMA public TO fluent_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fluent_readonly;
```

## Security Monitoring

### 1. Security Event Logging

```typescript
import winston from 'winston';

// Security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

export class SecurityMonitor {
  static logAuthAttempt(email: string, ip: string, success: boolean): void {
    securityLogger.info('Authentication attempt', {
      event: 'auth_attempt',
      email,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  }
  
  static logSuspiciousActivity(userId: string, activity: string, details: any): void {
    securityLogger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  }
  
  static logSecurityViolation(violation: string, details: any): void {
    securityLogger.error('Security violation', {
      event: 'security_violation',
      violation,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

// Security monitoring middleware
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Log all requests
  securityLogger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|update|delete|drop|create|alter)\b/i,
    /<script.*?>.*?<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];
  
  const requestData = JSON.stringify(req.body);
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));
  
  if (isSuspicious) {
    SecurityMonitor.logSuspiciousActivity(req.user?.id || 'anonymous', 'suspicious_request', {
      url: req.url,
      body: req.body,
      ip: req.ip
    });
  }
  
  next();
};
```

### 2. Intrusion Detection

```typescript
export class IntrusionDetection {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  
  static recordFailedAttempt(identifier: string): void {
    const now = new Date();
    const current = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: now };
    
    // Reset count if last attempt was more than lockout duration ago
    if (now.getTime() - current.lastAttempt.getTime() > this.LOCKOUT_DURATION) {
      current.count = 0;
    }
    
    current.count++;
    current.lastAttempt = now;
    this.failedAttempts.set(identifier, current);
    
    if (current.count >= this.MAX_FAILED_ATTEMPTS) {
      SecurityMonitor.logSecurityViolation('max_failed_attempts', {
        identifier,
        count: current.count,
        lastAttempt: current.lastAttempt
      });
    }
  }
  
  static isLocked(identifier: string): boolean {
    const current = this.failedAttempts.get(identifier);
    if (!current) return false;
    
    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - current.lastAttempt.getTime();
    
    return current.count >= this.MAX_FAILED_ATTEMPTS && 
           timeSinceLastAttempt < this.LOCKOUT_DURATION;
  }
  
  static resetFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }
}
```

## Security Headers & Middleware

### 1. Security Headers

```typescript
import helmet from 'helmet';

// Comprehensive security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // Hide Express server information
  hidePoweredBy: true,
  
  // Permissions policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: []
  }
});
```

### 2. Request Sanitization

```typescript
// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    }
  }
  
  // Sanitize body
  if (req.body) {
    sanitizeObject(req.body);
  }
  
  next();
};

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes and control characters
      obj[key] = obj[key].replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}
```

## Security Checklist

### Pre-Deployment Security Checklist

- [ ] **Authentication & Authorization**
  - [ ] Strong JWT secret configured
  - [ ] Password hashing with bcrypt (rounds >= 12)
  - [ ] Multi-factor authentication implemented
  - [ ] Session management secure

- [ ] **Input Validation**
  - [ ] All inputs validated with Joi or similar
  - [ ] SQL injection prevention (parameterized queries)
  - [ ] XSS protection implemented
  - [ ] CSRF protection enabled

- [ ] **HTTPS & TLS**
  - [ ] SSL certificates installed
  - [ ] Force HTTPS redirect
  - [ ] Strong TLS configuration
  - [ ] HSTS headers configured

- [ ] **Rate Limiting**
  - [ ] General rate limiting enabled
  - [ ] Auth endpoint rate limiting
  - [ ] File upload rate limiting
  - [ ] DDoS protection configured

- [ ] **File Security**
  - [ ] File type validation
  - [ ] File size limits
  - [ ] Secure file storage
  - [ ] Antivirus scanning

- [ ] **Database Security**
  - [ ] Database SSL/TLS enabled
  - [ ] Database user permissions restricted
  - [ ] Connection pooling configured
  - [ ] Query logging disabled in production

- [ ] **Security Headers**
  - [ ] CSP headers configured
  - [ ] XSS protection headers
  - [ ] CSRF protection headers
  - [ ] Frame options configured

- [ ] **Monitoring & Logging**
  - [ ] Security event logging
  - [ ] Intrusion detection
  - [ ] Failed attempt monitoring
  - [ ] Suspicious activity alerts

## Next Steps

1. [Performance Optimization](performance.md) - Optimize application performance
2. [Deployment Guides](../deployment/docker.md) - Deploy your secured application
3. [Monitoring Setup](../operations/monitoring.md) - Set up security monitoring
4. [Troubleshooting](../troubleshooting/common-issues.md) - Security issue troubleshooting