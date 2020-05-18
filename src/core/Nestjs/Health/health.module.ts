import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { DNSHealthIndicator, HealthCheckService } from '@nestjs/terminus'
// import { TypegooseModule } from 'nestjs-typegoose'
import { TerminusModule } from '@nestjs/terminus'

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  exports: [
    // TypegooseModule,
    TerminusModule
  ]
})
export class HealthModule {}
