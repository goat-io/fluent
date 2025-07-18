# Node XLSX Package

The `@goatlab/node-xlsx` package provides high-performance Excel file processing capabilities for Node.js applications. It offers streaming support for processing large Excel files without memory issues.

## Installation

```bash
npm install @goatlab/node-xlsx
# or
pnpm add @goatlab/node-xlsx
```

## Core Features

### xlsxStream

The main utility for streaming Excel file processing.

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

// Basic usage
const readableStream = await xlsxStream.getReadableStream({
  filePath: './data.xlsx',
  sheet: 0,
  withHeader: true
})
```

## Basic Usage

### Reading Excel Files

```typescript
import { xlsxStream, IXlsxStreamOptions } from '@goatlab/node-xlsx'

const options: IXlsxStreamOptions = {
  filePath: './employees.xlsx',
  sheet: 0, // First sheet
  withHeader: true // Use first row as headers
}

const stream = await xlsxStream.getReadableStream(options)

// Process each row
stream.on('data', (row) => {
  console.log('Row data:', row.formatted.obj)
})

stream.on('end', () => {
  console.log('Finished processing file')
})
```

## Streaming Methods

### Single Row Processing

Process one row at a time for memory efficiency:

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

type EmployeeRow = {
  Name: string
  Email: string
  Department: string
  Salary: string
}

await xlsxStream.stream<keyof EmployeeRow, any>({
  file: {
    filePath: './employees.xlsx',
    sheet: 0,
    withHeader: true
  },
  batchSize: 1,
  rowMapper: (row, index) => {
    // Transform raw row data
    return {
      id: index + 1,
      name: row.Name?.trim(),
      email: row.Email?.toLowerCase(),
      department: row.Department,
      salary: parseFloat(row.Salary?.replace(/[$,]/g, '') || '0')
    }
  },
  fx: async (employee) => {
    // Process single employee
    await saveEmployeeToDatabase(employee)
    console.log(`Processed employee: ${employee.name}`)
  },
  mapOptions: {
    concurrency: 5 // Process 5 rows concurrently
  }
})
```

### Batch Processing

Process multiple rows in batches for better throughput:

```typescript
await xlsxStream.batchStream<keyof EmployeeRow, any>({
  file: {
    filePath: './employees.xlsx',
    sheet: 0,
    withHeader: true
  },
  batchSize: 100, // Process 100 rows at a time
  rowMapper: (row, index) => {
    if (!row.Name || !row.Email) {
      return null // Skip invalid rows
    }
    
    return {
      id: index + 1,
      name: row.Name.trim(),
      email: row.Email.toLowerCase(),
      department: row.Department || 'Unknown',
      salary: parseFloat(row.Salary?.replace(/[$,]/g, '') || '0'),
      startDate: new Date(row.StartDate || Date.now())
    }
  },
  fx: async (employeeBatch) => {
    // Process batch of employees
    await saveEmployeeBatchToDatabase(employeeBatch)
    console.log(`Processed batch of ${employeeBatch.length} employees`)
  },
  mapOptions: {
    concurrency: 3 // Process 3 batches concurrently
  }
})
```

## Advanced Usage

### Data Validation and Transformation

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

type ProductRow = {
  ProductID: string
  Name: string
  Price: string
  Category: string
  InStock: string
}

