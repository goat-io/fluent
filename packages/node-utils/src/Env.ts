export interface EnvServiceCfg {
  /**
   * Dir with ${envName}.env.ts files
   */
  envDir: string
}

export interface BaseEnv {
  name: string
}

export interface BuildInfo {
  ts: number
  tsStr: string
  branch: string
  env?: string
  rev: string
  ver: string
  dev?: boolean
}

export class Env<ENV extends BaseEnv = any> {
  constructor(private cfg: EnvServiceCfg) {}

  private env?: ENV

  init(): void {
    this.getEnv()
  }

  getEnv(): ENV {
    if (!this.env) {
      const { APP_ENV } = process.env
      if (!APP_ENV) {
        throw new Error('APP_ENV should be defined!')
      }

      const { envDir } = this.cfg
      const envFilePath = `${envDir}/${APP_ENV}.env`

      try {
        const module = require(envFilePath)
        this.env = module.default
      } catch {
        throw new Error(`Cannot read envFile ${envFilePath}`)
      }

      if (APP_ENV.toLowerCase() !== 'test') {
        console.log(`APP_ENV=${APP_ENV} loaded`)
      }
    }

    return this.env!
  }

  setEnv(env?: ENV): void {
    console.log(`setEnv APP_ENV=${env ? env.name : 'undefined'}`)
    this.env = env
  }
}
