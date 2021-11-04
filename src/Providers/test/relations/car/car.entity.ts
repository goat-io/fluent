import { JoinColumn, ManyToOne } from 'typeorm'

import { Decorators } from '../../../../core/database/decorators'
import { UsersEntity } from '../user/user.entity'

@Decorators.entity('cars')
export class CarsEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: true })
  userId?: string

  @Decorators.belongsTo({
    entity: () => UsersEntity,
    inverse: user => user.cars,
    pivotColumnName: 'userId'
  })
  user?: UsersEntity
}
