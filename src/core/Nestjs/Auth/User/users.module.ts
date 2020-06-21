import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UserProviders } from './user.providers'
import { UserController } from './users.controller'
@Module({
  providers: [...UserProviders, UsersService],
  exports: [UsersService],
  controllers: [UserController]
})
export class UsersModule {}
