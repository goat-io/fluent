import { Decorators } from '../../../core/database/decorators'
import { ObjectType } from '@nestjs/graphql'

@ObjectType()
export class Breed {
  @Decorators.property({ required: false })
  family?: string

  @Decorators.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@Decorators.entity('goat')
export class GoatEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: false })
  age?: number

  @Decorators.embed(Breed)
  breed?: Breed
}
