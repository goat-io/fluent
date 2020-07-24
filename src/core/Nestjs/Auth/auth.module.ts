import { ConfigModule, ConfigService } from '@nestjs/config'

import { AuthController } from './auth.controller'
// import { AuthResolver } from './auth.resolver'
import { AuthService } from './auth.service'
import { GoatStrategy } from './jwt.strategy'
import { JwtModule } from '@nestjs/jwt'
import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from './User/users.module'

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt'
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', process.env.JWT_SECRET),
        signOptions: {
          expiresIn: 3600
        }
      }),
      inject: [ConfigService]
    }),
    UsersModule
  ],
  providers: [AuthService, GoatStrategy],
  controllers: [AuthController]
  // providers: [AuthService, AuthResolver, GoatStrategy]
})
export class AuthModule {}
