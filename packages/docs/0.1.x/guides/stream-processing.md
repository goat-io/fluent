# Stream Processing Guide

This guide covers stream processing patterns using the `@goatlab/node-utils` Streams utility, which provides powerful stream manipulation capabilities for Node.js applications.

## Basic Stream Operations

### Creating Readable Streams

```typescript
import { Streams } from '@goatlab/node-utils'

// Create stream from array
const data = [1, 2, 3, 4, 5]
const readable = Streams.readableFrom(data)

// Create stream from async iterable
async function* generateData() {
  for (let i = 0; i < 100; i++) {
    yield { id: i, value: Math.random() }
  }
}

const asyncReadable = Streams.readableFrom(generateData())
```

### Simple Pipeline

```typescript
import { Streams } from '@goatlab/node-utils'

await Streams.pipeline([
  Streams.readableFrom([1, 2, 3, 4, 5]),
  Streams.map(async (item) => item * 2),
  Streams.filter(item => item > 4),
  Streams.closePipeline()
])
```

## Data Transformation

### Map Transformations

```typescript
// Async mapping
await Streams.pipeline([
  Streams.readableFrom(userIds),
  Streams.map(async (userId) => {
    const user = await database.users.findById(userId)
    return {
      id: user.id,
      name: user.name,
      email: user.email
    }
  }, { concurrency: 10 }),
  Streams.closePipeline()
])

// Synchronous mapping
await Streams.pipeline([
  Streams.readableFrom(numbers),
  Streams.mapSync(n => n * 2),
  Streams.closePipeline()
])
```

### Filtering

```typescript
await Streams.pipeline([
  Streams.readableFrom(users),
  Streams.filter(user => user.age >= 18),
  Streams.filter(user => user.active === true),
  Streams.closePipeline()
])
```

### Buffering/Batching

```typescript
await Streams.pipeline([
  Streams.readableFrom(largeDataset),
  Streams.buffer({ batchSize: 100 }),
  Streams.map(async (batch) => {
    // Process 100 items at a time
    await processBatch(batch)
  }),
  Streams.closePipeline()
])
```

## File Processing

### Reading Large Files

```typescript
import fs from 'fs'
import { Streams } from '@goatlab/node-utils'

// Process large text file line by line
await Streams.pipeline([
  fs.createReadStream('./large-file.txt'),
  Streams.map(async (chunk) => {
    // Process each chunk
    return chunk.toString().split('\n')
  }),
  Streams.map(async (lines) => {
    // Process each line
    return lines.map(line => line.trim()).filter(line => line)
  }),
  Streams.toWriteStream('./processed-file.txt'),
  Streams.closePipeline()
])
```

### CSV Processing

```typescript
import fs from 'fs'
import csv from 'csv-parser'

await Streams.pipeline([
  fs.createReadStream('./data.csv'),
  csv(),
  Streams.map(async (row) => {
    // Transform CSV row
    return {
      id: parseInt(row.id),
      name: row.name.trim(),
      email: row.email.toLowerCase(),
      age: parseInt(row.age)
    }
  }),
  Streams.filter(row => row.age >= 18),
  Streams.buffer({ batchSize: 1000 }),
  Streams.map(async (batch) => {
    // Save batch to database
    await database.users.insertMany(batch)
  }),
  Streams.closePipeline()
])
```

### JSON Processing

```typescript
import fs from 'fs'

// Process NDJSON (newline-delimited JSON)
await Streams.pipeline([
  fs.createReadStream('./data.ndjson'),
  Streams.parseJson(),
  Streams.map(async (item) => {
    // Transform JSON item
    return await transformItem(item)
  }),
  Streams.toNDJson(),
  Streams.toWriteStream('./transformed-data.ndjson'),
  Streams.closePipeline()
])
```

## Compression and Decompression

### Gzip Compression

