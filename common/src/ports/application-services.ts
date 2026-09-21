import type { PaperKnowledge, PaperKnowledgeCommand } from '@studycommit/rpc-contracts/papers'
import type {
  LearningLog,
  LearningLogPage,
  ListLearningLogsInput,
  UpdateLearningLogInput,
} from '../contracts/learning-log'
import type {
  ActiveStudySessionResponse,
  CompletePaperInput,
  CompletePaperResult,
  CompleteStudySessionInput,
  CompleteStudySessionResult,
  CreateSessionFragmentInput,
  CreateStudySessionInput,
  PaperFragment,
  SessionCommandInput,
  StudySession,
  UpdateSessionFragmentInput,
} from '../contracts/study-session'
import type { AiApi, CampaignsApi, CreditsApi, OperationsApi } from './ai'
import type { UploadsApi } from './uploads'
import type { ReviewApi } from './review'
import type { SearchApi } from './search'
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
  UpdatePaperQuestionInput,
} from '../contracts/paper'
import type { PuzzleAlbum, PuzzleReward } from '@studycommit/rpc-contracts/puzzles'

export interface PuzzleApi {
  album(): Promise<PuzzleAlbum>
  selectArtwork(artworkId: string): Promise<PuzzleAlbum>
  reveal(rewardId: string): Promise<PuzzleReward>
  featureArtwork(artworkId: string): Promise<PuzzleAlbum>
}

export interface StudySessionApi {
  create(input: CreateStudySessionInput): Promise<StudySession>
  getActive(): Promise<ActiveStudySessionResponse>
  getById(sessionId: string): Promise<StudySession>
  pause(input: SessionCommandInput): Promise<StudySession>
  resume(input: SessionCommandInput): Promise<StudySession>
  complete(input: CompleteStudySessionInput): Promise<CompleteStudySessionResult>
  /** 纸页收尾(BE-309):回写理解文本并可选创建下一个问题 */
  completePaper(input: CompletePaperInput): Promise<CompletePaperResult>
  /** 记下一条学习片段(fragmentId 幂等) */
  createFragment(input: CreateSessionFragmentInput): Promise<PaperFragment>
  updateFragment(input: UpdateSessionFragmentInput): Promise<PaperFragment>
  listFragments(sessionId: string): Promise<PaperFragment[]>
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
  get?(id: string): Promise<Paper>
  knowledge?(id: string): Promise<PaperKnowledge>
  updateKnowledge?(input: PaperKnowledgeCommand): Promise<PaperKnowledge>
  list(input?: ListPapersInput): Promise<PaperPage>
  /**
   * 创建纸页:options.idempotencyKey 传入草稿锚点(客户端 UUID)时,
   * 失败重试复用同一键,服务端幂等去重保证不产生重复纸页;
   * 不传则由适配器生成一次性键。
   */
  create(input: CreatePaperInput, options?: { idempotencyKey?: string }): Promise<Paper>
  update(input: UpdatePaperInput): Promise<Paper>
  organize(input: OrganizePaperInput): Promise<Paper>
  moveToInbox(input: PaperCommandInput): Promise<Paper>
  remove(input: PaperCommandInput): Promise<DeletePaperOutput>
  updateQuestion(input: UpdatePaperQuestionInput): Promise<Paper>
  restore(input: PaperCommandInput): Promise<Paper>
}

export interface ApplicationServices {
  readonly credits?: CreditsApi
  readonly campaigns?: CampaignsApi
  readonly operations?: OperationsApi
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
  papers: PaperApi
  readonly puzzles?: PuzzleApi
  ai: AiApi
  /** 图片直传会话(BE-308);桌面端由主进程持令牌调用 */
  uploads: UploadsApi
  /** 月度装订统计(BE-311) */
  reviews: ReviewApi
  /** 统一搜索(BE-310) */
  search: SearchApi
}
