import {  GoatInputSchema, GoatSchema, GoatEntity } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MongoDataSource } from '../mongo/mongoDatasource'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: MongoDataSource,
      inputSchema: GoatSchema
    })
  }
}
