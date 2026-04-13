import {
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
  TypeOrmEntity,
} from '@goatlab/fluent'
import { FirebaseConnector } from '../FirebaseConnector'

export class TypeOrmRepository extends FirebaseConnector<
  TypeOrmEntity,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeOrmEntity,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema,
    })
  }
}
