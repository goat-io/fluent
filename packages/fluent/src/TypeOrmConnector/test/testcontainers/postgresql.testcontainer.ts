import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export class PostgreSQLTestContainer {
  private container: StartedPostgreSqlContainer | null = null
  private dataSource: DataSource | null = null

  async start(): Promise<DataSource> {
    // Start PostgreSQL container with dynamic port allocation
    this.container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('test-db')
      .withUsername('test-user')
      .withPassword('password')
      .start()

    // Create DataSource with container connection info
    this.dataSource = new DataSource({
      type: 'postgres',
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      entities: dbEntities,
      synchronize: true,
      logging: false,
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
