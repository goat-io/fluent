import { AuthModule } from './Auth/auth.module'
import { FilesModule } from './Uploads/files.module'
import { UsersModule } from './Auth/User/users.module'
import { AccessControlModule } from 'nestjs-role-protected'
import { HealthModule } from './Health/health.module'
import { FormModule } from './Form/form.module'
import { DatabaseModule } from './Database/database.module'
import { EnvModule } from './Env/env.module'
import { RoleModule } from './Auth/Role/roles.module'

const GoatModules = [
  DatabaseModule,
  FilesModule,
  UsersModule,
  RoleModule,
  AccessControlModule,
  HealthModule,
  FormModule,
  EnvModule
]

if (process.env.AUTH_USE_JWT && String(process.env.AUTH_USE_JWT) === 'true') {
  GoatModules.push(AuthModule)
}

export { GoatModules }
