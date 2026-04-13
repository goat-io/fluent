import { GoatEntity, GoatInputSchema, GoatSchema } from '@goatlab/fluent'
import { FirebaseConnector } from '../FirebaseConnector'

export class GoatRepository extends FirebaseConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      inputSchema: GoatSchema,
    })
  }
}
