import axios from 'axios'
import { Connection } from '../../Helpers/Connection'
import { Hash } from '../../Helpers/Hash'
import { Objects } from '../../Helpers/Objects'
import { AuthInterface } from '../AuthInterface'
import { Role } from '../Role'

export class Formio implements AuthInterface {
  /**
   *
   *
   * @param {any} credentials
   * @returns
   */
  /*
  public async localAuthenticate(credentials) {
    const { username, password } = credentials
    // Hash password
    const hashedPassword = await Hash.hash(password)

    const dbUser = await User.local()
      .where('email', '=', username)
      .get()

    const userFound = dbUser && dbUser[0]

    if (!userFound) {
      throw new Error('The user was not found locally')
    }

    const isValidUser = Hash.compare(userFound.data.hashedPassword, hashedPassword)

    if (!isValidUser) {
      throw new Error('The passwords do not match')
    }

    return userFound
  }
  */
  /**
   *
   *
   * @param {any} credentials
   * @param {any} role
   * @returns
   */
  public async remoteAuthenticate(credentials) {
    let url = process.env.APP_URL

    url = url + '/users/login'

    return axios.post(url, credentials)
  }
  /**
   *
   * Authenticates the User with the given credentials
   * @param {any} credentials
   * @param {any} role
   * @returns
   */
  public async authenticate(credentials) {
    const isOnline = await Connection.isOnline()

    if (isOnline) {
      return this.remoteAuthenticate(credentials)
    }
    // return this.localAuthenticate(credentials)
  }
  /**
   *
   *
   * @param {any} credentials
   * @param {any} role
   * @returns
   */
  public attempt(credentials): Promise<object> {
    return new Promise((resolve, reject) => {
      this.authenticate(credentials)
        // If credentials are OK
        .then(async response => {
          const headers = response.headers || {}
          const user = response.data

          user.x_jwt_token = headers['x-jwt-token']

          localStorage.setItem('authUser', JSON.stringify(user))
          localStorage.setItem('formioToken', headers['x-jwt-token'])

          const roles = await Role.local().first()

          user.rolesNames = []
          Object.keys(roles).forEach(key => {
            if (key !== '$loki' && key !== '_id' && key !== 'meta') {
              if (user.roles && user.roles.indexOf(roles[key]._id) !== -1) {
                user.rolesNames.push(roles[key])
              }
            }
          })

          localStorage.setItem('authUser', JSON.stringify(user))

          resolve(user)
        })
        // If there are errors
        .catch(error => {
          console.log('There was an error over here!')
          reject(error)
        })
    })
  }
  /**
   *
   *
   * @returns
   */
  public user() {
    try {
      const user = JSON.parse(localStorage.getItem('authUser'))

      return user === null ? false : user
    } catch (e) {
      localStorage.removeItem('authUser')
      return false
    }
  }
  /**
   *
   *
   * @returns
   */
  public email() {
    let email = ''

    if (this.user() && this.user().data && this.user().data.email) {
      email = this.user().data.email
    } else if (this.user() && this.user().email) {
      email = this.user().email
    }
    return email
  }
  /**
   *
   *
   * @param {any} roleName
   * @returns
   */
  public hasRole(roleName: string): boolean {
    let user = JSON.parse(localStorage.getItem('authUser'))

    user = user === null ? false : user

    const result = user.rolesNames.find(r => {
      return r.title === roleName
    })

    return typeof result !== 'undefined'
  }
  /**
   *
   *
   * @param {any} roles
   * @returns
   */
  public hasRoleIn(roles: string[]): boolean {
    if (!roles || Objects.isEmpty(roles)) {
      return true
    }
    return roles.some(role => {
      return this.hasRole(role) || role === 'Authenticated'
    })
  }
  /**
   *
   *
   * @param {any} rolesIds
   * @returns
   */
  public async hasRoleIdIn(rolesIds: string[]): Promise<boolean> {
    if (!rolesIds || Objects.isEmpty(rolesIds)) {
      return true
    }
    const appRoles = await Role.local().first()

    const roles = rolesIds.reduce((reducer, roleId) => {
      Object.keys(appRoles).forEach(role => {
        if (appRoles[role] && appRoles[role]._id && appRoles[role]._id === roleId) {
          reducer.push(appRoles[role].title)
        }
      })
      return reducer
    }, [])

    return roles.some(role => {
      return this.hasRole(role) || role === 'Authenticated'
    })
  }
  /**
   * Checks if the current user is
   * Authenticated
   * @return {boolean}
   */
  public check() {
    const user = JSON.parse(localStorage.getItem('authUser'))

    return !!user && !!user.x_jwt_token
  }
  /**
   * Logs out autheticated user
   *
   */
  public async logOut() {
    await localStorage.removeItem('authUser')
    await localStorage.removeItem('formioToken')
    await localStorage.removeItem('formioUser')
  }
}
