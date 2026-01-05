import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql'
import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export class MySQLTestContainer {
  private container: StartedMySqlContainer | null = null
  private dataSource: DataSource | null = null

  async start(): Promise<DataSource> {
    // Start MySQL container with dynamic port allocation
    this.container = await new MySqlContainer('mysql:8.0')
      .withDatabase('test-db')
      .withUsername('test-user')
      .withUserPassword('password')
      .withRootPassword('root-password')
      .start()

    // Create DataSource with container connection info
    this.dataSource = new DataSource({
      type: 'mysql',
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: 'test-user',
      password: 'password',
      database: 'test-db',
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
