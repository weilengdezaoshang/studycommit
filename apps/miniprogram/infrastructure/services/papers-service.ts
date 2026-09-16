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
import { ServiceError } from '../../shared/service-runtime/index'
import { getStoredSession } from '../../services/auth-session'
import { getMockPapersApi } from '../../services/mock-papers'
import { createIdempotencyKey } from '../../utils/uuid'
import type { MiniprogramTransport } from '../transport/transport.types'

export type TopicSummary = { id: string; name: string; color: string }

export type CreatePaperRequest = {
  content?: string
  hasQuestion?: boolean
  assetUploadIds?: string[]
  photoPath?: string
}

export type ResolveQuestionRequest = { id: string; version: number }

export type RemovePaperResult = { id: string; version: number; deletedAt: string }

export type CreatePaperOptions = { idempotencyKey?: string }

export type PapersService = {
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

export const TOPIC_NAME_LIMIT = 18
const LIST_PAGE_LIMIT = 100

export interface CreatePapersServiceOptions {
  transport: MiniprogramTransport
  hasCredentials?: () => boolean
}

/** 记录业务服务：契约校验复用 rpc-contracts；未登录回退演示数据（按调用时登录态判断）。 */
export function createPapersService(options: CreatePapersServiceOptions): PapersService {
  const { transport } = options
  const hasCredentials = options.hasCredentials ?? (() => Boolean(getStoredSession()))

  const real: PapersService = {
    async list(input = {}) {
      return transport.call('papers.list', input).then((value) => paperPageSchema.parse(value))
    },

    async listTopics() {
      const page = await transport
        .call('topics.list', { limit: LIST_PAGE_LIMIT })
        .then((value) => topicListSchema.parse(value))
      return page.items.map(toTopicSummary)
    },

    async createTopic({ name }) {
      const trimmedName = name.trim()
      if (!trimmedName || trimmedName.length > TOPIC_NAME_LIMIT) {
        throw new ServiceError({
          code: 'INVALID_INPUT',
          message: `箱子名称需要 1~${TOPIC_NAME_LIMIT} 个字符`,
          retryable: false,
        })
      }
      const topic = await transport
        .call('topics.create', { name: trimmedName }, { idempotencyKey: createIdempotencyKey() })
        .then((value) => topicSchema.parse(value))
      return toTopicSummary(topic)
    },

    get(id) {
      return transport.call('papers.get', { id }).then((value) => paperSchema.parse(value))
    },

    create(input, callOptions = {}) {
      return transport
        .call(
          'papers.create',
          {
            content: input.content ?? '',
            hasQuestion: input.hasQuestion ?? false,
            ...(input.assetUploadIds?.length ? { assetUploadIds: input.assetUploadIds } : {}),
          },
          { idempotencyKey: callOptions.idempotencyKey ?? createIdempotencyKey() },
        )
        .then((value) => paperSchema.parse(value))
    },

    resolveQuestion({ id, version }) {
      return transport
        .call('papers.resolveQuestion', { id, version, status: 'resolved' })
        .then((value) => paperSchema.parse(value))
    },

    update(input) {
      return transport.call('papers.update', input).then((value) => paperSchema.parse(value))
    },

    organize(input) {
      return transport.call('papers.organize', input).then((value) => paperSchema.parse(value))
    },

    moveToInbox(input) {
      return transport.call('papers.moveToInbox', input).then((value) => paperSchema.parse(value))
    },

    remove(input) {
      return transport
        .call('papers.remove', input)
        .then((value) => deletePaperOutputSchema.parse(value))
    },
  }

  let demo: PapersService | undefined
  const pick = (): PapersService => {
    if (hasCredentials()) {
      return real
    }
    // 演示实现惰性创建，避免未登录以外场景初始化本地演示存储。
    demo ??= createDemoPapersService()
    return demo
  }

  return {
    list: (input) => pick().list(input),
    listTopics: () => pick().listTopics(),
    createTopic: (input) => pick().createTopic(input),
    get: (id) => pick().get(id),
    create: (input, callOptions) => pick().create(input, callOptions),
    resolveQuestion: (input) => pick().resolveQuestion(input),
    update: (input) => pick().update(input),
    organize: (input) => pick().organize(input),
    moveToInbox: (input) => pick().moveToInbox(input),
    remove: (input) => pick().remove(input),
  }
}

/** 未登录时的演示数据实现：复用 mock-papers，并补齐 resolveQuestion 的纸页返回。 */
function createDemoPapersService(): PapersService {
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

function toTopicSummary(topic: Topic): TopicSummary {
  return { id: topic.id, name: topic.name, color: topic.color }
}
