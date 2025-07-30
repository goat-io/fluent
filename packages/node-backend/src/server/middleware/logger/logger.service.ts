import { createLogger } from 'winston'
import { pkg } from '../../consts'
import {
  getWinstonCloudRunConfig,
  WinstonCloudRunConfig
} from './cloudRun.logger'

export type GetLoggerConfig = Omit<
  WinstonCloudRunConfig,
  'appName' | 'appVersion'
> & {
  appName?: string
  appVersion?: string
}

export const getLogger = (cfg: GetLoggerConfig) => {
  return createLogger({
    ...getWinstonCloudRunConfig({
      ...cfg,
      appName: cfg.appName || pkg.name,
      appVersion: cfg.appVersion || pkg.version
    })
  })
}
