# Form.io Connector

The Form.io connector provides integration with Form.io, a powerful form and data management platform that offers form building, data collection, and submission management via RESTful APIs.

## Overview

The `FormioConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a unified API for Form.io operations while maintaining compatibility with the Fluent query interface.

> **Note**: The Form.io connector is currently under development. This documentation describes the planned implementation.

### Features

- **Form Management** - Create and manage dynamic forms
- **Data Collection** - Collect and validate form submissions
- **RESTful API** - Full REST API integration
- **Authentication** - Built-in user authentication and JWT support
- **Role-Based Access** - Fine-grained permissions system
- **File Uploads** - Support for file attachments
- **Workflow Management** - Form approval workflows

## Installation

```bash
npm install @goatlab/fluent-formio axios
```

## Setup

### 1. Form.io Project Setup

1. Create a Form.io project at [Form.io](https://form.io)
2. Note your project URL (e.g., `https://myproject.form.io`)
3. Get your API key from the project settings
4. Create your forms using the Form.io builder

### 2. Define Your Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('user_submissions') // Maps to Form.io form
@ObjectType()
export class UserSubmission {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  // Form.io specific fields
  @Column()
  @f.Column()
  owner: string

  @Column()
  @f.Column()
  roles: string[]

  @Column({ type: 'timestamp' })
  @f.Column()
  created: Date

  @Column({ type: 'timestamp' })
  @f.Column()
  modified: Date

  // Form data fields
  @Column()
  @f.Column()
  firstName: string

  @Column()
  @f.Column()
  lastName: string

  @Column()
  @f.Column()
  email: string

  @Column()
  @f.Column()
  phone?: string

  @Column()
  @f.Column()
  status: 'submitted' | 'approved' | 'rejected'
}

// Define your schemas
export const UserSubmissionInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  status: z.enum(['submitted', 'approved', 'rejected']).default('submitted')
})

export const UserSubmissionOutputSchema = z.object({
  id: z.string(),
  owner: z.string(),
  roles: z.array(z.string()),
  created: z.date(),
  modified: z.date(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  status: z.enum(['submitted', 'approved', 'rejected'])
})
```

### 3. Create Repository

```typescript
import { FormioConnector } from '@goatlab/fluent-formio'
import { UserSubmission, UserSubmissionInputSchema, UserSubmissionOutputSchema } from './entities/UserSubmission'

export class UserSubmissionRepository extends FormioConnector<
  UserSubmission,
  typeof UserSubmissionInputSchema._type,
  typeof UserSubmissionOutputSchema._type
> {
  constructor() {
    super({
      entity: UserSubmission,
      baseEndPoint: 'https://myproject.form.io/user-form',
      token: process.env.FORMIO_API_KEY,
      inputSchema: UserSubmissionInputSchema,
      outputSchema: UserSubmissionOutputSchema
    })
  }
}
```

### 4. Initialize and Use

```typescript
import { Fluent } from '@goatlab/fluent'
import { modelGeneratorDataSource } from '@goatlab/fluent'
import { UserSubmission } from './entities/UserSubmission'

// Initialize Fluent
await Fluent.initialize([modelGeneratorDataSource], [UserSubmission])

// Create repository instance
const userSubmissionRepository = new UserSubmissionRepository()

// Use the repository
const submission = await userSubmissionRepository.insert({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  status: 'submitted'
})
```

## Configuration

### Environment Variables

```bash
# .env
FORMIO_PROJECT_URL=https://myproject.form.io
FORMIO_API_KEY=your-api-key
FORMIO_FORM_PATH=/user-form
```

### Configuration Object

```typescript
interface FormioConfig {
  baseEndPoint: string
  token?: string
  timeout?: number
  retries?: number
  headers?: Record<string, string>
}

const config: FormioConfig = {
  baseEndPoint: process.env.FORMIO_PROJECT_URL + process.env.FORMIO_FORM_PATH,
  token: process.env.FORMIO_API_KEY,
  timeout: 30000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Goat-Fluent-Client'
  }
}
```

## CRUD Operations

### Create

```typescript
// Insert single submission
const submission = await userSubmissionRepository.insert({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  status: 'submitted'
})

