import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MYSQLDataSource } from '../mysql/mysqlDataSource'
import { GoatEntity, GoatInputSchema, GoatSchema } from './goat.entity'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: MYSQLDataSource,
      inputSchema: GoatSchema,
    })
  }
}
