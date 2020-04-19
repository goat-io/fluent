import { model, property } from '@loopback/repository'
import { User as UserModel } from './user.model'

@model()
export class NewUserRequest extends UserModel {
  @property({
    required: true,
    type: 'string'
  })
  public password: string
}