// Insert multiple submissions
const submissions = await userSubmissionRepository.insertMany([
  { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' }
])
```

### Read

```typescript
// Find all submissions
const submissions = await userSubmissionRepository.findMany()

// Find with filters
const submissions = await userSubmissionRepository.findMany({
  where: { 
    status: 'submitted',
    email: { contains: '@company.com' }
  },
  orderBy: { created: 'desc' },
  limit: 10
})

// Find by ID
const submission = await userSubmissionRepository.findById('submission-id')

// Find first matching submission
const submission = await userSubmissionRepository.findFirst({
  where: { email: 'john@example.com' }
})
```

### Update

```typescript
// Update by ID
const updatedSubmission = await userSubmissionRepository.updateById('submission-id', {
  status: 'approved',
  phone: '+1234567891'
})

// Update many with conditions
const updatedSubmissions = await userSubmissionRepository.updateMany(
  { where: { status: 'submitted' } },
  { status: 'approved' }
)
```

### Delete

```typescript
// Delete by ID
await userSubmissionRepository.deleteById('submission-id')

// Delete many with conditions
await userSubmissionRepository.deleteMany({
  where: { status: 'rejected' }
})
```

## Form.io-Specific Features

### Authentication

```typescript
// JWT Authentication
const authToken = await formioAuth.authenticate({
  username: 'user@example.com',
  password: 'password'
})

// Use token in repository
const repository = new UserSubmissionRepository()
repository.setAuthToken(authToken)
```

### Role-Based Access

```typescript
// Filter by user roles
const submissions = await userSubmissionRepository.findMany({
  where: {
    roles: { contains: 'admin' }
  }
})

// Check user permissions
const hasPermission = await repository.checkPermission('submission-id', 'read')
```

### File Uploads

```typescript
// Handle file uploads
const submissionWithFile = await userSubmissionRepository.insert({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  resume: {
    name: 'resume.pdf',
    url: 'https://formio.s3.amazonaws.com/...',
    size: 1024000,
    type: 'application/pdf'
  }
})
```

### Form Validation

```typescript
// Validate submission against form schema
const validationResult = await repository.validateSubmission({
  firstName: 'John',
  lastName: 'Doe',
  email: 'invalid-email'
})

if (!validationResult.isValid) {
  console.log('Validation errors:', validationResult.errors)
}
```

## Query Operations

### Basic Filters

```typescript
// Exact match
const submissions = await userSubmissionRepository.findMany({
  where: { status: 'submitted' }
})

// Contains
const submissions = await userSubmissionRepository.findMany({
  where: { email: { contains: '@gmail.com' } }
})

// Date range
const submissions = await userSubmissionRepository.findMany({
  where: {
    created: {
      gte: new Date('2023-01-01'),
      lte: new Date('2023-12-31')
    }
  }
})
```

### Advanced Queries

```typescript
// Complex filters
const submissions = await userSubmissionRepository.findMany({
  where: {
    AND: [
      { status: 'submitted' },
      {
        OR: [
          { email: { contains: '@company.com' } },
          { roles: { contains: 'admin' } }
        ]
      }
    ]
  }
})
```

### Pagination

```typescript
// Paginated results
const paginatedSubmissions = await userSubmissionRepository.paginate({
  page: 1,
  perPage: 20,
  where: { status: 'submitted' },
  orderBy: { created: 'desc' }
})

console.log('Total submissions:', paginatedSubmissions.total)
console.log('Current page:', paginatedSubmissions.current_page)
console.log('Data:', paginatedSubmissions.data)
```

## Error Handling

```typescript
import { FormioError } from '@goatlab/fluent-formio'

try {
  const submission = await userSubmissionRepository.insert({
    firstName: '',
    lastName: 'Doe',
    email: 'invalid-email'
  })
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    console.log('Validation errors:', error.errors)
  } else if (error instanceof FormioError) {
    // Handle Form.io specific errors
    console.log('Form.io error:', error.message, error.code)
  } else if (error.response?.status === 401) {
    // Handle authentication errors
    console.log('Authentication failed')
  } else if (error.response?.status === 403) {
    // Handle permission errors
    console.log('Access denied')
  } else {
    // Handle other errors
    console.log('Unknown error:', error.message)
  }
}
```

## Advanced Features

### Webhooks

```typescript
// Set up webhook for form submissions
const webhookConfig = {
  url: 'https://myapp.com/webhook/formio',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer webhook-token'
  },
  events: ['submission.create', 'submission.update']
}

await repository.createWebhook(webhookConfig)
```

### Workflow Management

```typescript
// Approve submission
await userSubmissionRepository.updateById('submission-id', {
  status: 'approved',
  approvedBy: 'admin-user-id',
  approvedAt: new Date()
})

