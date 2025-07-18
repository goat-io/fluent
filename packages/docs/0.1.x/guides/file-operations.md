# File Operations Guide

This guide covers file handling patterns using the `@goatlab/node-utils` utilities, including folder operations, file processing, and stream-based file manipulation.

## Basic File Operations

### Folder Operations

```typescript
import { Folders } from '@goatlab/node-utils'

// Get folder size
const size = await Folders.getSize('./path/to/folder')
console.log(`Folder size: ${size} bytes`)

// Copy folder recursively
await Folders.copy('./source-folder', './destination-folder')

// Delete folder and all contents
await Folders.delete('./path/to/folder')

// Create directory structure
await Folders.ensureDir('./path/to/nested/folder')

// List all files recursively
const files = await Folders.listFiles('./path/to/folder', {
  recursive: true,
  extensions: ['.js', '.ts', '.json']
})
```

### File System Utilities

```typescript
import fs from 'fs'
import path from 'path'
import { Folders } from '@goatlab/node-utils'

// Check if directory exists and create if needed
const ensureDirectory = async (dirPath: string) => {
  try {
    await fs.promises.access(dirPath)
  } catch {
    await Folders.ensureDir(dirPath)
  }
}

// Get file stats
const getFileInfo = async (filePath: string) => {
  const stats = await fs.promises.stat(filePath)
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory()
  }
}
```

## Stream-Based File Processing

### Reading Large Files

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Process large text file line by line
const processLargeFile = async (filePath: string) => {
  let lineCount = 0
  
  await Streams.pipeline([
    fs.createReadStream(filePath, { encoding: 'utf8' }),
    Streams.map(async (chunk) => {
      // Split chunk into lines
      const lines = chunk.toString().split('\n')
      lineCount += lines.length
      return lines
    }),
    Streams.map(async (lines) => {
      // Process each line
      return lines.map(line => line.trim()).filter(line => line.length > 0)
    }),
    Streams.logProgress({ interval: 10000, label: 'Processing lines' }),
    Streams.closePipeline()
  ])
  
  console.log(`Processed ${lineCount} lines`)
}
```

### Writing Files with Streams

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Write processed data to file
const writeProcessedData = async (data: any[], outputPath: string) => {
  await Streams.pipeline([
    Streams.readableFrom(data),
    Streams.map(async (item) => JSON.stringify(item) + '\n'),
    Streams.toWriteStream(outputPath),
    Streams.closePipeline()
  ])
}

// Append to existing file
const appendToFile = async (data: any[], outputPath: string) => {
  const writeStream = fs.createWriteStream(outputPath, { flags: 'a' })
  
  await Streams.pipeline([
    Streams.readableFrom(data),
    Streams.map(async (item) => JSON.stringify(item) + '\n'),
    writeStream,
    Streams.closePipeline()
  ])
}
```

## CSV File Processing

### Reading CSV Files

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'
import csv from 'csv-parser'

const processCSV = async (filePath: string) => {
  const results = []
  
  await Streams.pipeline([
    fs.createReadStream(filePath),
    csv(),
    Streams.map(async (row) => {
      // Transform CSV row
      return {
        id: parseInt(row.id),
        name: row.name?.trim(),
        email: row.email?.toLowerCase(),
        age: parseInt(row.age) || 0
      }
    }),
    Streams.filter(row => row.name && row.email),
    Streams.map(async (row) => {
      results.push(row)
    }),
    Streams.closePipeline()
  ])
  
  return results
}
```

### Writing CSV Files

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

const writeCSV = async (data: any[], outputPath: string) => {
  const headers = Object.keys(data[0]).join(',')
  
  await Streams.pipeline([
    Streams.readableFrom([headers, ...data]),
    Streams.map(async (item, index) => {
      if (index === 0) {
        return item + '\n' // Headers
      }
      
      const values = Object.values(item).map(val => 
        typeof val === 'string' ? `"${val}"` : val
      ).join(',')
      
      return values + '\n'
    }),
    Streams.toWriteStream(outputPath),
    Streams.closePipeline()
  ])
}
```

## JSON File Processing

