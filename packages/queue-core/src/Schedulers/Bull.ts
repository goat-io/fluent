// import * as Bull from 'bull'
// import Redis from 'ioredis'
// import { Promises } from '@goatlab/js-utils'
// import { Job, JobDescription, RepeatEvery, TimeZones } from '../core/Jobs'

// export enum BullTimeZones {
//   EuropeStockholm = 'Europe/Stockholm'
// }

// const repeatEveryToBullCronTime = (value?: RepeatEvery): string => {
//   if(!value) {
//     return 'never'
//   }

//   const map: Record<RepeatEvery, string> = {
//     never: 'never',
//     second: '* * * * * *',
//     minute: '*/1 * * * *',
//     minutes5: '*/5 * * * *',
//     minutes10: '*/10 * * * *',
//     minutes20: '*/20 * * * *',
//     minutes30: '*/30 * * * *',
//     minutes40: '*/40 * * * *',
//     minutes50: '*/50 * * * *',
//     hour: '0 */1 * * *',
//     hours2: '0 */2 * * *',
//     hours3: '0 */3 * * *',
//     hours4: '0 */4 * * *',
//     hours5: '0 */5 * * *',
//     hours6: '0 */6 * * *',
//     hours7: '0 */7 * * *',
//     hours8: '0 */8 * * *',
//     hours9: '0 */9 * * *',
//     hours10: '0 */10 * * *'
//   }
//   return map[value]
// }

// const getTimezoneString = (timeZone: TimeZones): BullTimeZones =>
//   BullTimeZones[timeZone]

// const RedisConnection = {
//   db: 0,
//   family: 4, // 4 (IPv4) or 6 (IPv6)
//   host: process.env['REDIS_HOST'] || '127.0.0.1',
//   password: process.env['REDIS_PASSWORD'] || undefined,
//   port: Number(process.env['REDIS_PORT']) || 6379
// }

// export const BullScheduler = (() => {
//   /**
//    *
//    * @param options
//    */
//   const schedule = async (options: Job) => {
//     const opts: Bull.QueueOptions = {
//       redis: RedisConnection
//     }

//     const croneString = repeatEveryToBullCronTime(
//       (options.repeat && options.repeat.cronTime) || 'never'
//     )
//     const timezoneString = getTimezoneString(
//       (options.repeat && options.repeat.timeZone) || 'Europe/Stockholm'
//     )

//     const queue = new Bull(options.jobName, opts)

//     let queueOptions: any = {
//       repeat: { cron: croneString, tz: timezoneString }
//     }

//     if (croneString === 'never') {
//       queueOptions = {}
//     }

//     queue.add(options.data, queueOptions)

//     queue.process(async job => {
//       const jobDescription: JobDescription = {
//         data: job.data,
//         id: String(job.id),
//         instance: job,
//         name: job.name
//       }

//       const [error] = await Promises.try(options.handle(jobDescription))
//       if (error) {
//         console.log('error', error)
//         console.log('Could not process the job', jobDescription)
//       }
//     })

//     return queue
//   }
//   return Object.freeze({ schedule })
// })()
