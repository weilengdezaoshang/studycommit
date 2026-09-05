import type { PaperApi, TopicMutationApi } from '@studycommit/common/ports'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { Topic } from '@studycommit/rpc-contracts/topics'
import { configurePapersServices, getPapersState, loadRemote, papersActions } from './papers-store'

const topic: Topic = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: '22222222-2222-4222-8222-222222222222',
  name: '服务端箱子',
  description: null,
  color: '#53635A',
  templateId: 't1e60f00-0000-4000-8000-000000000001',
  template: {
    id: 't1e60f00-0000-4000-8000-000000000001',
    name: '素纸',
    icon: 'plain',
    paperBackground: 'plain',
  },
  status: 'active',
  totalDurationSeconds: 0,
  paperCount: 1,
  lastPaperAt: null,
  version: 4,
  createdAt: '2026-09-03T07:00:00.000Z',
  updatedAt: '2026-09-03T07:00:00.000Z',
  deletedAt: null,
}

const paper: Paper = {
  id: '44444444-4444-4444-8444-444444444444',
  content: '需要移回待整理',
  status: 'organized',
  topicId: topic.id,
  version: 2,
  createdAt: '2026-09-03T07:00:00.000Z',
  updatedAt: '2026-09-03T07:00:00.000Z',
  deletedAt: null,
  hasQuestion: false,
  isQuestionResolved: false,
  questionStatus: 'none',
  questionText: null,
  understandingText: null,
  questionResolvedAt: null,
}