### Reading JSON Files

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Process large JSON file
const processLargeJSON = async (filePath: string) => {
  const content = await fs.promises.readFile(filePath, 'utf8')
  const data = JSON.parse(content)
  
  await Streams.pipeline([
    Streams.readableFrom(data),
    Streams.map(async (item) => {
      // Transform item
      return await processItem(item)
    }),
    Streams.buffer({ batchSize: 100 }),
    Streams.map(async (batch) => {
      // Process batch
      await saveBatch(batch)
    }),
    Streams.closePipeline()
  ])
}

// Process NDJSON (newline-delimited JSON)
const processNDJSON = async (filePath: string) => {
  await Streams.pipeline([
    fs.createReadStream(filePath),
    Streams.parseJson(),
    Streams.map(async (item) => {
      return await processItem(item)
    }),
    Streams.closePipeline()
  ])
}
```

### Writing JSON Files

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Write JSON array to file
const writeJSON = async (data: any[], outputPath: string) => {
  await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2))
}

// Write NDJSON
const writeNDJSON = async (data: any[], outputPath: string) => {
  await Streams.pipeline([
    Streams.readableFrom(data),
    Streams.toNDJson(),
    Streams.toWriteStream(outputPath),
    Streams.closePipeline()
  ])
}
```

## File Compression

### Gzip Compression

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

// Compress file
const compressFile = async (inputPath: string, outputPath: string) => {
  await Streams.pipeline([
    fs.createReadStream(inputPath),
    Streams.gzip(),
    Streams.toWriteStream(outputPath),
    Streams.closePipeline()
  ])
}

// Decompress file
const decompressFile = async (inputPath: string, outputPath: string) => {
  await Streams.pipeline([
    fs.createReadStream(inputPath),
    Streams.unGzip(),
    Streams.toWriteStream(outputPath),
    Streams.closePipeline()
  ])
}
```

### Archive Processing

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'
import archiver from 'archiver'
import unzipper from 'unzipper'

// Create zip archive
const createZipArchive = async (files: string[], outputPath: string) => {
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  
  archive.pipe(output)
  
  for (const file of files) {
    archive.file(file, { name: path.basename(file) })
  }
  
  await archive.finalize()
}

// Extract zip archive
const extractZipArchive = async (archivePath: string, outputDir: string) => {
  await Folders.ensureDir(outputDir)
  
  await Streams.pipeline([
    fs.createReadStream(archivePath),
    unzipper.Extract({ path: outputDir }),
    Streams.closePipeline()
  ])
}
```

## File Monitoring

### Watch File Changes

```typescript
import fs from 'fs'
import { Folders } from '@goatlab/node-utils'

const watchFiles = (directory: string, callback: (event: string, filename: string) => void) => {
  const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
    if (filename) {
      callback(eventType, filename)
    }
  })
  
  return watcher
}

// Watch for changes and process files
const processChangedFiles = async (directory: string) => {
  const watcher = watchFiles(directory, async (event, filename) => {
    if (event === 'change' && filename.endsWith('.txt')) {
      const filePath = path.join(directory, filename)
      console.log(`Processing changed file: ${filePath}`)
      
      try {
        await processFile(filePath)
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error)
      }
    }
  })
  
  // Cleanup function
  return () => watcher.close()
}
```

## File Validation

### Validate File Types

```typescript
import fs from 'fs'
import path from 'path'

const validateFileType = async (filePath: string, allowedTypes: string[]) => {
  const ext = path.extname(filePath).toLowerCase()
  
  if (!allowedTypes.includes(ext)) {
    throw new Error(`Invalid file type: ${ext}. Allowed types: ${allowedTypes.join(', ')}`)
  }
  
  // Check file exists
  try {
    await fs.promises.access(filePath)
  } catch {
    throw new Error(`File not found: ${filePath}`)
  }
  
  return true
}

// Validate file size
const validateFileSize = async (filePath: string, maxSizeBytes: number) => {
  const stats = await fs.promises.stat(filePath)
  
  if (stats.size > maxSizeBytes) {
    throw new Error(`File too large: ${stats.size} bytes. Max allowed: ${maxSizeBytes} bytes`)
  }
  
  return true
}
```

## Real-world Examples

### Log File Processor

