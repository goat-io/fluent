import {
  FirebaseConnector,
  MockCreateFirebaseRepository
} from './FirebaseConnector'

import { advancedTestSuite, TypeORMDataModel } from '../test/advancedTestSuite'
import { basicTestSuite } from '../test/basicTestSuite'

import { GoatEntityOut, GoatEntityIn } from '../test/goat.dto'
import { GoatEntity } from '../test/goat.entity'
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
