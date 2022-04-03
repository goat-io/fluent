import { InputType, OmitType } from '@goatlab/fluent'
import { CarsEntity } from './car.entity'

@InputType()
export class CarsEntityIn extends OmitType(CarsEntity, ['id'] as const) {}
