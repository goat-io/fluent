import { z } from 'zod'
import { carInputSchema } from '../car/car.schema'
import { carOutputSchema } from '../car/car.output.schema'
import { RoleInputSchema } from '../roles/role.schema'

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
      })
    })
    .array()
    .optional()
}

export const userOutputSchema = userInputSchema.extend({
  id: z.string(),
  cars: ZodManyToOne({
    manySchema: carInputSchema,
    oneSchema: userInputSchema,
    manyKey: 'cars',
    oneKey: 'user'
  }),
  roles: RoleInputSchema.array().optional()
})

export type UsersDtoIn = z.infer<typeof userInputSchema>

export type UsersDtoOut = z.infer<typeof userOutputSchema>
