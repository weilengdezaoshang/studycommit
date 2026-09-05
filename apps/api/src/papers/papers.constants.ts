export const PAPER_CREATE_KIND = {
  ok: 'ok',
  idempotencyConflict: 'idempotency_conflict',
} as const

export const PAPER_ORGANIZE_KIND = {
  ok: 'ok',
  notFound: 'not_found',
  topicNotFound: 'topic_not_found',
  topicArchived: 'topic_archived',
  versionConflict: 'version_conflict',
} as const

export type PaperOrganizeKind = (typeof PAPER_ORGANIZE_KIND)[keyof typeof PAPER_ORGANIZE_KIND]

export const PAPER_COMMAND_KIND = {
  ok: 'ok',
  notFound: 'not_found',
  versionConflict: 'version_conflict',
} as const

export type PaperCommandKind = (typeof PAPER_COMMAND_KIND)[keyof typeof PAPER_COMMAND_KIND]

export const PAPER_QUESTION_KIND = {
  ok: 'ok',
  notFound: 'not_found',
  versionConflict: 'version_conflict',
  invalidTransition: 'invalid_transition',
} as const

export type PaperQuestionKind = (typeof PAPER_QUESTION_KIND)[keyof typeof PAPER_QUESTION_KIND]

export const PAPER_RESOURCE_TYPE = 'paper'

export const PAPER_ERROR = {
  notFound: { code: 'PAPER_NOT_FOUND', message: '记录不存在' },
  versionConflict: { code: 'PAPER_VERSION_CONFLICT', message: '记录版本冲突' },
  questionTransitionInvalid: {
    code: 'PAPER_QUESTION_TRANSITION_INVALID',
    message: '问题状态不能这样切换',
  },
  questionTextRequired: {
    code: 'PAPER_QUESTION_TEXT_REQUIRED',
    message: '设置问题需要先写下问题内容',
  },
} as const
