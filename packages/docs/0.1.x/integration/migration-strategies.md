# Data Migration Strategies

This guide covers comprehensive strategies for migrating data between different databases and connectors in Goat Fluent applications.

## Migration Overview

### Migration Types

1. **Schema Migrations** - Changing database structure
2. **Data Migrations** - Moving data between systems
3. **Connector Migrations** - Switching between different connectors
4. **Version Migrations** - Upgrading to new versions

### Migration Planning

```typescript
// types/migration.ts
export interface MigrationPlan {
  source: {
    connector: string
    database: string
    entities: string[]
  }
  target: {
    connector: string
    database: string
    entities: string[]
  }
  strategy: 'bulk' | 'streaming' | 'incremental'
  batchSize?: number
  validation: boolean
  rollback: boolean
}

export interface MigrationResult {
  success: boolean
  recordsProcessed: number
  recordsSuccessful: number
  recordsFailed: number
  errors: string[]
  duration: number
}
```

## Database-to-Database Migration

### SQL to SQL Migration

```typescript
// migrations/sqlToSql.ts
import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '@goatlab/fluent'

export class SqlToSqlMigration {
  private sourceDataSource: DataSource
  private targetDataSource: DataSource
  private batchSize: number

  constructor(
    sourceDataSource: DataSource,
    targetDataSource: DataSource,
    batchSize: number = 1000
  ) {
    this.sourceDataSource = sourceDataSource
    this.targetDataSource = targetDataSource
    this.batchSize = batchSize
  }

  async migrateEntity<T>(
    entityClass: new () => T,
    sourceSchema: any,
    targetSchema: any,
    transformer?: (data: any) => any
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsSuccessful = 0
    let recordsFailed = 0
    const errors: string[] = []

    try {
      // Initialize source and target connectors
      const sourceConnector = new TypeOrmConnector({
        entity: entityClass,
        dataSource: this.sourceDataSource,
        inputSchema: sourceSchema,
        outputSchema: sourceSchema
      })

      const targetConnector = new TypeOrmConnector({
        entity: entityClass,
        dataSource: this.targetDataSource,
        inputSchema: targetSchema,
        outputSchema: targetSchema
      })

      // Get total count for progress tracking
      const totalCount = await sourceConnector.count()
      console.log(`Starting migration of ${totalCount} records`)

      // Process in batches
      let offset = 0
      while (offset < totalCount) {
        try {
          // Fetch batch from source
          const batch = await sourceConnector.findMany({
            limit: this.batchSize,
            offset,
            orderBy: { id: 'asc' }
          })

          recordsProcessed += batch.length

          // Transform data if transformer provided
          const transformedBatch = transformer
            ? batch.map(transformer)
            : batch

          // Insert into target
          await targetConnector.insertMany(transformedBatch)
          recordsSuccessful += batch.length

          console.log(`Migrated ${recordsProcessed}/${totalCount} records`)
          
        } catch (error) {
          recordsFailed += this.batchSize
          errors.push(`Batch ${offset}-${offset + this.batchSize}: ${error.message}`)
          console.error(`Failed to migrate batch ${offset}-${offset + this.batchSize}:`, error)
        }

        offset += this.batchSize
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }
}

// Usage
const migration = new SqlToSqlMigration(
  MySQLDataSource,
  PostgreSQLDataSource,
  2000
)

const result = await migration.migrateEntity(
  User,
  UserInputSchema,
  UserOutputSchema,
  (user) => ({
    ...user,
    fullName: `${user.firstName} ${user.lastName}`, // Transform data
    createdAt: new Date(user.created_at) // Convert date format
  })
)
```

### SQL to NoSQL Migration

