import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/typeOrm.entity'
import { FirebaseConnector } from '../FirebaseConnector'

export class TypeOrmRepository extends FirebaseConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema
    })
  }
}
