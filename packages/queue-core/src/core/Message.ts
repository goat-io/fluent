import { EventEmitter } from 'events'

export type MessageBrokers = 'rabbitmq'

type MessageBrokerAdapter = any

export class Message {
  private static adapters: Map<MessageBrokers, MessageBrokerAdapter> = new Map()

  public static register(type: MessageBrokers, adapter: MessageBrokerAdapter) {
    Message.adapters.set(type, adapter)
  }

  public static using(type: MessageBrokers): MessageBrokerAdapter | undefined {
    return Message.adapters.get(type)
  }

  public static setMaxListeners(listeners: number) {
    EventEmitter.defaultMaxListeners = listeners
  }
}
