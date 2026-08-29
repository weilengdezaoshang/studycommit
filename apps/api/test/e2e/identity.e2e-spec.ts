import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('IdentityGuard', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const redis = new Redis(testEnv.REDIS_URL)
  const phone = '13800138000'
  const fixtureUser = '11111111-1111-4111-8111-111111111111'

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  beforeEach(async () => {
    await pool.query(
      'truncate papers, learning_logs, study_sessions, idempotency_records, topics, auth_sessions, auth_identities, users restart identity cascade',
    )
    await redis.flushdb()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  async function login() {
    await app.inject({
      method: 'POST',
      url: '/api/auth/phone/code',
      payload: { phone },
    })
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/phone/verify',
      payload: { phone, code: '123456', deviceType: 'mobile' },
    })
    return verified.json().tokens.accessToken as string
  }

  it('登录令牌可以创建纸页和箱子且不必再传用户头', async () => {
    const accessToken = await login()
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'idempotency-key': crypto.randomUUID(),
    }
    const paper = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers,
      payload: { content: '记下一段内容' },
    })
    expect(paper.statusCode).toBe(201)
    expect(paper.json().status).toBe('inbox')

    const topic = await app.inject({
      method: 'POST',
      url: '/api/topics',
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
      payload: { name: '系统设计' },
    })
    expect(topic.statusCode).toBe(201)
    expect(topic.json().name).toBe('系统设计')

    const templates = await app.inject({
      method: 'GET',
      url: '/api/templates',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(templates.statusCode).toBe(200)
    expect(templates.json().items.length).toBeGreaterThan(0)
  })

  it('无效令牌即使带有开发用户头也拒绝', async () => {
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: {
        authorization: 'Bearer not-a-token',
        'x-user-id': fixtureUser,
        'idempotency-key': crypto.randomUUID(),
      },
      payload: { content: '不应保存' },
    })
    expect(rejected.statusCode).toBe(401)
    expect(rejected.json().error.code).toBe('UNAUTHENTICATED')
  })

  it('测试环境无令牌时仍可用开发用户头', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': fixtureUser, 'idempotency-key': crypto.randomUUID() },
      payload: { content: '开发用户头仍可用' },
    })
    expect(created.statusCode).toBe(201)
  })

  it('没有令牌也没有开发用户头时拒绝访问', async () => {
    const paper = await app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'idempotency-key': crypto.randomUUID() },
      payload: { content: '不应保存' },
    })
    expect(paper.statusCode).toBe(401)
    expect(paper.json().error.code).toBe('UNAUTHENTICATED')
    expect((await app.inject({ method: 'GET', url: '/api/templates' })).statusCode).toBe(401)
    expect(
      (await app.inject({ method: 'GET', url: '/api/study-sessions/active' })).statusCode,
    ).toBe(401)
  })

  it('登录令牌可以查询当前学习会话', async () => {
    const accessToken = await login()
    const active = await app.inject({
      method: 'GET',
      url: '/api/study-sessions/active',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(active.statusCode).toBe(200)
    expect(active.json().session).toBeNull()
  })
})
