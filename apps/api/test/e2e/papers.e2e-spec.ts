import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('Papers API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const userA = '11111111-1111-4111-8111-111111111111'
  const userB = '22222222-2222-4222-8222-222222222222'

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  beforeEach(async () => {
    await pool.query(
      'truncate papers, learning_logs, study_sessions, idempotency_records, topics restart identity cascade',
    )
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  const create = (
    user = userA,
    key = crypto.randomUUID(),
    body: object = { content: '  记下一段内容  ' },
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': user, 'idempotency-key': key },
      payload: body,
    })

  it('去掉首尾空格后创建待整理记录', async () => {
    const created = await create()
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      content: '记下一段内容',
      status: 'inbox',
      topicId: null,
      version: 1,
      deletedAt: null,
    })
    expect(created.json().id).toEqual(expect.any(String))
    expect(created.json().createdAt).toEqual(expect.any(String))
    expect(created.json().updatedAt).toEqual(created.json().createdAt)
  })

  it('相同幂等键重试返回首次结果，内容不同则冲突', async () => {
    const first = await create(userA, 'same-paper-key')
    const replay = await create(userA, 'same-paper-key')
    expect(replay.statusCode).toBe(201)
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')

    const conflict = await create(userA, 'same-paper-key', { content: '另一段内容' })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('拒绝空白内容、缺少身份和缺少幂等键', async () => {
    expect((await create(userA, crypto.randomUUID(), { content: '   ' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/papers', payload: {} })).statusCode).toBe(
      401,
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/papers',
          headers: { 'x-user-id': userA },
          payload: { content: '一段内容' },
        })
      ).statusCode,
    ).toBe(400)
  })

  it('其他用户无法查看已创建的记录', async () => {
    const paper = (await create()).json()
    const foreign = await app.inject({
      method: 'GET',
      url: `/api/papers/${paper.id}`,
      headers: { 'x-user-id': userB },
    })
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().error.code).toBe('PAPER_NOT_FOUND')
  })
})
