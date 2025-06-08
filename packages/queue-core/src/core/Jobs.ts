import { EventEmitter } from 'events'
import Worker from 'cluster'
import { Job, Scheduler } from '../types/job'

export class Jobs {
  public static using<T extends Scheduler>(type: T): T {
    return type
  }

  public static worker() {
    return Worker
  }

  public static setMaxListeners(listeners: number) {
    EventEmitter.defaultMaxListeners = listeners
  }
}

class MyDummyScheduler implements Scheduler {
  async schedule(props: Job): Promise<void> {
    console.log('here')
  }

  async myCustomFunction() {}
}

const myScheduler = new MyDummyScheduler()

const job = Jobs.using(myScheduler)

job.schedule
