import { OneToMany, PrimaryGeneratedColumn } from 'typeorm'

import { CarsEntity } from './car.entity'
import { Decorators } from '../../../core/Nestjs/Database/decorators'
import { Field } from '@nestjs/graphql'

export class Family {
  @Decorators.property({ required: false })
  family?: string

  @Decorators.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@Decorators.entity('users')
export class UsersEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: false })
  age?: number

  @Decorators.embed(Family)
  breed?: Family

  @OneToMany(type => CarsEntity, car => car.userId)
  cars?: CarsEntity[]
}
