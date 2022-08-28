import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/typeOrm.entity'
import { LokiConnector } from '../LokiConnector'
import { lokiDataSource } from './loki.datasource'

export class TypeOrmRepository extends LokiConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      dataSource: lokiDataSource,
      inputSchema: TypeORMDataModelSchema
    })
  }
}
