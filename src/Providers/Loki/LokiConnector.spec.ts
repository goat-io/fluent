import { LokiConnector } from './LokiConnector'
import {
  advancedTestSuite,
  DataModel,
  TypeORMDataModel
} from '../test/advancedTestSuite'

const NormalClass = new LokiConnector<DataModel>('myModel')
const TypeORMClass = new LokiConnector<TypeORMDataModel>('myModel2')

advancedTestSuite(NormalClass)
advancedTestSuite(TypeORMClass)
