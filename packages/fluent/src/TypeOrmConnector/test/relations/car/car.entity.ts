import { Decorators } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
import { z } from 'zod'
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

export const CarsEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  userId: z.string().optional()
})

export type CarsEntityInputSchema = z.infer<typeof CarsEntitySchema>
