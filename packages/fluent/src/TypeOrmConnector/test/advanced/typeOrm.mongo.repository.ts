import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
} from './typeOrm.entity'

export class TypeOrmRepository extends TypeOrmConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor(dataSource?: DataSource | (() => DataSource)) {
    super({
      entity: TypeORMDataModel,
      dataSource:
        dataSource ||
        (() => {
          throw new Error('DataSource not provided to TypeOrmRepository')
        }),
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema,
    })
  }
}
