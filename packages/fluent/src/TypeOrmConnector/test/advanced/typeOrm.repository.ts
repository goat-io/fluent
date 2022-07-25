import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema
} from './typeOrm.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MemoryDataSource } from '../sqlite/memoryDataSource'

export class TypeOrmRepository extends TypeOrmConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor() {
    super({
      entity: TypeORMDataModel,
      dataSource: MemoryDataSource,
      inputSchema: TypeORMDataModelSchema,
      outputSchema: TypeORMDataModelSchema
    })
  }
}