```typescript
import fs from 'fs'

// Compress file
await Streams.pipeline([
  fs.createReadStream('./large-file.txt'),
  Streams.gzip(),
  Streams.toWriteStream('./large-file.txt.gz'),
  Streams.closePipeline()
])

// Decompress file
await Streams.pipeline([
  fs.createReadStream('./large-file.txt.gz'),
  Streams.unGzip(),
  Streams.toWriteStream('./decompressed-file.txt'),
  Streams.closePipeline()
])
```

## Progress Monitoring

### Basic Progress Logging

```typescript
await Streams.pipeline([
  Streams.readableFrom(largeDataset),
  Streams.logProgress({ 
    interval: 1000, 
    label: 'Processing items' 
  }),
  Streams.map(async (item) => {
    return await processItem(item)
  }),
  Streams.closePipeline()
])
```

### Custom Progress Tracking

```typescript
let processedCount = 0
let totalCount = largeDataset.length

await Streams.pipeline([
  Streams.readableFrom(largeDataset),
  Streams.map(async (item) => {
    const result = await processItem(item)
    processedCount++
    
    if (processedCount % 100 === 0) {
      const progress = (processedCount / totalCount) * 100
      console.log(`Progress: ${progress.toFixed(1)}%`)
    }
    
    return result
  }),
  Streams.closePipeline()
])
```

## Error Handling

### Graceful Error Handling

```typescript
await Streams.pipeline([
  Streams.readableFrom(items),
  Streams.map(async (item) => {
    try {
      return await processItem(item)
    } catch (error) {
      console.error(`Error processing item ${item.id}:`, error)
      return null // Skip failed items
    }
  }),
  Streams.filter(item => item !== null),
  Streams.closePipeline()
])
```

### Error Recovery

```typescript
const errors = []

await Streams.pipeline([
  Streams.readableFrom(items),
  Streams.map(async (item) => {
    try {
      return await processItem(item)
    } catch (error) {
      errors.push({ item, error })
      return null
    }
  }),
  Streams.filter(item => item !== null),
  Streams.closePipeline()
])

// Process errors separately
if (errors.length > 0) {
  console.log(`${errors.length} items failed processing`)
  await saveErrorLog(errors)
}
```

## Real-world Examples

### ETL Pipeline

```typescript
import { Streams } from '@goatlab/node-utils'

class ETLPipeline {
  async processUserData(inputFile: string, outputFile: string) {
    const stats = {
      extracted: 0,
      transformed: 0,
      loaded: 0,
      errors: 0
    }
    
    await Streams.pipeline([
      // Extract
      fs.createReadStream(inputFile),
      csv(),
      Streams.map(async (row) => {
        stats.extracted++
        return row
      }),
      
      // Transform
      Streams.map(async (row) => {
        try {
          const transformed = await this.transformUser(row)
          stats.transformed++
          return transformed
        } catch (error) {
          stats.errors++
          console.error(`Transform error for row ${row.id}:`, error)
          return null
        }
      }),
      
      // Filter out failed transformations
      Streams.filter(user => user !== null),
      
      // Load in batches
      Streams.buffer({ batchSize: 100 }),
      Streams.map(async (batch) => {
        await this.loadUsers(batch)
        stats.loaded += batch.length
        
        // Progress reporting
        console.log(`ETL Progress: ${JSON.stringify(stats)}`)
      }),
      
      Streams.closePipeline()
    ])
    
    return stats
  }
  
  private async transformUser(row: any) {
    return {
      id: parseInt(row.id),
      name: row.first_name + ' ' + row.last_name,
      email: row.email.toLowerCase(),
      age: parseInt(row.age),
      active: row.status === 'active',
      createdAt: new Date(row.created_at)
    }
  }
  
  private async loadUsers(users: any[]) {
    await database.users.insertMany(users)
  }
}
```

### Log Processing

