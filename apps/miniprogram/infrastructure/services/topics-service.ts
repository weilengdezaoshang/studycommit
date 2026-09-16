import type { RemoveTopicOutput, TopicMutationApi } from '@studycommit/common/ports'
import type { TopicPage } from '@studycommit/common/contracts'
import { topicSchema } from '@studycommit/rpc-contracts/topics'
import { createIdempotencyKey } from '../../utils/uuid'
import type { MiniprogramTransport } from '../transport/transport.types'

export type TopicsService = TopicMutationApi

export function createTopicsService(transport: MiniprogramTransport): TopicsService {
  return {
    async listActive(input): Promise<TopicPage> {
      return transport.call('topics.list', { limit: input?.limit ?? 100 })
    },

    async create(input) {
      return transport
        .call('topics.create', input, { idempotencyKey: createIdempotencyKey() })
        .then((value) => topicSchema.parse(value))
    },

    async update(input) {
      return transport.call('topics.update', input).then((value) => topicSchema.parse(value))
    },

    async remove(input): Promise<RemoveTopicOutput> {
      return transport.call('topics.remove', input)
    },
  }
}
