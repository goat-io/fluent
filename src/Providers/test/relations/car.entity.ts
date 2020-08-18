import { Column, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Decorators } from '../../../core/Nestjs/Database/decorators'
import { Field } from '@nestjs/graphql'
import { UsersEntity } from './user.entity'

@Decorators.entity('cars')
export class CarsEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: true })
  userId?: string

  @ManyToOne(() => UsersEntity, user => user.cars)
  @JoinColumn({ name: 'userId' })
  user?: UsersEntity
}
