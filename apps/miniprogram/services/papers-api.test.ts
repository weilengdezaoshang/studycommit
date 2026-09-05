import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdempotencyKey } from '../utils/uuid'
import {
  createDemoPapersApi,
  createRealPapersApi,
  getPapersApi,
  type PapersApiRequest,
} from './papers-api'

const paper = {
  id: '11111111-1111-4111-8111-111111111111',
  content: '数据库索引不是越多越好。',
  status: 'inbox',
  topicId: null,
  version: 1,
  createdAt: '2026-08-24T14:10:00.000Z',
  updatedAt: '2026-08-24T14:10:00.000Z',
  deletedAt: null,
  hasQuestion: false,
  isQuestionResolved: false,
  questionStatus: 'none',
  questionText: null,
  understandingText: null,
  questionResolvedAt: null,
}

const topic = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: '44444444-4444-4444-8444-444444444444',
  name: '系统设计',
  description: null,
  color: '#DCE9D8',
  templateId: '55555555-5555-4555-8555-555555555555',
  template: {
    id: '55555555-5555-4555-8555-555555555555',
    name: '点阵纸',
    icon: 'dot',
    paperBackground: 'dot',
  },
  status: 'active',
  totalDurationSeconds: 0,
  paperCount: 2,
  lastPaperAt: null,
  version: 1,
  createdAt: '2026-08-24T14:10:00.000Z',
  updatedAt: '2026-08-24T14:10:00.000Z',
  deletedAt: null,
}

function createStubRequest(response: unknown) {
  const requests: Array<RecordedRequest> = []
  const request = async <TResponse>(req: {
    method: PapersApiRequest['method']
    path: string
    data?: unknown
    headers?: Record<string, string>
    parse?: (data: unknown) => TResponse
  }): Promise<TResponse> => {
    requests.push({
      method: req.method,
      path: req.path,
      data: req.data,
      headers: req.headers,
    })
    const parsed = req.parse ? req.parse(response) : (response as TResponse)
    return parsed
  }
  return { requests, request }
}

type RecordedRequest = {
  method: PapersApiRequest['method']
  path: string
  data?: unknown
  headers?: Record<string, string>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('papers-api 真实后端实现', () => {
  it('列表请求把筛选参数展开为查询字符串', async () => {
    const { requests, request } = createStubRequest({
      items: [paper],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    const api = createRealPapersApi({ request })

    const filtered = await api.list({ status: 'inbox', limit: 50 })
    const unfiltered = await api.list()

    expect(filtered.items).toHaveLength(1)
    expect(unfiltered.pageInfo).toEqual({ hasNextPage: false, nextCursor: null })
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/papers?status=inbox&limit=50' })
    expect(requests[1]).toMatchObject({ method: 'GET', path: '/papers' })
  })

  it('创建纸页携带幂等键并只发送契约字段', async () => {
    const { requests, request } = createStubRequest(paper)
    const api = createRealPapersApi({ request })

    await api.create({ content: '记一段内容', hasQuestion: true }, { idempotencyKey: 'key-1' })
    await api.create({ content: '记一段内容', photoPath: '/local/photo.jpg' })

    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/papers',
      data: { content: '记一段内容', hasQuestion: true },
      headers: { 'idempotency-key': 'key-1' },
    })
    expect(requests[1]?.data).toEqual({ content: '记一段内容', hasQuestion: false })
    expect(requests[1]?.headers?.['idempotency-key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('标记问题解决走问题状态接口并提交 resolved', async () => {
    const { requests, request } = createStubRequest(paper)
    const api = createRealPapersApi({ request })

    await api.resolveQuestion({ id: paper.id, version: 3 })

    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      path: `/papers/${paper.id}/question`,
      data: { id: paper.id, version: 3, status: 'resolved' },
    })
  })

  it('整理与移回待整理使用命令路径', async () => {
    const { requests, request } = createStubRequest(paper)
    const api = createRealPapersApi({ request })
    const topicId = '33333333-3333-4333-8333-333333333333'

    await api.organize({ id: paper.id, version: 2, topicId })
    await api.moveToInbox({ id: paper.id, version: 3 })

    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: `/papers/${paper.id}/organize`,
      data: { id: paper.id, version: 2, topicId },
    })
    expect(requests[1]).toMatchObject({
      method: 'POST',
      path: `/papers/${paper.id}/move-to-inbox`,
    })
  })

  it('箱子名称超过 18 字符时本地拒绝且不发起请求', async () => {
    const { requests, request } = createStubRequest(topic)
    const api = createRealPapersApi({ request })

    await expect(
      api.createTopic({ name: '这是一个超过十八个字符上限的箱子名称测试样例' }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    expect(requests).toHaveLength(0)

    await api.createTopic({ name: '  系统设计  ' })
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/topics',
      data: { name: '系统设计' },
    })
    expect(requests[0]?.headers?.['idempotency-key']).toEqual(expect.any(String))
  })

  it('箱子列表折叠为概要字段', async () => {
    const { request } = createStubRequest({
      items: [topic],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    const api = createRealPapersApi({ request })

    const topics = await api.listTopics()

    expect(topics).toEqual([{ id: topic.id, name: '系统设计', color: '#DCE9D8' }])
  })
})

describe('papers-api 登录态选择', () => {
  it('未登录时回退演示数据，已登录时走真实后端', async () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => '',
      setStorageSync: () => undefined,
      removeStorageSync: () => undefined,
    })

    const demo = getPapersApi({ hasCredentials: () => false })
    // 演示实现允许 80 字符名称,真实实现 18 字符即本地拒绝
    await expect(
      demo.createTopic({ name: '这是一个超过十八个字符上限的箱子名称测试样例' }),
    ).resolves.toMatchObject({
      name: expect.any(String),
    })

    const real = getPapersApi({ hasCredentials: () => true })
    await expect(
      real.createTopic({ name: '这是一个超过十八个字符上限的箱子名称测试样例' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('演示实现的标记解决返回更新后的纸页', async () => {
    vi.stubGlobal('wx', {
      getStorageSync: () => '',
      setStorageSync: () => undefined,
      removeStorageSync: () => undefined,
    })
    const demo = createDemoPapersApi()
    const created = await demo.create({ content: '为什么批处理不是立即生效？', hasQuestion: true })

    const resolved = await demo.resolveQuestion({ id: created.id, version: created.version })

    expect(resolved.isQuestionResolved).toBe(true)
  })
})

describe('幂等键生成', () => {
  it('生成合法的 v4 UUID', () => {
    const key = createIdempotencyKey()

    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(key).not.toBe(createIdempotencyKey())
  })
})
