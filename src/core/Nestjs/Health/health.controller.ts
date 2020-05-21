import { Controller, Get } from '@nestjs/common'
import {
  DNSHealthIndicator,
  HealthCheck,
  HealthCheckService
} from '@nestjs/terminus'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private dns: DNSHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.dns.pingCheck('google', 'https://google.com')
    ])
  }
}
