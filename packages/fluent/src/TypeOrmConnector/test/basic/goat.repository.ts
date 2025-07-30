import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MemoryDataSource } from '../sqlite/memoryDataSource'
import { GoatEntity, GoatInputSchema, GoatSchema } from './goat.entity'

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
