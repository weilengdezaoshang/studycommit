import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CreateStudySessionInput,
  SessionCommandInput,
  StudySession,
} from '@studycommit/common/contracts'
import type { IpcResult } from '../../../main/ipc/ipc-result'

export interface StudyCommitStudySessionsApi {
  create: (input: CreateStudySessionInput) => Promise<IpcResult<StudySession>>
  getActive: () => Promise<IpcResult<ActiveStudySessionResponse>>
  getById: (sessionId: string) => Promise<IpcResult<StudySession>>
  pause: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  resume: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  complete: (input: CompleteStudySessionInput) => Promise<IpcResult<StudySession>>
}

export interface StudyCommitApi {
  platform: NodeJS.Platform
  studySessions: StudyCommitStudySessionsApi
}

declare global {
  interface Window {
    studyCommit: StudyCommitApi
  }
}

export {}
