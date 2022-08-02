import { CarsEntity } from '../car/car.entity'
import { f } from '../../../../decorators'
import { RoleEntity } from '../roles/roles.entity'
import { z } from 'zod'
import { FluentEntity } from '../../../../FluentEntity'
import { PrimaryGeneratedColumn } from 'typeorm'

export class Family {
  @f.property({ required: false })
  family?: string

  @f.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@f.entity('users')
export class UsersEntity extends FluentEntity {  
  @f.property({ required: true })
  name: string

  @f.property({ required: false })
  age?: number

  @f.embed(Family)
  breed?: Family

  @f.hasMany({
    entity: () => CarsEntity,
    inverse: cars => cars.userId
  })
  cars?: CarsEntity[]

  /*
  @f.belongsToMany({
    entity: () => RoleEntity,
    joinTableName: 'roles_users',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles?: RoleEntity[]
  */
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

