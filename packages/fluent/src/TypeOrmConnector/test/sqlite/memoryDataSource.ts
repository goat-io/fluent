import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export const MemoryDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: dbEntities,
    logging: false,
    synchronize: true
  })