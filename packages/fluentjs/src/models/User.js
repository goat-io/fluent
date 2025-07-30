import to from 'await-to-js'
import axios from 'axios'
import { Fluent } from '../fluent'
import Utilities from '../utilities'
import Connection from '../Wrappers/Connection'
import Configuration from './Configuration'
import Form from './Form'

export default Fluent.model({
  properties: {
    name: 'User',
    config: {
      remote: {
        path: 'user',
        token: undefined
      }
    }
  },
  methods: {
    async storeLocally(user) {
      const localUser = await this.local()
        .where('data.email', '=', user.data.email)
        .first()

      const cleanedUser = Utilities.deleteNulls(user)
      const isUserAlreadyStored = !!localUser && !Utilities.isEmpty(localUser)

      //  check if user is already present in local storage
      if (isUserAlreadyStored) {
        throw new Error('The user email is already taken')
      }

      if (Connection.isOnline()) {
        const [error, onlineUser] = await to(
          Form.getModel({ path: 'userregister' }).remote().insert(cleanedUser)
        )

        if (error) {
          throw new Error('The user email is already taken')
        }
        return this.local().insert(onlineUser)
      }

      return this.local().insert(cleanedUser)
    },
    async updateUser(user) {
      const localUser = await this.local()
        .where('data.email', '=', user.data.email)
        .pluck('_id')

      localUser.forEach(async _id => {
        await this.local().remove(_id)
      })

      const cleanedUser = Utilities.deleteNulls(user)

      return this.local().insert(cleanedUser)
    },
    async login({ credentials, role }) {
      let url = (await Configuration.local().first()).APP_URL

      if (role === 'admin') {
        url = `${url}/admin/login`
      } else {
        url = `${url}/user/login`
      }
      return axios.post(url, {
        data: credentials
      })
    },
    async loopbackLogin({ credentials }) {
      const url = (await Configuration.local().first()).LOOPBACK_URL
      credentials.username = undefined
      return axios.post(`${url}users/login`, {
        email: credentials.email,
        password: credentials.password
      })
    }
  }
})()
