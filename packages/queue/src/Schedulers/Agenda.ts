import AgendaCron from 'agenda'
import { hostname } from 'os'
import { Promises } from '@goatlab/js-utils'
import { Job, JobDescription, RepeatEvery, TimeZones } from '../Jobs'

const mongoConnectionString = process.env.MONGO_URL

export enum AgendaCronTimes {
  never = 'never',
  second = 'one second',
  minute = 'one minute',
  minutes5 = '5 minutes',
  minutes10 = '10 minutes',
  minutes20 = '20 minutes',
  minutes30 = '30 minutes',
  minutes40 = '40 minutes',
  minutes50 = '50 minutes',
  hour = '1 hour',
  hours2 = '2 hours',
  hours3 = '3 hours',
  hours4 = '4 hours',
  hours5 = '5 hours',
  hours6 = '6 hours',
  hours7 = '7 hours',
  hours8 = '8 hours',
  hours9 = '9 hours',
  hours10 = '10 hours'
}

export enum AgendaTimeZones {
  EuropeStockholm = 'Europe/Stockholm'
}

const getCronString = (cronTime: RepeatEvery): AgendaCronTimes =>
  AgendaCronTimes[cronTime]

const getTimezoneString = (timeZone: TimeZones): AgendaTimeZones =>
  AgendaTimeZones[timeZone]

const agenda = new AgendaCron(
  {
    db: { address: mongoConnectionString, collection: '_goat_jobs' },
    defaultConcurrency: 5,
    defaultLockLifetime: 600000,
    lockLimit: 0,
    maxConcurrency: 20,
    processEvery: '1000'
  },
  err => {
    if (err) {
      console.log(err)
    }
  }
)

const hostName = `${hostname}-${process.pid}`
agenda.name(`${hostName}`)

let agendaStarted = false
/**
 *
 */
const startAgenda = async () => {
  if (agendaStarted) {
    return
  }

  const [error] = await Promises.tuple(agenda.start())

  if (!error) {
    agendaStarted = true
  }
}

export const Agenda = (() => {
  /**
   *
   * @param options
   */
  const schedule = async (options: Job) => {
    const croneString = getCronString(
      (options.repeat && options.repeat.cronTime) || RepeatEvery.never
    )
    const timezoneString = getTimezoneString(
      (options.repeat && options.repeat.timeZone) || TimeZones.EuropeStockholm
    )

    await startAgenda()

    agenda.define(
      options.jobName,
      { lockLifetime: options.lockTime || 10000 },
      async job => {
        const jobDescription: JobDescription = {
          data: job.attrs.data,
          id: String(job.attrs._id),
          instance: job,
          name: job.attrs.name
        }

        const [error] = await Promises.tuple(options.handle(jobDescription))

        if (error) {
          console.log('Could not process the job', job)
        }

        if (croneString === AgendaCronTimes.never) {
          job.remove()
        }
      }
    )

    if (croneString === AgendaCronTimes.never) {
      return agenda.now(options.jobName, options.data)
    }

    await agenda.every(croneString, options.jobName, options.data, {
      skipImmediate: !options.repeat.runOnInit,
      timezone: timezoneString
    })
  }

  return Object.freeze({ schedule })
})()