describe('mobile papers store box mutations', () => {
  const topics = {
    listActive: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } satisfies Record<keyof TopicMutationApi, jest.Mock>
  const papers = {
    list: jest.fn(),
  } as unknown as PaperApi

  beforeEach(async () => {
    topics.listActive.mockResolvedValue({
      items: [topic],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    topics.update.mockResolvedValue({
      ...topic,
      name: '已重命名',
      version: 5,
    })
    topics.remove.mockResolvedValue({
      id: topic.id,
      version: 5,
      deletedAt: '2026-09-03T08:00:00.000Z',
    })
    papers.list = jest.fn().mockResolvedValue({
      items: [paper],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    configurePapersServices({ papers, topics })
    await loadRemote()
  })

  it('重命名服务端箱子时携带当前版本并更新本地名称', async () => {
    await papersActions.renameTopic(topic.id, ' 已重命名 ')

    expect(topics.update).toHaveBeenCalledWith({ id: topic.id, name: '已重命名', version: 4 })
    expect(getPapersState().topics[0]).toMatchObject({ name: '已重命名', version: 5 })
  })

  it('删除服务端箱子时携带版本并将纸页移回待整理', async () => {
    await papersActions.deleteTopic(topic.id)

    expect(topics.remove).toHaveBeenCalledWith({ id: topic.id, version: 4 })
    expect(getPapersState().topics).toHaveLength(0)
    expect(getPapersState().papers[0]).toMatchObject({ status: 'inbox', topicId: null })
  })

  it('服务端箱子变更失败时恢复乐观更新前的状态', async () => {
    topics.update.mockRejectedValueOnce(new Error('版本冲突'))

    await expect(papersActions.renameTopic(topic.id, '冲突名称')).rejects.toThrow('版本冲突')
    expect(getPapersState().topics[0]).toMatchObject({ name: topic.name, version: topic.version })
  })
})

describe('mobile papers store question commands', () => {
  const thinkingPaper: Paper = {
    ...paper,
    id: '55555555-5555-4555-8555-555555555555',
    status: 'inbox',
    topicId: null,
    hasQuestion: true,
    isQuestionResolved: false,
    questionStatus: 'thinking',
    questionText: '为什么状态更新不是立即生效',
  }
  const topics = {
    listActive: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } satisfies Record<keyof TopicMutationApi, jest.Mock>
  const papers = {
    list: jest.fn(),
    updateQuestion: jest.fn(),
  } as unknown as PaperApi

  beforeEach(async () => {
    topics.listActive.mockResolvedValue({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    papers.list = jest.fn().mockResolvedValue({
      items: [thinkingPaper],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    papers.updateQuestion = jest.fn()
    configurePapersServices({ papers, topics })
    await loadRemote()
  })

  it('解决问题时携带版本调用服务端并同步侧车字段', async () => {
    papers.updateQuestion = jest.fn().mockResolvedValue({
      ...thinkingPaper,
      questionStatus: 'resolved',
      isQuestionResolved: true,
      questionResolvedAt: '2026-09-04T08:00:00.000Z',
      version: 3,
    })

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).resolves.toBe('resolved')

    expect(papers.updateQuestion).toHaveBeenCalledWith({
      id: thinkingPaper.id,
      version: 2,
      status: 'resolved',
    })
    expect(getPapersState().papers[0]).toMatchObject({ questionStatus: 'resolved', version: 3 })
    expect(getPapersState().extras[thinkingPaper.id]).toMatchObject({
      questionStatus: 'resolved',
      isQuestionResolved: true,
    })
  })

  it('版本冲突时采纳服务端实体并按目标状态报告成功', async () => {
    const error = new Error('记录版本冲突') as Error & {
      serialized?: Record<string, unknown>
    }
    error.serialized = {
      code: 'CONFLICT',
      status: 409,
      details: {
        paper: {
          ...thinkingPaper,
          questionStatus: 'resolved',
          isQuestionResolved: true,
          version: 6,
        },
      },
    }
    papers.updateQuestion = jest.fn().mockRejectedValue(error)

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).resolves.toBe('resolved')
    expect(getPapersState().papers[0]).toMatchObject({ questionStatus: 'resolved', version: 6 })
  })

  it('其他失败时回滚到操作前状态并抛出错误', async () => {
    papers.updateQuestion = jest.fn().mockRejectedValue(new Error('网络不可用'))

    await expect(papersActions.resolveQuestion(thinkingPaper.id)).rejects.toThrow('网络不可用')
    expect(getPapersState().papers[0]).toMatchObject({ questionStatus: 'thinking', version: 2 })
    expect(getPapersState().extras[thinkingPaper.id]).toMatchObject({
      questionStatus: 'thinking',
    })
  })

  it('重新打开问题时清空解决时间', async () => {
    papers.list = jest.fn().mockResolvedValue({
      items: [
        {
          ...thinkingPaper,
          questionStatus: 'resolved',
          isQuestionResolved: true,
          questionResolvedAt: '2026-09-04T08:00:00.000Z',
        },
      ],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })
    await loadRemote()
    papers.updateQuestion = jest.fn().mockResolvedValue({
      ...thinkingPaper,
      questionStatus: 'thinking',
      isQuestionResolved: false,
      questionResolvedAt: null,
      version: 3,
    })

    await expect(papersActions.reopenQuestion(thinkingPaper.id)).resolves.toBe('thinking')
    expect(getPapersState().papers[0]).toMatchObject({
      questionStatus: 'thinking',
      questionResolvedAt: null,
      version: 3,
    })
  })

  it('AI 解释卡确认后本地落定已解决且不再发起状态请求', async () => {
    papers.updateQuestion = jest.fn()

    papersActions.markQuestionConfirmed(thinkingPaper.id)

    expect(getPapersState().papers[0]).toMatchObject({
      questionStatus: 'resolved',
      isQuestionResolved: true,
      version: 3,
    })
    expect(papers.updateQuestion).not.toHaveBeenCalled()
  })

  it('演示数据未同步服务端时不发请求只更新本地状态', async () => {
    // 重置服务端配置,回到纯演示模式;使用演示种子里还在思考的纸页
    const seedThinking = getPapersState().papers.find((item) => item.questionStatus === 'thinking')
    expect(seedThinking).toBeDefined()
    configurePapersServices(undefined as never)

    const result = await papersActions.resolveQuestion(seedThinking!.id)

    expect(result).toBe('resolved')
    expect(papers.updateQuestion).not.toHaveBeenCalled()
    expect(getPapersState().extras[seedThinking!.id]).toMatchObject({
      questionStatus: 'resolved',
    })
  })
})
