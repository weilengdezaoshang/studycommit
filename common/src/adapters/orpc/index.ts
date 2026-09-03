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
import type {
  CreateTopicInput,
  ListActiveTopicsInput,
  Topic,
  TopicPage,
} from '../../contracts/topic'
import type { PaperExplainInput, PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import type {
  CreatePaperInput,
  DeletePaperOutput,
  ListPapersInput,
  OrganizePaperInput,
  Paper,
  PaperCommandInput,
  PaperPage,
  UpdatePaperInput,
} from '../../contracts/paper'
import type { ApplicationServices } from '../../ports'

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
  topics: {
    list: Procedure<ListActiveTopicsInput | undefined, TopicPage>
    create: Procedure<CreateTopicInput, Topic>
  }
  learningLogs: {
    list: Procedure<ListLearningLogsInput | undefined, LearningLogPage>
    bySession: Procedure<string, LearningLog>
    update: Procedure<UpdateLearningLogInput, LearningLog>
  }
  papers: {
    list: Procedure<ListPapersInput | undefined, PaperPage>
    create: Procedure<CreatePaperInput, Paper>
    update: Procedure<UpdatePaperInput, Paper>
    organize: Procedure<OrganizePaperInput, Paper>
    moveToInbox: Procedure<PaperCommandInput, Paper>
    remove: Procedure<PaperCommandInput, DeletePaperOutput>
  }
  ai: {
    explainPaper: Procedure<PaperExplainInput, PaperExplainOutput>
  }
}

export type OrpcServices = ApplicationServices

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
      listActive: (input?: ListActiveTopicsInput): Promise<TopicPage> => client.topics.list(input),
      create: (input: CreateTopicInput): Promise<Topic> => client.topics.create(input),
    },
    learningLogs: {
      list: (input) => client.learningLogs.list(input),
      getBySession: (sessionId) => client.learningLogs.bySession(sessionId),
      update: (input) => client.learningLogs.update(input),
    },
    papers: {
      list: (input) => client.papers.list(input),
      create: (input) => client.papers.create(input),
      update: (input) => client.papers.update(input),
      organize: (input) => client.papers.organize(input),
      moveToInbox: (input) => client.papers.moveToInbox(input),
      remove: (input) => client.papers.remove(input),
    },
    ai: {
      explainPaper: (input) => client.ai.explainPaper(input),
    },
  }
}
