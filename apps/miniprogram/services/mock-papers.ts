import { createHttpError } from './http'
import type {
  CreatePaperInput,
  ListPapersInput,
  OrganizePaperInput,
  Paper,
  PaperCommandInput,
  PaperPage,
  UpdatePaperInput,
} from '@studycommit/rpc-contracts/papers'

export type MockPapersStorage = {
  read(): unknown
  write(papers: Paper[]): void
}

export type MockTopic = {
  id: string
  name: string
  color: string
}

export type MockTopicsStorage = {
  read(): unknown
  write(topics: MockTopic[]): void
}

export type MockPapersApiOptions = {
  storage?: MockPapersStorage
  topicStorage?: MockTopicsStorage
  now?: () => Date
  delayMs?: number
}

export const MOCK_PAPERS_STORAGE_KEY = 'studycommit.mock.papers.agent-prd.v1' as const
export const MOCK_TOPICS_STORAGE_KEY = 'studycommit.mock.topics.agent-prd.v1' as const
export const MOCK_TOPIC_ID = '33333333-3333-4333-8333-333333333333' as const
export const MOCK_SYSTEM_DESIGN_TOPIC_ID = '77777777-7777-4777-8777-777777777777' as const
export const MOCK_MOBILE_DESIGN_TOPIC_ID = '88888888-8888-4888-8888-888888888888' as const
export const MOCK_FRONTEND_TOPIC_ID = '99999999-9999-4999-8999-999999999999' as const

const SEED_PAPERS: Paper[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    content: '数据库索引不是越多越好，写入成本与查询收益必须结合真实访问模式判断。',
    status: 'organized',
    topicId: MOCK_SYSTEM_DESIGN_TOPIC_ID,
    version: 1,
    createdAt: '2026-08-24T14:10:00.000Z',
    updatedAt: '2026-08-24T14:10:00.000Z',
    deletedAt: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    content: '为什么 React 的状态更新不是立即生效？批处理和调度分别解决了什么问题？',
    status: 'inbox',
    topicId: null,
    version: 1,
    createdAt: '2026-08-25T06:20:00.000Z',
    updatedAt: '2026-08-25T06:20:00.000Z',
    deletedAt: null,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    content: 'Safe Area 不只是顶部留白，它代表系统界面与应用内容之间需要共同遵守的边界。',
    status: 'organized',
    topicId: MOCK_MOBILE_DESIGN_TOPIC_ID,
    version: 2,
    createdAt: '2026-08-25T01:42:00.000Z',
    updatedAt: '2026-08-25T01:42:00.000Z',
    deletedAt: null,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    content: 'Optimistic update 失败时，怎样回滚才能不覆盖用户随后产生的新状态？',
    status: 'inbox',
    topicId: null,
    version: 1,
    createdAt: '2026-08-21T10:36:00.000Z',
    updatedAt: '2026-08-21T10:36:00.000Z',
    deletedAt: null,
  },
]

const SEED_TOPICS: MockTopic[] = [
  { id: MOCK_TOPIC_ID, name: '学习方法', color: '#DCE9D8' },
  { id: '55555555-5555-4555-8555-555555555555', name: '工程实践', color: '#E8E4C9' },
  { id: '66666666-6666-4666-8666-666666666666', name: '待验证', color: '#E6DCD5' },
  { id: MOCK_SYSTEM_DESIGN_TOPIC_ID, name: '系统设计', color: '#DCE9D8' },
  { id: MOCK_MOBILE_DESIGN_TOPIC_ID, name: '移动端设计', color: '#E8E4C9' },
  { id: MOCK_FRONTEND_TOPIC_ID, name: '前端架构', color: '#E6DCD5' },
]

