import {
  GoatEntity,
  GoatInputSchema,
  GoatSchema,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
  TypeOrmEntity,
} from '@goatlab/fluent'
import PouchDB from 'pouchdb-core'
import { PouchDBConnector } from '../PouchDBConnector'

export class PouchDBGoatRepositoryFactory extends PouchDBConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor() {
    // Create a fresh in-memory PouchDB instance for each test
    const pouchDB = new PouchDB(`goats-${Date.now()}-${Math.random()}`, {
      adapter: 'memory',
    })

    super({
      entity: GoatEntity,
      dataSource: pouchDB,
      inputSchema: GoatSchema as any,
    })
  }
}

export class PouchDBTypeOrmRepositoryFactory extends PouchDBConnector<
  TypeOrmEntity,
  TypeORMDataModelInputSchema
> {
  constructor() {
    // Create a fresh in-memory PouchDB instance for each test
    const pouchDB = new PouchDB(`advanced-${Date.now()}-${Math.random()}`, {
      adapter: 'memory',
    })

    super({
      entity: TypeOrmEntity,
      dataSource: pouchDB,
      inputSchema: TypeORMDataModelSchema as any,
    })
  }
}
