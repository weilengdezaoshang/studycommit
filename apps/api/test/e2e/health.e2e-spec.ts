import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv } from '../helpers/env'
describe('Health API', () => {
  let app: NestFastifyApplication
  beforeAll(async () => {
    applyTestEnv()
    app = await (await import('../../src/app.factory')).createApp()
  })
  afterAll(async () => app.close())
  it('reports liveness and readiness', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health/live' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/health/ready' })).statusCode).toBe(200)
  })
})
