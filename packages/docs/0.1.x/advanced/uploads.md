# Multi-Cloud File Upload System

The `@goatlab/uploads` package provides a unified interface for file uploads across multiple cloud storage providers and local storage options.

## Overview

The upload system supports multiple storage providers through a single, consistent API:

- **Amazon S3**: AWS cloud storage
- **Google Cloud Storage**: GCP cloud storage  
- **Azure Blob Storage**: Microsoft Azure storage
- **Local Storage**: File system storage
- **Memory Storage**: In-memory storage for testing

## Installation

```bash
npm install @goatlab/uploads multer
```

### Provider-Specific Dependencies

```bash
# For AWS S3
npm install aws-sdk multer-s3

# For Google Cloud Storage
npm install multer-google-storage

# For Azure Blob Storage
npm install multer-azure-blob-storage

# For local/memory storage (included with multer)
# No additional dependencies needed
```

## Basic Usage

### Express.js Integration

```typescript
import { Upload, Providers } from '@goatlab/uploads'
import express from 'express'

const app = express()

// Upload endpoint
app.post('/upload', async (req, res) => {
  try {
    const upload = new Upload(Providers.S3, req, res)
    
    const file = await upload.file({
      folder: 'user-uploads',
      fileName: `${Date.now()}-uploaded-file`,
      fileKey: 'file',
      maxFileSize: 10 * 1024 * 1024 // 10MB
    })

    res.json({ success: true, file })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Configuration Interface

```typescript
export interface MulterConfiguration {
  fileName?: string      // Custom file name (default: timestamp)
  folder: string        // Storage folder/bucket name
  fileKey?: string      // Form field name (default: 'file')
  maxFileSize?: number  // Maximum file size in bytes (default: 50MB)
}
```

## Storage Providers

### Amazon S3

#### Environment Variables

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

#### Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'

const upload = new Upload(Providers.S3, req, res)

const file = await upload.file({
  folder: 'my-s3-bucket',
  fileName: 'custom-filename',
  fileKey: 'uploadedFile',
  maxFileSize: 5 * 1024 * 1024 // 5MB
})

console.log('S3 Upload result:', file)
```

#### S3 Configuration

```typescript
// S3 provider automatically configures:
// - Public read ACL
// - File naming with extensions
// - Bucket as folder parameter
```

### Google Cloud Storage

#### Environment Variables

```bash
# Google Cloud Storage Configuration
GOOGLE_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

#### Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'

const upload = new Upload(Providers.Google, req, res)

const file = await upload.file({
  folder: 'my-gcp-bucket',
  fileName: 'gcp-file',
  fileKey: 'service-account-key.json', // Path to service account key
  maxFileSize: 10 * 1024 * 1024 // 10MB
})

console.log('GCP Upload result:', file)
```

#### GCP Configuration

```typescript
// Google Cloud Storage provider features:
// - Automatic retry (up to 3 retries)
// - Project ID from environment
// - Service account authentication
// - Bucket as folder parameter
```

### Azure Blob Storage

#### Environment Variables

```bash
# Azure Blob Storage Configuration
AZURE_CONNECTION_STRING=your_connection_string
AZURE_ACCESS_KEY=your_access_key
AZURE_ACCOUNT_NAME=your_account_name
```

#### Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'

const upload = new Upload(Providers.Azure, req, res)

const file = await upload.file({
  folder: 'my-azure-container',
  fileName: 'azure-file',
  maxFileSize: 20 * 1024 * 1024 // 20MB
})

console.log('Azure Upload result:', file)
```

#### Azure Configuration

```typescript
// Azure Blob Storage provider features:
// - Container access level: 'blob'
// - URL expiration time: 60 minutes
// - Container as folder parameter
// - Connection string authentication
```

### Local File System

#### Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'

const upload = new Upload(Providers.Local, req, res)

const file = await upload.file({
  folder: 'uploads', // Creates directory if it doesn't exist
  fileName: 'local-file',
  maxFileSize: 50 * 1024 * 1024 // 50MB
})

console.log('Local Upload result:', file)
```

#### Local Storage Features

```typescript
// Local storage provider:
// - Creates directories automatically
// - Stores files relative to application directory
// - Preserves file extensions
// - No external dependencies
```

### Memory Storage

#### Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'

const upload = new Upload(Providers.Memory, req, res)

const file = await upload.file({
  folder: 'memory', // Not used for memory storage
  fileName: 'memory-file',
  maxFileSize: 1 * 1024 * 1024 // 1MB for memory storage
})

