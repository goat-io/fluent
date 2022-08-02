import { f } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
import { z } from 'zod'
import { FluentEntity } from '../../../../FluentEntity'
@f.entity('cars')
export class CarsEntity extends FluentEntity {
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
}

export const CarsEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  userId: z.string().optional()
})

export type CarsEntityInputSchema = z.infer<typeof CarsEntitySchema>
