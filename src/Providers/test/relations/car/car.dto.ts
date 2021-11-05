import { InputType, OmitType } from '../../../../core/types'
import { CarsEntity } from './car.entity'

@InputType()
export class CarsEntityIn extends OmitType(CarsEntity, ['id'] as const) {}
