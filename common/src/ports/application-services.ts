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
import type { AiApi } from './ai'
import type { CreateTopicInput, ListActiveTopicsInput, Topic, TopicPage } from '../contracts/topic'
import type {
  CreatePaperInput,
  DeletePaperOutput,
  ListPapersInput,
  OrganizePaperInput,
  Paper,
  PaperCommandInput,
  PaperPage,
  UpdatePaperInput,
} from '../contracts/paper'

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
  create(input: CreateTopicInput): Promise<Topic>
}

export interface TopicMutationApi extends TopicApi {
  update(input: UpdateTopicInput): Promise<Topic>
  remove(input: RemoveTopicInput): Promise<RemoveTopicOutput>
}

export interface UpdateTopicInput {
  id: string
  name?: string
  description?: string | null
  color?: string
  status?: 'active' | 'archived'
  version: number
}

export interface RemoveTopicInput {
  id: string
  version: number
}

export interface RemoveTopicOutput {
  id: string
  version: number
  deletedAt: string
}

/** @deprecated Use TopicApi for new code. */
export type TopicQueryApi = TopicApi

export interface LearningLogApi {
  list(input?: ListLearningLogsInput): Promise<LearningLogPage>
  getBySession(sessionId: string): Promise<LearningLog>
  update(input: UpdateLearningLogInput): Promise<LearningLog>
}

export interface PaperApi {
  list(input?: ListPapersInput): Promise<PaperPage>
  create(input: CreatePaperInput): Promise<Paper>
  update(input: UpdatePaperInput): Promise<Paper>
  organize(input: OrganizePaperInput): Promise<Paper>
  moveToInbox(input: PaperCommandInput): Promise<Paper>
  remove(input: PaperCommandInput): Promise<DeletePaperOutput>
}

export interface ApplicationServices {
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
  papers: PaperApi
  ai: AiApi
}
