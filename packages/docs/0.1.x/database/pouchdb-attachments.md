# PouchDB Attachments

PouchDB supports binary attachments, allowing you to store files like images, documents, and media alongside your JSON documents. This guide covers everything about working with attachments.

## Understanding Attachments

### What are Attachments?

Attachments are binary data (files) stored within PouchDB documents:
- Stored as base64-encoded strings internally
- Can be any file type (images, PDFs, audio, video, etc.)
- Include metadata (content type, length, digest)
- Sync with documents during replication

### Attachment Structure

```javascript
{
  "_id": "user123",
  "_rev": "1-abc123",
  "name": "John Doe",
  "_attachments": {
    "avatar.jpg": {
      "content_type": "image/jpeg",
      "revpos": 1,
      "digest": "md5-abc123def456",
      "length": 12345,
      "stub": true
    },
    "resume.pdf": {
      "content_type": "application/pdf",
      "revpos": 2,
      "digest": "md5-def456ghi789",
      "length": 67890,
      "stub": true
    }
  }
}
```

## Adding Attachments

### Using putAttachment()

```typescript
class AttachmentManager {
  constructor(private db: PouchDB.Database) {}

  async addAttachment(docId: string, filename: string, file: Blob, contentType: string) {
    try {
      // Get current document and revision
      const doc = await this.db.get(docId)
      
      // Add attachment
      const result = await this.db.putAttachment(
        docId,
        filename,
        doc._rev,
        file,
        contentType
      )
      
      return result
    } catch (error) {
      if (error.status === 404) {
        // Document doesn't exist, create it with attachment
        const newDoc = {
          _id: docId,
          createdAt: new Date().toISOString()
        }
        
        const docResult = await this.db.put(newDoc)
        
        return this.db.putAttachment(
          docId,
          filename,
          docResult.rev,
          file,
          contentType
        )
      }
      throw error
    }
  }

  async addMultipleAttachments(docId: string, attachments: Array<{
    name: string
    file: Blob
    contentType: string
  }>) {
    let doc
    try {
      doc = await this.db.get(docId)
    } catch (error) {
      if (error.status === 404) {
        // Create new document
        const newDoc = { _id: docId, createdAt: new Date().toISOString() }
        const result = await this.db.put(newDoc)
        doc = { ...newDoc, _rev: result.rev }
      } else {
        throw error
      }
    }

    // Add attachments sequentially to maintain revision chain
    for (const attachment of attachments) {
      const result = await this.db.putAttachment(
        docId,
        attachment.name,
        doc._rev,
        attachment.file,
        attachment.contentType
      )
      doc._rev = result.rev
    }

    return doc
  }
}
```

### Inline Attachments

```typescript
class InlineAttachmentManager {
  async createDocumentWithAttachments(docId: string, data: any, attachments: Array<{
    name: string
    data: string | Blob
    contentType: string
  }>) {
    const _attachments = {}
    
    for (const attachment of attachments) {
      let attachmentData
      
      if (attachment.data instanceof Blob) {
        // Convert Blob to base64
        attachmentData = await this.blobToBase64(attachment.data)
      } else {
        attachmentData = attachment.data
      }
      
      _attachments[attachment.name] = {
        content_type: attachment.contentType,
        data: attachmentData
      }
    }

    const doc = {
      _id: docId,
      ...data,
      _attachments
    }

    return this.db.put(doc)
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
}
```

## Retrieving Attachments

### Getting Attachment Data

```typescript
class AttachmentRetriever {
  constructor(private db: PouchDB.Database) {}

  async getAttachment(docId: string, filename: string): Promise<Blob> {
    try {
      return await this.db.getAttachment(docId, filename)
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Attachment ${filename} not found in document ${docId}`)
      }
      throw error
    }
  }

  async getAttachmentAsDataURL(docId: string, filename: string): Promise<string> {
    const blob = await this.getAttachment(docId, filename)
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async getAttachmentAsArrayBuffer(docId: string, filename: string): Promise<ArrayBuffer> {
    const blob = await this.getAttachment(docId, filename)
    return blob.arrayBuffer()
  }

  async getAttachmentInfo(docId: string, filename?: string) {
    const doc = await this.db.get(docId, { attachments: false })
    
    if (!doc._attachments) {
      return filename ? null : {}
    }
    
    if (filename) {
      return doc._attachments[filename] || null
    }
    
    return doc._attachments
  }

  async listAttachments(docId: string): Promise<string[]> {
    const doc = await this.db.get(docId)
    return doc._attachments ? Object.keys(doc._attachments) : []
  }
}
```

### Streaming Large Attachments

```typescript
class StreamingAttachmentManager {
  async streamAttachment(docId: string, filename: string): Promise<ReadableStream> {
    // For large files, use streaming to avoid memory issues
    const response = await fetch(`${this.db.name}/${docId}/${filename}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`)
    }
    
