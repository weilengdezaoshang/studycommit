import type {
  LearningLog,
  LearningLogPage,
  ListLearningLogsInput,
  UpdateLearningLogInput,
} from '../contracts/learning-log'
import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  SessionCommandInput,
  StudySession,
} from '../contracts/study-session'
import type { ListActiveTopicsInput, TopicPage } from '../contracts/topic'

export interface StudySessionApi {
  create(input: CreateStudySessionInput): Promise<StudySession>
  getActive(): Promise<ActiveStudySessionResponse>
  getById(sessionId: string): Promise<StudySession>
  pause(input: SessionCommandInput): Promise<StudySession>
  resume(input: SessionCommandInput): Promise<StudySession>
  complete(input: CompleteStudySessionInput): Promise<CompleteStudySessionResult>
}

export interface TopicApi {
  listActive(input?: ListActiveTopicsInput): Promise<TopicPage>
}

/** @deprecated Use TopicApi for new code. */
export type TopicQueryApi = TopicApi

export interface LearningLogApi {
  list(input?: ListLearningLogsInput): Promise<LearningLogPage>
  getBySession(sessionId: string): Promise<LearningLog>
  update(input: UpdateLearningLogInput): Promise<LearningLog>
}

export interface ApplicationServices {
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
}
