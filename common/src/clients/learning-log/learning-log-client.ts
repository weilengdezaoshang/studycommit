import {
  learningLogSchema,
  learningLogPageSchema,
  listLearningLogsInputSchema,
  type LearningLogPage,
  type ListLearningLogsInput,
  updateLearningLogInputSchema,
  type LearningLog,
  type UpdateLearningLogInput,
} from '../../contracts/learning-log'
import { sessionIdSchema } from '../../contracts/study-session'
import type { HttpTransport } from '../../http'
import type { LearningLogApi } from '../../ports'

export type { LearningLogApi } from '../../ports'

export class LearningLogClient implements LearningLogApi {
  constructor(private readonly http: HttpTransport) {}

  list(rawInput?: ListLearningLogsInput): Promise<LearningLogPage> {
    const input = listLearningLogsInputSchema.parse(rawInput ?? {})
    const params = new URLSearchParams()
    if (input.page !== undefined) {
      params.set('page', String(input.page))
    }
    if (input.pageSize !== undefined) {
      params.set('pageSize', String(input.pageSize))
    }
    if (input.topicId) {
      params.set('topicId', input.topicId)
    }
    if (input.from) {
      params.set('from', input.from)
    }
    if (input.to) {
      params.set('to', input.to)
    }
    const query = params.toString()
    return this.http.request({
      method: 'GET',
      path: `/learning-logs${query ? `?${query}` : ''}`,
      responseSchema: learningLogPageSchema,
    })
  }

  getBySession(rawSessionId: string): Promise<LearningLog> {
    const sessionId = sessionIdSchema.parse(rawSessionId)
    return this.http.request({
      method: 'GET',
      path: `/study-sessions/${encodeURIComponent(sessionId)}/learning-log`,
      responseSchema: learningLogSchema,
    })
  }

  update(rawInput: UpdateLearningLogInput): Promise<LearningLog> {
    const { id, ...body } = updateLearningLogInputSchema.parse(rawInput)
    return this.http.request({
      method: 'PATCH',
      path: `/learning-logs/${encodeURIComponent(id)}`,
      body,
      responseSchema: learningLogSchema,
    })
  }
}