```typescript
// migrations/sqlToNoSql.ts
import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '@goatlab/fluent'
import { FirebaseConnector } from '@goatlab/fluent-firebase'

export class SqlToNoSqlMigration {
  private sqlDataSource: DataSource
  private batchSize: number

  constructor(sqlDataSource: DataSource, batchSize: number = 1000) {
    this.sqlDataSource = sqlDataSource
    this.batchSize = batchSize
  }

  async migrateToFirebase<T>(
    entityClass: new () => T,
    sourceSchema: any,
    targetSchema: any,
    transformer?: (data: any) => any
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsSuccessful = 0
    let recordsFailed = 0
    const errors: string[] = []

    try {
      // Initialize connectors
      const sourceConnector = new TypeOrmConnector({
        entity: entityClass,
        dataSource: this.sqlDataSource,
        inputSchema: sourceSchema,
        outputSchema: sourceSchema
      })

      const targetConnector = new FirebaseConnector({
        entity: entityClass,
        inputSchema: targetSchema,
        outputSchema: targetSchema
      })

      // Get total count
      const totalCount = await sourceConnector.count()
      console.log(`Starting migration of ${totalCount} records to Firebase`)

      // Process in batches
      let offset = 0
      while (offset < totalCount) {
        try {
          // Fetch batch
          const batch = await sourceConnector.findMany({
            limit: this.batchSize,
            offset,
            orderBy: { id: 'asc' }
          })

          recordsProcessed += batch.length

          // Transform SQL data to NoSQL format
          const transformedBatch = batch.map(record => {
            const transformed = transformer ? transformer(record) : record
            
            // Convert relational data to nested structure
            return {
              ...transformed,
              // Embed related data instead of using foreign keys
              profile: record.profile || {},
              tags: record.tags || [],
              metadata: {
                migratedAt: new Date(),
                source: 'sql_migration'
              }
            }
          })

          // Insert into Firebase
          await targetConnector.insertMany(transformedBatch)
          recordsSuccessful += batch.length

          console.log(`Migrated ${recordsProcessed}/${totalCount} records to Firebase`)
          
        } catch (error) {
          recordsFailed += this.batchSize
          errors.push(`Batch ${offset}-${offset + this.batchSize}: ${error.message}`)
          console.error(`Failed to migrate batch:`, error)
        }

        offset += this.batchSize
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }
}
```

### NoSQL to SQL Migration

```typescript
// migrations/noSqlToSql.ts
import { DataSource } from 'typeorm'
import { FirebaseConnector } from '@goatlab/fluent-firebase'
import { TypeOrmConnector } from '@goatlab/fluent'

export class NoSqlToSqlMigration {
  private sqlDataSource: DataSource
  private batchSize: number

  constructor(sqlDataSource: DataSource, batchSize: number = 1000) {
    this.sqlDataSource = sqlDataSource
    this.batchSize = batchSize
  }

  async migrateFromFirebase<T>(
    entityClass: new () => T,
    sourceSchema: any,
    targetSchema: any,
    transformer?: (data: any) => any
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsSuccessful = 0
    let recordsFailed = 0
    const errors: string[] = []

    try {
      // Initialize connectors
      const sourceConnector = new FirebaseConnector({
        entity: entityClass,
        inputSchema: sourceSchema,
        outputSchema: sourceSchema
      })

      const targetConnector = new TypeOrmConnector({
        entity: entityClass,
        dataSource: this.sqlDataSource,
        inputSchema: targetSchema,
        outputSchema: targetSchema
      })

      // Get all documents (Firebase doesn't have direct count)
      const allDocuments = await sourceConnector.findMany()
      const totalCount = allDocuments.length
      console.log(`Starting migration of ${totalCount} records from Firebase`)

      // Process in batches
      for (let i = 0; i < totalCount; i += this.batchSize) {
        try {
          const batch = allDocuments.slice(i, i + this.batchSize)
          recordsProcessed += batch.length

          // Transform NoSQL data to SQL format
          const transformedBatch = batch.map(record => {
            const transformed = transformer ? transformer(record) : record
            
            // Flatten nested structures for SQL
            return {
              id: transformed.id,
              name: transformed.name,
              email: transformed.email,
              // Extract nested data to separate columns
              profileBio: transformed.profile?.bio || null,
              profileAvatar: transformed.profile?.avatar || null,
              tags: JSON.stringify(transformed.tags || []), // Store as JSON
              createdAt: transformed.createdAt,
              updatedAt: transformed.updatedAt
            }
          })

          // Insert into SQL database
          await targetConnector.insertMany(transformedBatch)
          recordsSuccessful += batch.length

          console.log(`Migrated ${recordsProcessed}/${totalCount} records from Firebase`)
          
        } catch (error) {
          recordsFailed += this.batchSize
          errors.push(`Batch ${i}-${i + this.batchSize}: ${error.message}`)
          console.error(`Failed to migrate batch:`, error)
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }
}
```

## Streaming Migration

### Large Dataset Streaming

