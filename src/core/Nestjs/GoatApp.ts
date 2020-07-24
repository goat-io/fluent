import { AccessControlModule } from 'nestjs-role-protected'
import { AuthModule } from './Auth/auth.module'
import { DatabaseModule } from './Database/database.module'
import { EnvModule } from './Env/env.module'
import { FilesModule } from './Uploads/files.module'
import { FormModule } from './Form/form.module'
import { HealthModule } from './Health/health.module'
import { RoleModule } from './Auth/Role/roles.module'
import { UsersModule } from './Auth/User/users.module'

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

if (
  (process.env.AUTH_USE_JWT && String(process.env.AUTH_USE_JWT) === 'true') ||
  (process.env.AUTH_USE_FIREBASE &&
    String(process.env.AUTH_USE_FIREBASE) === 'true')
) {
  GoatModules.push(AuthModule)
}

export { GoatModules }
