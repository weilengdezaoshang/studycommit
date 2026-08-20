export const SESSION_KIND = {
  ok: 'ok',
  missing: 'missing',
  versionConflict: 'version_conflict',
  idempotencyConflict: 'idempotency_conflict',
  topicMissing: 'topic_missing',
  activeExists: 'active_exists',
  invalidTime: 'invalid_time',
  inconsistent: 'inconsistent',
} as const

export type SessionKind = (typeof SESSION_KIND)[keyof typeof SESSION_KIND]

export const SESSION_STATUS = {
  running: 'running',
  paused: 'paused',
  completed: 'completed',
} as const

export const SESSION_COMPLETION_SOURCE = {
  online: 'online',
  offlineSync: 'offline_sync',
} as const

export const SESSION_RESOURCE_TYPE = 'study_session'
export const SESSION_ONE_ACTIVE_CONSTRAINT = 'study_sessions_one_active_per_user_idx'

export const SESSION_ERROR = {
  notFound: { code: 'STUDY_SESSION_NOT_FOUND', message: '学习会话不存在' },
  versionConflict: { code: 'SESSION_VERSION_CONFLICT', message: '学习会话版本冲突' },
  activeExists: { code: 'ACTIVE_STUDY_SESSION_EXISTS', message: '当前已有进行中的学习会话' },
  invalidEndTime: { code: 'INVALID_SESSION_END_TIME', message: '结束时间不能晚于当前时间' },
  invalidEndTimeOrder: {
    code: 'INVALID_SESSION_END_TIME',
    message: '结束时间不能早于开始或暂停时间',
  },
  topicMissing: { code: 'TOPIC_NOT_FOUND', message: '专题不存在或不可用于学习' },
  learningLogInconsistent: {
    code: 'LEARNING_LOG_INCONSISTENT',
    message: '已完成的学习会话缺少学习记录',
  },
} as const
