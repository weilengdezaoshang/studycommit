import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('AI API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const redis = new Redis(testEnv.REDIS_URL)

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  const followup = (body: object, token?: string) =>
    app.inject({
      method: 'POST',
      url: '/api/ai/papers/explain',
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })

  const registerAndLogin = async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/account/register',
      payload: { account: 'ai_user', password: 'secret123' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/account/login',
      payload: { account: 'ai_user', password: 'secret123', deviceType: 'desktop' },
    })
    return login.json().tokens.accessToken as string
  }

  it('未登录访问陪学追问被拒绝', async () => {
    const response = await followup({ content: '讲解内容' })
    expect(response.statusCode).toBe(401)
  })

  it('输入过短讲解被拒绝', async () => {
    const token = await registerAndLogin()
    const response = await followup({ content: '   ' }, token)
    expect(response.statusCode).toBe(400)
  })

  it('未配置 AI 供应商时返回固定降级错误码', async () => {
    const token = await registerAndLogin()
    const response = await followup({ content: 'React 的批处理会合并多次更新。' }, token)
    expect(response.statusCode).toBe(503)
    expect(response.json().code).toBe('AI_UNAVAILABLE')
  })
})
