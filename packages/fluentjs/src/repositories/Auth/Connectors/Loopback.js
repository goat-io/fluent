import { Hash } from '../../../../Helpers/Hash'
import Role from '../../../models/Role'
import User from '../../../models/User'
import Utilities from '../../../utilities'
import Connection from '../../../Wrappers/Connection'
import AuthInterface from '../AuthInterface'

export default AuthInterface.compose({
  methods: {
    /**
     *
     *
     * @param {any} credentials
     * @returns
     */
    async localAuthenticate(credentials) {
      const { username, password } = credentials

      // Hash password
      const hashedPassword = Hash.hash(password)

      // Get the user
      const dbUser = await User.local()
        .where('data.username', '=', username)
        .get()
      const userFound = dbUser?.[0] ? dbUser[0] : undefined

      if (!userFound) {
        throw new Error()
      }
      // Compare hashed passwords
      const isValidUser = userFound.data.hashedPassword === hashedPassword

      if (!isValidUser) {
        throw new Error()
      }
      // If is valid, return the user
      return userFound
    },
    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    async remoteAuthenticate(credentials) {
      const response = await User.loopbackLogin({ credentials: credentials })
      const user = response.data

      await User.updateUser(user)
      return response
    },
    /**
     *
     * Authenticates the User with the given credentials
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    async authenticate(credentials, role) {
      const isOnline = await Connection.isOnline()

      if (isOnline) {
        return this.remoteAuthenticate(credentials, role)
      }
      return this.localAuthenticate(credentials)
    },
    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    attempt(credentials, role) {
      const userRole = role || 'user'

      return new Promise((resolve, reject) => {
        this.authenticate(credentials, userRole)
          // If credentials are OK
          .then(async response => {
            const user = response.data

            // Save auth user
            localStorage.setItem('authUser', JSON.stringify(user))
            localStorage.setItem('formioToken', user.data['x-jwt-token'])
            // user.isAdmin = true
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
            reject(error)
          })
      })
    },
    /**
     *
     *
     * @returns
     */
    user() {
      try {
        const user = JSON.parse(localStorage.getItem('authUser'))

        return user === null ? false : user
      } catch (_e) {
        localStorage.removeItem('authUser')
        return false
      }
    },
    /**
     *
     *
     * @returns
     */
    email() {
      let email = ''

      if (this.user()?.data?.email) {
        email = this.user().data.email
      } else if (this.user()?.email) {
        email = this.user().email
      }
      return email
    },
    /**
     *
     *
     * @param {any} roleName
     * @returns
     */
    hasRole(roleName) {
      let user = JSON.parse(localStorage.getItem('authUser'))

      user = user === null ? false : user

      const result = user.rolesNames.find(r => {
        return r.title === roleName
      })

      return typeof result !== 'undefined'
    },
    /**
     *
     *
     * @param {any} roles
     * @returns
     */

    hasRoleIn(roles) {
      if (!roles || Utilities.isEmpty(roles)) {
        return true
      }
      return roles.some(role => {
        return this.hasRole(role) || role === 'Authenticated'
      })
    },
    /**
     *
     *
     * @param {any} rolesIds
     * @returns
     */
    async hasRoleIdIn(rolesIds) {
      if (!rolesIds || Utilities.isEmpty(rolesIds)) {
        return true
      }
      const appRoles = await Role.local().first()

      const roles = rolesIds.reduce((reducer, roleId) => {
        Object.keys(appRoles).forEach(role => {
          if (appRoles[role]?._id && appRoles[role]._id === roleId) {
            reducer.push(appRoles[role].title)
          }
        })
        return reducer
      }, [])

      return roles.some(role => {
        return this.hasRole(role) || role === 'Authenticated'
      })
    },
    /**
     * Checks if the current user is
     * Authenticated
     * @return {boolean}
     */
    check() {
      const user = JSON.parse(localStorage.getItem('authUser'))

      return !!user && !!user.x_jwt_token
    },
    /**
     * Logs out autheticated user
     *
     */
    async logOut() {
      await localStorage.removeItem('authUser')
      await localStorage.removeItem('formioToken')
      await localStorage.removeItem('formioUser')
    }
  }
})
