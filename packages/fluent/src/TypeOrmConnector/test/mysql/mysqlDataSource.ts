import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export const MYSQLDataSource = new DataSource({
    type: 'mysql',
    database: 'test-db',
    username: 'root',
    password: 'password',
    host: '127.0.0.1',
    port: 3307,
    entities:dbEntities,
    synchronize: true,
    logging: false
  })