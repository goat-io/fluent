import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../Database/database.module'
// import { User } from './user.entity'
import { UsersService } from './users.service'
import { UserProviders } from './user.providers'

@Module({
  imports: [DatabaseModule],
  providers: [...UserProviders, UsersService],
  exports: [UsersService]
})
export class UsersModule {}
