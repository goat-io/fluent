import { TypeORMDataModel } from './typeOrm.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'

export class TypeOrmRepository extends TypeOrmConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, relations, 'runningTest')
  }
}
