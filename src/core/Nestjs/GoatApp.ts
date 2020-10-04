import { AccessControlModule } from 'nestjs-role-protected'
import { DatabaseModule } from './Database/database.module'
import { EnvModule } from './Env/env.module'
import { FilesModule } from './Uploads/files.module'
import { FormModule } from './Form/form.module'
import { HealthModule } from './Health/health.module'

const GoatModules = [
  DatabaseModule,
  FilesModule,
  AccessControlModule,
  HealthModule,
  FormModule,
  EnvModule
]

export { GoatModules }
