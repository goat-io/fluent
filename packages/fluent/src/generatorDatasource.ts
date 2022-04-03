import { DataSource } from 'typeorm'

export const modelGeneratorDataSource = new DataSource({
  name: '_goat_model_generator',
  type: 'sqlite',
  database: ':memory:',
  logging: false,
  synchronize: true,
  dropSchema: true
})