const processProducts = async () => {
  let validCount = 0
  let invalidCount = 0
  
  await xlsxStream.stream<keyof ProductRow, any>({
    file: {
      filePath: './products.xlsx',
      sheet: 0,
      withHeader: true
    },
    batchSize: 1,
    rowMapper: (row, index) => {
      // Validate required fields
      if (!row.ProductID || !row.Name || !row.Price) {
        invalidCount++
        return null
      }
      
      // Transform and validate data
      const price = parseFloat(row.Price.replace(/[$,]/g, ''))
      if (isNaN(price) || price < 0) {
        invalidCount++
        return null
      }
      
      validCount++
      return {
        id: row.ProductID.trim(),
        name: row.Name.trim(),
        price: price,
        category: row.Category?.trim() || 'Uncategorized',
        inStock: row.InStock?.toLowerCase() === 'true'
      }
    },
    fx: async (product) => {
      if (product) {
        await saveProductToDatabase(product)
      }
    },
    mapOptions: {
      concurrency: 10
    }
  })
  
  console.log(`Processing complete. Valid: ${validCount}, Invalid: ${invalidCount}`)
}
```

### Error Handling and Logging

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

const processWithErrorHandling = async () => {
  const errors: Array<{ row: number, error: string }> = []
  let processedCount = 0
  
  try {
    await xlsxStream.batchStream({
      file: {
        filePath: './data.xlsx',
        sheet: 0,
        withHeader: true
      },
      batchSize: 50,
      rowMapper: (row, index) => {
        try {
          // Validate and transform row
          return transformRow(row, index)
        } catch (error) {
          errors.push({
            row: index + 2, // +2 because index is 0-based and we have header
            error: error.message
          })
          return null
        }
      },
      fx: async (batch) => {
        try {
          await processBatch(batch)
          processedCount += batch.length
          
          // Log progress
          if (processedCount % 500 === 0) {
            console.log(`Processed ${processedCount} records`)
          }
        } catch (error) {
          console.error('Batch processing error:', error)
          throw error
        }
      },
      mapOptions: {
        concurrency: 5
      }
    })
  } catch (error) {
    console.error('Stream processing failed:', error)
  }
  
  // Report errors
  if (errors.length > 0) {
    console.log(`Processing completed with ${errors.length} errors:`)
    errors.forEach(({ row, error }) => {
      console.log(`Row ${row}: ${error}`)
    })
  }
}
```

### Multiple Sheet Processing

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

const processMultipleSheets = async () => {
  const sheets = [
    { name: 'Employees', index: 0 },
    { name: 'Departments', index: 1 },
    { name: 'Projects', index: 2 }
  ]
  
  for (const sheet of sheets) {
    console.log(`Processing sheet: ${sheet.name}`)
    
    await xlsxStream.batchStream({
      file: {
        filePath: './company-data.xlsx',
        sheet: sheet.index,
        withHeader: true
      },
      batchSize: 100,
      rowMapper: (row, index) => {
        // Sheet-specific transformation
        switch (sheet.name) {
          case 'Employees':
            return transformEmployee(row, index)
          case 'Departments':
            return transformDepartment(row, index)
          case 'Projects':
            return transformProject(row, index)
          default:
            return null
        }
      },
      fx: async (batch) => {
        await saveToDatabase(sheet.name, batch)
      },
      mapOptions: {
        concurrency: 3
      }
    })
    
    console.log(`Completed processing sheet: ${sheet.name}`)
  }
}
```

## Performance Optimization

### Memory-Efficient Processing

```typescript
// Process large files without loading into memory
const processLargeFile = async (filePath: string) => {
  let totalRows = 0
  const startTime = Date.now()
  
  await xlsxStream.stream({
    file: {
      filePath,
      sheet: 0,
      withHeader: true
    },
    batchSize: 1,
    rowMapper: (row, index) => {
      totalRows++
      return processRow(row)
    },
    fx: async (data) => {
      // Process without accumulating in memory
      await processAndDiscard(data)
    },
    mapOptions: {
      concurrency: 10 // Adjust based on system capacity
    }
  })
  
  const duration = Date.now() - startTime
  console.log(`Processed ${totalRows} rows in ${duration}ms`)
}
```

### Optimal Batch Sizing

```typescript
// Determine optimal batch size based on data complexity
const getBatchSize = (estimatedRowSize: number) => {
  const targetMemoryUsage = 50 * 1024 * 1024 // 50MB
  const batchSize = Math.floor(targetMemoryUsage / estimatedRowSize)
  return Math.max(10, Math.min(1000, batchSize))
}

