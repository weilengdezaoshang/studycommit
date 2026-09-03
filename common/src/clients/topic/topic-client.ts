import {
  createTopicInputSchema,
  listActiveTopicsInputSchema,
  topicPageSchema,
  topicSchema,
  type CreateTopicInput,
  type ListActiveTopicsInput,
  type Topic,
  type TopicPage,
} from '../../contracts/topic'
import type { HttpTransport } from '../../http'
import type { TopicApi } from '../../ports'

export type { TopicApi, TopicQueryApi } from '../../ports'

export class TopicClient implements TopicApi {
  constructor(private readonly http: HttpTransport) {}

  listActive(input?: ListActiveTopicsInput): Promise<TopicPage> {
    const query = listActiveTopicsInputSchema.parse(input ?? {})
    const params = new URLSearchParams({
      status: 'active',
      limit: String(query.limit ?? 100),
    })
    if (query.cursor) {
      params.set('cursor', query.cursor)
    }
    return this.http.request({
      method: 'GET',
      path: `/topics?${params.toString()}`,
      responseSchema: topicPageSchema,
    })
  }

  create(input: CreateTopicInput): Promise<Topic> {
    return this.http.request({
      method: 'POST',
      path: '/topics',
      body: createTopicInputSchema.parse(input),
      responseSchema: topicSchema,
    })
  }
}
