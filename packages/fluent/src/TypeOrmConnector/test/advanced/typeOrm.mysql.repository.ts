import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from './typeOrm.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MYSQLDataSource } from '../mysql/mysqlDataSource'

export class TypeOrmRepository extends TypeOrmConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      dataSource: MYSQLDataSource,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema
    })
  }
}
