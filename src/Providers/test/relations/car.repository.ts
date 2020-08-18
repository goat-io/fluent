import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { FirebaseConnector } from '../../../Providers/Firebase/FirebaseConnector'

export class CarsRepository extends FirebaseConnector<
  CarsEntity,
  CarsEntityIn
> {
  constructor(relationQuery?: any) {
    super(CarsEntity, relationQuery)
  }
}
