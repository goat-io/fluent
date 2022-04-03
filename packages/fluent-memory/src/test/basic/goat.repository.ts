import { GoatEntityIn, GoatEntityOut } from './goat.dto'
import { GoatEntity } from './goat.entity'
import { TypeOrmConnector } from '@goatlab/fluent'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatEntityIn,
  GoatEntityOut
> {
  constructor(relations?: any) {
    super(GoatEntity, relations, 'runningTest')
  }
}