    return response.body
  }

  async downloadAttachment(docId: string, filename: string, downloadFilename?: string) {
    const blob = await this.db.getAttachment(docId, filename)
    
    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadFilename || filename
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    URL.revokeObjectURL(url)
  }
}
```

## File Upload Handling

### File Input Integration

```typescript
class FileUploadHandler {
  constructor(private attachmentManager: AttachmentManager) {}

  setupFileInput(inputElement: HTMLInputElement, docId: string) {
    inputElement.addEventListener('change', async (event) => {
      const files = (event.target as HTMLInputElement).files
      if (!files) return

      await this.handleFiles(Array.from(files), docId)
    })
  }

  async handleFiles(files: File[], docId: string) {
    const uploadPromises = files.map(file => this.uploadFile(file, docId))
    
    try {
      const results = await Promise.all(uploadPromises)
      console.log('All files uploaded:', results)
      return results
    } catch (error) {
      console.error('File upload failed:', error)
      throw error
    }
  }

  private async uploadFile(file: File, docId: string) {
    // Validate file
    this.validateFile(file)
    
    // Generate unique filename
    const filename = this.generateFilename(file)
    
    // Upload with progress tracking
    return this.uploadWithProgress(docId, filename, file)
  }

  private validateFile(file: File) {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
    
    if (file.size > maxSize) {
      throw new Error(`File ${file.name} is too large (max ${maxSize / 1024 / 1024}MB)`)
    }
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not allowed`)
    }
  }

  private generateFilename(file: File): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    return `${timestamp}-${random}.${extension}`
  }

  private async uploadWithProgress(docId: string, filename: string, file: File) {
    // For large files, you might want to chunk the upload
    if (file.size > 1024 * 1024) { // 1MB
      return this.chunkedUpload(docId, filename, file)
    }
    
    return this.attachmentManager.addAttachment(docId, filename, file, file.type)
  }

  private async chunkedUpload(docId: string, filename: string, file: File) {
    const chunkSize = 1024 * 1024 // 1MB chunks
    const chunks = Math.ceil(file.size / chunkSize)
    
    // Create temporary document for chunks
    const tempDocId = `${docId}-upload-${Date.now()}`
    
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      await this.attachmentManager.addAttachment(
        tempDocId,
        `chunk-${i}`,
        chunk,
        'application/octet-stream'
      )
    }
    
    // Reassemble chunks and add to final document
    return this.reassembleChunks(tempDocId, docId, filename, file.type, chunks)
  }
}
```

### Drag and Drop

```typescript
class DragDropHandler {
  constructor(
    private uploadHandler: FileUploadHandler,
    private dropZone: HTMLElement
  ) {
    this.setupDragDrop()
  }

  private setupDragDrop() {
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      this.dropZone.classList.add('drag-over')
    })

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over')
    })

    this.dropZone.addEventListener('drop', async (e) => {
      e.preventDefault()
      this.dropZone.classList.remove('drag-over')
      
      const files = Array.from(e.dataTransfer?.files || [])
      if (files.length > 0) {
        const docId = this.dropZone.dataset.docId
        if (docId) {
          await this.uploadHandler.handleFiles(files, docId)
        }
      }
    })
  }
}
```

## Image Processing

### Image Resizing and Thumbnails

```typescript
class ImageProcessor {
  async createThumbnail(file: File, maxWidth = 200, maxHeight = 200): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        const { width, height } = this.calculateDimensions(
          img.width, img.height, maxWidth, maxHeight
        )
        
        canvas.width = width
        canvas.height = height
        
        // Draw resized image
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create thumbnail'))
          }
        }, 'image/jpeg', 0.8)
      }
      
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ) {
    let { width, height } = { width: originalWidth, height: originalHeight }
    
    if (width > maxWidth) {
      height = (height * maxWidth) / width
      width = maxWidth
    }
    
    if (height > maxHeight) {
      width = (width * maxHeight) / height
      height = maxHeight
    }
    
    return { width: Math.round(width), height: Math.round(height) }
  }

  async processImage(file: File, docId: string, attachmentManager: AttachmentManager) {
    // Create original and thumbnail
    const thumbnail = await this.createThumbnail(file)
    
    // Upload both
    await Promise.all([
      attachmentManager.addAttachment(docId, `original-${file.name}`, file, file.type),
      attachmentManager.addAttachment(docId, `thumb-${file.name}`, thumbnail, 'image/jpeg')
    ])
  }
}
```

### Image Metadata Extraction

```typescript
class ImageMetadataExtractor {
  async extractMetadata(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        const metadata = {
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified),
          name: file.name
        }
        
        resolve(metadata)
      }
      
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  async extractExifData(file: File): Promise<any> {
    // This would require a library like exif-js or piexifjs
    // Simplified example:
    const arrayBuffer = await file.arrayBuffer()
    const dataView = new DataView(arrayBuffer)
    
    // Check for JPEG EXIF header
    if (dataView.getUint16(0) === 0xFFD8) {
      // Parse EXIF data (simplified)
      return this.parseExif(dataView)
    }
    
    return null
  }

  private parseExif(dataView: DataView): any {
    // Simplified EXIF parsing - in practice, use a library
    return {
      camera: 'Unknown',
      timestamp: new Date(),
      gps: null
    }
  }
}
```

## Attachment Synchronization

### Sync with Attachments

```typescript
class AttachmentSyncManager {
  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database
  ) {}

  async syncWithAttachments() {
    // Sync with attachments included
    const sync = this.localDb.sync(this.remoteDb, {
      live: true,
      retry: true,
      // Include attachments in sync
      filter: (doc) => {
        // Only sync documents with small attachments
        if (doc._attachments) {
          const totalSize = Object.values(doc._attachments)
            .reduce((sum: number, att: any) => sum + (att.length || 0), 0)
          return totalSize < 1024 * 1024 // 1MB limit
        }
        return true
      }
    })

    return sync
  }

  async syncLargeAttachmentsSeparately() {
    // Find documents with large attachments
    const result = await this.localDb.allDocs({
      include_docs: true,
      attachments: false
    })

    for (const row of result.rows) {
      const doc = row.doc
      if (doc._attachments) {
        await this.syncDocumentAttachments(doc._id, doc._attachments)
      }
    }
  }

  private async syncDocumentAttachments(docId: string, attachments: any) {
    for (const [filename, attachment] of Object.entries(attachments)) {
      if ((attachment as any).length > 1024 * 1024) { // 1MB
        await this.syncLargeAttachment(docId, filename)
      }
    }
  }

  private async syncLargeAttachment(docId: string, filename: string) {
    try {
      // Check if attachment exists on remote
      const remoteDoc = await this.remoteDb.get(docId, { attachments: false })
      
      if (!remoteDoc._attachments?.[filename]) {
        // Upload to remote
        const attachment = await this.localDb.getAttachment(docId, filename)
        const doc = await this.remoteDb.get(docId)
        
        await this.remoteDb.putAttachment(
          docId,
          filename,
          doc._rev,
          attachment,
          remoteDoc._attachments[filename].content_type
        )
      }
    } catch (error) {
      console.error(`Failed to sync attachment ${filename}:`, error)
    }
  }
}
```

### Selective Attachment Sync

```typescript
class SelectiveAttachmentSync {
  private syncedAttachments = new Set<string>()
  
  async syncAttachmentsOnDemand(docId: string, filename: string) {
    const key = `${docId}/${filename}`
    
    if (this.syncedAttachments.has(key)) {
      return // Already synced
    }

    try {
      // Check if we have it locally
      await this.localDb.getAttachment(docId, filename)
    } catch (error) {
      if (error.status === 404) {
        // Download from remote
        await this.downloadAttachment(docId, filename)
      }
    }
    
    this.syncedAttachments.add(key)
  }

  private async downloadAttachment(docId: string, filename: string) {
    const attachment = await this.remoteDb.getAttachment(docId, filename)
    const doc = await this.localDb.get(docId)
    
    await this.localDb.putAttachment(
      docId,
      filename,
      doc._rev,
      attachment,
      doc._attachments[filename].content_type
    )
  }
}
```

## Performance Optimization

### Lazy Loading Attachments

```typescript
class LazyAttachmentLoader {
  private attachmentCache = new Map<string, Blob>()
  
  async getAttachmentWithCache(docId: string, filename: string): Promise<Blob> {
    const key = `${docId}/${filename}`
    
    if (this.attachmentCache.has(key)) {
      return this.attachmentCache.get(key)!
    }
    
    const attachment = await this.db.getAttachment(docId, filename)
    this.attachmentCache.set(key, attachment)
    
    return attachment
  }

  async preloadAttachments(docIds: string[]) {
    const loadPromises = docIds.map(async (docId) => {
      const doc = await this.db.get(docId, { attachments: false })
      
      if (doc._attachments) {
        const attachmentPromises = Object.keys(doc._attachments).map(filename =>
          this.getAttachmentWithCache(docId, filename).catch(err => {
            console.warn(`Failed to preload ${filename}:`, err)
          })
        )
        
        await Promise.all(attachmentPromises)
      }
    })
    
    await Promise.all(loadPromises)
  }

  clearCache() {
    this.attachmentCache.clear()
  }
}
```

### Attachment Compression

```typescript
class AttachmentCompressor {
  async compressImage(file: File, quality = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        
        ctx?.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Compression failed'))
          }
        }, 'image/jpeg', quality)
      }
      
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  async compressText(text: string): Promise<Uint8Array> {
    // Use compression library like pako for gzip compression
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    
    // Simplified - in practice, use a compression library
    return data
  }
}
```

## Security Considerations

### Attachment Validation

```typescript
class AttachmentValidator {
  private allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain'
  ])

  private maxFileSize = 10 * 1024 * 1024 // 10MB

  validateFile(file: File): void {
    // Check file type
    if (!this.allowedTypes.has(file.type)) {
      throw new Error(`File type ${file.type} not allowed`)
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File size ${file.size} exceeds limit of ${this.maxFileSize}`)
    }

    // Validate file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!this.isValidExtension(extension, file.type)) {
      throw new Error('File extension does not match content type')
    }
  }

  private isValidExtension(extension: string | undefined, mimeType: string): boolean {
    const validExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt']
    }

    return extension ? (validExtensions[mimeType] || []).includes(extension) : false
  }

  async scanForMalware(file: File): Promise<boolean> {
    // Implement virus scanning if needed
    // This could integrate with a service like VirusTotal
    return true
  }
}
```

### Access Control

```typescript
class AttachmentAccessControl {
  constructor(private userPermissions: Map<string, string[]>) {}

