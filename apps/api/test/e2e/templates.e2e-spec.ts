import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'
import { SYSTEM_TEMPLATE } from '../../src/templates/template.constants'

describe('Templates API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const user = '11111111-1111-4111-8111-111111111111'

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  it('列出系统模板供箱子选择', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/templates',
      headers: { 'x-user-id': user },
    })
    expect(response.statusCode).toBe(200)
    const { items } = response.json() as { items: Array<{ id: string; icon: string }> }
    expect(items).toHaveLength(4)
    expect(items.map((item) => item.id).sort()).toEqual(
      Object.values(SYSTEM_TEMPLATE)
        .map((template) => template.id)
        .sort(),
    )
    expect(items.find((item) => item.id === SYSTEM_TEMPLATE.plain.id)).toMatchObject({
      name: '空白',
      icon: 'box',
      paperBackground: 'plain',
    })
  })

  it('缺少身份时拒绝查询模板', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/templates' })).statusCode).toBe(401)
  })
})
