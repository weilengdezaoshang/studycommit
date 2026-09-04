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
