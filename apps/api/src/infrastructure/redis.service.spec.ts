import { describe, expect, it, vi } from 'vitest'
import { RedisService } from './redis.service'

interface RedisClientStub {
  status: string
  quit: () => Promise<string>
  disconnect: (reconnect?: boolean) => void
}

function createService(client: RedisClientStub): RedisService {
  const service = Object.create(RedisService.prototype) as RedisService
  Object.assign(service, { client })
  return service
}

describe('RedisService connect', () => {
  it('并发首次命令只建立一次连接', async () => {
    let status = 'wait'
    const client = {
      get status() {
        return status
      },
      connect: vi.fn().mockImplementation(async () => {
        status = 'ready'
      }),
      get: vi.fn().mockResolvedValue(null),
      on: vi.fn(),
      quit: vi.fn(),
      disconnect: vi.fn(),
    }
    const service = createService(client)

    await Promise.all([service.get('a'), service.get('b')])

    expect(client.connect).toHaveBeenCalledOnce()
    expect(client.get).toHaveBeenCalledTimes(2)
  })
})

describe('RedisService shutdown', () => {
  it('正常关闭已初始化的 Redis 连接', async () => {
    const client = {
      status: 'ready',
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    }
    const service = createService(client)

    await service.onModuleDestroy()

    expect(client.quit).toHaveBeenCalledOnce()
    expect(client.disconnect).not.toHaveBeenCalled()
  })

  it('从未建立连接时不发送退出命令', async () => {
    const client = {
      status: 'wait',
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    }
    const service = createService(client)

    await service.onModuleDestroy()

    expect(client.quit).not.toHaveBeenCalled()
    expect(client.disconnect).toHaveBeenCalledOnce()
    expect(client.disconnect).toHaveBeenCalledWith(false)
  })

  it('连接尚未就绪时直接断开而不发送退出命令', async () => {
    const client = {
      status: 'connecting',
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    }
    const service = createService(client)

    await service.onModuleDestroy()

    expect(client.quit).not.toHaveBeenCalled()
    expect(client.disconnect).toHaveBeenCalledOnce()
    expect(client.disconnect).toHaveBeenCalledWith(false)
  })

  it('并发或重复关闭时只发送一次退出命令', async () => {
    const client = {
      status: 'ready',
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    }
    const service = createService(client)

    await Promise.all([service.onModuleDestroy(), service.onModuleDestroy()])
    await service.onModuleDestroy()

    expect(client.quit).toHaveBeenCalledOnce()
  })
})
