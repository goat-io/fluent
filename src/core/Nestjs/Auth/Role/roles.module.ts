import { Module } from '@nestjs/common'
import { RoleController } from './roles.controller'
import { Role } from './roles.entity'
import { RoleService } from './roles.service'
import { Connection } from 'typeorm'
import { DatabaseModule } from '../../Database/database.module'

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
