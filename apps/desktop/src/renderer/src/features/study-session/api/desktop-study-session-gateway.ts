import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  ListActiveTopicsInput,
  SessionCommandInput,
  StudySession,
  TopicPage,
} from '@studycommit/common/contracts'
import { createHttpError, HttpError, type SerializedHttpError } from '@studycommit/common/http'

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
  }
}
