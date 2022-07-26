import {
    GoatInputSchema,
    GoatEntity,
    GoatSchema
  } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/goat.entity'
import { PouchDBConnector } from '../PouchDBConnector'
import { dataSource } from './pouchdb.datasource'

export class GoatRepository extends PouchDBConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    super({
      entity: GoatEntity,
      dataSource: dataSource,
      inputSchema: GoatSchema
    })
  }
}