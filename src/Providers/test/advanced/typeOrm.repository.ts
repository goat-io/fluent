import { TypeORMDataModel } from './typeOrm.entity'
import { TypeOrmConnector } from '../../TypeOrm/TypeOrmConnector'

export class TypeOrmRepository extends TypeOrmConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, relations, 'runningTest')
  }
}
