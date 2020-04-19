import { Fluent } from '../Fluent'

export const Role = Fluent.model('Role', {
  remote: {
    path: 'access',
    pullForm: true,
    token: undefined
  }
})
