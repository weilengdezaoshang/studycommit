import { createORPCClient, ORPCError } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { topicContract, type Topic as RpcTopic } from '@studycommit/rpc-contracts/topics'
import type {
  RemoveTopicInput,
  RemoveTopicOutput,
  TopicMutationApi,
  UpdateTopicInput,
} from '../../ports'
import { createApiUrl, createHttpError, httpErrorFromStatus, HttpError } from '../../http'
import type {
  CreateTopicInput,
  ListActiveTopicsInput,
  Topic,
  TopicPage,
} from '../../contracts/topic'

export interface OrpcClientContext {
  idempotencyKey?: string
}

export type TopicOrpcClient = ContractRouterClient<typeof topicContract, OrpcClientContext>

export interface CreateTopicOrpcClientOptions {
  origin: string
  apiPrefix: string
  allowInsecureHttp?: boolean
  fetchImpl?: typeof fetch
  getHeaders: () => Promise<Readonly<Record<string, string>>>
}

export function createTopicOrpcClient(options: CreateTopicOrpcClientOptions): TopicOrpcClient {
  const baseUrl = createApiUrl({
    origin: options.origin,
    apiPrefix: options.apiPrefix,
    path: '/',
    allowInsecureHttp: options.allowInsecureHttp,
  })
  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, '')
  const link = new OpenAPILink<OrpcClientContext>(topicContract, {
    url: baseUrl,
    headers: async ({ context }) => ({
      ...(await options.getHeaders()),
      ...(context.idempotencyKey ? { 'idempotency-key': context.idempotencyKey } : {}),
    }),
    ...(options.fetchImpl
      ? {
          fetch: (request, init) => options.fetchImpl!(request, init as RequestInit),
        }
      : {}),
  })
  return createORPCClient<TopicOrpcClient>(link)
}

export function createOrpcTopicService(
  client: TopicOrpcClient,
  createIdempotencyKey: () => string,
): TopicMutationApi {
  return {
    listActive: async (input?: ListActiveTopicsInput): Promise<TopicPage> => {
      const page = await callTopicProcedure(() =>
        client.list({ ...input, status: 'active' }, { context: {} }),
      )
      return {
        items: page.items.map(toPublicTopic),
        pageInfo: page.pageInfo,
      }
    },
    create: async (input: CreateTopicInput): Promise<Topic> => {
      const topic = await callTopicProcedure(() =>
        client.create(input, { context: { idempotencyKey: createIdempotencyKey() } }),
      )
      return toPublicTopic(topic)
    },
    update: async (input: UpdateTopicInput): Promise<Topic> => {
      const topic = await callTopicProcedure(() => client.update(input, { context: {} }))
      return toPublicTopic(topic)
    },
    remove: (input: RemoveTopicInput): Promise<RemoveTopicOutput> =>
      callTopicProcedure(() => client.remove(input, { context: {} })),
  }
}

async function callTopicProcedure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toTopicHttpError(error)
  }
}

function toTopicHttpError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error
  }
  if (error instanceof ORPCError) {
    return createHttpError({
      code: httpErrorFromStatus(error.status),
      message: error.message,
      status: error.status,
      backendCode: error.code,
      details: error.data ?? null,
    })
  }
  return error
}

function toPublicTopic(topic: RpcTopic): Topic {
  return {
    id: topic.id,
    userId: topic.userId,
    name: topic.name,
    description: topic.description,
    color: topic.color,
    status: topic.status,
    totalDurationSeconds: topic.totalDurationSeconds,
    version: topic.version,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
    deletedAt: topic.deletedAt,
  }
}
