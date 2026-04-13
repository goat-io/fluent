import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MYSQLDataSource } from '../mysql/mysqlDataSource'
import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
} from './typeOrm.entity'

export class TypeOrmRepository extends TypeOrmConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      dataSource: MYSQLDataSource,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema,
    })
  }
}
