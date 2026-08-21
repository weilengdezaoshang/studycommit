import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  LearningLog,
  ListActiveTopicsInput,
  SessionCommandInput,
  StudySession,
  TopicPage,
  UpdateLearningLogInput,
} from '@studycommit/common/contracts'
import type { IpcResult } from '../../../main/ipc/ipc-result'

export interface StudyCommitStudySessionsApi {
  create: (input: CreateStudySessionInput) => Promise<IpcResult<StudySession>>
  getActive: () => Promise<IpcResult<ActiveStudySessionResponse>>
  getById: (sessionId: string) => Promise<IpcResult<StudySession>>
  pause: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  resume: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  complete: (input: CompleteStudySessionInput) => Promise<IpcResult<CompleteStudySessionResult>>
}

export interface StudyCommitTopicsApi {
  listActive: (input?: ListActiveTopicsInput) => Promise<IpcResult<TopicPage>>
}

export interface StudyCommitLearningLogsApi {
  getBySession: (sessionId: string) => Promise<IpcResult<LearningLog>>
  update: (input: UpdateLearningLogInput) => Promise<IpcResult<LearningLog>>
}

export interface StudyCommitApi {
  platform: NodeJS.Platform
  studySessions: StudyCommitStudySessionsApi
  topics: StudyCommitTopicsApi
  learningLogs: StudyCommitLearningLogsApi
}

declare global {
  interface Window {
    studyCommit: StudyCommitApi
  }
}

export {}
