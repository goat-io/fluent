import { Module } from '@nestjs/common'
import { EnvController } from './env.controller'

@Module({
  controllers: [EnvController]
})
export class EnvModule {}
