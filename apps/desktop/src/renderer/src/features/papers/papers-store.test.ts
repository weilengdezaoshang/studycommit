import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPapersState, papersActions } from './papers-store'
import type { StudyCommitApi } from '../../types/study-commit-api'

function stubStudyCommit(partial: Partial<StudyCommitApi>) {
  window.studyCommit = { ...window.studyCommit, ...partial }
}

const serverPaper = {
  id: '9a111111-1111-4111-8111-111111111111',
  content: '云端纸页内容',
  status: 'inbox' as const,
  topicId: null,
  version: 1,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  deletedAt: null,
}

const serverTopic = {
  id: '9b222222-2222-4222-8222-222222222222',
  name: '云端箱子',
  color: '#53635A',
}

function serverTopicPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...serverTopic,
    userId: 'u',
    description: null,
    status: 'active' as const,
    version: 1,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function okEnvelope<T>(data: T) {
  return { ok: true as const, data }
}

function failEnvelope() {
  return { ok: false as const, error: { message: '服务不可用' } }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('桌面纸页数据通路', () => {
  it('loadRemote 成功后用服务端纸页和箱子替换演示数据', async () => {
    stubStudyCommit({
      papers: {
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [serverPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        organize: vi.fn(),
        moveToInbox: vi.fn(),
        question: vi.fn(),
        restore: vi.fn(),
      },
      topics: {
        listActive: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [
              {
                ...serverTopicPayload(),
              },
            ],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    })

    await papersActions.loadRemote()

    const state = getPapersState()
    expect(state.source).toBe('server')
    expect(state.papers).toEqual([serverPaper])
    expect(state.topics).toEqual([
      { id: serverTopic.id, name: serverTopic.name, color: serverTopic.color, version: 1 },
    ])
  })

  it('loadRemote 失败时保留当前数据', async () => {
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(failEnvelope()),
      },
    })

    await papersActions.loadRemote()

    const state = getPapersState()
    expect(state.source).toBe('server')
    expect(state.papers).toHaveLength(1)
  })

  it('归档纸页服务端失败时回滚本地状态', async () => {
    const organize = vi.fn().mockResolvedValue(failEnvelope())
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [serverPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        organize,
      },
      topics: {
        listActive: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [
              {
                ...serverTopicPayload(),
              },
            ],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
      },
    })
    await papersActions.loadRemote()

    papersActions.organizePaper(serverPaper.id, serverTopic.id)

    await vi.waitFor(() => {
      expect(organize).toHaveBeenCalled()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const state = getPapersState()
    const paper = state.papers.find((item) => item.id === serverPaper.id)
    expect(paper?.status).toBe('inbox')
    expect(paper?.topicId).toBeNull()
    expect(paper?.version).toBe(1)
  })

  it('新建箱子成功后用服务端箱子替换本地临时箱子', async () => {
    const create = vi.fn().mockResolvedValue(okEnvelope({ ...serverTopic, version: 1 }))
    stubStudyCommit({
      topics: {
        ...window.studyCommit.topics,
        create,
      },
    })

    const temp = papersActions.createTopic('云端箱子')
    expect(temp.id).not.toBe(serverTopic.id)

    await new Promise((resolve) => setTimeout(resolve, 0))

    const state = getPapersState()
    expect(state.topics.map((topic) => topic.id)).toContain(serverTopic.id)
    expect(state.topics.map((topic) => topic.id)).not.toContain(temp.id)
  })

  it('重命名服务端箱子时携带版本并写回新版本', async () => {
    const update = vi
      .fn()
      .mockResolvedValue(okEnvelope(serverTopicPayload({ name: '新名称', version: 2 })))
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi
          .fn()
          .mockResolvedValue(
            okEnvelope({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
          ),
      },
      topics: {
        ...window.studyCommit.topics,
        listActive: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [serverTopicPayload()],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        update,
      },
    })
    await papersActions.loadRemote()

    await papersActions.renameTopic(serverTopic.id, ' 新名称 ')

    expect(update).toHaveBeenCalledWith({ id: serverTopic.id, name: '新名称', version: 1 })
    expect(getPapersState().topics).toEqual([
      { id: serverTopic.id, name: '新名称', color: serverTopic.color, version: 2 },
    ])
  })

  it('重命名服务端箱子失败时回滚并触发重新同步', async () => {
    const update = vi.fn().mockResolvedValue(failEnvelope())
    const listActive = vi.fn().mockResolvedValue(
      okEnvelope({
        items: [serverTopicPayload()],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    )
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi
          .fn()
          .mockResolvedValue(
            okEnvelope({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }),
          ),
      },
      topics: { ...window.studyCommit.topics, listActive, update },
    })
    await papersActions.loadRemote()

    await expect(papersActions.renameTopic(serverTopic.id, '失败名称')).rejects.toThrow(
      '服务不可用',
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getPapersState().topics).toEqual([
      { id: serverTopic.id, name: serverTopic.name, color: serverTopic.color, version: 1 },
    ])
    expect(listActive).toHaveBeenCalledTimes(2)
  })

  it('删除服务端箱子成功后将箱内纸页放回待整理', async () => {
    const remove = vi.fn().mockResolvedValue(
      okEnvelope({
        id: serverTopic.id,
        version: 2,
        deletedAt: '2026-09-03T08:00:00.000Z',
      }),
    )
    const paper = { ...serverPaper, topicId: serverTopic.id, status: 'organized' as const }
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi
          .fn()
          .mockResolvedValue(
            okEnvelope({ items: [paper], pageInfo: { hasNextPage: false, nextCursor: null } }),
          ),
      },
      topics: {
        ...window.studyCommit.topics,
        listActive: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [serverTopicPayload()],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        remove,
      },
    })
    await papersActions.loadRemote()

    await papersActions.deleteTopic(serverTopic.id)

    expect(remove).toHaveBeenCalledWith({ id: serverTopic.id, version: 1 })
    expect(getPapersState().topics).toEqual([])
    expect(getPapersState().papers[0]).toMatchObject({
      id: serverPaper.id,
      topicId: null,
      status: 'inbox',
      version: 2,
    })
  })
})

