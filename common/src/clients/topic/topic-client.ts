import {
  listActiveTopicsInputSchema,
  topicPageSchema,
  type ListActiveTopicsInput,
  type TopicPage,
} from '../../contracts/topic'
import type { HttpTransport } from '../../http'

export interface TopicQueryApi {
  listActive(input?: ListActiveTopicsInput): Promise<TopicPage>
}

export class TopicClient implements TopicQueryApi {
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
}
