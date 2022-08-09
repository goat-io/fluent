import { DataSource } from 'typeorm'
import { dbEntities } from '../dbEntities'

export const MongoDataSource = new DataSource({
  type: 'mongodb',
  useNewUrlParser: true,
  useUnifiedTopology: true,
  entities: dbEntities,
  logging: false
})