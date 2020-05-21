import { Module } from '@nestjs/common'
import { Databases } from './database.providers'

@Module({
  providers: [...Databases],
  exports: [...Databases]
})
export class DatabaseModule {}
