/**
 * 纸页草稿运行时(SH-304):无 React 纯函数,移动端与桌面端编辑器共用。
 * 草稿以客户端 UUID(paperId)为锚:它同时充当创建纸页的幂等键,
 * 保存失败重试复用同键,保证崩溃或离线补发不会产生重复纸页。
 */

export const PAPER_CONTENT_MAX_LENGTH = 20_000
export const PAPER_QUESTION_MAX_LENGTH = 2_000
/** 与创建契约 assetUploadIds 的上限一致。 */
export const PAPER_DRAFT_MAX_ASSETS = 9

export const PAPER_DRAFT_ERROR = {
  contentRequired: '先写点什么再记下',
  contentTooLong: `正文最多 ${PAPER_CONTENT_MAX_LENGTH} 字`,
  questionTooLong: `问题最多 ${PAPER_QUESTION_MAX_LENGTH} 字`,
} as const

export interface PaperDraft {
  /** 客户端 UUID,兼作创建纸页的幂等键 */
  paperId: string
  content: string
  hasQuestion: boolean
  questionText?: string
  /** 已完成直传的上传会话 ID,创建时绑定到纸页 */
  assetUploadIds: string[]
  /**
   * 平台本地图片引用(移动端本地 URI、桌面端临时文件路径),
   * 仅用于草稿恢复时的本地预览,不进入创建载荷。
   */
  localPhotoUri?: string | null
  /** 本地时间戳(毫秒),用于展示“已保存时间” */
  updatedAt: number
  /** 保存失败次数,供重试策略与提示 */
  attempts: number
}

export type PaperDraftAction =
  | {
      type: 'start'
      paperId: string
      now: number
      initial?: Partial<Omit<PaperDraft, 'paperId' | 'updatedAt' | 'attempts'>>
    }
  | { type: 'setContent'; content: string; now: number }
  | { type: 'setQuestion'; hasQuestion: boolean; questionText?: string; now: number }
  | { type: 'attachAsset'; uploadId: string; now: number }
  | { type: 'detachAsset'; uploadId: string; now: number }
  | { type: 'setLocalPhotoUri'; uri: string | null; now: number }
  | { type: 'saveFailed'; now: number }
  | { type: 'saveSucceeded' }
  | { type: 'discard' }

/** 归一化草稿输入:trim 正文与问题文本,供校验和创建载荷统一使用。 */
export function normalizePaperDraft(draft: Pick<PaperDraft, 'content' | 'questionText'>): {
  content: string
  questionText: string
} {
  return {
    content: draft.content.trim(),
    questionText: (draft.questionText ?? '').trim(),
  }
}

/** 保存前校验:返回中文错误文案,通过时返回 null。 */
export function paperDraftValidationError(draft: PaperDraft): string | null {
  const { content, questionText } = normalizePaperDraft(draft)
  if (!content) {
    return PAPER_DRAFT_ERROR.contentRequired
  }
  if (content.length > PAPER_CONTENT_MAX_LENGTH) {
    return PAPER_DRAFT_ERROR.contentTooLong
  }
  if (questionText.length > PAPER_QUESTION_MAX_LENGTH) {
    return PAPER_DRAFT_ERROR.questionTooLong
  }
  return null
}

/** 草稿到创建纸页载荷:只包含归一化后的字段,空集合不携带。 */
export function paperCreateInputOf(draft: PaperDraft): {
  content: string
  hasQuestion: boolean
  questionText?: string
  assetUploadIds?: string[]
} {
  const { content, questionText } = normalizePaperDraft(draft)
  return {
    content,
    hasQuestion: draft.hasQuestion,
    ...(draft.hasQuestion && questionText ? { questionText } : {}),
    ...(draft.assetUploadIds.length > 0 ? { assetUploadIds: draft.assetUploadIds } : {}),
  }
}

/**
 * 草稿 reducer:编辑期保留原文便于输入,校验与归一化统一走保存前函数;
 * 保存成功清空草稿,失败保留内容并累计 attempts 供重试提示。
 */
export function createPaperDraftReducer(
  state: PaperDraft | null,
  action: PaperDraftAction,
): PaperDraft | null {
  switch (action.type) {
    case 'start': {
      if (state) {
        return state
      }
      return {
        paperId: action.paperId,
        content: action.initial?.content ?? '',
        hasQuestion: action.initial?.hasQuestion ?? false,
        questionText: action.initial?.questionText,
        assetUploadIds: action.initial?.assetUploadIds ?? [],
        localPhotoUri: action.initial?.localPhotoUri ?? null,
        updatedAt: action.now,
        attempts: 0,
      }
    }
    case 'setContent': {
      if (!state) {
        return state
      }
      return { ...state, content: action.content, updatedAt: action.now }
    }
    case 'setQuestion': {
      if (!state) {
        return state
      }
      return {
        ...state,
        hasQuestion: action.hasQuestion,
        questionText: action.hasQuestion ? (action.questionText ?? state.questionText) : undefined,
        updatedAt: action.now,
      }
    }
    case 'attachAsset': {
      if (!state || state.assetUploadIds.includes(action.uploadId)) {
        return state
      }
      if (state.assetUploadIds.length >= PAPER_DRAFT_MAX_ASSETS) {
        return state
      }
      return {
        ...state,
        assetUploadIds: [...state.assetUploadIds, action.uploadId],
        updatedAt: action.now,
      }
    }
    case 'detachAsset': {
      if (!state || !state.assetUploadIds.includes(action.uploadId)) {
        return state
      }
      return {
        ...state,
        assetUploadIds: state.assetUploadIds.filter((id) => id !== action.uploadId),
        updatedAt: action.now,
      }
    }
    case 'setLocalPhotoUri': {
      if (!state) {
        return state
      }
      return { ...state, localPhotoUri: action.uri, updatedAt: action.now }
    }
    case 'saveFailed': {
      if (!state) {
        return state
      }
      return { ...state, attempts: state.attempts + 1, updatedAt: action.now }
    }
    case 'saveSucceeded':
    case 'discard':
      return null
    default:
      return state
  }
}
