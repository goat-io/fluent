import { TypeORMDataModel } from './typeOrm.entity'
import { TypeOrmConnector } from '@goatlab/fluent'

export class TypeOrmRepository extends TypeOrmConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, relations, 'runningTest')
  }
}
