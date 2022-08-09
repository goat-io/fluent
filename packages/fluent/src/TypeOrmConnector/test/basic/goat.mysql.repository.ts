import { GoatEntity, GoatInputSchema, GoatSchema } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MYSQLDataSource } from '../mysql/mysqlDataSource'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: MYSQLDataSource,
      inputSchema: GoatSchema
    })
  }
}