```typescript
// migrations/streamingMigration.ts
import { Transform, pipeline } from 'stream'
import { promisify } from 'util'

const pipelineAsync = promisify(pipeline)

export class StreamingMigration {
  private sourceConnector: any
  private targetConnector: any
  private batchSize: number

  constructor(sourceConnector: any, targetConnector: any, batchSize: number = 1000) {
    this.sourceConnector = sourceConnector
    this.targetConnector = targetConnector
    this.batchSize = batchSize
  }

  async migrateStream<T>(
    transformer?: (data: any) => any
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsSuccessful = 0
    let recordsFailed = 0
    const errors: string[] = []

    try {
      // Create readable stream from source
      const sourceStream = this.createSourceStream()

      // Create transform stream
      const transformStream = new Transform({
        objectMode: true,
        transform(chunk: any, encoding, callback) {
          try {
            const transformed = transformer ? transformer(chunk) : chunk
            callback(null, transformed)
          } catch (error) {
            callback(error)
          }
        }
      })

      // Create batch accumulator
      let batch: any[] = []
      const batchStream = new Transform({
        objectMode: true,
        transform(chunk: any, encoding, callback) {
          batch.push(chunk)
          recordsProcessed++

          if (batch.length >= this.batchSize) {
            this.processBatch(batch)
              .then(() => {
                recordsSuccessful += batch.length
                batch = []
                callback()
              })
              .catch(error => {
                recordsFailed += batch.length
                errors.push(error.message)
                batch = []
                callback()
              })
          } else {
            callback()
          }
        },
        flush(callback) {
          if (batch.length > 0) {
            this.processBatch(batch)
              .then(() => {
                recordsSuccessful += batch.length
                callback()
              })
              .catch(error => {
                recordsFailed += batch.length
                errors.push(error.message)
                callback()
              })
          } else {
            callback()
          }
        }
      })

      // Run the pipeline
      await pipelineAsync(
        sourceStream,
        transformStream,
        batchStream
      )

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }

  private createSourceStream() {
    // Create a readable stream from the source connector
    const { Readable } = require('stream')
    let offset = 0
    
    return new Readable({
      objectMode: true,
      async read() {
        try {
          const batch = await this.sourceConnector.findMany({
            limit: this.batchSize,
            offset,
            orderBy: { id: 'asc' }
          })

          if (batch.length === 0) {
            this.push(null) // End of stream
            return
          }

          for (const record of batch) {
            this.push(record)
          }

          offset += batch.length
        } catch (error) {
          this.emit('error', error)
        }
      }
    })
  }

  private async processBatch(batch: any[]): Promise<void> {
    await this.targetConnector.insertMany(batch)
  }
}
```

## Incremental Migration

### Change Data Capture (CDC)

```typescript
// migrations/incrementalMigration.ts
export class IncrementalMigration {
  private sourceConnector: any
  private targetConnector: any
  private checkpointStorage: any

  constructor(
    sourceConnector: any,
    targetConnector: any,
    checkpointStorage: any
  ) {
    this.sourceConnector = sourceConnector
    this.targetConnector = targetConnector
    this.checkpointStorage = checkpointStorage
  }

  async migrateIncremental<T>(
    entityClass: new () => T,
    timestampField: string = 'updatedAt'
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let recordsProcessed = 0
    let recordsSuccessful = 0
    let recordsFailed = 0
    const errors: string[] = []

    try {
      // Get last migration timestamp
      const lastMigrationTime = await this.getLastMigrationTime(entityClass.name)
      
      // Find records modified since last migration
      const modifiedRecords = await this.sourceConnector.findMany({
        where: {
          [timestampField]: { gt: lastMigrationTime }
        },
        orderBy: { [timestampField]: 'asc' }
      })

      recordsProcessed = modifiedRecords.length
      console.log(`Found ${recordsProcessed} modified records since ${lastMigrationTime}`)

      if (recordsProcessed === 0) {
        return {
          success: true,
          recordsProcessed: 0,
          recordsSuccessful: 0,
          recordsFailed: 0,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Process each record
      for (const record of modifiedRecords) {
        try {
          // Check if record exists in target
          const existingRecord = await this.targetConnector.findById(record.id)
          
          if (existingRecord) {
            // Update existing record
            await this.targetConnector.updateById(record.id, record)
          } else {
            // Insert new record
            await this.targetConnector.insert(record)
          }
          
          recordsSuccessful++
          
          // Update checkpoint
          await this.updateCheckpoint(entityClass.name, record[timestampField])
          
        } catch (error) {
          recordsFailed++
          errors.push(`Record ${record.id}: ${error.message}`)
          console.error(`Failed to migrate record ${record.id}:`, error)
        }
      }

      return {
        success: recordsFailed === 0,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        recordsProcessed,
        recordsSuccessful,
        recordsFailed,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }

  private async getLastMigrationTime(entityName: string): Promise<Date> {
    const checkpoint = await this.checkpointStorage.get(`migration_${entityName}`)
    return checkpoint ? new Date(checkpoint.lastMigrationTime) : new Date(0)
  }

  private async updateCheckpoint(entityName: string, timestamp: Date): Promise<void> {
    await this.checkpointStorage.set(`migration_${entityName}`, {
      lastMigrationTime: timestamp.toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
}
```