describe('桌面问题状态切换', () => {
  const thinkingPaper = {
    ...serverPaper,
    hasQuestion: true,
    isQuestionResolved: false,
    questionStatus: 'thinking' as const,
    questionText: '为什么状态更新不是立即生效',
    understandingText: null,
    questionResolvedAt: null,
  }

  it('解决问题成功后同步侧车字段与服务端版本', async () => {
    const question = vi.fn().mockResolvedValue(
      okEnvelope({
        ...thinkingPaper,
        questionStatus: 'resolved',
        isQuestionResolved: true,
        questionResolvedAt: '2026-09-02T08:00:00.000Z',
        version: 2,
      }),
    )
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [thinkingPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        question,
      },
    })
    await papersActions.loadRemote()

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).resolves.toBe('resolved')

    expect(question).toHaveBeenCalledWith({
      id: thinkingPaper.id,
      version: 1,
      status: 'resolved',
      questionText: undefined,
    })
    const state = getPapersState()
    expect(state.papers[0]).toMatchObject({ questionStatus: 'resolved', version: 2 })
    expect(state.extras[thinkingPaper.id]).toMatchObject({
      questionStatus: 'resolved',
      isQuestionResolved: true,
    })
  })

  it('版本冲突时采纳服务端实体并报告服务端状态', async () => {
    const serverState = {
      ...thinkingPaper,
      questionStatus: 'resolved' as const,
      isQuestionResolved: true,
      version: 5,
    }
    const question = vi.fn().mockResolvedValue({
      ok: false as const,
      error: {
        code: 'CONFLICT',
        message: '记录版本冲突',
        status: 409,
        backendCode: 'PAPER_VERSION_CONFLICT',
        requestId: null,
        details: { paper: serverState },
      },
    })
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [thinkingPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        question,
      },
    })
    await papersActions.loadRemote()

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).resolves.toBe('resolved')

    expect(getPapersState().papers[0]).toMatchObject({ questionStatus: 'resolved', version: 5 })
  })

  it('非冲突失败时回滚到操作前状态并返回空', async () => {
    const question = vi.fn().mockResolvedValue(failEnvelope())
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [thinkingPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        question,
      },
    })
    await papersActions.loadRemote()

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).resolves.toBeNull()

    expect(getPapersState().papers[0]).toMatchObject({ questionStatus: 'thinking', version: 1 })
  })

  it('演示数据下解决问题只更新本地状态', async () => {
    // store 是模块级单例,前面的用例已把 source 切到 server;重置模块拿一份全新演示状态
    vi.resetModules()
    const fresh = await import('./papers-store')
    const seedPaper = fresh
      .getPapersState()
      .papers.find((item) => item.questionStatus === 'thinking')
    expect(seedPaper).toBeDefined()

    await expect(fresh.papersActions.resolveQuestion(seedPaper!.id)).resolves.toBe('resolved')
    expect(fresh.getPapersState().source).toBe('seed')
    expect(fresh.getPapersState().extras[seedPaper!.id]).toMatchObject({
      questionStatus: 'resolved',
    })
  })

  it('AI 解释卡确认后本地落定已解决且不再发起状态请求', async () => {
    const question = vi.fn()
    stubStudyCommit({
      papers: {
        ...window.studyCommit.papers,
        list: vi.fn().mockResolvedValue(
          okEnvelope({
            items: [thinkingPaper],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        ),
        question,
      },
    })
    await papersActions.loadRemote()

    papersActions.markQuestionConfirmed(thinkingPaper.id)

    expect(getPapersState().papers[0]).toMatchObject({
      questionStatus: 'resolved',
      isQuestionResolved: true,
      version: 2,
    })
    expect(question).not.toHaveBeenCalled()
  })
})
