import { EventEmitter } from 'events'
import Worker from 'cluster'
import { Agenda } from './Schedulers/Agenda'
import { BullMQScheduler } from './Schedulers/BullMQ'
import { BullScheduler } from './Schedulers/Bull'
import { NodeScheduler } from './Schedulers/Node'

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
export interface DataMap {
  [key: string]: any
}

export interface JobDescription {
  id: string
  name: string
  data?: DataMap
  instance: any
}

export interface Repeat {
  cronTime: RepeatEvery
  timeZone: TimeZones
  runOnInit: boolean
}

export interface Job {
  data?: DataMap
  jobName: string
  repeat?: Repeat
  lockTime?: number
  handle(job: JobDescription): Promise<void>
}

export enum Schedulers {
  AGENDA = 'agenda',
  BULL = 'bull',
  BULLMQ = 'bullmq',
  NODE = 'node'
}
// TODO test jobs
export class Jobs {
  public static using(type: Schedulers.AGENDA): typeof Agenda
  public static using(type: Schedulers.BULL): typeof BullScheduler
  public static using(type: Schedulers.BULLMQ): typeof BullMQScheduler
  public static using(type: Schedulers.NODE): typeof NodeScheduler

  public static using(type: Schedulers) {
    if (type === Schedulers.AGENDA) {
      return Agenda
    }
    if (type === Schedulers.BULL) {
      return BullScheduler
    }
    if (type === Schedulers.BULLMQ) {
      return BullMQScheduler
    }
    if (type === Schedulers.NODE) {
      return NodeScheduler
    }
  }

  public static worker() {
    return Worker
  }

  public static setMaxListeners(listeners: number) {
    EventEmitter.defaultMaxListeners = listeners
  }
}
