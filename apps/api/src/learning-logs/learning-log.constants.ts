export const LEARNING_LOG_KIND = {
  ok: 'ok',
  missing: 'missing',
  versionConflict: 'version_conflict',
} as const

export type LearningLogKind = (typeof LEARNING_LOG_KIND)[keyof typeof LEARNING_LOG_KIND]

export const LEARNING_LOG_ERROR = {
  notFound: { code: 'LEARNING_LOG_NOT_FOUND', message: '学习记录不存在' },
  versionConflict: { code: 'LEARNING_LOG_VERSION_CONFLICT', message: '学习记录版本冲突' },
} as const
