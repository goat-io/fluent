import { CarsEntity } from '../car/car.entity'
import { Decorators } from '../../../../decorators'
import { RoleEntity } from '../roles/roles.entity'
import { z } from 'zod'

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

  @Decorators.hasMany({
    entity: () => CarsEntity,
    inverse: cars => cars.userId
  })
  cars?: CarsEntity[]

  @Decorators.belongsToMany({
    entity: () => RoleEntity,
    joinTableName: 'roles_users',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles?: RoleEntity[]
}


export const BreedSchema = z.object({
  family: z.string().optional(),
  members: z.number().optional()
})

export const UsersEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().optional(),
  breed: BreedSchema.optional()
})

export type UsersEntityInputSchema = z.infer<typeof UsersEntitySchema>

