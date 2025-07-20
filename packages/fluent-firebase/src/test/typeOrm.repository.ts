import { FirebaseConnector } from '../FirebaseConnector'
import {
  TypeOrmEntity,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from '@goatlab/fluent'

export class TypeOrmRepository extends FirebaseConnector<
  TypeOrmEntity,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeOrmEntity,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema
    })
  }
}
