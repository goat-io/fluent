import { CronJob } from 'cron'
import type {
  Job,
  JobDescription,
  RepeatEvery,
  TimeZones,
  Scheduler
} from '../../queue-core/src'

export enum NodeTimeZones {
  EuropeStockholm = 'Europe/Stockholm'
}

const repeatEveryToNodeCronTime = (value?: RepeatEvery): string => {
  if (!value) return 'never'

  const map: Record<RepeatEvery, string> = {
    never: 'never',
    second: '* * * * * *',
    minute: '*/1 * * * *',
    minutes5: '*/5 * * * *',
    minutes10: '*/10 * * * *',
    minutes20: '*/20 * * * *',
    minutes30: '*/30 * * * *',
    minutes40: '*/40 * * * *',
    minutes50: '*/50 * * * *',
    hour: '0 */1 * * *',
    hours2: '0 */2 * * *',
    hours3: '0 */3 * * *',
    hours4: '0 */4 * * *',
    hours5: '0 */5 * * *',
    hours6: '0 */6 * * *',
    hours7: '0 */7 * * *',
    hours8: '0 */8 * * *',
    hours9: '0 */9 * * *',
    hours10: '0 */10 * * *'
  }

  return map[value]
}

const getTimezoneString = (timeZone: TimeZones): NodeTimeZones =>
  NodeTimeZones[timeZone]

export class NodeScheduler implements Scheduler {
  async schedule(options: Job) {
    const croneString = repeatEveryToNodeCronTime(
      (options.repeat && options.repeat.cronTime) || 'never'
    )
    const timezoneString = getTimezoneString(
      (options.repeat && options.repeat.timeZone) || 'Europe/Stockholm'
    )

    const jobDescription: JobDescription = {
      data: options.data,
      id: options.jobName,
      instance: undefined,
      name: options.jobName
    }

    let runAt: string | Date = croneString

    if (croneString === 'never') {
      const date = new Date()
      date.setSeconds(date.getSeconds() + 0.25)
      runAt = date
    }

    const cronJob = CronJob.from({
      cronTime: runAt,
      onTick: async job => options.handle(jobDescription),
      runOnInit: options.repeat.runOnInit,
      start: true,
      timeZone: timezoneString
    })

    return
  }
}
