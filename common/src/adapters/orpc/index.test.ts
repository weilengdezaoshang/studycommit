import { describe, expect, it, vi } from 'vitest'
import { createOrpcServices, type OrpcRawClient } from './index'

function createClient(): OrpcRawClient {
  return {
    studySessions: {
      start: vi.fn(),
      active: vi.fn(),
      byId: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      complete: vi.fn(),
    },
    topics: { list: vi.fn(), create: vi.fn() },
    learningLogs: { list: vi.fn(), bySession: vi.fn(), update: vi.fn() },
    papers: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      organize: vi.fn(),
      moveToInbox: vi.fn(),
      remove: vi.fn(),
    },
  }
}

describe('createOrpcServices', () => {
  it('将全部学习会话操作映射到对应的 oRPC procedure', async () => {
    const client = createClient()
    const services = createOrpcServices(client)
    const createInput = { topicId: 'topic', goal: null, idempotencyKey: 'create-key' }
    const commandInput = { sessionId: 'session', version: 2, idempotencyKey: 'command-key' }
    const completeInput = {
      ...commandInput,
      gains: '理解了批处理',
      problems: null,
      nextStep: '继续学习调度',
    }

    await services.studySessions.create(createInput)
    await services.studySessions.getActive()
    await services.studySessions.getById('session')
    await services.studySessions.pause(commandInput)
    await services.studySessions.resume(commandInput)
    await services.studySessions.complete(completeInput)

    expect(client.studySessions.start).toHaveBeenCalledExactlyOnceWith(createInput)
    expect(client.studySessions.active).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(client.studySessions.byId).toHaveBeenCalledExactlyOnceWith('session')
    expect(client.studySessions.pause).toHaveBeenCalledExactlyOnceWith(commandInput)
    expect(client.studySessions.resume).toHaveBeenCalledExactlyOnceWith(commandInput)
    expect(client.studySessions.complete).toHaveBeenCalledExactlyOnceWith(completeInput)
  })

  it('将全部主题和学习记录操作映射到对应的 oRPC procedure', async () => {
    const client = createClient()
    const services = createOrpcServices(client)
    const topicInput = { limit: 20, cursor: 'cursor' }
    const listInput = { page: 2, pageSize: 10, topicId: 'topic' }
    const updateInput = { id: 'log', version: 3, gains: '新的理解' }

    await services.topics.listActive(topicInput)
    await services.learningLogs.list(listInput)
    await services.learningLogs.getBySession('session')
    await services.learningLogs.update(updateInput)

    expect(client.topics.list).toHaveBeenCalledExactlyOnceWith(topicInput)
    expect(client.learningLogs.list).toHaveBeenCalledExactlyOnceWith(listInput)
    expect(client.learningLogs.bySession).toHaveBeenCalledExactlyOnceWith('session')
    expect(client.learningLogs.update).toHaveBeenCalledExactlyOnceWith(updateInput)
  })

  it('保留可选查询参数的 undefined 语义', async () => {
    const client = createClient()
    const services = createOrpcServices(client)

    await services.topics.listActive()
    await services.learningLogs.list()

    expect(client.topics.list).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(client.learningLogs.list).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it.each([
    [
      '学习会话',
      (client: OrpcRawClient, error: Error) =>
        vi.mocked(client.studySessions.active).mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) => services.studySessions.getActive(),
    ],
    [
      '主题',
      (client: OrpcRawClient, error: Error) =>
        vi.mocked(client.topics.list).mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) => services.topics.listActive(),
    ],
    [
      '学习记录',
      (client: OrpcRawClient, error: Error) =>
        vi.mocked(client.learningLogs.bySession).mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) =>
        services.learningLogs.getBySession('session'),
    ],
  ] as const)('%s procedure 失败时原样向上传递异常', async (_name, reject, invoke) => {
    const client = createClient()
    const error = Object.assign(new Error('network unavailable'), {
      code: 'DEPENDENCY_UNAVAILABLE',
    })
    reject(client, error)

    await expect(invoke(createOrpcServices(client))).rejects.toBe(error)
  })
})
