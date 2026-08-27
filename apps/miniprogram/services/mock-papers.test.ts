import { describe, expect, it } from 'vitest'
import { HttpError } from './http'
import { createMockPapersApi, type MockPapersStorage, type MockTopicsStorage } from './mock-papers'

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

describe('mock papers api', () => {
  it('lists contract-compatible inbox papers in reverse chronological order', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage() })

    const page = await api.list({ status: 'inbox' })

    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((paper) => paper.status === 'inbox')).toBe(true)
    expect(new Date(page.items[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(page.items.at(-1)!.createdAt).getTime(),
    )
    expect(page.pageInfo).toEqual({ hasNextPage: false, nextCursor: null })
  })

  it('trims and creates a new inbox paper', async () => {
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

  it('organizes a paper and increments its version', async () => {
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

  it('returns a conflict when a command uses a stale version', async () => {
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

  it('recovers from invalid stored data instead of crashing the page', async () => {
    const api = createMockPapersApi({ storage: createMemoryStorage({ broken: true }) })

    await expect(api.list({ status: 'inbox' })).resolves.toMatchObject({
      items: expect.any(Array),
    })
  })

  it('lists seeded topics and creates a trimmed topic', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      topicStorage: createTopicStorage(),
      delayMs: 0,
    })

    await expect(api.listTopics()).resolves.toHaveLength(3)
    await expect(api.createTopic({ name: '  新主题  ' })).resolves.toMatchObject({
      name: '新主题',
      color: '#DCE9D8',
    })
  })

  it('rejects duplicate topics with a conflict', async () => {
    const api = createMockPapersApi({
      storage: createMemoryStorage(),
      topicStorage: createTopicStorage(),
      delayMs: 0,
    })

    await expect(api.createTopic({ name: '学习方法' })).rejects.toMatchObject({
      serialized: { code: 'CONFLICT' },
    })
  })
})
