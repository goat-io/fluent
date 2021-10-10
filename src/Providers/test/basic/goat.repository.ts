import { GoatEntityIn, GoatEntityOut } from './goat.dto'
import { GoatEntity } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrm/TypeOrmConnector'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatEntityIn,
  GoatEntityOut
> {
  constructor(relations?: any) {
    super(GoatEntity, relations, 'runningTest')
  }
}
