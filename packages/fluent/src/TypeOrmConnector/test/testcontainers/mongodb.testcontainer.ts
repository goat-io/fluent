import {
  MongoDBContainer,
  StartedMongoDBContainer
} from '@testcontainers/mongodb'
import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export class MongoDBTestContainer {
  private container: StartedMongoDBContainer | null = null
  private dataSource: DataSource | null = null

  async start(): Promise<DataSource> {
    // Start MongoDB container with dynamic port allocation
    this.container = await new MongoDBContainer('mongo:7.0').start()

    // Get connection details
    const host = this.container.getHost()
    const port = this.container.getMappedPort(27017)

    // Create DataSource with container connection info
    this.dataSource = new DataSource({
      type: 'mongodb',
      host: host,
      port: port,
      database: 'test-db',
      entities: dbEntities,
      synchronize: false, // MongoDB has issues with synchronize and indexes
      logging: false,
      directConnection: true
    })

    await this.dataSource.initialize()
    return this.dataSource
  }

  async stop(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.destroy()
    }
    if (this.container) {
      await this.container.stop()
    }
  }

  getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Error('Container not started')
    }
    return this.dataSource
  }
}
