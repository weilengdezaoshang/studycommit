import {
  deletePaperOutputSchema,
  paperPageSchema,
  paperSchema,
  type ListPapersInput,
  type OrganizePaperInput,
  type Paper,
  type PaperCommandInput,
  type PaperPage,
  type UpdatePaperInput,
} from '@studycommit/rpc-contracts/papers'
import { topicListSchema, topicSchema, type Topic } from '@studycommit/rpc-contracts/topics'
import { getMiniprogramHttpClient } from './api-client'
import { createHttpError } from './http'
import { getMockPapersApi } from './mock-papers'
import { getAccessToken } from './auth-session'
import { createIdempotencyKey } from '../utils/uuid'

/**
 * 纸页/箱子数据访问面:与 mock-papers 的方法形状对齐。
 * 已登录走真实后端(oRPC REST 路由),未登录回退本地演示数据。
 */

export type TopicSummary = { id: string; name: string; color: string }

export type CreatePaperRequest = {
  content: string
  hasQuestion?: boolean
  /** 本地暂存的照片;资产直传能力上线前不会发送给后端 */
  photoPath?: string
}

export type ResolveQuestionRequest = { id: string; version: number }

export type RemovePaperResult = { id: string; version: number; deletedAt: string }

export type CreatePaperOptions = { idempotencyKey?: string }

export type PapersApi = {
  list(input?: Partial<ListPapersInput>): Promise<PaperPage>
  listTopics(): Promise<TopicSummary[]>
  createTopic(input: { name: string }): Promise<TopicSummary>
  get(id: string): Promise<Paper>
  create(input: CreatePaperRequest, options?: CreatePaperOptions): Promise<Paper>
  resolveQuestion(input: ResolveQuestionRequest): Promise<Paper>
  update(input: UpdatePaperInput): Promise<Paper>
  organize(input: OrganizePaperInput): Promise<Paper>
  moveToInbox(input: PaperCommandInput): Promise<Paper>
  remove(input: PaperCommandInput): Promise<RemovePaperResult>
}

export type PapersApiRequest = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  data?: unknown
  headers?: Record<string, string>
  parse?: (data: unknown) => unknown
}

export type PapersApiRequestFn = <TResponse>(request: {
  method: PapersApiRequest['method']
  path: string
  data?: unknown
  headers?: Record<string, string>
  parse?: (data: unknown) => TResponse
}) => Promise<TResponse>

export const TOPIC_NAME_LIMIT = 18
const LIST_PAGE_LIMIT = 100

/** 真实后端实现:路径与请求形态跟随 rpc-contracts 的 oRPC REST 路由。 */
export function createRealPapersApi(options: { request?: PapersApiRequestFn } = {}): PapersApi {
  const request = options.request ?? defaultRequest
  return {
    async list(input = {}) {
      return request({
        method: 'GET',
        path: appendQuery('/papers', {
          status: input.status,
          topicId: input.topicId,
          questionStatus: input.questionStatus,
          limit: input.limit,
          cursor: input.cursor,
        }),
        parse: (data) => paperPageSchema.parse(data),
      })
    },

    async listTopics() {
      const page = await request({
        method: 'GET',
        path: appendQuery('/topics', { limit: LIST_PAGE_LIMIT }),
        parse: (data) => topicListSchema.parse(data),
      })
      return page.items.map(toTopicSummary)
    },

    async createTopic({ name }) {
      const trimmedName = name.trim()
      if (!trimmedName || trimmedName.length > TOPIC_NAME_LIMIT) {
        throw invalidContract(`箱子名称需要 1~${TOPIC_NAME_LIMIT} 个字符`)
      }
      const topic = await request({
        method: 'POST',
        path: '/topics',
        data: { name: trimmedName },
        headers: { 'idempotency-key': createIdempotencyKey() },
        parse: (data) => topicSchema.parse(data),
      })
      return toTopicSummary(topic)
    },

    get(id) {
      return request({
        method: 'GET',
        path: `/papers/${id}`,
        parse: (data) => paperSchema.parse(data),
      })
    },

    create(input, options = {}) {
      return request({
        method: 'POST',
        path: '/papers',
        data: { content: input.content, hasQuestion: input.hasQuestion ?? false },
        headers: { 'idempotency-key': options.idempotencyKey ?? createIdempotencyKey() },
        parse: (data) => paperSchema.parse(data),
      })
    },

    resolveQuestion({ id, version }) {
      return request({
        method: 'PATCH',
        path: `/papers/${id}/question`,
        data: { id, version, status: 'resolved' },
        parse: (data) => paperSchema.parse(data),
      })
    },

    update(input) {
      return request({
        method: 'PATCH',
        path: `/papers/${input.id}`,
        data: input,
        parse: (data) => paperSchema.parse(data),
      })
    },

    organize(input) {
      return request({
        method: 'POST',
        path: `/papers/${input.id}/organize`,
        data: input,
        parse: (data) => paperSchema.parse(data),
      })
    },

    moveToInbox(input) {
      return request({
        method: 'POST',
        path: `/papers/${input.id}/move-to-inbox`,
        data: input,
        parse: (data) => paperSchema.parse(data),
      })
    },

    remove(input) {
      return request({
        method: 'DELETE',
        path: `/papers/${input.id}`,
        data: { id: input.id, version: input.version },
        parse: (data) => deletePaperOutputSchema.parse(data),
      })
    },
  }
}

/** 未登录时的演示数据实现:复用 mock-papers,并补齐 resolveQuestion 的纸页返回。 */
export function createDemoPapersApi(): PapersApi {
  const mock = getMockPapersApi()
  return {
    list: (input) => mock.list(input ?? {}),
    listTopics: () => mock.listTopics(),
    createTopic: ({ name }) => mock.createTopic({ name }),
    get: (id) => mock.get(id),
    create: (input) =>
      mock.create({
        content: input.content,
        hasQuestion: input.hasQuestion,
        photoPath: input.photoPath,
      }),
    resolveQuestion: async ({ id }) => {
      await mock.resolveQuestion(id)
      return mock.get(id)
    },
    update: (input) => mock.update(input),
    organize: (input) => mock.organize(input),
    moveToInbox: (input) => mock.moveToInbox(input),
    remove: (input) => mock.remove(input),
  }
}

let defaultRealPapersApi: PapersApi | undefined

export function getPapersApi(options: { hasCredentials?: () => boolean } = {}): PapersApi {
  const hasCredentials = options.hasCredentials ?? (() => Boolean(getAccessToken()))
  if (!hasCredentials()) {
    return createDemoPapersApi()
  }
  defaultRealPapersApi ??= createRealPapersApi()
  return defaultRealPapersApi
}

const defaultRequest: PapersApiRequestFn = (request) => getMiniprogramHttpClient().request(request)

function toTopicSummary(topic: Topic): TopicSummary {
  return { id: topic.id, name: topic.name, color: topic.color }
}

function appendQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

function invalidContract(message: string): never {
  throw createHttpError({ code: 'INVALID_RESPONSE', message })
}
