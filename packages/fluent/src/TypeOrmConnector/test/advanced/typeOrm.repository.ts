import { TypeORMDataModel } from './typeOrm.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MemoryDataSource } from '../memoryDataSource'

export class TypeOrmRepository extends TypeOrmConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, MemoryDataSource, relations)
  }
}
