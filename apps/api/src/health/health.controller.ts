import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      service: 'studycommit-api',
      timestamp: new Date().toISOString()
    }
  }

  @Get('ready')
  async readiness() {
    const result = await this.health.readiness()
    if (result.status !== 'ready') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE)
    }
    return result
  }
}
