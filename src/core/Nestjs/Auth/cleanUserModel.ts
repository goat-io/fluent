import { omit, pipe } from 'ramda'
import { User } from './User/user.entity'

const omitValues = omit(['id', '__v', 'password'])

export const cleanUserModel: (user: User) => User = pipe(
  JSON.stringify,
  JSON.parse,
  omitValues
)
