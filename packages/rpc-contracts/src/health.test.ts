import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { describe, expect, it } from 'vitest'
import { healthContract, livenessSchema } from './health.js'

describe('health contract', () => {
  it('声明稳定的存活检查路由', () => {
    expect(healthContract.liveness['~orpc'].route).toEqual(
      expect.objectContaining({ method: 'GET', path: '/health/live' }),
    )
  })

  it('接受标准存活响应', () => {
    expect(
      livenessSchema.parse({
        status: 'ok',
        service: 'studycommit-api',
        timestamp: '2026-08-26T09:00:00.000Z',
      }),
    ).toEqual({
      status: 'ok',
      service: 'studycommit-api',
      timestamp: '2026-08-26T09:00:00.000Z',
    })
  })

  it('拒绝错误服务名和非法时间', () => {
    expect(() =>
      livenessSchema.parse({ status: 'ok', service: 'other-api', timestamp: 'today' }),
    ).toThrow()
  })

  it('从同一份契约生成 OpenAPI 路由', async () => {
    const specification = await new OpenAPIGenerator({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }).generate(healthContract, { info: { title: 'StudyCommit API', version: '1.0.0' } })

    expect(specification.paths?.['/health/live']?.get).toEqual(
      expect.objectContaining({
        responses: expect.objectContaining({ 200: expect.any(Object) }),
      }),
    )
  })
})
