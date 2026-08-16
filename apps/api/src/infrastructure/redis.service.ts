import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis
  private closePromise?: Promise<void>

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null
    })
    this.client.on('error', () => undefined)
  }

  async ping(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect()
    }
    await this.client.ping()
  }

  onModuleDestroy(): Promise<void> {
    if (this.closePromise) return this.closePromise

    this.closePromise = this.client.status === 'ready'
      ? this.client.quit().then(() => undefined)
      : Promise.resolve(this.client.disconnect(false))
    return this.closePromise
  }
}
