import { Auth, SocketsInterface } from '@goatlab/goatjs'
import Pusher from 'pusher-js/react-native'

export default SocketsInterface.compose({
  init({
    authEndpoint,
    appCluster,
    appKey,
    token
  }: {
    appKey: string
    appCluster: string
    authEndpoint: string
    token: string
  }) {
    this.credentials.appKey = appKey || this.credentials.appKey
    this.credentials.appCluster = appCluster || this.credentials.appCluster
    this.authEndpoint = authEndpoint || this.authEndpoint
    const jwtToken =
      token ||
      Auth()
        .connector()
        .user().x_jwt_token
    this.instance = new Pusher(this.credentials.appKey, {
      cluster: this.credentials.appCluster,
      authEndpoint: this.authEndpoint,
      auth: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      }
    })
  },
  properties: {
    credentials: {
      appCluster: undefined,
      appKey: undefined
    },
    channels: {
      here: 'pusher:subscription_succeeded',
      error: 'pusher:subscription_error',
      entering: 'pusher:member_added',
      leaving: 'pusher:member_removed'
    },
    authEndpoint: undefined,
    instance: undefined,
    channel: undefined
  },
  methods: {
    here(callback: () => void): any {
      if (typeof callback !== 'function') throw new Error('Callback is not a function.')
      this.channel.bind(this.channels.here, callback)
      return this
    },
    join(channel: string): any {
      this.channel = this.instance.subscribe(`presence-${channel}`)
      this.channel.bind(this.channels.error, err => {
        throw new Error(`Could not subscribe to channel: ${err}`)
      })
      return this
    },
    joining(callback: () => void): any {
      if (typeof callback !== 'function') throw new Error('Callback is not a function.')
      this.channel.bind(this.channels.entering, callback)
      return this
    },
    leave(channel: string): void {
      this.instance.unsubscribe(`presence-${channel}`)
    },
    leaving(callback: () => void): any {
      if (typeof callback !== 'function') throw new Error('Callback is not a function.')
      this.channel.bind(this.channels.leaving, callback)
      return this
    }
  }
})
