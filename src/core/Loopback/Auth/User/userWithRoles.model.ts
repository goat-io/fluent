import { model, property } from '@loopback/repository'
import { Role } from '../Role/role.model'
import { User as UserModel } from './user.model'

@model()
export class UserWithRoles extends UserModel {
  @property.array(Role)
  public roles?: Role[]
}
