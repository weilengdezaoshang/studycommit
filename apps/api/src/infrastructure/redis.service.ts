import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis
  private closePromise?: Promise<void>
  private connecting?: Promise<void>

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })
    this.client.on('error', () => undefined)
  }

  async ping(): Promise<void> {
    await this.connect()
    await this.client.ping()
  }

  async get(key: string): Promise<string | null> {
    await this.connect()
    return this.client.get(key)
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.connect()
    await this.client.setex(key, seconds, value)
  }

  async setNxEx(key: string, seconds: number, value: string): Promise<boolean> {
    await this.connect()
    const result = await this.client.set(key, value, 'EX', seconds, 'NX')
    return result === 'OK'
  }

  async del(key: string): Promise<void> {
    await this.connect()
    await this.client.del(key)
  }

  async evalNumber(script: string, keys: string[], args: string[]): Promise<number> {
    await this.connect()
    const result = await this.client.eval(script, keys.length, ...keys, ...args)
    return Number(result)
  }

  private async connect(): Promise<void> {
    if (this.client.status === 'ready') {
      return
    }
    if (!this.connecting) {
      this.connecting = this.establishConnection().finally(() => {
        this.connecting = undefined
      })
    }
    await this.connecting
  }

  private async establishConnection(): Promise<void> {
    if (this.client.status === 'ready') {
      return
    }
    try {
      if (this.client.status === 'wait' || this.client.status === 'end') {
        await this.client.connect()
      }
    } catch (error) {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        return
      }
      throw error
    }
  }

  onModuleDestroy(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }

    this.closePromise =
      this.client.status === 'ready'
        ? this.client.quit().then(() => undefined)
        : Promise.resolve(this.client.disconnect(false))
    return this.closePromise
  }
}