```typescript
import { Streams } from '@goatlab/node-utils'

class LogProcessor {
  async processLogs(logFile: string) {
    const stats = {
      totalLines: 0,
      errors: 0,
      warnings: 0,
      info: 0
    }
    
    await Streams.pipeline([
      fs.createReadStream(logFile),
      Streams.map(async (chunk) => {
        return chunk.toString().split('\n').filter(line => line.trim())
      }),
      Streams.map(async (lines) => {
        return lines.map(line => this.parseLogLine(line))
      }),
      Streams.filter(entries => entries.length > 0),
      Streams.map(async (entries) => {
        entries.forEach(entry => {
          stats.totalLines++
          if (entry.level === 'error') stats.errors++
          else if (entry.level === 'warning') stats.warnings++
          else stats.info++
        })
        
        return entries
      }),
      Streams.buffer({ batchSize: 1000 }),
      Streams.map(async (batch) => {
        await this.saveLogEntries(batch.flat())
      }),
      Streams.closePipeline()
    ])
    
    return stats
  }
  
  private parseLogLine(line: string) {
    // Parse log format: [timestamp] [level] message
    const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/)
    if (!match) return null
    
    return {
      timestamp: new Date(match[1]),
      level: match[2],
      message: match[3]
    }
  }
  
  private async saveLogEntries(entries: any[]) {
    await database.logs.insertMany(entries)
  }
}
```

### API Data Aggregation

```typescript
import { Streams } from '@goatlab/node-utils'

class APIAggregator {
  async aggregateUserData(userIds: string[]) {
    const results = []
    
    await Streams.pipeline([
      Streams.readableFrom(userIds),
      
      // Fetch user data with concurrency control
      Streams.map(async (userId) => {
        const [user, posts, comments] = await Promise.all([
          this.fetchUser(userId),
          this.fetchUserPosts(userId),
          this.fetchUserComments(userId)
        ])
        
        return {
          user,
          posts,
          comments,
          totalActivity: posts.length + comments.length
        }
      }, { concurrency: 5 }),
      
      // Filter active users
      Streams.filter(data => data.totalActivity > 0),
      
      // Sort by activity
      Streams.buffer({ batchSize: 100 }),
      Streams.map(async (batch) => {
        const sorted = batch.sort((a, b) => b.totalActivity - a.totalActivity)
        results.push(...sorted)
      }),
      
      Streams.closePipeline()
    ])
    
    return results
  }
  
  private async fetchUser(userId: string) {
    const response = await fetch(`/api/users/${userId}`)
    return await response.json()
  }
  
  private async fetchUserPosts(userId: string) {
    const response = await fetch(`/api/users/${userId}/posts`)
    return await response.json()
  }
  
  private async fetchUserComments(userId: string) {
    const response = await fetch(`/api/users/${userId}/comments`)
    return await response.json()
  }
}
```

### Image Processing Pipeline

```typescript
import { Streams } from '@goatlab/node-utils'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

class ImageProcessor {
  async processImages(inputDir: string, outputDir: string) {
    const imageFiles = fs.readdirSync(inputDir)
      .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
    
    await Streams.pipeline([
      Streams.readableFrom(imageFiles),
      
      // Process images with concurrency
      Streams.map(async (filename) => {
        const inputPath = path.join(inputDir, filename)
        const outputPath = path.join(outputDir, filename)
        
        await sharp(inputPath)
          .resize(800, 600)
          .jpeg({ quality: 80 })
          .toFile(outputPath)
        
        return { filename, processed: true }
      }, { concurrency: 3 }),
      
      // Log progress
      Streams.logProgress({ 
        interval: 10, 
        label: 'Processing images' 
      }),
      
      Streams.closePipeline()
    ])
  }
}
```

## Performance Optimization

### Memory Management

```typescript
// Use streaming to avoid loading large datasets into memory
await Streams.pipeline([
  fs.createReadStream('./huge-file.csv'),
  csv(),
  Streams.map(async (row) => {
    // Process row without storing all data
    return await processRow(row)
  }),
  Streams.buffer({ batchSize: 1000 }),
  Streams.map(async (batch) => {
    await saveBatch(batch)
  }),
  Streams.closePipeline()
])
```

### Concurrency Control

```typescript
// Control concurrency to prevent overwhelming external services
await Streams.pipeline([
  Streams.readableFrom(urls),
  Streams.map(async (url) => {
    const response = await fetch(url)
    return await response.json()
  }, { concurrency: 5 }), // Limit to 5 concurrent requests
  Streams.closePipeline()
])
```

