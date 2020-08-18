import { Agenda } from './Schedulers/Agenda'
import { BullMQScheduler } from './Schedulers/BullMQ'
import { BullScheduler } from './Schedulers/Bull'
import { EventEmitter } from 'events'
import { NodeScheduler } from './Schedulers/Node'
import { worker } from 'cluster'

export enum TimeZones {
  EuropeStockholm = 'Europe/Stockholm'
}

export enum RepeatEvery {
  never = 'never',
  second = 'second',
  minute = 'minute',
  minutes5 = 'minutes5',
  minutes10 = 'minutes10',
  minutes20 = 'minutes20',
  minutes30 = 'minutes30',
  minutes40 = 'minutes40',
  minutes50 = 'minutes50',
  hour = 'hour',
  hours2 = 'hours2',
  hours3 = 'hours3',
  hours4 = 'hours4',
  hours5 = 'hours5',
  hours6 = 'hours6',
  hours7 = 'hours7',
  hours8 = 'hours8',
  hours9 = 'hours9',
  hours10 = 'hours10'
}
export interface IDataMap {
  [key: string]: any
}

export interface IJobDescription {
  id: string
  name: string
  data?: IDataMap
  instance: any
}

export interface IRepeat {
  cronTime: RepeatEvery
  timeZone: TimeZones
  runOnInit: boolean
}

export interface IJob {
  data?: IDataMap
  jobName: string
  repeat?: IRepeat
  lockTime?: number
  handle(job: IJobDescription): Promise<void>
}

export enum Schedulers {
  AGENDA = 'agenda',
  BULL = 'bull',
  BULLMQ = 'bullmq',
  NODE = 'node'
}
// TODO test jobs
export class Job {
  public static using(type: Schedulers.AGENDA): typeof Agenda
  public static using(type: Schedulers.BULL): typeof BullScheduler
  public static using(type: Schedulers.BULLMQ): typeof BullMQScheduler
  public static using(type: Schedulers.NODE): typeof NodeScheduler

  public static using(type: Schedulers) {
    if (type === Schedulers.AGENDA) {
      return Agenda
    } else if (type === Schedulers.BULL) {
      return BullScheduler
    } else if (type === Schedulers.BULLMQ) {
      return BullMQScheduler
    } else if (type === Schedulers.NODE) {
      return NodeScheduler
    }
  }

  public static worker() {
    return worker
  }

  public static setMaxListeners(listeners: number) {
    EventEmitter.defaultMaxListeners = listeners
  }
}
