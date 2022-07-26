import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/typeOrm.entity'
import { dataSource } from './pouchdb.datasource'
import { PouchDBConnector } from '../PouchDBConnector'

export class TypeOrmRepository extends PouchDBConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      dataSource: dataSource,
      inputSchema: TypeORMDataModelSchema
    })
  }
}
