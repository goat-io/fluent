import { Connection } from 'typeorm'
import { User } from './user.entity'
import { createRepository } from '../../Database/createRepository'

export const UserProviders = [
  createRepository({
    connectionName: 'MAIN_DATABASE',
    repositoryName: 'USER_REPOSITORY',
    entity: User
  })
]