  canAccessAttachment(userId: string, docId: string, filename: string): boolean {
    const permissions = this.userPermissions.get(userId) || []
    
    // Check if user can access the document
    if (!permissions.includes(`read:${docId}`) && !permissions.includes('read:*')) {
      return false
    }

    // Check specific attachment permissions
    if (filename.startsWith('private-') && !permissions.includes(`admin:${docId}`)) {
      return false
    }

    return true
  }

  async getSecureAttachment(
    userId: string,
    docId: string,
    filename: string
  ): Promise<Blob> {
    if (!this.canAccessAttachment(userId, docId, filename)) {
      throw new Error('Access denied')
    }

    return this.db.getAttachment(docId, filename)
  }
}
```

## Best Practices

1. **Use appropriate file types** - Only allow necessary file types
2. **Implement size limits** - Prevent large files from overwhelming storage
3. **Optimize images** - Compress and create thumbnails
4. **Validate files** - Check content type and scan for malware
5. **Cache strategically** - Use lazy loading and caching for performance
6. **Handle sync carefully** - Large attachments can slow sync
7. **Implement access control** - Protect sensitive attachments
8. **Monitor storage usage** - Track attachment storage consumption
9. **Clean up unused attachments** - Remove orphaned files
10. **Use progressive upload** - Chunk large files for better UX

Attachments are powerful but require careful handling to maintain performance and security in your PouchDB applications.