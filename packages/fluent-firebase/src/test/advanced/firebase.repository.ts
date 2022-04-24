import { FirebaseConnector } from '../../FirebaseConnector'
import { TypeORMDataModel } from './typeOrm.entity'
import { modelGeneratorDataSource } from '@goatlab/fluent'

export class FirebaseRepository extends FirebaseConnector<TypeORMDataModel> {
  constructor(relations?: any) {
    super(TypeORMDataModel,modelGeneratorDataSource,  relations)
  }
}
