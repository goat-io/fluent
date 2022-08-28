import { z } from 'zod'
import { carInputSchema } from '../car/car.schema'
import { carOutputSchema } from '../car/car.output.schema'
import { RoleInputSchema } from '../roles/role.schema'
import { RolesUserSchema } from '../roles/roles_user.schema'

interface zodManyToOneProps {
  manySchema: z.AnyZodObject
  manyKey: string
  oneSchema: z.AnyZodObject
  oneKey: string
}

// A bunch of nested, so you have enough to play around
const ZodManyToOne = ({
  manySchema,
  oneSchema,
  manyKey,
  oneKey
}: zodManyToOneProps) => {
  return manySchema
    .extend({
      [oneKey]: oneSchema.extend({
        [manyKey]: manySchema
          .extend({
            [oneKey]: oneSchema
              .extend({
                [manyKey]: manySchema
                  .extend({
                    [oneKey]: oneSchema.extend({
                      [manyKey]: manySchema
                        .extend({
                          [oneKey]: oneSchema
                            .extend({
                              [manyKey]: manySchema.optional().array()
                            })
                            .optional()
                        })
                        .optional()
                        .array()
                    })
                  })
                  .array()
                  .optional()
              })
              .optional()
          })
          .optional()
          .array()
      }).optional()
    })
    .array()
    .optional()
}

export const BreedSchema = z.object({
  family: z.string().optional(),
  members: z.number().optional()
})

export const userInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().optional(),
  breed: BreedSchema.optional()
})

// We need to add 1 by 1 the relations so we can
export const rolesWithPivot = RoleInputSchema.extend({
  pivot: RolesUserSchema.optional()
})

export const userWithRoles = userInputSchema.extend({
  id: z.string(),
  roles: rolesWithPivot.array().optional()
})

// The final Output for the user
export const userOutputSchema = userWithRoles.extend({  
  cars: ZodManyToOne({
    manySchema: carInputSchema,
    oneSchema: userWithRoles,
    manyKey: 'cars',
    oneKey: 'user'
  })
})

export type UsersDtoIn = z.infer<typeof userInputSchema>

export type UsersDtoOut = z.infer<typeof userOutputSchema>
