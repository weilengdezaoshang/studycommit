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
