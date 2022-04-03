import { FirebaseConnector } from '../../FirebaseConnector'
import { TypeORMDataModel } from './typeOrm.entity'

export class FirebaseRepository extends FirebaseConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel, 'runningTest')
  }
}
