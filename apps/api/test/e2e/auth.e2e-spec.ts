import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('Auth API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const redis = new Redis(testEnv.REDIS_URL)
  const phone = '13800138000'
  const code = '123456'

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  beforeEach(async () => {
    await pool.query('truncate auth_sessions, auth_identities, users restart identity cascade')
    await redis.flushdb()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  const send = (body: object = { phone }) =>
    app.inject({ method: 'POST', url: '/api/auth/phone/code', payload: body })

  const verify = (body: object = { phone, code, deviceType: 'mobile' }) =>
    app.inject({ method: 'POST', url: '/api/auth/phone/verify', payload: body })

  it('发送验证码后验证即登录并创建账户', async () => {
    const sent = await send()
    expect(sent.statusCode).toBe(200)
    expect(sent.json()).toEqual({ expiresInSeconds: 600 })
    expect(sent.json()).not.toHaveProperty('code')

    const first = await verify()
    expect(first.statusCode).toBe(200)
    expect(first.json().user).toMatchObject({
      nickname: '学习者',
      avatarUrl: null,
      status: 'active',
    })
    expect(first.json().user).not.toHaveProperty('phone')
    expect(first.json().tokens.accessToken).toEqual(expect.any(String))
    expect(first.json().tokens.refreshToken).toEqual(expect.any(String))

    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${first.json().tokens.accessToken}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().id).toBe(first.json().user.id)

    await redis.flushdb()
    const again = await send()
    expect(again.statusCode).toBe(200)
    const second = await verify()
    expect(second.json().user.id).toBe(first.json().user.id)
  })

  it('错误或过期验证码不暴露手机号是否已注册', async () => {
    await send()
    const invalid = await verify({ phone, code: '000000', deviceType: 'mobile' })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().error.code).toBe('AUTH_CODE_INVALID')

    const missing = await verify({
      phone: '13900139000',
      code: '123456',
      deviceType: 'mobile',
    })
    expect(missing.statusCode).toBe(400)
    expect(missing.json().error.code).toBe('AUTH_CODE_EXPIRED')
  })

  it('冷却期内重复发码被拒绝且刷新令牌可轮换', async () => {
    await send()
    const cooldown = await send()
    expect(cooldown.statusCode).toBe(429)
    expect(cooldown.json().error.code).toBe('AUTH_CODE_COOLDOWN')

    const session = (await verify()).json()
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken: session.tokens.refreshToken },
    })
    expect(refreshed.statusCode).toBe(200)
    expect(refreshed.json().accessToken).not.toBe(session.tokens.accessToken)
    expect(refreshed.json().refreshToken).not.toBe(session.tokens.refreshToken)

    const replayOld = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken: session.tokens.refreshToken },
    })
    expect(replayOld.statusCode).toBe(401)

    const loggedOut = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${refreshed.json().accessToken}` },
    })
    expect(loggedOut.statusCode).toBe(204)
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${refreshed.json().accessToken}` },
    })
    expect(me.statusCode).toBe(401)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/me',
          headers: { authorization: `Bearer ${session.tokens.accessToken}` },
        })
      ).statusCode,
    ).toBe(401)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/token/refresh',
          payload: { refreshToken: refreshed.json().refreshToken },
        })
      ).statusCode,
    ).toBe(401)
  })

  it('缺少令牌或手机号不合法时拒绝', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout' })).statusCode).toBe(401)
    expect((await send({ phone: '1380013800' })).statusCode).toBe(400)
    expect((await send({ phone: '1380013800' })).json().error.code).toBe('VALIDATION_ERROR')
  })

  it('停用账户不能登录', async () => {
    const disabledPhone = '13700137000'
    const [{ id }] = (
      await pool.query<{ id: string }>(
        `insert into users (nickname, status) values ('停用', 'disabled') returning id`,
      )
    ).rows
    await pool.query(
      `insert into auth_identities (user_id, provider, provider_subject, verified_at)
       values ($1, 'phone', $2, now())`,
      [id, createHash('sha256').update(`phone:${disabledPhone}`).digest('hex')],
    )
    await send({ phone: disabledPhone })
    const blocked = await verify({ phone: disabledPhone, code, deviceType: 'mobile' })
    expect(blocked.statusCode).toBe(401)
    expect(blocked.json().error.code).toBe('AUTH_ACCOUNT_DISABLED')
  })

  it('同一验证码并发验证只会建立一个会话', async () => {
    await send()
    const [first, second] = await Promise.all([verify(), verify()])
    const statuses = [first.statusCode, second.statusCode].sort()
    expect(statuses).toEqual([200, 400])
    const succeeded = first.statusCode === 200 ? first : second
    const failed = first.statusCode === 200 ? second : first
    expect(failed.json().error.code).toBe('AUTH_CODE_EXPIRED')
    const sessions = await pool.query('select count(*)::int as count from auth_sessions')
    expect(sessions.rows[0].count).toBe(1)
    expect(succeeded.json().user.id).toEqual(expect.any(String))
  })
})
