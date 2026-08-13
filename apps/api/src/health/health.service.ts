import { Inject, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { RedisService } from '../infrastructure/redis.service'

export type DependencyStatus = 'up' | 'down'

export interface ReadinessResult {
  status: 'ready' | 'not_ready'
  dependencies: {
    postgres: DependencyStatus
    redis: DependencyStatus
  }
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService
  ) {}

  async readiness(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.allSettled([
      this.database.ping(),
      this.redis.ping()
    ])

    const dependencies = {
      postgres: postgres.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down'
    } as const

    return {
      status: dependencies.postgres === 'up' && dependencies.redis === 'up' ? 'ready' : 'not_ready',
      dependencies
    }
  }
}