await xlsxStream.batchStream({
  file: options,
  batchSize: getBatchSize(1024), // Assume 1KB per row
  rowMapper: mapRow,
  fx: processBatch,
  mapOptions: {
    concurrency: 5
  }
})
```

## Data Processing Patterns

### ETL Pipeline

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

class ExcelETLProcessor {
  private stats = {
    extracted: 0,
    transformed: 0,
    loaded: 0,
    errors: 0
  }
  
  async processFile(filePath: string) {
    await xlsxStream.batchStream({
      file: {
        filePath,
        sheet: 0,
        withHeader: true
      },
      batchSize: 200,
      rowMapper: (row, index) => {
        this.stats.extracted++
        
        try {
          const transformed = this.transformRow(row)
          if (transformed) {
            this.stats.transformed++
          }
          return transformed
        } catch (error) {
          this.stats.errors++
          console.error(`Transform error at row ${index}:`, error)
          return null
        }
      },
      fx: async (batch) => {
        await this.loadBatch(batch)
        this.stats.loaded += batch.length
        
        // Log progress
        console.log(`ETL Progress: ${JSON.stringify(this.stats)}`)
      },
      mapOptions: {
        concurrency: 3
      }
    })
    
    return this.stats
  }
  
  private transformRow(row: any) {
    // Extract
    const data = this.extractData(row)
    
    // Transform
    const transformed = this.applyBusinessRules(data)
    
    // Validate
    if (!this.validateData(transformed)) {
      throw new Error('Data validation failed')
    }
    
    return transformed
  }
  
  private async loadBatch(batch: any[]) {
    // Load to database with transaction
    await this.database.transaction(async (tx) => {
      for (const item of batch) {
        await tx.insert(item)
      }
    })
  }
}
```

### Data Aggregation

```typescript
const aggregateData = async (filePath: string) => {
  const aggregations = {
    totalSales: 0,
    countByRegion: new Map<string, number>(),
    topProducts: new Map<string, number>()
  }
  
  await xlsxStream.stream({
    file: {
      filePath,
      sheet: 0,
      withHeader: true
    },
    batchSize: 1,
    rowMapper: (row, index) => ({
      sale: parseFloat(row.Amount || '0'),
      region: row.Region,
      product: row.Product
    }),
    fx: async (data) => {
      // Update aggregations
      aggregations.totalSales += data.sale
      
      const regionCount = aggregations.countByRegion.get(data.region) || 0
      aggregations.countByRegion.set(data.region, regionCount + 1)
      
      const productSales = aggregations.topProducts.get(data.product) || 0
      aggregations.topProducts.set(data.product, productSales + data.sale)
    },
    mapOptions: {
      concurrency: 1 // Sequential for aggregations
    }
  })
  
  return aggregations
}
```

## Integration Examples

### Express.js File Upload

```typescript
import express from 'express'
import multer from 'multer'
import { xlsxStream } from '@goatlab/node-xlsx'

const app = express()
const upload = multer({ dest: 'uploads/' })

app.post('/upload-excel', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  
  try {
    const results = []
    let errorCount = 0
    
    await xlsxStream.stream({
      file: {
        filePath: req.file.path,
        sheet: 0,
        withHeader: true
      },
      batchSize: 1,
      rowMapper: (row, index) => {
        try {
          return validateAndTransform(row)
        } catch (error) {
          errorCount++
          return null
        }
      },
      fx: async (data) => {
        if (data) {
          results.push(data)
        }
      },
      mapOptions: {
        concurrency: 5
      }
    })
    
    res.json({
      success: true,
      processed: results.length,
      errors: errorCount
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Database Migration

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

const migrateFromExcel = async (filePath: string) => {
  const migrationStats = {
    total: 0,
    success: 0,
    failed: 0
  }
  
  await xlsxStream.batchStream({
    file: {
      filePath,
      sheet: 0,
      withHeader: true
    },
    batchSize: 500,
    rowMapper: (row, index) => {
      migrationStats.total++
      
      try {
        return {
          id: row.ID,
          name: row.Name,
          createdAt: new Date(row.CreatedAt),
          updatedAt: new Date()
        }
      } catch (error) {
        migrationStats.failed++
        console.error(`Migration error at row ${index}:`, error)
        return null
      }
    },
    fx: async (batch) => {
      try {
        await database.batchInsert('users', batch)
        migrationStats.success += batch.length
      } catch (error) {
        migrationStats.failed += batch.length
        console.error('Batch insert failed:', error)
      }
    },
    mapOptions: {
      concurrency: 2
    }
  })
  
  console.log('Migration completed:', migrationStats)
  return migrationStats
}
```

