import { describe, expect, it, vi } from 'vitest'
import { HealthService } from './health.service'
const dependency = (reject = false) => ({ ping: reject ? vi.fn().mockRejectedValue(new Error('down')) : vi.fn().mockResolvedValue(undefined) })
describe('HealthService', () => {
  it('is ready when PostgreSQL and Redis are up', async () => expect(await new HealthService(dependency() as never, dependency() as never).readiness()).toMatchObject({ status: 'ready', dependencies: { postgres: 'up', redis: 'up' } }))
  it.each([[true, false, 'postgres'], [false, true, 'redis'], [true, true, 'both']])('is not ready when a dependency is down', async (dbDown, redisDown) => {
    const result = await new HealthService(dependency(dbDown) as never, dependency(redisDown) as never).readiness()
    expect(result.status).toBe('not_ready')
  })
})
