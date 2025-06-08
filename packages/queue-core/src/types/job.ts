export type TimeZones =
  | 'UTC'
  | 'Europe/Stockholm'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'Europe/Paris'
  | 'Europe/Madrid'
  | 'America/New_York'
  | 'America/Los_Angeles'
  | 'America/Chicago'
  | 'America/Sao_Paulo'
  | 'Asia/Tokyo'
  | 'Asia/Shanghai'
  | 'Asia/Hong_Kong'
  | 'Asia/Singapore'
  | 'Asia/Kolkata'
  | 'Australia/Sydney'
  | 'Pacific/Auckland'
  | 'Africa/Johannesburg'
  | 'Asia/Dubai'
  | 'America/Mexico_City'

export type RepeatEvery =
  | 'never'
  | 'second'
  | 'minute'
  | 'minutes5'
  | 'minutes10'
  | 'minutes20'
  | 'minutes30'
  | 'minutes40'
  | 'minutes50'
  | 'hour'
  | 'hours2'
  | 'hours3'
  | 'hours4'
  | 'hours5'
  | 'hours6'
  | 'hours7'
  | 'hours8'
  | 'hours9'
  | 'hours10'

export type DataMap = Record<string, any>

export interface JobDescription {
  id: string
  name: string
  data?: DataMap
  instance: any
}

export type Repeat = {
  cronTime: RepeatEvery
  timeZone: TimeZones
  runOnInit: boolean
}

export type Job = {
  data?: DataMap
  jobName: string
  repeat?: Repeat
  lockTime?: number
  handle(job: JobDescription): Promise<void>
}

export type Schedulers = 'agenda' | 'bull' | 'bullmq' | 'node'

export interface Scheduler {
  schedule(props: Job): Promise<void>
}
