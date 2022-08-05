import { f } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
@f.entity('cars')
export class CarsEntity {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: true })
  userId?: string

  @f.belongsTo({
    entity: () => UsersEntity,
    inverse: user => user.cars,
    pivotColumnName: 'userId'
  })
  user?: UsersEntity

  @f.belongsTo({
    entity: () => UsersEntity,
    inverse: user => user.cars,
    pivotColumnName: 'userId'
  })
  anotherRelation?: UsersEntity
}
