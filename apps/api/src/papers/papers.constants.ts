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

export const PAPER_RESOURCE_TYPE = 'paper'

export const PAPER_ERROR = {
  notFound: { code: 'PAPER_NOT_FOUND', message: '记录不存在' },
  versionConflict: { code: 'PAPER_VERSION_CONFLICT', message: '记录版本冲突' },
} as const
