import * as faker from 'faker'

import { Decorators } from '../../../Nestjs/Database/decorators'

@Decorators.entity('roles')
export class Role {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  description?: string

  @Decorators.property({ required: true, unique: true })
  name: string

  @Decorators.created()
  created: Date

  @Decorators.updated()
  updated: Date

  @Decorators.deleted()
  deleted: Date
}

export const fakeRole = (): Role => {
  return {
    id: faker.random.uuid(),
    description: faker.name.firstName(),
    name: faker.name.firstName(),
    created: faker.date.recent(),
    updated: faker.date.recent(),
    deleted: faker.date.recent()
  }
}
