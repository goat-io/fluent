import {
    TypeORMDataModel,
    TypeORMDataModelInputSchema,
    TypeORMDataModelSchema
  } from './typeOrm.entity'
  import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MongoDataSource } from '../mongo/mongoDatasource'
  
  export class TypeOrmRepository extends TypeOrmConnector<
    TypeORMDataModel,
    TypeORMDataModelInputSchema
  > {
    constructor() {
      super({
        entity: TypeORMDataModel,
        dataSource: MongoDataSource,
        inputSchema: TypeORMDataModelSchema,
        outputSchema: TypeORMDataModelSchema
      })
    }
  }
  