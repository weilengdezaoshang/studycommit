import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'
import {
  DEFAULT_TEMPLATE_ID,
  DEFAULT_TOPIC_COLOR,
  SYSTEM_TEMPLATE,
} from '../../src/templates/template.constants'

describe('Topics API', () => {
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
    body: object = { name: ' Node.js ', color: '#4f46e5' },
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/topics',
      headers: { 'x-user-id': user, 'idempotency-key': key },
      payload: body,
    })

  it('creates, lists, updates and soft deletes a topic', async () => {
    const created = await create()
    expect(created.statusCode).toBe(201)
    const topic = created.json()
    expect(topic).toMatchObject({
      name: 'Node.js',
      color: '#4F46E5',
      status: 'active',
      version: 1,
    })
    const list = await app.inject({
      method: 'GET',
      url: '/api/topics',
      headers: { 'x-user-id': userA },
    })
    expect(list.json().items).toHaveLength(1)
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
      payload: { name: 'Node 深入', version: 1 },
    })
    expect(updated.json()).toMatchObject({ name: 'Node 深入', version: 2 })
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA, 'if-match': '"2"' },
    })
    expect(removed.statusCode).toBe(204)
    const missing = await app.inject({
      method: 'GET',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
    })
    expect(missing.statusCode).toBe(404)
  })
  it('isolates users as not found', async () => {
    const topic = (await create()).json()
    const response = await app.inject({
      method: 'GET',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userB },
    })
    expect(response.statusCode).toBe(404)
  })
  it('replays equal requests and rejects changed content', async () => {
    const first = await create(userA, 'same-key')
    const replay = await create(userA, 'same-key')
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    const conflict = await create(userA, 'same-key', { name: 'Different', color: '#000000' })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })
  it('validates input, identity and optimistic versions', async () => {
    expect((await create(userA, crypto.randomUUID(), { name: '', color: 'red' })).statusCode).toBe(
      400,
    )
    expect((await app.inject({ method: 'GET', url: '/api/topics' })).statusCode).toBe(401)
    const topic = (await create()).json()
    const conflict = await app.inject({
      method: 'PATCH',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
      payload: { name: 'Old', version: 9 },
    })
    expect(conflict.statusCode).toBe(409)
  })
  it('paginates without duplicates and rejects malformed cursors', async () => {
    await create(userA, 'a', { name: 'A', color: '#000000' })
    await create(userA, 'b', { name: 'B', color: '#FFFFFF' })
    const page1 = (
      await app.inject({
        method: 'GET',
        url: '/api/topics?limit=1',
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(page1.pageInfo.hasNextPage).toBe(true)
    const page2 = (
      await app.inject({
        method: 'GET',
        url: `/api/topics?limit=1&cursor=${encodeURIComponent(page1.pageInfo.nextCursor)}`,
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(page2.items[0].id).not.toBe(page1.items[0].id)
    const bad = await app.inject({
      method: 'GET',
      url: '/api/topics?cursor=broken',
      headers: { 'x-user-id': userA },
    })
    expect(bad.statusCode).toBe(400)
  })

  it('只填名称时创建箱子并关联默认模板', async () => {
    const created = await create(userA, crypto.randomUUID(), { name: ' 系统设计 ' })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      name: '系统设计',
      color: DEFAULT_TOPIC_COLOR,
      templateId: DEFAULT_TEMPLATE_ID,
      template: {
        id: DEFAULT_TEMPLATE_ID,
        name: '空白',
        icon: 'box',
        paperBackground: 'plain',
      },
    })
  })

  it('创建时可指定模板且同名箱子冲突', async () => {
    const created = await create(userA, crypto.randomUUID(), {
      name: '前端架构',
      templateId: SYSTEM_TEMPLATE.rule.id,
    })
    expect(created.json()).toMatchObject({
      templateId: SYSTEM_TEMPLATE.rule.id,
      template: { icon: 'rule', paperBackground: 'rule' },
    })
    const duplicate = await create(userA, crypto.randomUUID(), { name: '前端架构' })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('TOPIC_NAME_CONFLICT')
  })

  it('省略模板和显式默认模板可用同一幂等键重试', async () => {
    const key = 'same-default-template'
    const first = await create(userA, key, { name: '幂等模板' })
    const replay = await create(userA, key, {
      name: '幂等模板',
      templateId: DEFAULT_TEMPLATE_ID,
    })
    expect(first.statusCode).toBe(201)
    expect(replay.statusCode).toBe(201)
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')
  })

  it('改名与已有箱子重名时返回冲突', async () => {
    const first = (await create(userA, crypto.randomUUID(), { name: '系统设计' })).json()
    const second = (await create(userA, crypto.randomUUID(), { name: '前端架构' })).json()
    const conflict = await app.inject({
      method: 'PATCH',
      url: `/api/topics/${second.id}`,
      headers: { 'x-user-id': userA },
      payload: { name: '系统设计', version: second.version },
    })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('TOPIC_NAME_CONFLICT')
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/topics/${first.id}`,
          headers: { 'x-user-id': userA },
        })
      ).json().name,
    ).toBe('系统设计')
  })

  it('模板不存在时拒绝创建箱子', async () => {
    const missing = await create(userA, crypto.randomUUID(), {
      name: '移动端设计',
      templateId: crypto.randomUUID(),
    })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error.code).toBe('TEMPLATE_NOT_FOUND')
  })

  const createPaper = (user = userA, body: object = { content: '一段记录' }) =>
    app.inject({
      method: 'POST',
      url: '/api/papers',
      headers: { 'x-user-id': user, 'idempotency-key': crypto.randomUUID() },
      payload: body,
    })

  it('新箱子纸页数量为零，归入后返回数量和最近更新时间', async () => {
    const topic = (await create(userA, crypto.randomUUID(), { name: '系统设计' })).json()
    expect(topic).toMatchObject({ paperCount: 0, lastPaperAt: null })
    const paper = (await createPaper()).json()
    const organized = (
      await app.inject({
        method: 'POST',
        url: `/api/papers/${paper.id}/organize`,
        headers: { 'x-user-id': userA },
        payload: { topicId: topic.id, version: paper.version },
      })
    ).json()
    const latest = (
      await app.inject({
        method: 'GET',
        url: `/api/topics/${topic.id}`,
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(latest.paperCount).toBe(1)
    expect(latest.lastPaperAt).toBe(organized.updatedAt)
  })

  it('已删除纸页不计入箱子数量', async () => {
    const topic = (await create(userA, crypto.randomUUID(), { name: '系统设计' })).json()
    const first = (await createPaper()).json()
    const second = (await createPaper(userA, { content: '另一段记录' })).json()
    await app.inject({
      method: 'POST',
      url: `/api/papers/${first.id}/organize`,
      headers: { 'x-user-id': userA },
      payload: { topicId: topic.id, version: first.version },
    })
    const organized = (
      await app.inject({
        method: 'POST',
        url: `/api/papers/${second.id}/organize`,
        headers: { 'x-user-id': userA },
        payload: { topicId: topic.id, version: second.version },
      })
    ).json()
    await app.inject({
      method: 'DELETE',
      url: `/api/papers/${second.id}`,
      headers: { 'x-user-id': userA },
      payload: { version: organized.version },
    })
    const latest = (
      await app.inject({
        method: 'GET',
        url: `/api/topics/${topic.id}`,
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(latest.paperCount).toBe(1)
  })

  it('删除箱子后纸页回到待整理', async () => {
    const topic = (await create(userA, crypto.randomUUID(), { name: '系统设计' })).json()
    const paper = (await createPaper()).json()
    const organized = (
      await app.inject({
        method: 'POST',
        url: `/api/papers/${paper.id}/organize`,
        headers: { 'x-user-id': userA },
        payload: { topicId: topic.id, version: paper.version },
      })
    ).json()
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA, 'if-match': `"${topic.version}"` },
    })
    expect(removed.statusCode).toBe(204)
    const inbox = (
      await app.inject({
        method: 'GET',
        url: `/api/papers/${paper.id}`,
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(inbox).toMatchObject({
      id: paper.id,
      status: 'inbox',
      topicId: null,
      version: organized.version + 1,
      createdAt: paper.createdAt,
    })
  })
})