console.log('Memory Upload result:', file)
// File buffer available in file.buffer
```

## Advanced Configuration

### Multiple File Uploads

```typescript
app.post('/upload-multiple', async (req, res) => {
  try {
    const upload = new Upload(Providers.S3, req, res)
    
    // Note: Current implementation supports single file
    // For multiple files, call upload.file() multiple times
    const files = []
    
    for (let i = 0; i < req.files.length; i++) {
      const file = await upload.file({
        folder: 'batch-uploads',
        fileName: `batch-${i}-${Date.now()}`,
        fileKey: `file-${i}`
      })
      files.push(file)
    }

    res.json({ success: true, files })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Provider-Specific Configuration

```typescript
// Environment-based provider selection
const getProvider = (): Providers => {
  const provider = process.env.UPLOAD_PROVIDER || 'local'
  
  switch (provider.toLowerCase()) {
    case 's3':
      return Providers.S3
    case 'google':
    case 'gcp':
      return Providers.Google
    case 'azure':
      return Providers.Azure
    case 'memory':
      return Providers.Memory
    default:
      return Providers.Local
  }
}

// Usage
const upload = new Upload(getProvider(), req, res)
```

### File Validation

```typescript
import { Upload, Providers } from '@goatlab/uploads'
import { extname } from 'path'

app.post('/upload-image', async (req, res) => {
  try {
    // Validate file type before upload
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const fileExtension = extname(req.file?.originalname || '')
    
    if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid file type' })
    }

    const upload = new Upload(Providers.S3, req, res)
    
    const file = await upload.file({
      folder: 'images',
      fileName: `img-${Date.now()}`,
      maxFileSize: 5 * 1024 * 1024, // 5MB for images
    })

    res.json({ success: true, file })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

## Error Handling

### Common Error Scenarios

```typescript
app.post('/upload-with-error-handling', async (req, res) => {
  try {
    const upload = new Upload(Providers.S3, req, res)
    
    const file = await upload.file({
      folder: 'uploads',
      fileName: 'error-handled-file',
      maxFileSize: 10 * 1024 * 1024
    })

    res.json({ success: true, file })
  } catch (error) {
    console.error('Upload error:', error)
    
    // Handle specific error types
    if (error.message.includes('File too large')) {
      return res.status(413).json({ error: 'File size exceeds limit' })
    }
    
    if (error.message.includes('access keys are missing')) {
      return res.status(500).json({ error: 'Server configuration error' })
    }
    
    if (error.message.includes('ENOENT')) {
      return res.status(500).json({ error: 'Storage directory error' })
    }

    res.status(500).json({ error: 'Upload failed' })
  }
})
```

### Retry Logic

```typescript
const uploadWithRetry = async (
  provider: Providers,
  req: any,
  res: any,
  config: MulterConfiguration,
  maxRetries: number = 3
) => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const upload = new Upload(provider, req, res)
      return await upload.file(config)
    } catch (error) {
      lastError = error
      console.warn(`Upload attempt ${attempt} failed:`, error.message)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  throw lastError
}
```

## Performance Optimization

### File Size Limits

```typescript
// Different limits for different file types
const getFileSizeLimit = (filename: string): number => {
  const extension = extname(filename).toLowerCase()
  
  switch (extension) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.webp':
      return 5 * 1024 * 1024 // 5MB for images
    case '.pdf':
      return 10 * 1024 * 1024 // 10MB for PDFs
    case '.doc':
    case '.docx':
      return 20 * 1024 * 1024 // 20MB for documents
    case '.mp4':
    case '.avi':
      return 100 * 1024 * 1024 // 100MB for videos
    default:
      return 50 * 1024 * 1024 // 50MB default
  }
}

// Usage
const upload = new Upload(Providers.S3, req, res)
const file = await upload.file({
  folder: 'uploads',
  fileName: 'optimized-file',
  maxFileSize: getFileSizeLimit(req.file?.originalname || '')
})
```

### Chunked Upload (for large files)

```typescript
// For large files, consider implementing chunked upload
const uploadLargeFile = async (
  provider: Providers,
  req: any,
  res: any,
  config: MulterConfiguration
) => {
  const fileSize = req.headers['content-length']
  const chunkSize = 5 * 1024 * 1024 // 5MB chunks
  
  if (fileSize > chunkSize) {
    // Implement chunked upload logic
    console.log('Large file detected, using chunked upload')
    // This would require custom implementation
  }
  
  const upload = new Upload(provider, req, res)
  return await upload.file(config)
}
```

## Security Considerations

### File Type Validation

```typescript
const validateFileType = (filename: string, allowedTypes: string[]): boolean => {
  const extension = extname(filename).toLowerCase()
  return allowedTypes.includes(extension)
}

// Usage
app.post('/secure-upload', async (req, res) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx']
  
  if (!validateFileType(req.file?.originalname || '', allowedTypes)) {
    return res.status(400).json({ error: 'File type not allowed' })
  }
  
  // Proceed with upload
})
```

### Filename Sanitization

```typescript
const sanitizeFilename = (filename: string): string => {
  // Remove special characters and spaces
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase()
}

