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

  const list = (query = '', user = userA) =>
    app.inject({
      method: 'GET',
      url: `/api/papers${query}`,
      headers: { 'x-user-id': user },
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
    expect(conflict.json().code).toBe('IDEMPOTENCY_KEY_REUSED')
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
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')
  })

  const createTopic = (user = userA, body: object = { name: '系统设计', color: '#4F46E5' }) =>
    app.inject({
      method: 'POST',
      url: '/api/topics',
      headers: { 'x-user-id': user, 'idempotency-key': crypto.randomUUID() },
      payload: body,
    })

  const organize = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'POST',
      url: `/api/papers/${paperId}/organize`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  const update = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'PATCH',
      url: `/api/papers/${paperId}`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  const moveToInbox = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'POST',
      url: `/api/papers/${paperId}/move-to-inbox`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  const remove = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'DELETE',
      url: `/api/papers/${paperId}`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  it('归入箱子后变为已整理并增加版本', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    const organized = await organize(paper.id, { topicId: topic.id, version: paper.version })
    expect(organized.statusCode).toBe(200)
    expect(organized.json()).toMatchObject({
      id: paper.id,
      content: paper.content,
      status: 'organized',
      topicId: topic.id,
      version: 2,
      createdAt: paper.createdAt,
    })
    // 快速连续操作可能落在同一毫秒,updatedAt 相同不能视为失败
    expect(new Date(organized.json().updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(paper.updatedAt).getTime(),
    )
  })

  it('重复归入同一箱子直接返回且不增加版本', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: topic.id, version: 1 })
    const replay = await organize(paper.id, { topicId: topic.id, version: 1 })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({ topicId: topic.id, version: 2, status: 'organized' })
  })

  it('换到另一个箱子视为一次更新', async () => {
    const first = (await createTopic()).json()
    const second = (await createTopic(userA, { name: '前端架构', color: '#0F766E' })).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: first.id, version: 1 })
    const moved = await organize(paper.id, { topicId: second.id, version: 2 })
    expect(moved.statusCode).toBe(200)
    expect(moved.json()).toMatchObject({
      topicId: second.id,
      version: 3,
      status: 'organized',
      createdAt: paper.createdAt,
    })
  })

  it('版本不一致时返回记录版本冲突', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    const conflict = await organize(paper.id, { topicId: topic.id, version: 9 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper.version).toBe(1)
  })

  it('专题不存在、已归档或属于他人时拒绝归类', async () => {
    const paper = (await create()).json()
    const missing = await organize(paper.id, { topicId: crypto.randomUUID(), version: 1 })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().code).toBe('TOPIC_NOT_FOUND')

    const foreignTopic = (await createTopic(userB, { name: '别人的箱子', color: '#111111' })).json()
    const foreign = await organize(paper.id, { topicId: foreignTopic.id, version: 1 })
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('TOPIC_NOT_FOUND')

    const archived = (await createTopic(userA, { name: '已归档', color: '#222222' })).json()
    await app.inject({
      method: 'PATCH',
      url: `/api/topics/${archived.id}`,
      headers: { 'x-user-id': userA },
      payload: { status: 'archived', version: archived.version },
    })
    const blocked = await organize(paper.id, { topicId: archived.id, version: 1 })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().code).toBe('TOPIC_ARCHIVED')
  })

  it('其他用户不能整理不属于自己的记录', async () => {
    const topic = (await createTopic(userB, { name: '别人的箱子', color: '#111111' })).json()
    const paper = (await create()).json()
    const foreign = await organize(paper.id, { topicId: topic.id, version: 1 }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('记录不存在或已删除时返回不存在', async () => {
    const topic = (await createTopic()).json()
    const missing = await organize(crypto.randomUUID(), { topicId: topic.id, version: 1 })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().code).toBe('PAPER_NOT_FOUND')

    const paper = (await create()).json()
    await pool.query('update papers set deleted_at = now() where id = $1', [paper.id])
    const deleted = await organize(paper.id, { topicId: topic.id, version: 1 })
    expect(deleted.statusCode).toBe(404)
    expect(deleted.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('已整理记录用旧版本换箱时返回冲突', async () => {
    const first = (await createTopic()).json()
    const second = (await createTopic(userA, { name: '前端架构', color: '#0F766E' })).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: first.id, version: 1 })
    const conflict = await organize(paper.id, { topicId: second.id, version: 1 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({
      topicId: first.id,
      version: 2,
    })
  })

  it('并发归入同一箱子只升一次版本', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    const [first, second] = await Promise.all([
      organize(paper.id, { topicId: topic.id, version: 1 }),
      organize(paper.id, { topicId: topic.id, version: 1 }),
    ])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(new Set([first.json().version, second.json().version])).toEqual(new Set([2]))
    expect(first.json().topicId).toBe(topic.id)
    expect(second.json().topicId).toBe(topic.id)
  })

  it('去掉首尾空格后更新正文并增加版本，不改创建时间和所属箱子', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    const organized = (await organize(paper.id, { topicId: topic.id, version: 1 })).json()
    const updated = await update(paper.id, {
      content: '  改过的内容  ',
      version: organized.version,
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      id: paper.id,
      content: '改过的内容',
      status: 'organized',
      topicId: topic.id,
      version: 3,
      createdAt: paper.createdAt,
    })
    expect(new Date(updated.json().updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(organized.updatedAt).getTime(),
    )
  })

  it('重复提交相同正文直接返回且不增加版本', async () => {
    const paper = (await create()).json()
    await update(paper.id, { content: '同一段内容', version: 1 })
    const replay = await update(paper.id, { content: '  同一段内容  ', version: 1 })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({ content: '同一段内容', version: 2, topicId: null })
  })

  it('空白或超长内容拒绝更新', async () => {
    const paper = (await create()).json()
    expect((await update(paper.id, { content: '   ', version: 1 })).statusCode).toBe(400)
    expect((await update(paper.id, { content: 'a'.repeat(20_001), version: 1 })).statusCode).toBe(
      400,
    )
  })

  it('更新时版本不一致返回记录版本冲突', async () => {
    const paper = (await create()).json()
    const conflict = await update(paper.id, { content: '另一段内容', version: 9 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({
      id: paper.id,
      version: 1,
      content: paper.content,
    })
  })

  it('其他用户或已删除记录无法更新', async () => {
    const paper = (await create()).json()
    const foreign = await update(paper.id, { content: '别人改', version: 1 }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')

    await pool.query('update papers set deleted_at = now() where id = $1', [paper.id])
    const deleted = await update(paper.id, { content: '已删除还改', version: 1 })
    expect(deleted.statusCode).toBe(404)
    expect(deleted.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('并发提交相同正文只升一次版本', async () => {
    const paper = (await create()).json()
    const [first, second] = await Promise.all([
      update(paper.id, { content: '并发同一段', version: 1 }),
      update(paper.id, { content: '并发同一段', version: 1 }),
    ])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(new Set([first.json().version, second.json().version])).toEqual(new Set([2]))
    expect(first.json().content).toBe('并发同一段')
    expect(second.json().content).toBe('并发同一段')
  })

  it('移回待整理后清空箱子并增加版本', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: topic.id, version: 1 })
    const moved = await moveToInbox(paper.id, { version: 2 })
    expect(moved.statusCode).toBe(200)
    expect(moved.json()).toMatchObject({
      id: paper.id,
      content: paper.content,
      status: 'inbox',
      topicId: null,
      version: 3,
      createdAt: paper.createdAt,
    })
    // 快速连续操作可能落在同一毫秒,updatedAt 相同不能视为失败
    expect(new Date(moved.json().updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(paper.updatedAt).getTime(),
    )
  })

  it('已经在待整理时直接返回且不增加版本', async () => {
    const paper = (await create()).json()
    const replay = await moveToInbox(paper.id, { version: 1 })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({
      id: paper.id,
      status: 'inbox',
      topicId: null,
      version: 1,
    })
  })

  it('移回待整理时版本不一致返回记录版本冲突', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: topic.id, version: 1 })
    const conflict = await moveToInbox(paper.id, { version: 1 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({
      topicId: topic.id,
      version: 2,
    })
  })

  it('其他用户或已删除记录无法移回待整理', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: topic.id, version: 1 })
    const foreign = await moveToInbox(paper.id, { version: 2 }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')

    await pool.query('update papers set deleted_at = now() where id = $1', [paper.id])
    const deleted = await moveToInbox(paper.id, { version: 2 })
    expect(deleted.statusCode).toBe(404)
    expect(deleted.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('并发移回待整理只升一次版本', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: topic.id, version: 1 })
    const [first, second] = await Promise.all([
      moveToInbox(paper.id, { version: 2 }),
      moveToInbox(paper.id, { version: 2 }),
    ])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(new Set([first.json().version, second.json().version])).toEqual(new Set([3]))
    expect(first.json().topicId).toBeNull()
    expect(second.json().topicId).toBeNull()
  })

  it('整理后再移回待整理可以重新归入', async () => {
    const first = (await createTopic()).json()
    const second = (await createTopic(userA, { name: '前端架构', color: '#0F766E' })).json()
    const paper = (await create()).json()
    await organize(paper.id, { topicId: first.id, version: 1 })
    const inbox = (await moveToInbox(paper.id, { version: 2 })).json()
    const reorganized = await organize(paper.id, { topicId: second.id, version: inbox.version })
    expect(reorganized.statusCode).toBe(200)
    expect(reorganized.json()).toMatchObject({
      topicId: second.id,
      status: 'organized',
      version: 4,
    })
  })

  it('软删除后返回新版本和删除时间', async () => {
    const paper = (await create()).json()
    const deleted = await remove(paper.id, { version: 1 })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json()).toMatchObject({
      id: paper.id,
      version: 2,
    })
    expect(deleted.json().deletedAt).toEqual(expect.any(String))

    const missing = await app.inject({
      method: 'GET',
      url: `/api/papers/${paper.id}`,
      headers: { 'x-user-id': userA },
    })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('重复删除已删除记录直接返回', async () => {
    const paper = (await create()).json()
    const first = await remove(paper.id, { version: 1 })
    const replay = await remove(paper.id, { version: 1 })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toEqual(first.json())
  })

  it('删除时版本不一致返回记录版本冲突', async () => {
    const paper = (await create()).json()
    await update(paper.id, { content: '先改一版', version: 1 })
    const conflict = await remove(paper.id, { version: 1 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({
      content: '先改一版',
      version: 2,
    })
  })

  it('其他用户无法删除不属于自己的记录', async () => {
    const paper = (await create()).json()
    const foreign = await remove(paper.id, { version: 1 }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('记录不存在时删除返回不存在', async () => {
    const missing = await remove(crypto.randomUUID(), { version: 1 })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('已删除记录不能再编辑、归类或移回待整理', async () => {
    const topic = (await createTopic()).json()
    const paper = (await create()).json()
    await remove(paper.id, { version: 1 })
    expect((await update(paper.id, { content: '删了还改', version: 2 })).json().code).toBe(
      'PAPER_NOT_FOUND',
    )
    expect((await organize(paper.id, { topicId: topic.id, version: 2 })).json().code).toBe(
      'PAPER_NOT_FOUND',
    )
    expect((await moveToInbox(paper.id, { version: 2 })).json().code).toBe('PAPER_NOT_FOUND')
  })

  it('并发删除只升一次版本', async () => {
    const paper = (await create()).json()
    const [first, second] = await Promise.all([
      remove(paper.id, { version: 1 }),
      remove(paper.id, { version: 1 }),
    ])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(new Set([first.json().version, second.json().version])).toEqual(new Set([2]))
    expect(first.json().id).toBe(paper.id)
    expect(second.json().id).toBe(paper.id)
    expect(first.json().deletedAt).toEqual(expect.any(String))
    expect(second.json().deletedAt).toEqual(expect.any(String))
  })

  it('时间线按创建时间从新到旧返回', async () => {
    await create(userA, crypto.randomUUID(), { content: '较早的记录' })
    await create(userA, crypto.randomUUID(), { content: '较新的记录' })
    const listed = await list()
    expect(listed.statusCode).toBe(200)
    const items = listed.json().items as { createdAt: string; id: string }[]
    expect(items).toHaveLength(2)
    expect(
      items[0].createdAt > items[1].createdAt ||
        (items[0].createdAt === items[1].createdAt && items[0].id > items[1].id),
    ).toBe(true)
  })

  it('分页游标按从新到旧继续且不重复', async () => {
    await create(userA, crypto.randomUUID(), { content: '最旧' })
    await create(userA, crypto.randomUUID(), { content: '中间' })
    await create(userA, crypto.randomUUID(), { content: '最新' })
    const all = ((await list()).json().items as { id: string }[]).map((item) => item.id)
    expect(all).toHaveLength(3)
    const page1 = (await list('?limit=2')).json()
    expect(page1.items.map((item: { id: string }) => item.id)).toEqual(all.slice(0, 2))
    expect(page1.pageInfo.hasNextPage).toBe(true)
    const page2 = (
      await list(`?limit=2&cursor=${encodeURIComponent(page1.pageInfo.nextCursor)}`)
    ).json()
    expect(page2.items.map((item: { id: string }) => item.id)).toEqual(all.slice(2))
    expect(page2.pageInfo.hasNextPage).toBe(false)
  })

  const updateQuestion = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'PATCH',
      url: `/api/papers/${paperId}/question`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  const restore = (paperId: string, body: object, user = userA) =>
    app.inject({
      method: 'POST',
      url: `/api/papers/${paperId}/restore`,
      headers: { 'x-user-id': user },
      payload: body,
    })

  it('创建时携带问题文本记为还在思考', async () => {
    const created = await create(userA, crypto.randomUUID(), {
      content: '读了事件循环这一节',
      questionText: '  宏任务和微任务的执行顺序  ',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      questionStatus: 'thinking',
      questionText: '宏任务和微任务的执行顺序',
      hasQuestion: true,
      isQuestionResolved: false,
      questionResolvedAt: null,
    })
  })

  it('标记疑问但未写问题文本时以正文充当问题文本', async () => {
    const created = await create(userA, crypto.randomUUID(), {
      content: '为什么索引会让写入变慢',
      hasQuestion: true,
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      questionStatus: 'thinking',
      questionText: '为什么索引会让写入变慢',
      hasQuestion: true,
    })
  })

  it('解决问题后记录解决时间并双写布尔字段', async () => {
    const paper = (
      await create(userA, crypto.randomUUID(), {
        content: '  记下一段内容  ',
        hasQuestion: true,
      })
    ).json()
    const resolved = await updateQuestion(paper.id, { version: 1, status: 'resolved' })
    expect(resolved.statusCode).toBe(200)
    expect(resolved.json()).toMatchObject({
      id: paper.id,
      questionStatus: 'resolved',
      hasQuestion: true,
      isQuestionResolved: true,
      version: 2,
    })
    expect(resolved.json().questionResolvedAt).toEqual(expect.any(String))

    const replay = await updateQuestion(paper.id, { version: 2, status: 'resolved' })
    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({
      questionStatus: 'resolved',
      questionResolvedAt: resolved.json().questionResolvedAt,
      version: 2,
    })
  })

  it('重新打开问题后清空解决时间', async () => {
    const paper = (
      await create(userA, crypto.randomUUID(), {
        content: '  记下一段内容  ',
        hasQuestion: true,
      })
    ).json()
    await updateQuestion(paper.id, { version: 1, status: 'resolved' })
    const reopened = await updateQuestion(paper.id, { version: 2, status: 'thinking' })
    expect(reopened.statusCode).toBe(200)
    expect(reopened.json()).toMatchObject({
      questionStatus: 'thinking',
      isQuestionResolved: false,
      questionResolvedAt: null,
      version: 3,
    })
    expect(reopened.json().questionText).toBe(paper.content)
  })

  it('移除问题后清空问题文本和解决时间', async () => {
    const paper = (
      await create(userA, crypto.randomUUID(), {
        content: '  记下一段内容  ',
        hasQuestion: true,
      })
    ).json()
    await updateQuestion(paper.id, { version: 1, status: 'resolved' })
    const removed = await updateQuestion(paper.id, { version: 2, status: 'none' })
    expect(removed.statusCode).toBe(200)
    expect(removed.json()).toMatchObject({
      questionStatus: 'none',
      questionText: null,
      questionResolvedAt: null,
      hasQuestion: false,
      isQuestionResolved: false,
      version: 3,
    })
  })

  it('从无问题直接标记解决或缺少文本时拒绝', async () => {
    const paper = (await create()).json()
    const invalid = await updateQuestion(paper.id, { version: 1, status: 'resolved' })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().code).toBe('PAPER_QUESTION_TRANSITION_INVALID')

    const noText = await updateQuestion(paper.id, { version: 1, status: 'thinking' })
    expect(noText.statusCode).toBe(400)
    expect(noText.json().code).toBe('PAPER_QUESTION_TEXT_REQUIRED')
  })

  it('问题状态版本冲突时带服务端最新实体', async () => {
    const paper = (
      await create(userA, crypto.randomUUID(), {
        content: '  记下一段内容  ',
        hasQuestion: true,
      })
    ).json()
    await updateQuestion(paper.id, { version: 1, status: 'resolved' })
    const conflict = await updateQuestion(paper.id, { version: 1, status: 'none' })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({
      questionStatus: 'resolved',
      version: 2,
    })
  })

  it('已删除记录不能修改问题状态', async () => {
    const paper = (await create()).json()
    await remove(paper.id, { version: 1 })
    const deleted = await updateQuestion(paper.id, { version: 2, status: 'resolved' })
    expect(deleted.statusCode).toBe(404)
    expect(deleted.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('其他用户不能修改不属于自己的问题状态', async () => {
    const paper = (await create()).json()
    const foreign = await updateQuestion(paper.id, { version: 1, status: 'resolved' }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')
  })

  it('并发解决问题只升一次版本', async () => {
    const paper = (
      await create(userA, crypto.randomUUID(), {
        content: '  记下一段内容  ',
        hasQuestion: true,
      })
    ).json()
    const [first, second] = await Promise.all([
      updateQuestion(paper.id, { version: 1, status: 'resolved' }),
      updateQuestion(paper.id, { version: 1, status: 'resolved' }),
    ])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(new Set([first.json().version, second.json().version])).toEqual(new Set([2]))
  })

  it('按问题状态筛选列表并在翻页时不重不漏', async () => {
    const thinking = (
      await create(userA, crypto.randomUUID(), { content: '还在思考的记录', hasQuestion: true })
    ).json()
    await create(userA, crypto.randomUUID(), { content: '没有问题的记录' })
    const resolvedSource = (
      await create(userA, crypto.randomUUID(), { content: '已解决的记录', hasQuestion: true })
    ).json()
    await updateQuestion(resolvedSource.id, { version: 1, status: 'resolved' })

    const thinkingList = await list('?questionStatus=thinking')
    expect(thinkingList.statusCode).toBe(200)
    expect((thinkingList.json().items as { id: string }[]).map((item) => item.id)).toEqual([
      thinking.id,
    ])

    const page1 = (await list('?questionStatus=all&limit=1')).json()
    expect(page1.items).toHaveLength(1)
    expect(page1.pageInfo.hasNextPage).toBe(true)
    const page2 = (
      await list(
        `?questionStatus=all&limit=1&cursor=${encodeURIComponent(page1.pageInfo.nextCursor)}`,
      )
    ).json()
    expect(page2.items).toHaveLength(1)
    expect(page2.pageInfo.hasNextPage).toBe(false)
    const combined = [...page1.items, ...page2.items].map((item: { id: string }) => item.id)
    expect(new Set(combined)).toEqual(new Set([thinking.id, resolvedSource.id]))
  })

  it('恢复已删除记录后重新可见并增加版本', async () => {
    const paper = (await create()).json()
    await remove(paper.id, { version: 1 })
    const restored = await restore(paper.id, { version: 2 })
    expect(restored.statusCode).toBe(200)
    expect(restored.json()).toMatchObject({
      id: paper.id,
      deletedAt: null,
      version: 3,
    })
    const fetched = await app.inject({
      method: 'GET',
      url: `/api/papers/${paper.id}`,
      headers: { 'x-user-id': userA },
    })
    expect(fetched.statusCode).toBe(200)
    expect(fetched.json().deletedAt).toBeNull()
  })

  it('未删除记录恢复时幂等且不增加版本', async () => {
    const paper = (await create()).json()
    const restored = await restore(paper.id, { version: 1 })
    expect(restored.statusCode).toBe(200)
    expect(restored.json()).toMatchObject({ id: paper.id, version: 1, deletedAt: null })
  })

  it('恢复时版本不一致返回记录版本冲突', async () => {
    const paper = (await create()).json()
    await update(paper.id, { content: '先改一版', version: 1 })
    await remove(paper.id, { version: 2 })
    const conflict = await restore(paper.id, { version: 1 })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('PAPER_VERSION_CONFLICT')
    expect(conflict.json().data.paper).toMatchObject({ version: 3 })
    expect(conflict.json().data.paper.deletedAt).toEqual(expect.any(String))
  })

  it('其他用户无法恢复不属于自己的记录', async () => {
    const paper = (await create()).json()
    const foreign = await restore(paper.id, { version: 1 }, userB)
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().code).toBe('PAPER_NOT_FOUND')
  })
})
