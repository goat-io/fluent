import { LokiConnector } from '../LokiConnector'
import { 
  GoatEntity, 
  TypeOrmEntity,
  GoatSchema,
  GoatInputSchema,
  TypeORMDataModelSchema,
  TypeORMDataModelInputSchema
} from '@goatlab/fluent'
import { lokiDataSource } from './loki.datasource'

export class LokiGoatRepositoryFactory extends LokiConnector<GoatEntity, GoatInputSchema> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: lokiDataSource,
      inputSchema: GoatSchema as any
    })
  }
}

export class LokiTypeOrmRepositoryFactory extends LokiConnector<TypeOrmEntity, TypeORMDataModelInputSchema> {
  constructor() {
    super({
      entity: TypeOrmEntity,
      dataSource: lokiDataSource,
      inputSchema: TypeORMDataModelSchema as any
    })
  }
}