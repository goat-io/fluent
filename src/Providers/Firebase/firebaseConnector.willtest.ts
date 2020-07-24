import {
  FirebaseConnector,
  MockCreateFirebaseRepository
} from './FirebaseConnector'
import { GoatEntityIn, GoatEntityOut } from '../test/goat.dto'
import { TypeORMDataModel, advancedTestSuite } from '../test/advancedTestSuite'

import { GoatEntity } from '../test/goat.entity'
import { basicTestSuite } from '../test/basicTestSuite'

/*
describe('Execute all basic test Suite', () => {
  const repository = MockCreateFirebaseRepository(GoatEntity)
  const GoatModel = new FirebaseConnector<
    GoatEntity,
    GoatEntityIn,
    GoatEntityOut
  >(repository)
  basicTestSuite(GoatModel)
})
*/

describe('Execute all advanced test Suite', () => {
  const repository = MockCreateFirebaseRepository(TypeORMDataModel)
  const GoatModel = new FirebaseConnector<TypeORMDataModel>(repository)
  advancedTestSuite(GoatModel)
})
