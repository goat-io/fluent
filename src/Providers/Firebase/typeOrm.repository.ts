import { FirebaseConnector } from './FirebaseConnector'
import { TypeORMDataModel } from '../test/advanced/typeOrm.entity'

export class TypeOrmRepository extends FirebaseConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, relations)
  }
}