export function createMockPapersApi(options: MockPapersApiOptions = {}) {
  const storage = options.storage ?? createWxStorage()
  const topicStorage = options.topicStorage ?? createDefaultTopicStorage()
  const now = options.now ?? (() => new Date())
  const delayMs = options.delayMs ?? 120
  let papers = readPapers(storage)
  let topics = readTopics(topicStorage)

  async function settle<T>(value: T): Promise<T> {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    }
    return value
  }

  function persist(nextPapers: Paper[]): void {
    papers = nextPapers.map(clonePaper)
    storage.write(papers)
  }

  function findPaper(id: string): Paper {
    const paper = papers.find((item) => item.id === id && item.deletedAt === null)
    if (!paper) {
      throw createHttpError({ code: 'NOT_FOUND', message: '内容不存在' })
    }
    return paper
  }

  function assertVersion(paper: Paper, version: number): void {
    if (paper.version !== version) {
      throw createHttpError({
        code: 'CONFLICT',
        message: '内容已在其他位置更新',
        details: { currentVersion: paper.version },
      })
    }
  }

  return {
    async list(input: Partial<ListPapersInput> = {}): Promise<PaperPage> {
      const query = parseListInput(input)
      const filtered = papers
        .filter((paper) => paper.deletedAt === null)
        .filter((paper) => query.status === undefined || paper.status === query.status)
        .filter((paper) => query.topicId === undefined || paper.topicId === query.topicId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      const items = filtered.slice(0, query.limit)
      return settle({
        items: items.map(clonePaper),
        pageInfo: {
          hasNextPage: filtered.length > items.length,
          nextCursor: filtered.length > items.length ? 'mock-next-page' : null,
        },
      })
    },

    async listTopics(): Promise<MockTopic[]> {
      return settle(topics.map(cloneTopic))
    },

    async createTopic(input: { name: string }): Promise<MockTopic> {
      const name = readString(asRecord(input).name, '主题名称').trim()
      if (!name || name.length > 80) {
        throw invalidContract('主题名称长度不符合契约')
      }
      if (topics.some((topic) => topic.name === name)) {
        throw createHttpError({ code: 'CONFLICT', message: '主题已存在' })
      }
      const topic = { id: createMockUuid(), name, color: '#DCE9D8' }
      topics = [topic, ...topics]
      topicStorage.write(topics.map(cloneTopic))
      return settle(cloneTopic(topic))
    },

    async get(id: string): Promise<Paper> {
      return settle(clonePaper(findPaper(id)))
    },

    async create(input: CreatePaperInput): Promise<Paper> {
      const data = parseCreateInput(input)
      const timestamp = now().toISOString()
      const paper = parsePaper({
        id: createMockUuid(),
        content: data.content,
        status: 'inbox',
        topicId: null,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      })
      persist([paper, ...papers])
      return settle(clonePaper(paper))
    },

    async update(input: UpdatePaperInput): Promise<Paper> {
      const data = parseUpdateInput(input)
      const paper = findPaper(data.id)
      assertVersion(paper, data.version)
      const updated = parsePaper({
        ...paper,
        content: data.content,
        version: paper.version + 1,
        updatedAt: now().toISOString(),
      })
      persist(papers.map((item) => (item.id === updated.id ? updated : item)))
      return settle(clonePaper(updated))
    },

    async organize(input: OrganizePaperInput): Promise<Paper> {
      const data = parseOrganizeInput(input)
      const paper = findPaper(data.id)
      assertVersion(paper, data.version)
      const organized = parsePaper({
        ...paper,
        status: 'organized',
        topicId: data.topicId,
        version: paper.version + 1,
        updatedAt: now().toISOString(),
      })
      persist(papers.map((item) => (item.id === organized.id ? organized : item)))
      return settle(clonePaper(organized))
    },

    async moveToInbox(input: PaperCommandInput): Promise<Paper> {
      const data = parseCommandInput(input)
      const paper = findPaper(data.id)
      assertVersion(paper, data.version)
      const inboxPaper = parsePaper({
        ...paper,
        status: 'inbox',
        topicId: null,
        version: paper.version + 1,
        updatedAt: now().toISOString(),
      })
      persist(papers.map((item) => (item.id === inboxPaper.id ? inboxPaper : item)))
      return settle(clonePaper(inboxPaper))
    },

    async remove(input: PaperCommandInput) {
      const data = parseCommandInput(input)
      const paper = findPaper(data.id)
      assertVersion(paper, data.version)
      const deletedAt = now().toISOString()
      const deleted = parsePaper({
        ...paper,
        version: paper.version + 1,
        updatedAt: deletedAt,
        deletedAt,
      })
      persist(papers.map((item) => (item.id === deleted.id ? deleted : item)))
      return settle({ id: deleted.id, version: deleted.version, deletedAt })
    },
  }
}

let defaultMockPapersApi: ReturnType<typeof createMockPapersApi> | undefined

export function getMockPapersApi(): ReturnType<typeof createMockPapersApi> {
  if (!defaultMockPapersApi) {
    defaultMockPapersApi = createMockPapersApi()
  }
  return defaultMockPapersApi
}

function readPapers(storage: MockPapersStorage): Paper[] {
  const stored = storage.read()
  if (isPaperArray(stored)) {
    return stored
  }
  const seeds = SEED_PAPERS.map(clonePaper)
  storage.write(seeds)
  return seeds
}

function clonePaper(paper: Paper): Paper {
  return { ...paper }
}

function createMockUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function createWxStorage(): MockPapersStorage {
  return {
    read: () => wx.getStorageSync(MOCK_PAPERS_STORAGE_KEY),
    write: (papers) => wx.setStorageSync(MOCK_PAPERS_STORAGE_KEY, papers),
  }
}

