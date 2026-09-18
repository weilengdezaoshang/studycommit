/** 事务事件类型:payload 只放业务 ID,禁止放入密钥与用户正文。 */
export const OUTBOX_EVENT_TYPES = {
  /** 首次验证成功创建用户;payload: {userId, provider, verifiedAt} */
  userVerified: 'auth.user_verified',
} as const

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES]

export const OUTBOX_ERROR = {
  unknownEventType: { code: 'OUTBOX_UNKNOWN_EVENT_TYPE', message: '未注册的事件类型' },
} as const

/** 投递配置:重试上限与退避基数;到达上限转 failed 等待人工/后续任务处理。 */
export const OUTBOX_DISPATCH = {
  batchSize: 20,
  maxAttempts: 12,
  backoffBaseMs: 5_000,
  intervalMs: 5_000,
} as const
