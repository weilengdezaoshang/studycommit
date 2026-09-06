import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('Search API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const user = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
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
    content: string
    questionText?: string
    userId?: string
    deleted?: boolean
    updatedAt?: string
  }) {
    await pool.query(
      `INSERT INTO papers (user_id, content, question_status, question_text, has_question,
         created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, now() - interval '1 day', $6, $7)`,
      [
        options.userId ?? user,
        options.content,
        options.questionText ? 'thinking' : 'none',
        options.questionText ?? null,
        Boolean(options.questionText),
        options.updatedAt ?? new Date().toISOString(),
        options.deleted ? new Date().toISOString() : null,
      ],
    )
  }

  it('命中纸页正文与问题文本并隔离用户', async () => {
    await insertPaper({ content: '调度器使用小顶堆管理任务' })
    await insertPaper({ content: '无关内容', questionText: '并发渲染中断后如何恢复' })
    await insertPaper({ content: '别人的纸页:小顶堆', userId: other })
    await insertPaper({ content: '软删的:小顶堆', deleted: true })

    const result = (
      await app.inject({
        method: 'GET',
        url: '/api/search?q=' + encodeURIComponent('小顶堆'),
        headers,
      })
    ).json()
    expect(result.papers.items).toHaveLength(1)
    expect(result.papers.items[0].content).toBe('调度器使用小顶堆管理任务')
    expect(result.topics).toEqual([])

    const questionHit = (
      await app.inject({
        method: 'GET',
        url: '/api/search?q=' + encodeURIComponent('并发渲染'),
        headers,
      })
    ).json()
    expect(questionHit.papers.items).toHaveLength(1)
    expect(questionHit.papers.items[0].questionText).toBe('并发渲染中断后如何恢复')
  })

  it('命中箱子名称且只返回活跃未删箱子', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: { 'x-user-id': user, 'idempotency-key': crypto.randomUUID() },
        payload: { name: '前端架构' },
      })
    ).json()
    // 别人的同名箱子不可见
    await app.inject({
      method: 'POST',
      url: '/api/topics',
      headers: { 'x-user-id': other, 'idempotency-key': crypto.randomUUID() },
      payload: { name: '前端架构私有' },
    })

    const result = (
      await app.inject({
        method: 'GET',
        url: '/api/search?q=' + encodeURIComponent('前端'),
        headers,
      })
    ).json()
    expect(result.topics).toHaveLength(1)
    expect(result.topics[0]).toMatchObject({ id: created.id, name: '前端架构' })
  })

  it('纸页按更新时间倒序并支持游标翻页', async () => {
    // 依次插入:updated_at 由参数控制,先旧后新
    await insertPaper({ content: '翻页一', updatedAt: '2026-09-01T00:00:00Z' })
    await insertPaper({ content: '翻页二', updatedAt: '2026-09-02T00:00:00Z' })
    await insertPaper({ content: '翻页三', updatedAt: '2026-09-03T00:00:00Z' })

    const firstPage = (
      await app.inject({
        method: 'GET',
        url: '/api/search?q=' + encodeURIComponent('翻页') + '&limit=2',
        headers,
      })
    ).json()
    expect(firstPage.papers.items.map((item: { content: string }) => item.content)).toEqual([
      '翻页三',
      '翻页二',
    ])
    expect(firstPage.papers.pageInfo.hasNextPage).toBe(true)

    const secondPage = (
      await app.inject({
        method: 'GET',
        url:
          '/api/search?q=' +
          encodeURIComponent('翻页') +
          '&limit=2&cursor=' +
          firstPage.papers.pageInfo.nextCursor,
        headers,
      })
    ).json()
    expect(secondPage.papers.items.map((item: { content: string }) => item.content)).toEqual([
      '翻页一',
    ])
    expect(secondPage.papers.pageInfo.hasNextPage).toBe(false)
  })

  it('查询词中的通配符被转义且空白查询被拒绝', async () => {
    await insertPaper({ content: '普通内容' })

    const wildcard = (
      await app.inject({
        method: 'GET',
        url: '/api/search?q=' + encodeURIComponent('%'),
        headers,
      })
    ).json()
    expect(wildcard.papers.items).toHaveLength(0)

    const blank = await app.inject({
      method: 'GET',
      url: '/api/search?q=' + encodeURIComponent('   '),
      headers,
    })
    expect(blank.statusCode).toBe(400)
  })
})
