import { Decorators } from '../../../core/database/decorators'

// tslint:disable-next-line: max-classes-per-file
export class FurtherNested {
  @Decorators.property({ required: true })
  c: boolean

  @Decorators.array({ required: true })
  d: number[]
}

// tslint:disable-next-line: max-classes-per-file
export class Nested {
  @Decorators.array({ required: true })
  a: number[]

  @Decorators.property({ required: true })
  c: number

  @Decorators.embed(FurtherNested)
  b?: FurtherNested
}
// tslint:disable-next-line: max-classes-per-file
@Decorators.entity('numbers')
export class TypeORMDataModel {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  created?: string

  @Decorators.embed(Nested)
  nestedTest?: Nested

  @Decorators.property({ required: false })
  order?: number

  @Decorators.property({ required: true })
  test: boolean
}
