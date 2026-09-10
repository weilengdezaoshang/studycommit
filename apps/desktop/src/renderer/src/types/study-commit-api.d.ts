import type {
  ActiveStudySessionResponse,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateStudySessionInput,
  CreatePaperInput,
  CreateTopicInput,
  DeletePaperOutput,
  LearningLog,
  LearningLogPage,
  ListLearningLogsInput,
  ListActiveTopicsInput,
  ListPapersInput,
  OrganizePaperInput,
  Paper,
  PaperCommandInput,
  PaperPage,
  SessionCommandInput,
  StudySession,
  Topic,
  TopicPage,
  UpdateLearningLogInput,
  UpdatePaperInput,
  UpdatePaperQuestionInput,
  PaperFragment,
} from '@studycommit/common/contracts'
import type {
  RemoveTopicInput,
  RemoveTopicOutput,
  UpdateTopicInput,
} from '@studycommit/common/ports'
import type { IpcResult } from '../../../main/ipc/ipc-result'

export interface StudyCommitStudySessionsApi {
  create: (input: CreateStudySessionInput) => Promise<IpcResult<StudySession>>
  getActive: () => Promise<IpcResult<ActiveStudySessionResponse>>
  getById: (sessionId: string) => Promise<IpcResult<StudySession>>
  pause: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  resume: (input: SessionCommandInput) => Promise<IpcResult<StudySession>>
  complete: (input: CompleteStudySessionInput) => Promise<IpcResult<CompleteStudySessionResult>>
  completePaper: (input: {
    sessionId: string
    version: number
    understandingText: string
    nextQuestionText?: string
    nextPaperId?: string
    idempotencyKey?: string
  }) => Promise<
    IpcResult<{
      session: StudySession
      paper: Paper
      nextPaper: Paper | null
    }>
  >
  createFragment: (input: {
    sessionId: string
    fragmentId: string
    content: string
    position?: number
    idempotencyKey?: string
  }) => Promise<IpcResult<PaperFragment>>
  pendingFragmentCount: () => Promise<IpcResult<number>>
  updateFragment: (input: {
    sessionId: string
    fragmentId: string
    version: number
    content?: string
    position?: number
    idempotencyKey?: string
  }) => Promise<IpcResult<PaperFragment>>
  listFragments: (sessionId: string) => Promise<IpcResult<{ items: PaperFragment[] }>>
}

export interface StudyCommitTopicsApi {
  listActive: (input?: ListActiveTopicsInput) => Promise<IpcResult<TopicPage>>
  create: (input: CreateTopicInput) => Promise<IpcResult<Topic>>
  update: (input: UpdateTopicInput) => Promise<IpcResult<Topic>>
  remove: (input: RemoveTopicInput) => Promise<IpcResult<RemoveTopicOutput>>
}

export interface StudyCommitPapersApi {
  list: (input?: ListPapersInput) => Promise<IpcResult<PaperPage>>
  create: (input: CreatePaperInput) => Promise<IpcResult<Paper>>
  update: (input: UpdatePaperInput) => Promise<IpcResult<Paper>>
  organize: (input: OrganizePaperInput) => Promise<IpcResult<Paper>>
  moveToInbox: (input: PaperCommandInput) => Promise<IpcResult<Paper>>
  remove: (input: PaperCommandInput) => Promise<IpcResult<DeletePaperOutput>>
  question: (input: UpdatePaperQuestionInput) => Promise<IpcResult<Paper>>
  restore: (input: PaperCommandInput) => Promise<IpcResult<Paper>>
}

export interface StudyCommitLearningLogsApi {
  list: (input?: ListLearningLogsInput) => Promise<IpcResult<LearningLogPage>>
  getBySession: (sessionId: string) => Promise<IpcResult<LearningLog>>
  update: (input: UpdateLearningLogInput) => Promise<IpcResult<LearningLog>>
}

