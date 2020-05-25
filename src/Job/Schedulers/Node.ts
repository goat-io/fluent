import { CronJob } from 'cron'
import { IJob, IJobDescription, RepeatEvery, TimeZones } from '../Job'

export enum NodeCronTimes {
  never = 'never',
  second = '* * * * * *',
  minute = '*/1 * * * *',
  minutes5 = '*/5 * * * *',
  minutes10 = '*/10 * * * *',
  minutes20 = '*/20 * * * *',
  minutes30 = '*/30 * * * *',
  minutes40 = '*/40 * * * *',
  minutes50 = '*/50 * * * *',
  hour = '0 */1 * * *',
  hours2 = '0 */2 * * *',
  hours3 = '0 */3 * * *',
  hours4 = '0 */4 * * *',
  hours5 = '0 */5 * * *',
  hours6 = '0 */6 * * *',
  hours7 = '0 */7 * * *',
  hours8 = '0 */8 * * *',
  hours9 = '0 */9 * * *',
  hours10 = '0 */10 * * *'
}

export enum NodeTimeZones {
  EuropeStockholm = 'Europe/Stockholm'
}

const getCronString = (cronTime: RepeatEvery): NodeCronTimes => {
  return NodeCronTimes[cronTime]
}

const getTimezoneString = (timeZone: TimeZones): NodeTimeZones => {
  return NodeTimeZones[timeZone]
}

export const NodeScheduler = (() => {
  const schedule = async (options: IJob) => {
    const croneString = getCronString(
      (options.repeat && options.repeat.cronTime) || RepeatEvery.never
    )
    const timezoneString = getTimezoneString(
      (options.repeat && options.repeat.timeZone) || TimeZones.EuropeStockholm
    )

    const jobDescription: IJobDescription = {
      data: options.data,
      id: options.jobName,
      instance: undefined,
      name: options.jobName
    }

    let runAt: NodeCronTimes | Date = croneString

    if (croneString === NodeCronTimes.never) {
      const date = new Date()
      date.setSeconds(date.getSeconds() + 0.25)
      runAt = date
    }

    return new CronJob({
      cronTime: runAt,
      onTick: async job => {
        return options.handle(jobDescription)
      },
      runOnInit: options.repeat.runOnInit,
      start: true,
      timeZone: timezoneString
    })
  }
  return Object.freeze({ schedule })
})()
