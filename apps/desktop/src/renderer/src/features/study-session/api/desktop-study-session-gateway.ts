import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  CreateTopicInput,
  LearningLog,
  LearningLogPage,
  ListLearningLogsInput,
  ListActiveTopicsInput,
  SessionCommandInput,
  StudySession,
  Topic,
  TopicPage,
  UpdateLearningLogInput,
} from '@studycommit/common/contracts'
import type {
  RemoveTopicInput,
  RemoveTopicOutput,
  UpdateTopicInput,
} from '@studycommit/common/ports'
import { createHttpError, HttpError, type SerializedHttpError } from '@studycommit/common/http'
import type {
  ConfirmPaperExplainOutput,
  PaperExplainInput,
  PaperExplainOutput,
} from '@studycommit/rpc-contracts/ai'

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedHttpError }

export interface StudySessionGateway {
  getActive(): Promise<ActiveStudySessionResponse>
  getById(sessionId: string): Promise<StudySession>
  create(input: CreateStudySessionInput): Promise<StudySession>
  pause(input: SessionCommandInput): Promise<StudySession>
  resume(input: SessionCommandInput): Promise<StudySession>
  complete(input: CompleteStudySessionInput): Promise<CompleteStudySessionResult>
}

export interface TopicGateway {
  listActive(input?: ListActiveTopicsInput): Promise<TopicPage>
  create(input: CreateTopicInput): Promise<Topic>
  update(input: UpdateTopicInput): Promise<Topic>
  remove(input: RemoveTopicInput): Promise<RemoveTopicOutput>
}

export interface LearningLogGateway {
  list(input?: ListLearningLogsInput): Promise<LearningLogPage>
  getBySession(sessionId: string): Promise<LearningLog>
  update(input: UpdateLearningLogInput): Promise<LearningLog>
}

export interface AiGateway {
  explainPaper(input: PaperExplainInput): Promise<PaperExplainOutput>
  confirmPaperExplain(input: { runId: string }): Promise<ConfirmPaperExplainOutput>
}

export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    throw new HttpError(result.error)
  }
  return result.data
}

async function invokeIpc<T>(run: () => Promise<IpcResult<T>>): Promise<T> {
  try {
    return unwrapIpcResult(await run())
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '请求层尚未就绪' })
  }
}

export function createDesktopStudySessionGateway(
  api: Window['studyCommit']['studySessions'] = window.studyCommit.studySessions,
): StudySessionGateway {
  return {
    getActive: () => invokeIpc(() => api.getActive()),
    getById: (sessionId) => invokeIpc(() => api.getById(sessionId)),
    create: (input) => invokeIpc(() => api.create(input)),
    pause: (input) => invokeIpc(() => api.pause(input)),
    resume: (input) => invokeIpc(() => api.resume(input)),
    complete: (input) => invokeIpc(() => api.complete(input)),
  }
}

export function createDesktopTopicGateway(
  api: Window['studyCommit']['topics'] = window.studyCommit.topics,
): TopicGateway {
  return {
    listActive: (input) => invokeIpc(() => api.listActive(input)),
    create: (input) => invokeIpc(() => api.create(input)),
    update: (input) => invokeIpc(() => api.update(input)),
    remove: (input) => invokeIpc(() => api.remove(input)),
  }
}

export function createDesktopLearningLogGateway(
  api: Window['studyCommit']['learningLogs'] = window.studyCommit.learningLogs,
): LearningLogGateway {
  return {
    list: (input) => invokeIpc(() => api.list(input)),
    getBySession: (sessionId) => invokeIpc(() => api.getBySession(sessionId)),
    update: (input) => invokeIpc(() => api.update(input)),
  }
}

export function createDesktopAiGateway(
  api: Window['studyCommit']['ai'] = window.studyCommit.ai,
): AiGateway {
  return {
    explainPaper: (input) => invokeIpc(() => api.explainPaper(input)),
    confirmPaperExplain: (input) => invokeIpc(() => api.confirmPaperExplain(input)),
  }
}
