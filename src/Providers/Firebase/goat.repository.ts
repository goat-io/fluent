import { GoatEntityIn, GoatEntityOut } from '../test/basic/goat.dto'

import { FirebaseConnector } from './FirebaseConnector'
import { GoatEntity } from '../test/basic/goat.entity'

export class GoatEntityRepository extends FirebaseConnector<
  GoatEntity,
  GoatEntityIn,
  GoatEntityOut
> {
  constructor(relations?: any) {
    super(GoatEntity, relations)
  }
}
