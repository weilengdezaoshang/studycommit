import { Controller, HttpStatus, Inject } from '@nestjs/common'
import { healthContract } from '@studycommit/rpc-contracts/health'
import { Implement, implement, ORPCError } from '@orpc/nest'
import { HealthService } from './health.service'

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Implement(healthContract)
  healthRouter() {
    return {
      liveness: implement(healthContract.liveness).handler(() => ({
        status: 'ok' as const,
        service: 'studycommit-api' as const,
        timestamp: new Date().toISOString(),
      })),
      readiness: implement(healthContract.readiness).handler(async () => {
        const result = await this.health.readiness()
        if (result.status !== 'ready') {
          throw new ORPCError('SERVICE_UNAVAILABLE', {
            status: HttpStatus.SERVICE_UNAVAILABLE,
            message: '依赖服务不可用',
            data: result,
          })
        }
        return result
      }),
    }
  }
}
