import { Connection } from 'typeorm'
import { DatabaseModule } from '../../Database/database.module'
import { Module } from '@nestjs/common'
import { Role } from './roles.entity'
import { RoleController } from './roles.controller'
import { RoleService } from './roles.service'

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'Role_REPOSITORY',
      useFactory: (connection: Connection) => connection.getRepository(Role),
      inject: ['SQLITE3']
    },
    RoleService
  ],
  controllers: [RoleController]
})
export class RoleModule {}
