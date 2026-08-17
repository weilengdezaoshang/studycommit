export const TOPIC_REMOVE_KIND = {
  removed: 'removed',
  missing: 'missing',
  activeSession: 'active_session',
  versionConflict: 'version_conflict',
} as const

export type TopicRemoveKind = (typeof TOPIC_REMOVE_KIND)[keyof typeof TOPIC_REMOVE_KIND]

export const TOPIC_CREATE_KIND = {
  ok: 'ok',
  idempotencyConflict: 'idempotency_conflict',
} as const

export type TopicCreateKind = (typeof TOPIC_CREATE_KIND)[keyof typeof TOPIC_CREATE_KIND]

export const TOPIC_RESOURCE_TYPE = 'topic'
export const TOPIC_STATUS = {
  active: 'active',
  archived: 'archived',
} as const

export const TOPIC_ERROR = {
  notFound: { code: 'TOPIC_NOT_FOUND', message: '专题不存在' },
  hasActiveSession: {
    code: 'TOPIC_HAS_ACTIVE_SESSION',
    message: '该专题有正在进行或暂停的学习会话，请先结束学习',
  },
  versionConflict: { code: 'TOPIC_VERSION_CONFLICT', message: '专题版本冲突' },
} as const
