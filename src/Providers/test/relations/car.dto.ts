import { InputType, OmitType } from '@nestjs/graphql'

import { CarsEntity } from './car.entity'

@InputType()
export class CarsEntityIn extends OmitType(CarsEntity, ['id'] as const) {}