## Migration Validation

### Data Validation

```typescript
// migrations/migrationValidator.ts
export class MigrationValidator {
  private sourceConnector: any
  private targetConnector: any

  constructor(sourceConnector: any, targetConnector: any) {
    this.sourceConnector = sourceConnector
    this.targetConnector = targetConnector
  }

  async validateMigration(): Promise<{
    isValid: boolean
    issues: string[]
    statistics: {
      sourceCount: number
      targetCount: number
      matchingRecords: number
      missingRecords: number
      extraRecords: number
    }
  }> {
    const issues: string[] = []
    
    // Count records in both databases
    const sourceCount = await this.sourceConnector.count()
    const targetCount = await this.targetConnector.count()
    
    console.log(`Source records: ${sourceCount}, Target records: ${targetCount}`)
    
    if (sourceCount !== targetCount) {
      issues.push(`Record count mismatch: source=${sourceCount}, target=${targetCount}`)
    }

    // Sample validation
    const sampleSize = Math.min(1000, sourceCount)
    const sourceRecords = await this.sourceConnector.findMany({
      limit: sampleSize,
      orderBy: { id: 'asc' }
    })

    let matchingRecords = 0
    let missingRecords = 0
    
    for (const sourceRecord of sourceRecords) {
      const targetRecord = await this.targetConnector.findById(sourceRecord.id)
      
      if (!targetRecord) {
        missingRecords++
        issues.push(`Record ${sourceRecord.id} missing in target`)
        continue
      }

      // Validate key fields
      if (this.compareRecords(sourceRecord, targetRecord)) {
        matchingRecords++
      } else {
        issues.push(`Record ${sourceRecord.id} data mismatch`)
      }
    }

    // Check for extra records in target
    const targetRecords = await this.targetConnector.findMany({
      limit: sampleSize,
      orderBy: { id: 'asc' }
    })
    
    let extraRecords = 0
    for (const targetRecord of targetRecords) {
      const sourceRecord = await this.sourceConnector.findById(targetRecord.id)
      if (!sourceRecord) {
        extraRecords++
        issues.push(`Extra record ${targetRecord.id} in target`)
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      statistics: {
        sourceCount,
        targetCount,
        matchingRecords,
        missingRecords,
        extraRecords
      }
    }
  }

  private compareRecords(source: any, target: any): boolean {
    // Compare key fields (implement based on your needs)
    const keyFields = ['id', 'name', 'email', 'createdAt']
    
    for (const field of keyFields) {
      if (source[field] !== target[field]) {
        return false
      }
    }
    
    return true
  }
}
```

## Schema Migration

### TypeORM Migration

```typescript
// migrations/1234567890-UpdateUserSchema.ts
import { MigrationInterface, QueryRunner, Table, Column } from 'typeorm'

export class UpdateUserSchema1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.addColumn('users', new Column({
      name: 'fullName',
      type: 'varchar',
      length: '255',
      isNullable: true
    }))

    await queryRunner.addColumn('users', new Column({
      name: 'profileData',
      type: 'json',
      isNullable: true
    }))

    // Migrate data
    await queryRunner.query(`
      UPDATE users 
      SET fullName = CONCAT(firstName, ' ', lastName)
      WHERE firstName IS NOT NULL AND lastName IS NOT NULL
    `)

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IDX_USER_FULLNAME ON users (fullName)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_USER_FULLNAME')
    await queryRunner.dropColumn('users', 'profileData')
    await queryRunner.dropColumn('users', 'fullName')
  }
}
```

