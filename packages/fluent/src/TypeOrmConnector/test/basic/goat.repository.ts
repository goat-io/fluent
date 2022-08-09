import { GoatEntity, GoatInputSchema, GoatSchema } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MemoryDataSource } from '../sqlite/memoryDataSource'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: MemoryDataSource,
      inputSchema: GoatSchema
    })
  }
}
