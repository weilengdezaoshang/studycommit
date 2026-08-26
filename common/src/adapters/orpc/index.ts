import type { LearningLogApi } from '../../clients/learning-log/learning-log-client'
import type { StudySessionApi } from '../../clients/study-session/study-session-client'
import type { TopicApi } from '../../clients/topic/topic-client'
import type {
  LearningLog,
  LearningLogPage,
  ListLearningLogsInput,
  UpdateLearningLogInput,
} from '../../contracts/learning-log'
import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  SessionCommandInput,
  StudySession,
} from '../../contracts/study-session'
import type { ListActiveTopicsInput, TopicPage } from '../../contracts/topic'

type Procedure<TInput, TOutput> = (input: TInput) => Promise<TOutput>

/**
 * The smallest shape required from a generated oRPC client. The real client
 * can be injected without making the common package depend on a transport
 * implementation or on a specific oRPC link.
 */
export interface OrpcRawClient {
  studySessions: {
    start: Procedure<CreateStudySessionInput, StudySession>
    active: Procedure<void, ActiveStudySessionResponse>
    byId: Procedure<string, StudySession>
    pause: Procedure<SessionCommandInput, StudySession>
    resume: Procedure<SessionCommandInput, StudySession>
    complete: Procedure<CompleteStudySessionInput, CompleteStudySessionResult>
  }
  topics: TopicApi
  learningLogs: {
    list: Procedure<ListLearningLogsInput | undefined, LearningLogPage>
    bySession: Procedure<string, LearningLog>
    update: Procedure<UpdateLearningLogInput, LearningLog>
  }
}

export type OrpcServices = ApplicationServices

export interface ApplicationServices {
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
}

export function createOrpcServices(client: OrpcRawClient): OrpcServices {
  return {
    studySessions: {
      create: (input) => client.studySessions.start(input),
      getActive: () => client.studySessions.active(undefined),
      getById: (sessionId) => client.studySessions.byId(sessionId),
      pause: (input) => client.studySessions.pause(input),
      resume: (input) => client.studySessions.resume(input),
      complete: (input) => client.studySessions.complete(input),
    },
    topics: {
      listActive: (input?: ListActiveTopicsInput): Promise<TopicPage> =>
        client.topics.listActive(input),
    },
    learningLogs: {
      list: (input) => client.learningLogs.list(input),
      getBySession: (sessionId) => client.learningLogs.bySession(sessionId),
      update: (input) => client.learningLogs.update(input),
    },
  }
}
