import { DNSHealthIndicator, HealthCheckService } from '@nestjs/terminus'

import { HealthController } from './health.controller'
import { Module } from '@nestjs/common'
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