export interface StudyCommitAiApi {
  explainPaper: (input: {
    paperId?: string
    content: string
    questionText?: string | null
    directive?: 'initial' | 'plainer' | 'alternative'
    previousViewType?: 'causal_chain' | 'contrast' | 'checklist' | 'definition_counterexample'
    round?: number
  }) => Promise<
    IpcResult<{
      view:
        | { type: 'causal_chain'; steps: { title: string; detail: string }[] }
        | { type: 'contrast'; items: { aspect: string; a: string; b: string }[] }
        | { type: 'checklist'; steps: { action: string; reason: string }[] }
        | { type: 'definition_counterexample'; definition: string; counterexample: string }
      example: string
      plainLevel: number
      model: string
      promptVersion: string
      runId: string
    }>
  >
  confirmPaperExplain: (input: { runId: string }) => Promise<IpcResult<{ confirmed: true }>>
}

export interface StudyCommitAuthApi {
  registerAccount: (input: {
    account: string
    password: string
  }) => Promise<IpcResult<{ account: string }>>
  loginAccount: (input: {
    account: string
    password: string
  }) => Promise<IpcResult<AuthVerifyPhoneOutput>>
}

export type AuthVerifyPhoneOutput = {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    status: 'active' | 'disabled' | 'merged'
  }
  tokens: { accessToken: string; refreshToken: string; expiresAt: string }
}

export type CapturePermission = 'granted' | 'denied' | 'not-needed' | 'unavailable'

export type CaptureRequestResult =
  | { status: 'completed'; captureId: string; width: number; height: number }
  | { status: 'cancelled' }
  | { status: 'permission-denied' }
  | { status: 'failed'; message: string }

export type CaptureConfirmResult = {
  captureId: string
  filePath: string
  width: number
  height: number
}

export type CaptureOverlayState = {
  imageDataUrl: string
  width: number
  height: number
  scaleFactor: number
}

export interface StudyCommitCaptureApi {
  permissionCheck: () => Promise<IpcResult<CapturePermission>>
  openPermissionSettings: () => Promise<IpcResult<{ ok: true }>>
  request: () => Promise<IpcResult<CaptureRequestResult>>
  confirm: (input: { captureId: string }) => Promise<IpcResult<CaptureConfirmResult | null>>
  cancel: (input: { captureId: string }) => Promise<IpcResult<boolean>>
  preview: (input: { captureId: string }) => Promise<IpcResult<string | null>>
  upload: (input: { captureId: string }) => Promise<IpcResult<{ uploadId: string }>>
  ocr: (input: {
    captureId: string
  }) => Promise<IpcResult<{ text: string; confidence: number | null }>>
  onRequestResult: (listener: (result: CaptureRequestResult) => void) => () => void
  overlayReady: () => Promise<IpcResult<{ ok: true }>>
  overlaySelection: (input: {
    selection: { x: number; y: number; width: number; height: number }
  }) => Promise<IpcResult<{ ok: true }>>
  overlayCancel: () => Promise<IpcResult<{ ok: true }>>
  onOverlayState: (listener: (state: CaptureOverlayState) => void) => () => void
}

export type ReviewMonthlyResult = {
  month: string
  timezone: string
  paperCount: number
  topicCount: number
  resolvedCount: number
  days: { date: string; count: number }[]
}

export type SearchQueryResult = {
  papers: { items: Paper[]; pageInfo: { hasNextPage: boolean; nextCursor: string | null } }
  topics: Array<Pick<Topic, 'id' | 'name'> & { paperCount: number }>
}

export interface StudyCommitApi {
  platform: NodeJS.Platform
  studySessions: StudyCommitStudySessionsApi
  topics: StudyCommitTopicsApi
  learningLogs: StudyCommitLearningLogsApi
  papers: StudyCommitPapersApi
  ai: StudyCommitAiApi
  auth: StudyCommitAuthApi
  capture: StudyCommitCaptureApi
  reviews: {
    monthly: (input: { month: string; timezone: string }) => Promise<IpcResult<ReviewMonthlyResult>>
  }
  search: {
    query: (input: {
      q: string
      limit?: number
      cursor?: string
    }) => Promise<IpcResult<SearchQueryResult>>
  }
  mini: { open: () => Promise<{ ok: true }>; close: () => Promise<{ ok: true }> }
}

declare global {
  interface Window {
    studyCommit: StudyCommitApi
  }
}

export {}
