import type { ApiOrpcClient } from './client'
import { orpcToHttpError } from './errors'
import type {
  RemoveTopicInput,
  RemoveTopicOutput,
  TopicMutationApi,
  UpdateTopicInput,
} from '../../ports'
import type {
  CreateTopicInput,
  ListActiveTopicsInput,
  Topic,
  TopicPage,
} from '../../contracts/topic'
import type { Topic as RpcTopic } from '@studycommit/rpc-contracts/topics'

export function createOrpcTopicService(
  client: ApiOrpcClient,
  createIdempotencyKey: () => string,
): TopicMutationApi {
  return {
    listActive: async (input?: ListActiveTopicsInput): Promise<TopicPage> => {
      const page = await callTopicProcedure(() =>
        client.topics.list({ ...input, status: 'active' }, { context: {} }),
      )
      return {
        items: page.items.map(toPublicTopic),
        pageInfo: page.pageInfo,
      }
    },
    create: async (input: CreateTopicInput): Promise<Topic> => {
      const topic = await callTopicProcedure(() =>
        client.topics.create(input, { context: { idempotencyKey: createIdempotencyKey() } }),
      )
      return toPublicTopic(topic)
    },
    update: async (input: UpdateTopicInput): Promise<Topic> => {
      const topic = await callTopicProcedure(() => client.topics.update(input, { context: {} }))
      return toPublicTopic(topic)
    },
    remove: (input: RemoveTopicInput): Promise<RemoveTopicOutput> =>
      callTopicProcedure(() => client.topics.remove(input, { context: {} })),
  }
}

export async function callTopicProcedure<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw orpcToHttpError(error)
  }
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