```typescript
import { Streams, Folders } from '@goatlab/node-utils'
import fs from 'fs'
import path from 'path'

class LogProcessor {
  async processLogFiles(logDirectory: string) {
    const logFiles = await Folders.listFiles(logDirectory, {
      recursive: true,
      extensions: ['.log']
    })
    
    const stats = {
      totalFiles: logFiles.length,
      processedFiles: 0,
      totalLines: 0,
      errorLines: 0
    }
    
    for (const logFile of logFiles) {
      console.log(`Processing ${logFile}`)
      
      let lineCount = 0
      let errorCount = 0
      
      await Streams.pipeline([
        fs.createReadStream(logFile),
        Streams.map(async (chunk) => {
          return chunk.toString().split('\n').filter(line => line.trim())
        }),
        Streams.map(async (lines) => {
          lineCount += lines.length
          
          const errors = lines.filter(line => 
            line.includes('ERROR') || line.includes('FATAL')
          )
          
          errorCount += errors.length
          
          if (errors.length > 0) {
            await this.saveErrors(logFile, errors)
          }
        }),
        Streams.closePipeline()
      ])
      
      stats.processedFiles++
      stats.totalLines += lineCount
      stats.errorLines += errorCount
      
      console.log(`Processed ${lineCount} lines, found ${errorCount} errors`)
    }
    
    return stats
  }
  
  private async saveErrors(logFile: string, errors: string[]) {
    const errorFile = logFile.replace('.log', '-errors.txt')
    const errorContent = errors.join('\n') + '\n'
    
    await fs.promises.appendFile(errorFile, errorContent)
  }
}
```

### Data Migration Tool

```typescript
import { Streams, Folders } from '@goatlab/node-utils'
import fs from 'fs'
import csv from 'csv-parser'

class DataMigrator {
  async migrateData(sourceDir: string, targetDir: string) {
    await Folders.ensureDir(targetDir)
    
    const csvFiles = await Folders.listFiles(sourceDir, {
      recursive: true,
      extensions: ['.csv']
    })
    
    for (const csvFile of csvFiles) {
      const filename = path.basename(csvFile, '.csv')
      const outputPath = path.join(targetDir, `${filename}.json`)
      
      console.log(`Migrating ${csvFile} to ${outputPath}`)
      
      const records = []
      
      await Streams.pipeline([
        fs.createReadStream(csvFile),
        csv(),
        Streams.map(async (row) => {
          return this.transformRecord(row)
        }),
        Streams.filter(record => record !== null),
        Streams.map(async (record) => {
          records.push(record)
        }),
        Streams.closePipeline()
      ])
      
      await fs.promises.writeFile(outputPath, JSON.stringify(records, null, 2))
      console.log(`Migrated ${records.length} records`)
    }
  }
  
  private transformRecord(row: any) {
    try {
      return {
        id: parseInt(row.id),
        name: row.name?.trim(),
        email: row.email?.toLowerCase(),
        createdAt: new Date(row.created_at).toISOString(),
        active: row.active === 'true'
      }
    } catch (error) {
      console.error('Error transforming record:', error)
      return null
    }
  }
}
```

### File Backup System

```typescript
import { Folders } from '@goatlab/node-utils'
import fs from 'fs'
import path from 'path'

class FileBackup {
  async createBackup(sourceDir: string, backupDir: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `backup-${timestamp}`)
    
    await Folders.ensureDir(backupPath)
    
    // Copy files
    await Folders.copy(sourceDir, backupPath)
    
    // Create manifest
    const files = await Folders.listFiles(backupPath, { recursive: true })
    const manifest = {
      timestamp: new Date().toISOString(),
      sourceDir,
      backupDir: backupPath,
      fileCount: files.length,
      files: await Promise.all(files.map(async (file) => {
        const stats = await fs.promises.stat(file)
        return {
          path: file,
          size: stats.size,
          modified: stats.mtime
        }
      }))
    }
    
    await fs.promises.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )
    
    console.log(`Backup created: ${backupPath}`)
    return backupPath
  }
  
  async restoreBackup(backupPath: string, targetDir: string) {
    const manifestPath = path.join(backupPath, 'manifest.json')
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
    
    await Folders.ensureDir(targetDir)
    
    // Restore files
    for (const fileInfo of manifest.files) {
      if (fileInfo.path.endsWith('manifest.json')) continue
      
      const sourcePath = fileInfo.path
      const relativePath = path.relative(backupPath, sourcePath)
      const targetPath = path.join(targetDir, relativePath)
      
      await Folders.ensureDir(path.dirname(targetPath))
      await fs.promises.copyFile(sourcePath, targetPath)
    }
    
    console.log(`Restored ${manifest.fileCount} files to ${targetDir}`)
  }
}
```

