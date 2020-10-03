import { JoinColumn, ManyToOne } from 'typeorm'

import { Decorators } from '../../../../core/Nestjs/Database/decorators'
import { UsersEntity } from '../user/user.entity'

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
