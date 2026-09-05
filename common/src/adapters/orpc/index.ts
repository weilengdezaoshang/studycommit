import type { ApiOrpcClient } from './client'
import { createOrpcTopicService } from './topic-service'
import { callOrpc as call } from './errors'
import type { ApplicationServices, TopicMutationApi } from '../../ports'

export { createApiOrpcClient } from './client'
export type { ApiOrpcClient, CreateApiOrpcClientOptions, OrpcClientContext } from './client'
export { createOrpcTopicService } from './topic-service'
export { createOrpcUploadsService } from './uploads-service'
export { callOrpc, orpcToHttpError } from './errors'

export interface CreateOrpcServicesOptions {
  /** 幂等键生成器:POST 类操作(创建纸页等)自动附带。 */
  createIdempotencyKey: () => string
}

export type OrpcServices = ApplicationServices & {
  /** oRPC 契约完整实现了箱子的更新与删除,这里提供更精确的类型。 */
  topics: TopicMutationApi
}

export function createOrpcServices(
  client: ApiOrpcClient,
  options: CreateOrpcServicesOptions,
): OrpcServices {
  const topics = createOrpcTopicService(client, options.createIdempotencyKey)
  return {
    studySessions: {
      create: ({ idempotencyKey, ...body }) =>
        call(() => client.studySessions.start(body, { context: { idempotencyKey } })),
      getActive: () => call(() => client.studySessions.active(undefined, { context: {} })),
      getById: (sessionId) =>
        call(() => client.studySessions.byId({ id: sessionId }, { context: {} })),
      pause: ({ sessionId, version, idempotencyKey }) =>
        call(() =>
          client.studySessions.pause({ id: sessionId, version }, { context: { idempotencyKey } }),
        ),
      resume: ({ sessionId, version, idempotencyKey }) =>
        call(() =>
          client.studySessions.resume({ id: sessionId, version }, { context: { idempotencyKey } }),
        ),
      complete: ({ sessionId, idempotencyKey, ...body }) =>
        call(() =>
          client.studySessions.complete(
            { id: sessionId, ...body },
            { context: { idempotencyKey } },
          ),
        ),
    },
    topics,
    learningLogs: {
      list: (input) => call(() => client.learningLogs.list(input ?? {}, { context: {} })),
      getBySession: (sessionId) =>
        call(() => client.learningLogs.bySession({ sessionId }, { context: {} })),
      update: ({ id, ...body }) =>
        call(() => client.learningLogs.update({ id, ...body }, { context: {} })),
    },
    papers: {
      list: (input) => call(() => client.papers.list(input ?? {}, { context: {} })),
      create: (input, createOptions) =>
        call(() =>
          client.papers.create(input, {
            context: {
              idempotencyKey: createOptions?.idempotencyKey ?? options.createIdempotencyKey(),
            },
          }),
        ),
      update: (input) => call(() => client.papers.update(input, { context: {} })),
      organize: (input) => call(() => client.papers.organize(input, { context: {} })),
      moveToInbox: (input) => call(() => client.papers.moveToInbox(input, { context: {} })),
      remove: (input) => call(() => client.papers.remove(input, { context: {} })),
      updateQuestion: (input) => call(() => client.papers.question(input, { context: {} })),
      restore: (input) => call(() => client.papers.restore(input, { context: {} })),
    },
    ai: {
      explainPaper: (input) => call(() => client.ai.explainPaper(input, { context: {} })),
      confirmPaperExplain: (input) =>
        call(() => client.ai.confirmPaperExplain(input, { context: {} })),
    },
  }
}
