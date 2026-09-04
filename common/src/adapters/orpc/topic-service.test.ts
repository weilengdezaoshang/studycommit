import { describe, expect, it, vi } from 'vitest'
import { ORPCError } from '@orpc/client'
import type { Topic as RpcTopic } from '@studycommit/rpc-contracts/topics'
import {
  createOrpcTopicService,
  createTopicOrpcClient,
  type TopicOrpcClient,
} from './topic-service'

function topic(): RpcTopic {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    name: '系统设计',
    description: null,
    color: '#DCE9D8',
    templateId: crypto.randomUUID(),
    template: { id: crypto.randomUUID(), name: '空白', icon: 'box', paperBackground: 'plain' },
    status: 'active' as const,
    totalDurationSeconds: 0,
    paperCount: 0,
    lastPaperAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

function createClient() {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as TopicOrpcClient
}

describe('createOrpcTopicService', () => {
  it('通过 OpenAPI Link 发送箱子请求并合并鉴权头', async () => {
    const remoteTopic = topic()
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            items: [remoteTopic],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
    const client = createTopicOrpcClient({
      origin: 'https://api.example.com',
      apiPrefix: '/api',
      fetchImpl: fetchImpl as typeof fetch,
      getHeaders: async () => ({ authorization: 'Bearer access-token' }),
    })

    await client.list({ status: 'active', limit: 20 }, { context: {} })

    const request = fetchImpl.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).url).toBe(
      'https://api.example.com/api/topics?status=active&limit=20',
    )
    expect((request as Request).headers.get('authorization')).toBe('Bearer access-token')
  })

  it('查询箱子时固定只读取 active 状态并转换为公共模型', async () => {
    const client = createClient()
    const remoteTopic = topic()
    vi.mocked(client.list).mockResolvedValue({
      items: [remoteTopic],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    const service = createOrpcTopicService(client, () => 'create-key')

    const page = await service.listActive({ limit: 100, cursor: 'next' })

    expect(client.list).toHaveBeenCalledExactlyOnceWith(
      { limit: 100, cursor: 'next', status: 'active' },
      { context: {} },
    )
    expect(page.items[0]).toEqual({
      id: remoteTopic.id,
      userId: remoteTopic.userId,
      name: remoteTopic.name,
      description: remoteTopic.description,
      color: remoteTopic.color,
      status: remoteTopic.status,
      totalDurationSeconds: remoteTopic.totalDurationSeconds,
      version: remoteTopic.version,
      createdAt: remoteTopic.createdAt,
      updatedAt: remoteTopic.updatedAt,
      deletedAt: remoteTopic.deletedAt,
    })
  })

  it('创建箱子时生成并传递幂等键', async () => {
    const client = createClient()
    const remoteTopic = topic()
    vi.mocked(client.create).mockResolvedValue(remoteTopic)
    const service = createOrpcTopicService(client, () => 'create-key')

    await service.create({ name: '系统设计' })

    expect(client.create).toHaveBeenCalledExactlyOnceWith(
      { name: '系统设计' },
      { context: { idempotencyKey: 'create-key' } },
    )
  })

  it('更新和删除箱子时透传版本并返回服务端结果', async () => {
    const client = createClient()
    const remoteTopic = topic()
    const removed = {
      id: remoteTopic.id,
      version: 2,
      deletedAt: new Date().toISOString(),
    }
    vi.mocked(client.update).mockResolvedValue(remoteTopic)
    vi.mocked(client.remove).mockResolvedValue(removed)
    const service = createOrpcTopicService(client, () => 'create-key')
    const update = { id: remoteTopic.id, name: '新名称', version: 1 }

    await service.update(update)
    await expect(service.remove({ id: remoteTopic.id, version: 1 })).resolves.toEqual(removed)

    expect(client.update).toHaveBeenCalledExactlyOnceWith(update, { context: {} })
    expect(client.remove).toHaveBeenCalledExactlyOnceWith(
      { id: remoteTopic.id, version: 1 },
      { context: {} },
    )
  })

  it('把 oRPC 业务错误转换为公共 HttpError', async () => {
    const client = createClient()
    vi.mocked(client.create).mockRejectedValue(
      new ORPCError('TOPIC_NAME_CONFLICT', {
        status: 409,
        message: '已有同名箱子',
        data: { topicId: 'existing-topic' },
      }),
    )
    const service = createOrpcTopicService(client, () => 'create-key')

    await expect(service.create({ name: '系统设计' })).rejects.toMatchObject({
      serialized: {
        code: 'CONFLICT',
        backendCode: 'TOPIC_NAME_CONFLICT',
        details: { topicId: 'existing-topic' },
      },
    })
  })
})