// Usage
const upload = new Upload(Providers.S3, req, res)
const file = await upload.file({
  folder: 'secure-uploads',
  fileName: sanitizeFilename(req.file?.originalname || 'file'),
  maxFileSize: 10 * 1024 * 1024
})
```

## Best Practices

1. **Environment Configuration**: Use environment variables for cloud credentials
2. **File Size Limits**: Set appropriate file size limits for different file types
3. **Error Handling**: Implement comprehensive error handling
4. **File Validation**: Validate file types and content
5. **Security**: Sanitize filenames and validate uploads
6. **Performance**: Use appropriate storage providers for your use case

## Common Use Cases

### Profile Picture Upload

```typescript
app.post('/profile-picture', async (req, res) => {
  try {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp']
    const fileExtension = extname(req.file?.originalname || '')
    
    if (!allowedTypes.includes(fileExtension.toLowerCase())) {
      return res.status(400).json({ error: 'Only image files allowed' })
    }

    const upload = new Upload(Providers.S3, req, res)
    const file = await upload.file({
      folder: 'profile-pictures',
      fileName: `profile-${req.user.id}-${Date.now()}`,
      maxFileSize: 2 * 1024 * 1024 // 2MB limit for profile pictures
    })

    // Update user profile with new picture URL
    await updateUserProfile(req.user.id, { profilePicture: file.location })

    res.json({ success: true, profilePicture: file.location })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Document Upload

```typescript
app.post('/document', async (req, res) => {
  try {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt']
    const fileExtension = extname(req.file?.originalname || '')
    
    if (!allowedTypes.includes(fileExtension.toLowerCase())) {
      return res.status(400).json({ error: 'Only document files allowed' })
    }

    const upload = new Upload(Providers.Google, req, res)
    const file = await upload.file({
      folder: 'documents',
      fileName: `doc-${req.user.id}-${Date.now()}`,
      maxFileSize: 20 * 1024 * 1024 // 20MB for documents
    })

    // Store document metadata
    await storeDocumentMetadata({
      userId: req.user.id,
      filename: file.originalname,
      url: file.location,
      size: file.size,
      uploadedAt: new Date()
    })

    res.json({ success: true, document: file })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

## Testing

### Unit Tests

```typescript
import { Upload, Providers } from '@goatlab/uploads'

describe('Upload System', () => {
  test('should upload file to memory storage', async () => {
    const mockReq = {
      file: {
        originalname: 'test.txt',
        buffer: Buffer.from('test content')
      }
    }
    const mockRes = {}

    const upload = new Upload(Providers.Memory, mockReq, mockRes)
    const result = await upload.file({
      folder: 'test',
      fileName: 'test-file'
    })

    expect(result).toBeDefined()
    expect(result.buffer).toBeDefined()
  })
})
```

### Integration Tests

```typescript
describe('Upload Integration', () => {
  test('should upload file to S3', async () => {
    // Requires AWS credentials in test environment
    const upload = new Upload(Providers.S3, req, res)
    const result = await upload.file({
      folder: 'test-bucket',
      fileName: 'integration-test'
    })

    expect(result.location).toMatch(/amazonaws\.com/)
  })
})
```

## Troubleshooting

### Common Issues

1. **Missing Credentials**: Ensure all required environment variables are set
2. **File Size Errors**: Check file size limits and adjust as needed
3. **Permission Errors**: Verify cloud storage permissions
4. **Directory Errors**: Ensure local directories exist and are writable

### Debug Mode

```typescript
const upload = new Upload(Providers.S3, req, res)

try {
  const file = await upload.file({
    folder: 'debug-uploads',
    fileName: 'debug-file',
    maxFileSize: 10 * 1024 * 1024
  })
  
  console.log('Upload successful:', {
    filename: file.originalname,
    size: file.size,
    location: file.location
  })
} catch (error) {
  console.error('Upload failed:', {
    error: error.message,
    stack: error.stack,
    provider: 'S3'
  })
}
```

## Next Steps

- Learn about [Form.io Integration](formio-integration.md) for form-based uploads
- Explore [Cloud Integration Setup](../setup/cloud-integration.md) for production configuration
- Check out [Error Handling Strategies](error-handling.md) for robust upload handling