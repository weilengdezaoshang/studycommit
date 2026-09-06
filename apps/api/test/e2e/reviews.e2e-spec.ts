import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('Reviews API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const user = '11111111-1111-4111-8111-111111111111'
  const headers = { 'x-user-id': user }

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

  async function insertPaper(options: {
    createdAt: string
    topicId?: string
    resolved?: boolean
    resolvedAt?: string
    deleted?: boolean
  }) {
    await pool.query(
      `INSERT INTO papers (user_id, content, topic_id, question_status, question_text,
         question_resolved_at, has_question, is_question_resolved, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10)`,
      [
        user,
        '一条学习纸页',
        options.topicId ?? null,
        options.resolved ? 'resolved' : 'none',
        options.resolved ? '什么是事件循环' : null,
        options.resolvedAt ?? null,
        Boolean(options.resolved),
        Boolean(options.resolved),
        options.createdAt,
        options.deleted ? new Date().toISOString() : null,
      ],
    )
  }

  it('按用户时区聚合日界:上海时区的跨月纸页归属正确月份', async () => {
    // UTC 的 9 月 30 日 20 点 = 上海的 10 月 1 日凌晨 4 点
    await insertPaper({ createdAt: '2026-09-30T20:00:00Z' })
    // UTC 的 9 月 30 日 10 点 = 上海的 9 月 30 日 18 点
    await insertPaper({ createdAt: '2026-09-30T10:00:00Z' })

    const october = (
      await app.inject({
        method: 'GET',
        url: '/api/reviews/monthly?month=2026-10&timezone=Asia/Shanghai',
        headers,
      })
    ).json()
    expect(october.paperCount).toBe(1)
    expect(october.days).toEqual([{ date: '2026-10-01', count: 1 }])

    const september = (
      await app.inject({
        method: 'GET',
        url: '/api/reviews/monthly?month=2026-09&timezone=Asia/Shanghai',
        headers,
      })
    ).json()
    expect(september.paperCount).toBe(1)
    expect(september.days).toEqual([{ date: '2026-09-30', count: 1 }])

    // 换成 UTC 时区:两条都归属 9 月
    const utc = (
      await app.inject({
        method: 'GET',
        url: '/api/reviews/monthly?month=2026-09&timezone=UTC',
        headers,
      })
    ).json()
    expect(utc.paperCount).toBe(2)
  })

  it('装订统计区分纸页、箱子和已解决数且排除软删', async () => {
    const topic = (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: { 'x-user-id': user, 'idempotency-key': crypto.randomUUID() },
        payload: { name: '前端架构' },
      })
    ).json()

    await insertPaper({ createdAt: '2026-09-05T02:00:00Z', topicId: topic.id })
    await insertPaper({ createdAt: '2026-09-08T02:00:00Z' })
    await insertPaper({
      createdAt: '2026-09-10T02:00:00Z',
      resolved: true,
      resolvedAt: '2026-09-12T03:00:00Z',
    })
    // 解决时间在当月之外:不计入 resolvedCount,但纸页在当月仍计入 paperCount
    await insertPaper({
      createdAt: '2026-09-02T02:00:00Z',
      resolved: true,
      resolvedAt: '2026-10-05T03:00:00Z',
    })
    // 软删纸页不计入任何统计
    await insertPaper({ createdAt: '2026-09-20T02:00:00Z', deleted: true })

    const review = (
      await app.inject({
        method: 'GET',
        url: '/api/reviews/monthly?month=2026-09&timezone=UTC',
        headers,
      })
    ).json()
    expect(review).toMatchObject({
      month: '2026-09',
      timezone: 'UTC',
      // 解决时间在 10 月的纸页仍按创建时间计入当月纸页数
      paperCount: 4,
      topicCount: 1,
      resolvedCount: 1,
    })
    expect(review.days).toEqual([
      { date: '2026-09-02', count: 1 },
      { date: '2026-09-05', count: 1 },
      { date: '2026-09-08', count: 1 },
      { date: '2026-09-10', count: 1 },
    ])
  })

  it('无效时区被拒绝', async () => {
    const rejected = await app.inject({
      method: 'GET',
      url: '/api/reviews/monthly?month=2026-09&timezone=Mars/Olympus',
      headers,
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().code).toBe('REVIEW_TIMEZONE_INVALID')
  })
})