function readTopics(storage: MockTopicsStorage): MockTopic[] {
  const stored = storage.read()
  if (isTopicArray(stored)) {
    return stored
  }
  const seeds = SEED_TOPICS.map(cloneTopic)
  storage.write(seeds)
  return seeds
}

function cloneTopic(topic: MockTopic): MockTopic {
  return { ...topic }
}

function isTopicArray(value: unknown): value is MockTopic[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as MockTopic).id === 'string' &&
        isUuid((item as MockTopic).id) &&
        typeof (item as MockTopic).name === 'string' &&
        (item as MockTopic).name.length > 0 &&
        typeof (item as MockTopic).color === 'string' &&
        /^#[0-9A-F]{6}$/i.test((item as MockTopic).color),
    )
  )
}

function createWxTopicStorage(): MockTopicsStorage {
  return {
    read: () => wx.getStorageSync(MOCK_TOPICS_STORAGE_KEY),
    write: (topics) => wx.setStorageSync(MOCK_TOPICS_STORAGE_KEY, topics),
  }
}

function createDefaultTopicStorage(): MockTopicsStorage {
  if (typeof wx !== 'undefined') {
    return createWxTopicStorage()
  }
  let value: unknown
  return {
    read: () => value,
    write: (topics) => {
      value = topics
    },
  }
}

function parseCreateInput(input: unknown): CreatePaperInput {
  const content = readString(asRecord(input).content, 'content').trim()
  if (!content || content.length > 20_000) {
    throw invalidContract('记录内容长度不符合契约')
  }
  return { content }
}

function parseListInput(input: unknown): {
  status?: Paper['status']
  topicId?: string
  limit: number
  cursor?: string
} {
  const value = asRecord(input)
  const status = value.status
  if (status !== undefined && status !== 'inbox' && status !== 'organized') {
    throw invalidContract('内容状态不符合契约')
  }
  const topicId = value.topicId
  if (topicId !== undefined && !isUuid(topicId)) {
    throw invalidContract('主题 ID 不符合契约')
  }
  if (status === 'inbox' && topicId !== undefined) {
    throw invalidContract('待整理内容不能同时按主题筛选')
  }
  const limit = value.limit === undefined ? 20 : Number(value.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalidContract('分页数量不符合契约')
  }
  const cursor = value.cursor
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor)) {
    throw invalidContract('分页游标不符合契约')
  }
  return { status, topicId: typeof topicId === 'string' ? topicId : undefined, limit, cursor }
}

function parseUpdateInput(input: unknown): UpdatePaperInput {
  const value = asRecord(input)
  return {
    id: readUuid(value.id),
    version: readVersion(value.version),
    content: parseCreateInput({ content: value.content }).content,
  }
}

function parseOrganizeInput(input: unknown): OrganizePaperInput {
  const value = asRecord(input)
  return {
    id: readUuid(value.id),
    version: readVersion(value.version),
    topicId: readUuid(value.topicId),
  }
}

function parseCommandInput(input: unknown): PaperCommandInput {
  const value = asRecord(input)
  return { id: readUuid(value.id), version: readVersion(value.version) }
}

function parsePaper(input: unknown): Paper {
  const value = asRecord(input)
  const content = readString(value.content)
  const status = value.status
  const topicId = value.topicId
  const deletedAt = value.deletedAt
  if (
    !content ||
    content.length > 20_000 ||
    (status !== 'inbox' && status !== 'organized') ||
    (topicId !== null && !isUuid(topicId)) ||
    (deletedAt !== null && !isDateString(deletedAt))
  ) {
    throw invalidContract('纸页数据不符合契约')
  }
  return {
    id: readUuid(value.id),
    content,
    status,
    topicId,
    version: readVersion(value.version),
    createdAt: readDate(value.createdAt),
    updatedAt: readDate(value.updatedAt),
    deletedAt,
  } as Paper
}

function isPaperArray(value: unknown): value is Paper[] {
  return Array.isArray(value) && value.every((item) => isValidPaper(item))
}

function isValidPaper(value: unknown): value is Paper {
  try {
    parsePaper(value)
    return true
  } catch {
    return false
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidContract('请求参数不符合契约')
  }
  return value as Record<string, unknown>
}

function readString(value: unknown, field = '字段'): string {
  if (typeof value !== 'string') {
    throw invalidContract(`${field}不符合契约`)
  }
  return value
}

function readUuid(value: unknown): string {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw invalidContract('ID 不符合契约')
  }
  return value
}

function readVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalidContract('版本号不符合契约')
  }
  return value
}

function readDate(value: unknown): string {
  if (!isDateString(value)) {
    throw invalidContract('时间字段不符合契约')
  }
  return value
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function isDateString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
}

function invalidContract(message: string): never {
  throw createHttpError({ code: 'INVALID_RESPONSE', message })
}
