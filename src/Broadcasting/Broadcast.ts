/*import { PusherRNBroadcaster } from './Broadcasters/PusherBroadcasterRN'
import { RedisBroadcaster } from './Broadcasters/RedisBroadcaster'

export enum Broadcasters {
  PUSHER = 'pusher',
  REDIS = 'redis'
}

export class BroadCast {
  public static using(type: Broadcasters.PUSHER): PusherRNBroadcaster
  public static using(type: Broadcasters.REDIS): RedisBroadcaster

  public static using(type: Broadcasters) {
    if (type === Broadcasters.PUSHER) {
      return new PusherRNBroadcaster({ authEndpoint: '', appCluster: '', appKey: '', token: '' })
    } else if (type === Broadcasters.REDIS) {
      return new RedisBroadcaster({ authEndpoint: '', appCluster: '', appKey: '', token: '' })
    }
  }
}
*/