### Backpressure Handling

```typescript
// Streams automatically handle backpressure
await Streams.pipeline([
  Streams.readableFrom(largeDataset),
  Streams.map(async (item) => {
    // Slow processing - backpressure is handled automatically
    await new Promise(resolve => setTimeout(resolve, 100))
    return await processItem(item)
  }),
  Streams.closePipeline()
])
```

## Testing Stream Pipelines

### Unit Testing

```typescript
import { Streams } from '@goatlab/node-utils'

describe('Stream Processing', () => {
  it('should transform data correctly', async () => {
    const input = [1, 2, 3, 4, 5]
    const results = []
    
    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.map(async (item) => item * 2),
      Streams.map(async (item) => {
        results.push(item)
      }),
      Streams.closePipeline()
    ])
    
    expect(results).toEqual([2, 4, 6, 8, 10])
  })
  
  it('should handle errors gracefully', async () => {
    const input = [1, 2, 3, 4, 5]
    const errors = []
    const results = []
    
    await Streams.pipeline([
      Streams.readableFrom(input),
      Streams.map(async (item) => {
        if (item === 3) {
          throw new Error('Test error')
        }
        return item * 2
      }),
      Streams.map(async (item) => {
        try {
          results.push(item)
        } catch (error) {
          errors.push(error)
        }
      }),
      Streams.closePipeline()
    ])
    
    expect(errors).toHaveLength(1)
    expect(results).toEqual([2, 4, 8, 10])
  })
})
```

### Integration Testing

```typescript
import { Streams } from '@goatlab/node-utils'
import fs from 'fs'

describe('File Processing Integration', () => {
  it('should process CSV file correctly', async () => {
    const testFile = './test-data.csv'
    const outputFile = './test-output.json'
    
    // Create test CSV
    fs.writeFileSync(testFile, 'id,name,age\n1,John,25\n2,Jane,30')
    
    const results = []
    
    await Streams.pipeline([
      fs.createReadStream(testFile),
      csv(),
      Streams.map(async (row) => {
        return {
          id: parseInt(row.id),
          name: row.name,
          age: parseInt(row.age)
        }
      }),
      Streams.map(async (item) => {
        results.push(item)
      }),
      Streams.closePipeline()
    ])
    
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ id: 1, name: 'John', age: 25 })
    
    // Cleanup
    fs.unlinkSync(testFile)
  })
})
```

## Best Practices

1. **Use Appropriate Batch Sizes**: Balance memory usage and processing efficiency
2. **Control Concurrency**: Limit concurrent operations to prevent overwhelming services
3. **Handle Errors Gracefully**: Implement proper error handling and recovery
4. **Monitor Progress**: Add progress logging for long-running operations
5. **Test Thoroughly**: Test with various data sizes and error conditions
6. **Memory Management**: Use streaming to avoid loading large datasets into memory
7. **Cleanup Resources**: Ensure streams are properly closed and resources are cleaned up

## Common Pitfalls

1. **Not Handling Backpressure**: Allowing unbounded queues can cause memory issues
2. **Excessive Concurrency**: Too many concurrent operations can overwhelm systems
3. **Ignoring Errors**: Not properly handling errors can cause data loss
4. **Memory Leaks**: Not cleaning up resources properly
5. **Blocking Operations**: Using synchronous operations in async streams

## Performance Monitoring

```typescript
class StreamMonitor {
  private startTime: number
  private itemCount: number = 0
  
  constructor() {
    this.startTime = Date.now()
  }
  
  logProgress(interval: number = 1000) {
    return Streams.map(async (item) => {
      this.itemCount++
      
      if (this.itemCount % interval === 0) {
        const elapsed = Date.now() - this.startTime
        const rate = this.itemCount / (elapsed / 1000)
        console.log(`Processed ${this.itemCount} items at ${rate.toFixed(2)} items/sec`)
      }
      
      return item
    })
  }
}
```

This comprehensive guide covers the essential patterns and techniques for effective stream processing using the Goat Fluent utilities.