### File Synchronization

```typescript
import { Folders } from '@goatlab/node-utils'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

class FileSync {
  async syncDirectories(sourceDir: string, targetDir: string) {
    await Folders.ensureDir(targetDir)
    
    const sourceFiles = await this.getFileMap(sourceDir)
    const targetFiles = await this.getFileMap(targetDir)
    
    const operations = {
      copied: 0,
      updated: 0,
      deleted: 0
    }
    
    // Copy new and updated files
    for (const [relativePath, sourceInfo] of sourceFiles.entries()) {
      const targetPath = path.join(targetDir, relativePath)
      const targetInfo = targetFiles.get(relativePath)
      
      if (!targetInfo || sourceInfo.hash !== targetInfo.hash) {
        await Folders.ensureDir(path.dirname(targetPath))
        await fs.promises.copyFile(sourceInfo.path, targetPath)
        
        if (targetInfo) {
          operations.updated++
        } else {
          operations.copied++
        }
      }
    }
    
    // Delete removed files
    for (const [relativePath, targetInfo] of targetFiles.entries()) {
      if (!sourceFiles.has(relativePath)) {
        await fs.promises.unlink(targetInfo.path)
        operations.deleted++
      }
    }
    
    return operations
  }
  
  private async getFileMap(directory: string) {
    const files = await Folders.listFiles(directory, { recursive: true })
    const fileMap = new Map()
    
    for (const filePath of files) {
      const relativePath = path.relative(directory, filePath)
      const hash = await this.getFileHash(filePath)
      
      fileMap.set(relativePath, {
        path: filePath,
        hash
      })
    }
    
    return fileMap
  }
  
  private async getFileHash(filePath: string) {
    const content = await fs.promises.readFile(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  }
}
```

## Performance Optimization

### Batch File Operations

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

const processBatchFiles = async (files: string[], batchSize: number = 10) => {
  await Streams.pipeline([
    Streams.readableFrom(files),
    Streams.buffer({ batchSize }),
    Streams.map(async (batch) => {
      // Process batch of files concurrently
      await Promise.all(batch.map(file => processFile(file)))
    }, { concurrency: 3 }),
    Streams.closePipeline()
  ])
}
```

### Memory-Efficient File Processing

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

const processLargeFileEfficiently = async (filePath: string) => {
  // Use streaming to avoid loading entire file into memory
  let totalSize = 0
  let chunkCount = 0
  
  await Streams.pipeline([
    fs.createReadStream(filePath, { highWaterMark: 64 * 1024 }), // 64KB chunks
    Streams.map(async (chunk) => {
      totalSize += chunk.length
      chunkCount++
      
      // Process chunk without storing in memory
      return await processChunk(chunk)
    }),
    Streams.closePipeline()
  ])
  
  console.log(`Processed ${chunkCount} chunks, total size: ${totalSize} bytes`)
}
```

## Error Handling and Recovery

### Robust File Operations

```typescript
import { Folders } from '@goatlab/node-utils'
import fs from 'fs'

const robustFileOperation = async (operation: () => Promise<void>, retries: number = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error)
      
      if (attempt === retries - 1) {
        throw error
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// Usage
await robustFileOperation(async () => {
  await Folders.copy('./source', './destination')
})
```

## Best Practices

1. **Use Streams for Large Files**: Avoid loading entire files into memory
2. **Handle Errors Gracefully**: Implement proper error handling and recovery
3. **Validate Input**: Check file existence, permissions, and types
4. **Clean Up Resources**: Ensure file handles are properly closed
5. **Monitor Progress**: Add progress logging for long operations
6. **Use Appropriate Batch Sizes**: Balance memory usage and performance
7. **Implement Backup Strategies**: Always backup important data before operations

## Security Considerations

1. **Validate File Paths**: Prevent directory traversal attacks
2. **Check File Permissions**: Ensure proper read/write permissions
3. **Sanitize File Names**: Remove dangerous characters
4. **Limit File Sizes**: Prevent DoS attacks through large files
5. **Use Temporary Directories**: Process files in secure temporary locations

This comprehensive guide provides patterns and techniques for effective file operations using the Goat Fluent utilities.