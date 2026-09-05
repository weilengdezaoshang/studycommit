import { describe, expect, it, vi } from 'vitest'
import { ORPCError } from '@orpc/client'
import type { Topic as RpcTopic } from '@studycommit/rpc-contracts/topics'
import type { ApiOrpcClient } from './client'
import { createOrpcTopicService } from './topic-service'

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
    topics: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as ApiOrpcClient
}

function topicRouter(client: ReturnType<typeof createClient>) {
  return client.topics as unknown as {
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
}

describe('createOrpcTopicService', () => {
  it('查询箱子时固定只读取 active 状态并转换为公共模型', async () => {
    const client = createClient()
    const remoteTopic = topic()
    vi.mocked(topicRouter(client).list).mockResolvedValue({
      items: [remoteTopic],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    const service = createOrpcTopicService(client, () => 'create-key')

    const page = await service.listActive({ limit: 100, cursor: 'next' })

    expect(topicRouter(client).list).toHaveBeenCalledExactlyOnceWith(
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
    vi.mocked(topicRouter(client).create).mockResolvedValue(remoteTopic)
    const service = createOrpcTopicService(client, () => 'create-key')

    await service.create({ name: '系统设计' })

    expect(topicRouter(client).create).toHaveBeenCalledExactlyOnceWith(
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
    vi.mocked(topicRouter(client).update).mockResolvedValue(remoteTopic)
    vi.mocked(topicRouter(client).remove).mockResolvedValue(removed)
    const service = createOrpcTopicService(client, () => 'create-key')
    const update = { id: remoteTopic.id, name: '新名称', version: 1 }

    await service.update(update)
    await expect(service.remove({ id: remoteTopic.id, version: 1 })).resolves.toEqual(removed)

    expect(topicRouter(client).update).toHaveBeenCalledExactlyOnceWith(update, { context: {} })
    expect(topicRouter(client).remove).toHaveBeenCalledExactlyOnceWith(
      { id: remoteTopic.id, version: 1 },
      { context: {} },
    )
  })

  it('把 oRPC 业务错误转换为公共 HttpError', async () => {
    const client = createClient()
    vi.mocked(topicRouter(client).create).mockRejectedValue(
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