## Error Handling Best Practices

```typescript
import { xlsxStream } from '@goatlab/node-xlsx'

const robustProcessing = async (filePath: string) => {
  const errorLog = []
  
  try {
    await xlsxStream.batchStream({
      file: {
        filePath,
        sheet: 0,
        withHeader: true
      },
      batchSize: 100,
      rowMapper: (row, index) => {
        try {
          // Validate required fields
          if (!row.required_field) {
            throw new Error('Missing required field')
          }
          
          return transformRow(row)
        } catch (error) {
          errorLog.push({
            row: index + 2, // Account for header
            error: error.message,
            data: row
          })
          return null
        }
      },
      fx: async (batch) => {
        const validBatch = batch.filter(item => item !== null)
        
        if (validBatch.length > 0) {
          await processValidBatch(validBatch)
        }
      },
      mapOptions: {
        concurrency: 5
      }
    })
  } catch (error) {
    console.error('Processing failed:', error)
    throw error
  }
  
  // Save error log
  if (errorLog.length > 0) {
    await saveErrorLog(errorLog)
  }
  
  return errorLog
}
```

## Performance Monitoring

```typescript
const monitoredProcessing = async (filePath: string) => {
  const metrics = {
    startTime: Date.now(),
    processedRows: 0,
    errors: 0,
    memoryUsage: []
  }
  
  const memoryMonitor = setInterval(() => {
    const usage = process.memoryUsage()
    metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal
    })
  }, 1000)
  
  try {
    await xlsxStream.stream({
      file: {
        filePath,
        sheet: 0,
        withHeader: true
      },
      batchSize: 1,
      rowMapper: (row, index) => {
        metrics.processedRows++
        
        if (metrics.processedRows % 1000 === 0) {
          console.log(`Processed ${metrics.processedRows} rows`)
        }
        
        return transformRow(row)
      },
      fx: async (data) => {
        await processData(data)
      },
      mapOptions: {
        concurrency: 5
      }
    })
  } catch (error) {
    metrics.errors++
    throw error
  } finally {
    clearInterval(memoryMonitor)
    
    metrics.totalTime = Date.now() - metrics.startTime
    console.log('Processing metrics:', metrics)
  }
}
```

## TypeScript Integration

```typescript
// Define your row types
interface SalesRow {
  OrderID: string
  CustomerName: string
  ProductName: string
  Quantity: string
  Price: string
  OrderDate: string
}

interface ProcessedSale {
  orderId: string
  customerName: string
  productName: string
  quantity: number
  price: number
  orderDate: Date
  total: number
}

// Type-safe processing
await xlsxStream.batchStream<keyof SalesRow, ProcessedSale>({
  file: {
    filePath: './sales.xlsx',
    sheet: 0,
    withHeader: true
  },
  batchSize: 200,
  rowMapper: (row: Record<keyof SalesRow, string>, index: number): ProcessedSale | null => {
    try {
      const quantity = parseInt(row.Quantity, 10)
      const price = parseFloat(row.Price.replace(/[$,]/g, ''))
      
      return {
        orderId: row.OrderID,
        customerName: row.CustomerName,
        productName: row.ProductName,
        quantity,
        price,
        orderDate: new Date(row.OrderDate),
        total: quantity * price
      }
    } catch (error) {
      console.error(`Error processing row ${index}:`, error)
      return null
    }
  },
  fx: async (batch: ProcessedSale[]) => {
    await saveSalesToDatabase(batch)
  },
  mapOptions: {
    concurrency: 3
  }
})
```

## Contributing

The node-xlsx package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.