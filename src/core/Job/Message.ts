import { EventEmitter } from 'events'
import { RabbitMQBroker } from './Brokers/RabbitMQ'

export interface IDataMap {
  [key: string]: any
}

export interface IJobDescription {
  id: string
  name: string
  data?: IDataMap
  instance: any
}

export interface IJob {
  data?: IDataMap
  jobName: string
  lockTime?: number
  handle(job: IJobDescription): Promise<void>
}

export enum Brokers {
  RABBITMQ = 'rabbitmq'
}

export class Message {
  public static using(type: Brokers.RABBITMQ): typeof RabbitMQBroker

  public static using(type: Brokers) {
    if (type === Brokers.RABBITMQ) {
      return RabbitMQBroker
    }
  }

  public static setMaxListeners(listeners: number) {
    EventEmitter.defaultMaxListeners = listeners
  }
}
