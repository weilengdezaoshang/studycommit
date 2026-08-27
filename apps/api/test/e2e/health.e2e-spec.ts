import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv } from '../helpers/env'
describe('Health API', () => {
  let app: NestFastifyApplication
  beforeAll(async () => {
    applyTestEnv()
    app = await (await import('../../src/app.factory.js')).createApp()
  })
  afterAll(async () => app.close())
  it('reports liveness and readiness', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health/live' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/health/ready' })).statusCode).toBe(200)
  })

  it('publishes the oRPC response schema in the shared OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs-json' })
    const document = response.json()
    const schema =
      document.paths['/api/health/live'].get.responses['200'].content['application/json'].schema

    expect(response.statusCode).toBe(200)
    expect(document.openapi).toMatch(/^3\.1\./)
    expect(schema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['status', 'service', 'timestamp']),
      properties: {
        status: { const: 'ok' },
        service: { const: 'studycommit-api' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    })
  })
})
