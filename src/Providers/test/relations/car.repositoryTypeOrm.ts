import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'

export class CarsRepository extends TypeOrmConnector<CarsEntity, CarsEntityIn> {
  constructor(relationQuery?: any) {
    super(CarsEntity, 'runningTest', relationQuery)
  }
}
