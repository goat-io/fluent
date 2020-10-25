import { AccessControlModule } from 'nestjs-role-protected'
import { EnvModule } from './Env/env.module'
import { FilesModule } from './Uploads/files.module'
import { FormModule } from './Form/form.module'
import { HealthModule } from './Health/health.module'

const GoatModules = [
  FilesModule,
  AccessControlModule,
  HealthModule,
  EnvModule,
  FormModule
]

export { GoatModules }
