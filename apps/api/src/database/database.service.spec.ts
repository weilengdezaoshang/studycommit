import { describe, expect, it, vi } from 'vitest'
import { DatabaseService } from './database.service'

function createService(end: () => Promise<void>): DatabaseService {
  const service = Object.create(DatabaseService.prototype) as DatabaseService
  Object.assign(service, { pool: { end } })
  return service
}

describe('DatabaseService shutdown', () => {
  it('关闭模块时结束 PostgreSQL 连接池', async () => {
    const end = vi.fn().mockResolvedValue(undefined)
    const service = createService(end)

    await service.onModuleDestroy()

    expect(end).toHaveBeenCalledOnce()
  })

  it('并发或重复关闭时只结束一次连接池', async () => {
    const end = vi.fn().mockResolvedValue(undefined)
    const service = createService(end)

    await Promise.all([service.onModuleDestroy(), service.onModuleDestroy()])
    await service.onModuleDestroy()

    expect(end).toHaveBeenCalledOnce()
  })
})
