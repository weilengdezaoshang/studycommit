import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('createApp', () => {
  let app: NestFastifyApplication | undefined
  let createApp: typeof import('./app.factory').createApp

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('API_PORT', '3001')
    vi.stubEnv('DATABASE_URL', 'postgresql://studycommit:test@localhost:5433/studycommit_test')
    vi.stubEnv('REDIS_URL', 'redis://localhost:6380')
    ;({ createApp } = await import('./app.factory'))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  afterEach(async () => {
    await app?.close()
  })

  it('能够完成初始化并执行 NestJS 关闭生命周期', async () => {
    app = await createApp()

    expect(app).toBeDefined()

    await app.close()
    app = undefined
  })
})
