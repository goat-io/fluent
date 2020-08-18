import { GoatEntityIn, GoatEntityOut } from '../test/basic/goat.dto'

import { GoatEntity } from '../test/basic/goat.entity'
import { LokiConnector } from './LokiConnector'
import { TypeORMDataModel } from '../test/advanced/typeOrm.entity'
import { advancedTestSuite } from '../test/advanced/advancedTestSuite'
import { basicTestSuite } from '../test/basic/basicTestSuite'

class Goat extends LokiConnector<GoatEntity, GoatEntityIn, GoatEntityOut> {
  constructor() {
    super('myModel')
  }
}

// tslint:disable-next-line: max-classes-per-file
class Goat2 extends LokiConnector<TypeORMDataModel> {
  constructor() {
    super('myModel2')
  }
}

describe('Execute all basic test Suite', () => {
  basicTestSuite(Goat)
})

describe('Execute all advanced test Suite', () => {
  advancedTestSuite(Goat2)
})
