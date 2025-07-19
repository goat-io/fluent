import PouchDB from 'pouchdb'
import { PouchDBConnector } from '../PouchDBConnector'
import { GoatEntity, GoatInputSchema, GoatSchema } from '@goatlab/fluent/src/TypeOrmConnector/test/basic/goat.entity'
import { TypeORMDataModel, TypeORMDataModelInputSchema, TypeORMDataModelSchema } from '@goatlab/fluent/src/TypeOrmConnector/test/advanced/typeOrm.entity'

export class GoatRepositoryFactory extends PouchDBConnector<GoatEntity, GoatInputSchema> {
  constructor(dataSource?: any) {
    // Create a fresh in-memory PouchDB instance for each test
    const pouchDB = new PouchDB(`goats-${Date.now()}-${Math.random()}`, { adapter: 'memory' })
    
    super({
      entity: GoatEntity,
      dataSource: pouchDB,
      inputSchema: GoatSchema
    })
  }
}

export class TypeOrmRepositoryFactory extends PouchDBConnector<TypeORMDataModel, TypeORMDataModelInputSchema> {
  constructor(dataSource?: any) {
    // Create a fresh in-memory PouchDB instance for each test
    const pouchDB = new PouchDB(`typeorm-${Date.now()}-${Math.random()}`, { adapter: 'memory' })
    
    super({
      entity: TypeORMDataModel,
      dataSource: pouchDB,
      inputSchema: TypeORMDataModelSchema
    })
  }
}