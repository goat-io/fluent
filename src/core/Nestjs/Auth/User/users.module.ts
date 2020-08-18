import { Module } from '@nestjs/common'
import { RoleModule } from '../Role/roles.module'
import { UserController } from './users.controller'
import { UserProviders } from './user.providers'
import { UsersService } from './users.service'
@Module({
  imports: [RoleModule],
  providers: [...UserProviders, UsersService],
  exports: [UsersService, RoleModule],
  controllers: [UserController]
})
export class UsersModule {}