### Custom Schema Migration

```typescript
// migrations/customSchemaMigration.ts
export class CustomSchemaMigration {
  private dataSource: DataSource

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource
  }

  async migrateSchema(migrations: Array<{
    up: (queryRunner: QueryRunner) => Promise<void>
    down: (queryRunner: QueryRunner) => Promise<void>
  }>): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      for (const migration of migrations) {
        await migration.up(queryRunner)
      }
      
      await queryRunner.commitTransaction()
      console.log('Schema migration completed successfully')
    } catch (error) {
      await queryRunner.rollbackTransaction()
      console.error('Schema migration failed:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }
}
```

## Migration Tools

### Migration CLI

```typescript
// cli/migrate.ts
import { Command } from 'commander'
import { AppDataSource } from '../config/database'
import { SqlToSqlMigration } from '../migrations/sqlToSql'

const program = new Command()

program
  .name('migrate')
  .description('Database migration tool')
  .version('1.0.0')

program
  .command('sql-to-sql')
  .description('Migrate data from SQL to SQL database')
  .requiredOption('-s, --source <source>', 'Source database connection')
  .requiredOption('-t, --target <target>', 'Target database connection')
  .option('-b, --batch-size <size>', 'Batch size for migration', '1000')
  .option('-e, --entity <entity>', 'Entity to migrate')
  .action(async (options) => {
    try {
      const sourceDb = await createDataSource(options.source)
      const targetDb = await createDataSource(options.target)
      
      const migration = new SqlToSqlMigration(
        sourceDb,
        targetDb,
        parseInt(options.batchSize)
      )
      
      const result = await migration.migrateEntity(
        getEntityByName(options.entity),
        getSchemaByName(options.entity + 'Input'),
        getSchemaByName(options.entity + 'Output')
      )
      
      console.log('Migration completed:', result)
    } catch (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
  })

program
  .command('validate')
  .description('Validate migration results')
  .requiredOption('-s, --source <source>', 'Source database connection')
  .requiredOption('-t, --target <target>', 'Target database connection')
  .action(async (options) => {
    try {
      const sourceConnector = await createConnector(options.source)
      const targetConnector = await createConnector(options.target)
      
      const validator = new MigrationValidator(sourceConnector, targetConnector)
      const result = await validator.validateMigration()
      
      console.log('Validation result:', result)
      
      if (!result.isValid) {
        process.exit(1)
      }
    } catch (error) {
      console.error('Validation failed:', error)
      process.exit(1)
    }
  })

program.parse()
```

## Best Practices

### Migration Checklist

1. **Pre-Migration**
   - [ ] Create full backup of source database
   - [ ] Test migration on sample data
   - [ ] Verify target database capacity
   - [ ] Plan for rollback strategy
   - [ ] Schedule maintenance window

2. **During Migration**
   - [ ] Monitor migration progress
   - [ ] Check for errors in real-time
   - [ ] Validate data integrity
   - [ ] Monitor system performance
   - [ ] Keep migration logs

3. **Post-Migration**
   - [ ] Validate all data migrated correctly
   - [ ] Run application tests
   - [ ] Update connection strings
   - [ ] Monitor application performance
   - [ ] Document migration results

### Error Handling

```typescript
// utils/migrationErrorHandler.ts
export class MigrationErrorHandler {
  private errors: Array<{
    timestamp: Date
    record: any
    error: string
    severity: 'low' | 'medium' | 'high'
  }> = []

  addError(record: any, error: string, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    this.errors.push({
      timestamp: new Date(),
      record,
      error,
      severity
    })
  }

  getErrors(): typeof this.errors {
    return this.errors
  }

  getErrorsSummary(): {
    total: number
    bySeverity: Record<string, number>
  } {
    const summary = {
      total: this.errors.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0
      }
    }

    for (const error of this.errors) {
      summary.bySeverity[error.severity]++
    }

    return summary
  }

  exportErrors(filename: string): void {
    const fs = require('fs')
    fs.writeFileSync(filename, JSON.stringify(this.errors, null, 2))
  }
}
```

This comprehensive guide covers various migration strategies for moving data between different database systems and connectors in Goat Fluent applications, ensuring data integrity and minimal downtime.