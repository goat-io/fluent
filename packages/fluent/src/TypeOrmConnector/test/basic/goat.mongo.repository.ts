import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { GoatEntity, GoatInputSchema, GoatSchema } from './goat.entity'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor(dataSource?: DataSource | (() => DataSource)) {
    super({
      entity: GoatEntity,
      dataSource:
        dataSource ||
        (() => {
          throw new Error('DataSource not provided to GoatRepository')
        }),
      inputSchema: GoatSchema
    })
  }
}
