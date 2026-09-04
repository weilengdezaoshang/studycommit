import { describe, expect, it, vi } from 'vitest'
import { deleteStoreTopic, renameStoreTopic, type TopicStoreHost } from './topic-mutations'
import { normalizeTopicName, TOPIC_NAME_ERROR_MESSAGE } from './topic-name'
import { detachTopicPapers } from './detach-papers'

interface TestTopic {
  id: string
  name: string
  color: string
  version: number
}

interface TestPaper {
  id: string
  topicId: string | null
  status: 'inbox' | 'organized'
  version: number
  updatedAt: string
  deletedAt: string | null
}

function createHost(options: { topics: TestTopic[]; papers: TestPaper[]; canSync?: boolean }) {
  let topics = options.topics
  let papers = options.papers
  const host: TopicStoreHost<TestTopic, TestPaper> = {
    canSync: () => options.canSync ?? true,
    getTopics: () => topics,
    getPapers: () => papers,
    setTopics: (next) => {
      topics = next
    },
    setPapers: (next) => {
      papers = next
    },
    toLocalTopic: (saved) => ({
      id: saved.id,
      name: saved.name,
      color: saved.color,
      version: saved.version,
    }),
    refresh: vi.fn(),
    updateTopic: vi
      .fn()
      .mockResolvedValue({ id: 't1', name: '新名称', color: '#53635A', version: 2 }),
    removeTopic: vi
      .fn()
      .mockResolvedValue({ id: 't1', version: 2, deletedAt: '2026-09-04T00:00:00.000Z' }),
  }
  return host
}

describe('topic-store-runtime', () => {
  it('名称去空格后合法,空白或超长名称非法', () => {
    expect(normalizeTopicName('  系统设计 ')).toBe('系统设计')
    expect(normalizeTopicName('   ')).toBeNull()
    expect(normalizeTopicName('a'.repeat(19))).toBeNull()
  })

  it('删除箱子时仅把箱内未删除的纸页移回待整理并递增版本', () => {
    const now = '2026-09-04T00:00:00.000Z'
    const papers: TestPaper[] = [
      { id: 'p1', topicId: 't1', status: 'organized', version: 3, updatedAt: now, deletedAt: null },
      { id: 'p2', topicId: 't2', status: 'organized', version: 1, updatedAt: now, deletedAt: null },
      { id: 'p3', topicId: 't1', status: 'organized', version: 1, updatedAt: now, deletedAt: now },
    ]
    const detached = detachTopicPapers(papers, 't1', now)
    expect(detached[0]).toMatchObject({ topicId: null, status: 'inbox', version: 4 })
    expect(detached[1]).toMatchObject({ topicId: 't2', status: 'organized', version: 1 })
    expect(detached[2]).toMatchObject({ topicId: 't1', status: 'organized', version: 1 })
  })

  it('重命名可同步时携带当前版本并写回服务端版本', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '旧名称', color: '#53635A', version: 1 }],
      papers: [],
    })
    const renamed = await renameStoreTopic(host, 't1', ' 新名称 ')
    expect(host.updateTopic).toHaveBeenCalledWith({ id: 't1', name: '新名称', version: 1 })
    expect(renamed).toMatchObject({ id: 't1', name: '新名称', version: 2 })
    expect(host.getTopics()[0]).toMatchObject({ name: '新名称', version: 2 })
  })

  it('重命名失败时回滚到原状态并触发刷新', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '旧名称', color: '#53635A', version: 1 }],
      papers: [],
    })
    vi.mocked(host.updateTopic).mockRejectedValueOnce(new Error('版本冲突'))
    await expect(renameStoreTopic(host, 't1', '冲突名称')).rejects.toThrow('版本冲突')
    expect(host.getTopics()[0]).toMatchObject({ name: '旧名称', version: 1 })
    expect(host.refresh).toHaveBeenCalled()
  })

  it('重命名非法名称时直接抛出错误且不发起同步', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '旧名称', color: '#53635A', version: 1 }],
      papers: [],
    })
    await expect(renameStoreTopic(host, 't1', '   ')).rejects.toThrow(TOPIC_NAME_ERROR_MESSAGE)
    expect(host.updateTopic).not.toHaveBeenCalled()
  })

  it('不可同步时重命名只做本地乐观更新', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '旧名称', color: '#53635A', version: 1 }],
      papers: [],
      canSync: false,
    })
    const renamed = await renameStoreTopic(host, 't1', '本地名称')
    expect(host.updateTopic).not.toHaveBeenCalled()
    expect(renamed).toMatchObject({ name: '本地名称', version: 1 })
  })

  it('删除可同步时携带版本调用服务端并把纸页移回待整理', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '箱子', color: '#53635A', version: 1 }],
      papers: [
        {
          id: 'p1',
          topicId: 't1',
          status: 'organized',
          version: 1,
          updatedAt: '',
          deletedAt: null,
        },
      ],
    })
    await deleteStoreTopic(host, 't1')
    expect(host.removeTopic).toHaveBeenCalledWith({ id: 't1', version: 1 })
    expect(host.getTopics()).toHaveLength(0)
    expect(host.getPapers()[0]).toMatchObject({ topicId: null, status: 'inbox', version: 2 })
  })

  it('删除失败时回滚箱子和纸页并触发刷新', async () => {
    const host = createHost({
      topics: [{ id: 't1', name: '箱子', color: '#53635A', version: 1 }],
      papers: [
        {
          id: 'p1',
          topicId: 't1',
          status: 'organized',
          version: 1,
          updatedAt: '',
          deletedAt: null,
        },
      ],
    })
    vi.mocked(host.removeTopic).mockRejectedValueOnce(new Error('删除失败'))
    await expect(deleteStoreTopic(host, 't1')).rejects.toThrow('删除失败')
    expect(host.getTopics()).toHaveLength(1)
    expect(host.getPapers()[0]).toMatchObject({ topicId: 't1', status: 'organized', version: 1 })
    expect(host.refresh).toHaveBeenCalled()
  })

  it('删除不存在的箱子时为空操作', async () => {
    const host = createHost({ topics: [], papers: [] })
    await deleteStoreTopic(host, 'missing')
    expect(host.removeTopic).not.toHaveBeenCalled()
  })
})