// Reject submission with reason
await userSubmissionRepository.updateById('submission-id', {
  status: 'rejected',
  rejectionReason: 'Incomplete information',
  rejectedBy: 'admin-user-id',
  rejectedAt: new Date()
})
```

### Bulk Operations

```typescript
// Bulk approve submissions
const approvedSubmissions = await userSubmissionRepository.updateMany(
  { 
    where: { 
      status: 'submitted',
      created: { gte: new Date('2023-01-01') }
    } 
  },
  { 
    status: 'approved',
    approvedBy: 'admin-user-id',
    approvedAt: new Date()
  }
)

// Bulk delete old submissions
await userSubmissionRepository.deleteMany({
  where: {
    created: { lt: new Date('2022-01-01') },
    status: 'processed'
  }
})
```

## Performance Optimization

### Query Optimization

```typescript
// Use select to limit fields
const submissions = await userSubmissionRepository.findMany({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    status: true
  },
  where: { status: 'submitted' },
  limit: 100
})

// Use indexes for frequently queried fields
const indexedSubmissions = await userSubmissionRepository.findMany({
  where: { 
    owner: 'user-id', // Form.io automatically indexes owner field
    status: 'submitted'
  }
})
```

### Caching

```typescript
// Implement response caching
const cachedSubmissions = await userSubmissionRepository.findMany({
  where: { status: 'submitted' },
  cache: {
    ttl: 300, // 5 minutes
    key: 'submitted-forms'
  }
})
```

## Testing

### Mock Form.io API

```typescript
// test/userSubmissionRepository.test.ts
import { UserSubmissionRepository } from '../src/repositories/UserSubmissionRepository'
import { FormioConnector } from '@goatlab/fluent-formio'

// Mock Form.io API
jest.mock('@goatlab/fluent-formio')

describe('UserSubmissionRepository', () => {
  let repository: UserSubmissionRepository
  let mockFormioConnector: jest.Mocked<FormioConnector>

  beforeEach(() => {
    mockFormioConnector = {
      insert: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn()
    } as any

    repository = new UserSubmissionRepository()
    repository.setConnector(mockFormioConnector)
  })

  it('should insert a submission', async () => {
    const submissionData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      status: 'submitted' as const
    }

    const mockResponse = {
      id: 'submission-id',
      ...submissionData,
      owner: 'user-id',
      roles: ['user'],
      created: new Date(),
      modified: new Date()
    }

    mockFormioConnector.insert.mockResolvedValue(mockResponse)

    const result = await repository.insert(submissionData)

    expect(mockFormioConnector.insert).toHaveBeenCalledWith(submissionData)
    expect(result).toEqual(mockResponse)
  })
})
```

## Best Practices

1. **Use proper authentication** with JWT tokens
2. **Implement proper error handling** for network issues
3. **Use validation schemas** for data integrity
4. **Implement role-based access control** for security
5. **Use pagination** for large datasets
6. **Cache frequently accessed data** to reduce API calls
7. **Monitor API usage** to stay within rate limits
8. **Use webhooks** for real-time updates
9. **Implement proper logging** for debugging
10. **Use environment variables** for configuration

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check API key and token expiration
2. **Permission Denied**: Verify user roles and form permissions
3. **Rate Limiting**: Implement proper retry logic and caching
4. **Network Issues**: Handle timeouts and connection errors
5. **Data Validation**: Ensure data matches form schema

### Debug Mode

```typescript
// Enable debug logging
const repository = new UserSubmissionRepository()
repository.setDebugMode(true)

// Monitor API calls
repository.on('request', (config) => {
  console.log('API Request:', config.method, config.url)
})

repository.on('response', (response) => {
  console.log('API Response:', response.status, response.data)
})
```

## Migration from Other Systems

### From Database

```typescript
// Migrate existing data to Form.io
const migrateData = async (existingData: any[]) => {
  const submissions = existingData.map(item => ({
    firstName: item.first_name,
    lastName: item.last_name,
    email: item.email_address,
    phone: item.phone_number,
    status: 'submitted' as const
  }))

  await userSubmissionRepository.insertMany(submissions)
}
```

### From CSV

```typescript
// Import from CSV file
import csv from 'csv-parser'
import fs from 'fs'

const importFromCSV = async (filePath: string) => {
  const submissions: any[] = []

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        submissions.push({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          status: 'submitted'
        })
      })
      .on('end', async () => {
        try {
          await userSubmissionRepository.insertMany(submissions)
          resolve(submissions.length)
        } catch (error) {
          reject(error)
        }
      })
  })
}
```

The Form.io connector provides a powerful way to integrate with Form.io's form management platform, offering form building, data collection, and submission management capabilities within the Fluent ecosystem.