import { describe, expect, it, vi } from 'vitest'
import type { ApiOrpcClient } from './client'
import { createOrpcServices, type CreateOrpcServicesOptions } from './index'

function createClient(): ApiOrpcClient {
  return {
    studySessions: {
      start: vi.fn(),
      active: vi.fn(),
      byId: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      complete: vi.fn(),
    },
    topics: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    learningLogs: { list: vi.fn(), bySession: vi.fn(), update: vi.fn() },
    papers: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      organize: vi.fn(),
      moveToInbox: vi.fn(),
      remove: vi.fn(),
    },
    ai: { explainPaper: vi.fn(), confirmPaperExplain: vi.fn() },
    auth: {},
    templates: {},
    health: {},
  } as unknown as ApiOrpcClient
}

const options: CreateOrpcServicesOptions = { createIdempotencyKey: () => 'generated-key' }

describe('createOrpcServices', () => {
  it('把输入中的幂等键抽取到调用上下文并映射学习会话操作', async () => {
    const client = createClient()
    const services = createOrpcServices(client, options)
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

    const sessions = client.studySessions as unknown as Record<string, ReturnType<typeof vi.fn>>
    expect(sessions.start).toHaveBeenCalledExactlyOnceWith(
      { topicId: 'topic', goal: null },
      { context: { idempotencyKey: 'create-key' } },
    )
    expect(sessions.active).toHaveBeenCalledExactlyOnceWith(undefined, { context: {} })
    expect(sessions.byId).toHaveBeenCalledExactlyOnceWith({ id: 'session' }, { context: {} })
    expect(sessions.pause).toHaveBeenCalledExactlyOnceWith(
      { id: 'session', version: 2 },
      { context: { idempotencyKey: 'command-key' } },
    )
    expect(sessions.resume).toHaveBeenCalledExactlyOnceWith(
      { id: 'session', version: 2 },
      { context: { idempotencyKey: 'command-key' } },
    )
    expect(sessions.complete).toHaveBeenCalledExactlyOnceWith(
      {
        id: 'session',
        version: 2,
        gains: '理解了批处理',
        problems: null,
        nextStep: '继续学习调度',
      },
      { context: { idempotencyKey: 'command-key' } },
    )
  })

  it('学习记录与纸页操作映射到对应的 oRPC procedure', async () => {
    const client = createClient()
    const services = createOrpcServices(client, options)
    const listInput = { page: 2, pageSize: 10, topicId: 'topic' }
    const updateInput = { id: 'log', version: 3, gains: '新的理解' }
    const paperInput = { id: 'paper', version: 1 }

    await services.learningLogs.list(listInput)
    await services.learningLogs.getBySession('session')
    await services.learningLogs.update(updateInput)
    await services.papers.list(listInput as never)
    await services.papers.create({ content: '一段记录', hasQuestion: false })
    await services.papers.moveToInbox(paperInput)

    const raw = client as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
    expect(raw.learningLogs.list).toHaveBeenCalledExactlyOnceWith(listInput, { context: {} })
    expect(raw.learningLogs.bySession).toHaveBeenCalledExactlyOnceWith(
      { sessionId: 'session' },
      { context: {} },
    )
    expect(raw.learningLogs.update).toHaveBeenCalledExactlyOnceWith(updateInput, { context: {} })
    expect(raw.papers.list).toHaveBeenCalledExactlyOnceWith(listInput, { context: {} })
    expect(raw.papers.create).toHaveBeenCalledExactlyOnceWith(
      { content: '一段记录', hasQuestion: false },
      { context: { idempotencyKey: 'generated-key' } },
    )
    expect(raw.papers.moveToInbox).toHaveBeenCalledExactlyOnceWith(paperInput, { context: {} })
  })

  it('AI 解释卡操作映射到对应的 oRPC procedure', async () => {
    const client = createClient()
    const services = createOrpcServices(client, options)
    const explainInput = { content: '一段记录', directive: 'initial' as const, round: 1 }

    await services.ai.explainPaper(explainInput)
    await services.ai.confirmPaperExplain({ runId: 'run-1' })

    const raw = client as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>
    expect(raw.ai.explainPaper).toHaveBeenCalledExactlyOnceWith(explainInput, { context: {} })
    expect(raw.ai.confirmPaperExplain).toHaveBeenCalledExactlyOnceWith(
      { runId: 'run-1' },
      { context: {} },
    )
  })

  it.each([
    [
      '学习会话',
      (client: ApiOrpcClient, error: Error) =>
        vi
          .mocked(
            (client.studySessions as unknown as Record<string, ReturnType<typeof vi.fn>>).active,
          )
          .mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) => services.studySessions.getActive(),
    ],
    [
      '主题',
      (client: ApiOrpcClient, error: Error) =>
        vi
          .mocked((client.topics as unknown as Record<string, ReturnType<typeof vi.fn>>).list)
          .mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) => services.topics.listActive(),
    ],
    [
      '学习记录',
      (client: ApiOrpcClient, error: Error) =>
        vi
          .mocked(
            (client.learningLogs as unknown as Record<string, ReturnType<typeof vi.fn>>).bySession,
          )
          .mockRejectedValueOnce(error),
      (services: ReturnType<typeof createOrpcServices>) =>
        services.learningLogs.getBySession('session'),
    ],
  ] as const)('%s procedure 失败时原样向上传递异常', async (_name, reject, invoke) => {
    const client = createClient()
    const error = Object.assign(new Error('network unavailable'), {
      code: 'DEPENDENCY_UNAVAILABLE',
    })
    reject(client, error)

    await expect(invoke(createOrpcServices(client, options))).rejects.toBe(error)
  })
})
