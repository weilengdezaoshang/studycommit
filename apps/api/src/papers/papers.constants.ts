export const PAPER_CREATE_KIND = {
  ok: 'ok',
  idempotencyConflict: 'idempotency_conflict',
} as const

export const PAPER_RESOURCE_TYPE = 'paper'

export const PAPER_ERROR = {
  notFound: { code: 'PAPER_NOT_FOUND', message: '记录不存在' },
} as const
