import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createPapersService, TOPIC_NAME_LIMIT, type PapersService } from './papers-service'
import type { MiniprogramTransport, TransportCallOptions } from '../transport/transport.types'

const storage = new Map<string, string>()

beforeAll(() => {
  vi.stubGlobal('wx', {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
  })
})

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

type RecordedCall = {
  operation: string
  input: unknown
  options?: TransportCallOptions
}

function createFakeTransport(responses: Record<string, unknown> = {}) {
  const calls: RecordedCall[] = []
  const transport: MiniprogramTransport = {
    call: vi.fn(async (operation: string, input: never, options: never) => {
      calls.push({ operation, input, options })
      if (!(operation in responses)) {
        throw new Error(`未配置操作 ${operation}`)
      }
      return responses[operation]
    }),
  }
  return { calls, transport }
}

function createService(
  transport: MiniprogramTransport,
  options: { hasCredentials?: () => boolean } = {},
): PapersService {
  return createPapersService({
    transport,
    hasCredentials: options.hasCredentials ?? (() => true),
  })
}

describe('papers-service 统一业务服务', () => {
  it('记录列表与详情走统一 operation 并完成契约校验', async () => {
    const page = { items: [paper], pageInfo: { hasNextPage: false, nextCursor: null } }
    const { transport, calls } = createFakeTransport({
      'papers.list': page,
      'papers.get': paper,
    })
    const service = createService(transport)
    const listed = await service.list({ status: 'inbox', limit: 20 })
    expect(listed.items).toHaveLength(1)
    const detail = await service.get(paper.id)
    expect(detail.content).toContain('数据库索引')
    expect(calls.map((call) => call.operation)).toEqual(['papers.list', 'papers.get'])
    expect(calls[0].input).toEqual({ status: 'inbox', limit: 20 })
    expect(calls[1].input).toEqual({ id: paper.id })
  })

  it('纯文字创建只发送契约字段并自动生成幂等键', async () => {
    const { transport, calls } = createFakeTransport({ 'papers.create': paper })
    const service = createService(transport)
    await service.create({ content: '今日所学', hasQuestion: true })
    expect(calls[0].operation).toBe('papers.create')
    expect(calls[0].input).toEqual({ content: '今日所学', hasQuestion: true })
    expect(calls[0].options?.idempotencyKey).toEqual(expect.any(String))
  })

  it('多图片顺序通过 assetUploadIds 原样透传', async () => {
    const { transport, calls } = createFakeTransport({ 'papers.create': paper })
    const service = createService(transport)
    const uploadIds = ['u-3', 'u-1', 'u-2']
    await service.create({ content: '多图', assetUploadIds: uploadIds })
    expect(calls[0].input).toMatchObject({ assetUploadIds: ['u-3', 'u-1', 'u-2'] })
  })

  it('空图片列表不携带 assetUploadIds 字段', async () => {
    const { transport, calls } = createFakeTransport({ 'papers.create': paper })
    const service = createService(transport)
    await service.create({ content: '纯文字', assetUploadIds: [] })
    expect(calls[0].input).not.toHaveProperty('assetUploadIds')
  })

  it('创建响应丢失后重试复用相同幂等键', async () => {
    const { transport, calls } = createFakeTransport({ 'papers.create': paper })
    const service = createService(transport)
    const options = { idempotencyKey: 'save-key-1' }
    await service.create({ content: '第一次' }, options)
    await service.create({ content: '第一次' }, options)
    expect(calls).toHaveLength(2)
    expect(calls[0].options?.idempotencyKey).toBe('save-key-1')
    expect(calls[1].options?.idempotencyKey).toBe('save-key-1')
  })

  it('标记问题解决提交 resolved 状态', async () => {
    const { transport, calls } = createFakeTransport({ 'papers.resolveQuestion': paper })
    const service = createService(transport)
    await service.resolveQuestion({ id: paper.id, version: 2 })
    expect(calls[0]).toMatchObject({
      operation: 'papers.resolveQuestion',
      input: { id: paper.id, version: 2, status: 'resolved' },
    })
  })

  it('箱子名称超过上限时本地拒绝且不发起请求', async () => {
    const { transport, calls } = createFakeTransport()
    const service = createService(transport)
    await expect(service.createTopic({ name: '超'.repeat(TOPIC_NAME_LIMIT + 1) })).rejects.toThrow()
    await expect(service.createTopic({ name: '   ' })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('箱子列表折叠为概要字段', async () => {
    const { transport } = createFakeTransport({
      'topics.list': { items: [topic], pageInfo: { hasNextPage: false, nextCursor: null } },
    })
    const service = createService(transport)
    const topics = await service.listTopics()
    expect(topics).toEqual([{ id: topic.id, name: '系统设计', color: '#DCE9D8' }])
  })

  it('未登录时回退演示数据', async () => {
    const { transport } = createFakeTransport()
    const service = createService(transport, { hasCredentials: () => false })
    const topics = await service.listTopics()
    expect(topics.length).toBeGreaterThan(0)
    expect(transport.call).not.toHaveBeenCalled()
  })
})
