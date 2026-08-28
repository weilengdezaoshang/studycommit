import { describe, expect, it } from 'vitest'
import { HttpError } from './http'
import {
  createMockPapersApi,
  type MockPaperMetadataStorage,
  type MockPapersStorage,
  type MockTopicsStorage,
} from './mock-papers'

function createMemoryStorage(initial: unknown = undefined): MockPapersStorage {
  let value = initial
  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue
    },
  }
}

function createTopicStorage(initial: unknown = undefined): MockTopicsStorage {
  let value = initial
  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue
    },
  }
}

function createMetadataStorage(initial: unknown = undefined): MockPaperMetadataStorage {
  let value = initial
  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue
    },
  }
}

describe('mock papers api', () => {
  it('按创建时间倒序返回符合契约的待整理纸页', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage() })

    const page = await api.list({ status: 'inbox' })

    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((paper) => paper.status === 'inbox')).toBe(true)
    expect(new Date(page.items[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(page.items.at(-1)!.createdAt).getTime(),
    )
    expect(page.pageInfo).toEqual({ hasNextPage: false, nextCursor: null })
  })

  it('去掉首尾空格后创建待整理纸页', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      now: () => new Date('2026-08-27T10:00:00.000Z'),
    })

    const paper = await api.create({ content: '  记录一个知识点  ' })

    expect(paper).toMatchObject({
      content: '记录一个知识点',
      status: 'inbox',
      topicId: null,
      version: 1,
      deletedAt: null,
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
    })
  })

  it('整理纸页后递增版本号', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage() })
    const paper = (await api.list({ status: 'inbox' })).items[0]!

    const organized = await api.organize({
      id: paper.id,
      version: paper.version,
      topicId: '33333333-3333-4333-8333-333333333333',
    })

    expect(organized).toMatchObject({
      id: paper.id,
      status: 'organized',
      topicId: '33333333-3333-4333-8333-333333333333',
      version: paper.version + 1,
    })
  })

  it('使用过期版本整理纸页时返回冲突', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage() })
    const paper = (await api.list({ status: 'inbox' })).items[0]!

    await expect(
      api.organize({
        id: paper.id,
        version: paper.version + 1,
        topicId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toBeInstanceOf(HttpError)
    await expect(
      api.organize({
        id: paper.id,
        version: paper.version + 1,
        topicId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toMatchObject({ serialized: { code: 'CONFLICT' } })
  })

  it('存储数据损坏时恢复种子数据而不崩溃', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage({ broken: true }) })

    await expect(api.list({ status: 'inbox' })).resolves.toMatchObject({
      items: expect.any(Array),
    })
  })

  it('返回种子主题并去掉新主题名称首尾空格', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      topicStorage: createTopicStorage(),
      delayMs: 0,
    })

    await expect(api.listTopics()).resolves.toHaveLength(6)
    await expect(api.createTopic({ name: '  新主题  ' })).resolves.toMatchObject({
      name: '新主题',
      color: '#DCE9D8',
    })
  })

  it('创建重名主题时返回冲突', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      topicStorage: createTopicStorage(),
      delayMs: 0,
    })

    await expect(api.createTopic({ name: '学习方法' })).rejects.toMatchObject({
      serialized: { code: 'CONFLICT' },
    })
  })

  it('创建纸页时保存图片和问题标记元数据', async () => {
    const metadataStorage = createMetadataStorage()
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      metadataStorage,
      delayMs: 0,
    })

    const paper = await api.create({
      content: '带图片的问题',
      hasQuestion: true,
      photoPath: '/saved/photo.jpg',
    })

    await expect(api.listPaperMetadata()).resolves.toContainEqual({
      paperId: paper.id,
      hasQuestion: true,
      isQuestionResolved: false,
      photoPath: '/saved/photo.jpg',
    })
  })

  it('只能解决已标记的问题并持久化状态', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      metadataStorage: createMetadataStorage(),
      delayMs: 0,
    })
    const question = await api.create({ content: '一个问题', hasQuestion: true })
    const normalPaper = await api.create({ content: '普通纸页' })

    await expect(api.resolveQuestion(question.id)).resolves.toMatchObject({
      paperId: question.id,
      isQuestionResolved: true,
    })
    await expect(api.resolveQuestion(normalPaper.id)).rejects.toMatchObject({
      serialized: { code: 'INVALID_RESPONSE' },
    })
  })

  it('元数据损坏时恢复安全的种子数据', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      metadataStorage: createMetadataStorage([{ broken: true }]),
      delayMs: 0,
    })

    await expect(api.listPaperMetadata()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ hasQuestion: true })]),
    )
  })
})
