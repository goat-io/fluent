import { Module } from '@nestjs/common'

import { AuthModule } from './Auth/auth.module'
import { FilesModule } from './Uploads/files.module'
import { UsersModule } from './Auth/User/users.module'
import { AccessControlModule } from 'nestjs-role-protected'
import { HealthModule } from './Health/health.module'
import { FormModule } from './Form/form.module'
import { DatabaseModule } from './Database/database.module'

@Module({
  imports: [
    FilesModule,
    UsersModule,
    DatabaseModule,
    //AuthModule,
    AccessControlModule,
    HealthModule,
    FormModule
  ]
})
export class GoatApp {}
