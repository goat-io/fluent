import Pusher from 'pusher-js/react-native'
// import { BroadcasterInterface } from './BroadcasterInterface'

interface IPusher {
  appKey: string
  appCluster: string
  authEndpoint: string
  token: string
}
export class RedisBroadcaster {
  private authEndpoint: string
  private channel
  private channels: {
    entering: 'pusher:member_added'
    error: 'pusher:subscription_error'
    here: 'pusher:subscription_succeeded'
    leaving: 'pusher:member_removed'
  }
  private credentials: {
    appCluster: string
    appKey: string
  }

  private instance: Pusher
  constructor({ authEndpoint, appCluster, appKey, token }: IPusher) {
    this.credentials.appKey = appKey || this.credentials.appKey
    this.credentials.appCluster = appCluster || this.credentials.appCluster
    this.authEndpoint = authEndpoint || this.authEndpoint
    const AuthToken = undefined // Auth().connector().user().x_jwt_token

    const jwtToken = token || AuthToken
    this.instance = new Pusher(this.credentials.appKey, {
      auth: {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      },
      authEndpoint: this.authEndpoint,
      cluster: this.credentials.appCluster
    })
  }

  public here(callback: () => void): any {
    if (typeof callback !== 'function') {
      throw new Error('Callback is not a function.')
    }
    this.channel.bind(this.channels.here, callback)
    return this
  }
}
