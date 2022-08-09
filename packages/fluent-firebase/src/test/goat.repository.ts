import {
  GoatInputSchema,
  GoatSchema,
  GoatEntity
} from '@goatlab/fluent/src/TypeOrmConnector/test/basic/goat.entity'
import { FirebaseConnector } from '../FirebaseConnector'

export class GoatRepository extends FirebaseConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      inputSchema: GoatSchema
    })
  }
}
