import {  GoatInputSchema, GoatSchema, GoatEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/goat.entity'
import { LokiConnector } from '../LokiConnector'
import { lokiDataSource } from './loki.datasource'

export class GoatRepository extends LokiConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: lokiDataSource,
      inputSchema: GoatSchema
    })
  }
}
