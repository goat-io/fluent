# @goatlab/uploads

Express middleware for handling file uploads across multiple cloud storage providers. Provides a unified API for uploading files to S3, Google Cloud Storage, Azure Blob Storage, or local disk.

## Installation

```bash
npm install @goatlab/uploads
# or
yarn add @goatlab/uploads
# or
pnpm add @goatlab/uploads
```

## Basic Usage

```typescript
import { Upload, Providers } from '@goatlab/uploads'
import express from 'express'

const app = express()

app.post('/upload', async (req, res) => {
  const upload = new Upload(Providers.S3, req, res)
  
  try {
    const file = await upload.file({
      folder: 'my-bucket-name',
      fileKey: 'file', // form field name (default: 'file')
      fileName: `${Date.now()}-`, // optional prefix
      maxFileSize: 50 * 1024 * 1024 // 50MB (default)
    })
    
    res.json({ success: true, file })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

## Provider Examples

### Amazon S3

```typescript
// Required environment variables:
// AWS_ACCESS_KEYid
// AWS_SECRET_ACCESS_KEY

const upload = new Upload(Providers.S3, req, res)
const file = await upload.file({
  folder: 'my-bucket-name' // S3 bucket name
})
```

### Google Cloud Storage

```typescript
// Required environment variables:
// GOOGLE_PROJECTID
// Plus: Service account key file path

const upload = new Upload(Providers.Google, req, res)
const file = await upload.file({
  folder: 'my-bucket-name', // GCS bucket name
  fileKey: 'path/to/service-account-key.json'
})
```

### Azure Blob Storage

```typescript
// Required environment variables:
// AZURE_CONNECTION_STRING
// AZURE_ACCESS_KEY
// AZURE_ACCOUNT_NAME

const upload = new Upload(Providers.Azure, req, res)
const file = await upload.file({
  folder: 'my-container-name' // Azure container name
})
```

### Local Storage

```typescript
const upload = new Upload(Providers.Local, req, res)
const file = await upload.file({
  folder: 'uploads' // Local directory path
})
```

### Memory Storage

```typescript
const upload = new Upload(Providers.Memory, req, res)
const file = await upload.file({
  folder: 'unused' // Required but not used for memory storage
})
```

## Supported Providers

- **S3** - Amazon S3 storage
- **Google** - Google Cloud Storage
- **Azure** - Azure Blob Storage (Note: Currently commented out in code)
- **Local** - Local disk storage
- **Memory** - In-memory storage