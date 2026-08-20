import {
  learningLogSchema,
  updateLearningLogInputSchema,
  type LearningLog,
  type UpdateLearningLogInput,
} from '../../contracts/learning-log'
import { sessionIdSchema } from '../../contracts/study-session'
import type { HttpTransport } from '../../http'

export interface LearningLogApi {
  getBySession(sessionId: string): Promise<LearningLog>
  update(input: UpdateLearningLogInput): Promise<LearningLog>
}

export class LearningLogClient implements LearningLogApi {
  constructor(private readonly http: HttpTransport) {}

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
