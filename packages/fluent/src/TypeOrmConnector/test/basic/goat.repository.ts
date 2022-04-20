import { GoatEntityIn, GoatEntityOut } from './goat.dto'
import { GoatEntity } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MemoryDataSource } from '../memoryDataSource'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatEntityIn,
  GoatEntityOut
> {
  constructor(relations?: any) {
    super(GoatEntity, MemoryDataSource ,relations)
  }
}
