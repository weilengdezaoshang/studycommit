import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common'
import { healthContract } from '@studycommit/rpc-contracts/health'
import { Implement, implement } from '@orpc/nest'
import { HealthService } from './health.service'

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Implement(healthContract.liveness)
  liveness() {
    return implement(healthContract.liveness).handler(() => ({
      status: 'ok' as const,
      service: 'studycommit-api' as const,
      timestamp: new Date().toISOString(),
    }))
  }

  @Get('health/ready')
  async readiness() {
    const result = await this.health.readiness()
    if (result.status !== 'ready') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE)
    }
    return result
  }
}
