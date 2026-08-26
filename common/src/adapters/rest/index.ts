import { LearningLogClient } from '../../clients/learning-log/learning-log-client'
import { StudySessionClient } from '../../clients/study-session/study-session-client'
import { TopicClient } from '../../clients/topic/topic-client'
import type { HttpTransport } from '../../http'
import type { ApplicationServices } from '../../ports'

export type RestServices = ApplicationServices

/** Creates the stable business ports backed by the existing REST transport. */
export function createRestServices(transport: HttpTransport): RestServices {
  return {
    studySessions: new StudySessionClient(transport),
    topics: new TopicClient(transport),
    learningLogs: new LearningLogClient(transport),
  }
}
